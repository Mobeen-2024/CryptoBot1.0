import ccxt from 'ccxt';
import { Logger } from '../../logger.js';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config({ quiet: true });

export interface BotState {
  isActive: boolean;
  symbol: string;
  qty: number;
  stopLossUSDT: number;
  masterEntryPrice: number;
  slaveEntryPrice: number;
  longStopTriggered: boolean;
  shortStopTriggered: boolean;
  cycles: number;
}

export class DeltaNeutralBot {
  private masterClient: any;
  private slaveClient: any; // We only use slave_1 for this bot to exact pair 1:1
  private io: SocketIOServer | null;
  
  public state: BotState = {
    isActive: false,
    symbol: '',
    qty: 0,
    stopLossUSDT: 1,
    masterEntryPrice: 0,
    slaveEntryPrice: 0,
    longStopTriggered: false,
    shortStopTriggered: false,
    cycles: 0
  };

  private priceCheckInterval: NodeJS.Timeout | null = null;

  constructor(io?: SocketIOServer) {
    this.io = io || null;

    this.masterClient = new (ccxt as any).binance({
      apiKey: process.env.BINANCE_API_KEY || '',
      secret: (process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY) || '',
      options: { defaultType: 'spot' },
      enableRateLimit: true,
    });

    this.slaveClient = new (ccxt as any).binance({
      apiKey: process.env.BINANCE_SLAVE_API_KEY || '',
      secret: (process.env.BINANCE_SLAVE_API_SECRET || process.env.BINANCE_SLAVE_SECRET_KEY) || '',
      options: { defaultType: 'spot' },
      enableRateLimit: true,
    });

    if (process.env.BINANCE_USE_TESTNET === 'true' || process.env.BINANCE_USE_TESTNET === '1') {
      this.masterClient.setSandboxMode(true);
      this.slaveClient.setSandboxMode(true);
    }
  }

  public async start(symbol: string, qty: number, stopLossUSDT: number) {
    if (this.state.isActive) {
      throw new Error("Bot is already active");
    }

    try {
      await this.masterClient.loadMarkets();
      await this.slaveClient.loadMarkets();

      let ccxtSymbol = symbol;
      if (!ccxtSymbol.includes('/') && ccxtSymbol.endsWith('USDT')) {
        ccxtSymbol = ccxtSymbol.replace('USDT', '/USDT');
      }

      this.state.isActive = true;
      this.state.symbol = ccxtSymbol;
      this.state.qty = qty;
      this.state.stopLossUSDT = stopLossUSDT;
      this.state.cycles = 0;
      this.state.longStopTriggered = false;
      this.state.shortStopTriggered = false;

      this.emitStatus();

      await this.initiateBidirectionalEntry();
    } catch (error) {
      Logger.error("DeltaNeutralBot Start Error:", error);
      this.state.isActive = false;
      this.emitStatus();
      throw error;
    }
  }

  public async stop() {
    this.state.isActive = false;
    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);
    Logger.info("Delta Neutral Bot Aborted.");
    this.emitStatus();
  }

  public getStatus() {
    return this.state;
  }

  private emitStatus() {
    if (this.io) {
      this.io.emit('delta_neutral_status', this.state);
    }
  }

  private async initiateBidirectionalEntry() {
    if (!this.state.isActive) return;

    Logger.info(`DeltaNeutralBot: Initiating Bidirectional Entry for ${this.state.qty} ${this.state.symbol}`);

    try {
      // 1. Fetch current price to calculate tight stops accurately
      const ticker = await this.masterClient.fetchTicker(this.state.symbol);
      const currentPrice = ticker.last;

      if (!currentPrice) throw new Error("Could not fetch current price");

      // 2. Format Quantity
      const formattedQty = this.masterClient.amountToPrecision(this.state.symbol, this.state.qty);

      // 3. Execute Simultaneous MARKET orders
      const [masterOrder, slaveOrder] = await Promise.all([
        this.masterClient.createOrder(this.state.symbol, 'market', 'buy', formattedQty),
        this.slaveClient.createOrder(this.state.symbol, 'market', 'sell', formattedQty)
      ]);

      const masterExecPrice = parseFloat(masterOrder.average || masterOrder.price || currentPrice);
      const slaveExecPrice = parseFloat(slaveOrder.average || slaveOrder.price || currentPrice);

      this.state.masterEntryPrice = masterExecPrice;
      this.state.slaveEntryPrice = slaveExecPrice;

      Logger.info(`DeltaNeutralBot: Entry Success. Master Buy @ ${masterExecPrice}, Slave Sell @ ${slaveExecPrice}`);

      // 4. Calculate exactly 1 USDT price diff
      // PnL = Qty * PriceDiff => PriceDiff = PnL / Qty
      const priceOffset = this.state.stopLossUSDT / this.state.qty;
      
      const masterStopPrice = masterExecPrice - priceOffset;
      const slaveStopPrice = slaveExecPrice + priceOffset;

      Logger.info(`DeltaNeutralBot: Placing conditional STOPS. Master SL: ${masterStopPrice.toFixed(2)}, Slave SL: ${slaveStopPrice.toFixed(2)}`);

      // 5. Place native STOP_LOSS_LIMIT or STOP_MARKET orders
      // For Binance Spot, STOP_LOSS_LIMIT is common. We will simulate a local tracker for precise aggressive triggering, 
      // as Binance Spot minimum notional and stop-loss placement rules can occasionally reject micro-offsets.
      
      this.startLocalMonitoring(masterStopPrice, slaveStopPrice);
      this.state.cycles++;
      this.emitStatus();

    } catch (error) {
       Logger.error("DeltaNeutralBot Entry Failed:", error);
       this.stop();
    }
  }

  private startLocalMonitoring(masterStopPrice: number, slaveStopPrice: number) {
     if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);

     let masterStopped = false;
     let slaveStopped = false;

     // Using REST polling for high frequency local stop triggers (avoiding WebSocket complexity in this module)
     this.priceCheckInterval = setInterval(async () => {
         if (!this.state.isActive) {
            clearInterval(this.priceCheckInterval!);
            return;
         }

         try {
             // In shadow/live, pull latest ticker
             const ticker = await this.masterClient.fetchTicker(this.state.symbol);
             const currentPrice = ticker.last;

             // Check Master Long SL hit (Price dropped below SL)
             if (!masterStopped && currentPrice <= masterStopPrice) {
                 Logger.warn(`DeltaNeutralBot: [HIT] Master Long Stop-Loss Hit @ ${currentPrice}`);
                 masterStopped = true;
                 this.state.longStopTriggered = true;
                 this.emitStatus();
                 
                 // Close Master manually via Market Sell
                 const formattedQty = this.masterClient.amountToPrecision(this.state.symbol, this.state.qty);
                 await this.masterClient.createOrder(this.state.symbol, 'market', 'sell', formattedQty).catch((e:any) => Logger.error("Master SL Sell Fail", e));
             }

             // Check Slave Short SL hit (Price spiked above SL)
             if (!slaveStopped && currentPrice >= slaveStopPrice) {
                 Logger.warn(`DeltaNeutralBot: [HIT] Slave Short Stop-Loss Hit @ ${currentPrice}`);
                 slaveStopped = true;
                 this.state.shortStopTriggered = true;
                 this.emitStatus();
                 
                 // Close Slave manually via Market Buy
                 const formattedQty = this.slaveClient.amountToPrecision(this.state.symbol, this.state.qty);
                 await this.slaveClient.createOrder(this.state.symbol, 'market', 'buy', formattedQty).catch((e:any) => Logger.error("Slave SL Buy Fail", e));
             }

             // Re-Entry Logic
             if (masterStopped && !slaveStopped) {
                 // Market dropped. Slave is winning. If market reverses back UP exactly to `masterStopPrice`, re-enter!
                 if (currentPrice >= masterStopPrice) {
                     Logger.warn(`DeltaNeutralBot: [RE-ENTRY] Market reversed back to SL trigger. Re-entering Master Long.`);
                     masterStopped = false;
                     this.state.longStopTriggered = false;
                     clearInterval(this.priceCheckInterval!);
                     // We recursively call entry again purely for the stopped side? 
                     // The user requested: "re-initiates the BUY Market order with a new 1 USDT stop loss"
                     await this.reEnterMasterLong();
                 }
             } else if (slaveStopped && !masterStopped) {
                 // Market spiked. Master is winning. If market reverses back DOWN to `slaveStopPrice`, re-enter!
                 if (currentPrice <= slaveStopPrice) {
                     Logger.warn(`DeltaNeutralBot: [RE-ENTRY] Market reversed back to SL trigger. Re-entering Slave Short.`);
                     slaveStopped = false;
                     this.state.shortStopTriggered = false;
                     clearInterval(this.priceCheckInterval!);
                     await this.reEnterSlaveShort();
                 }
             }

         } catch (error) {
            Logger.error("DeltaNeutralBot Monitoring Error:", error);
         }
     }, 1000); // 1-second aggressive polling loop
  }

  private async reEnterMasterLong() {
      // Execute only Master Buy side
      try {
         const formattedQty = this.masterClient.amountToPrecision(this.state.symbol, this.state.qty);
         const order = await this.masterClient.createOrder(this.state.symbol, 'market', 'buy', formattedQty);
         
         const execPrice = parseFloat(order.average || order.price);
         this.state.masterEntryPrice = execPrice;
         
         const priceOffset = this.state.stopLossUSDT / this.state.qty;
         const newStop = execPrice - priceOffset;
         
         Logger.info(`DeltaNeutralBot: Master Re-entered @ ${execPrice}. New SL: ${newStop}`);
         
         // Resume monitoring with the old slave stop and the NEW master stop
         // Assuming Slave stop is still far out of bounds (hence why master triggered first)
         const oldSlaveSL = this.state.slaveEntryPrice + priceOffset; 
         this.state.cycles++;
         this.emitStatus();
         this.startLocalMonitoring(newStop, oldSlaveSL);

      } catch (err) {
         Logger.error("Re-entry Master failed:", err);
         this.stop();
      }
  }

  private async reEnterSlaveShort() {
      // Execute only Slave Sell side
       try {
         const formattedQty = this.slaveClient.amountToPrecision(this.state.symbol, this.state.qty);
         const order = await this.slaveClient.createOrder(this.state.symbol, 'market', 'sell', formattedQty);
         
         const execPrice = parseFloat(order.average || order.price);
         this.state.slaveEntryPrice = execPrice;
         
         const priceOffset = this.state.stopLossUSDT / this.state.qty;
         const newStop = execPrice + priceOffset;
         
         Logger.info(`DeltaNeutralBot: Slave Re-entered short @ ${execPrice}. New SL: ${newStop}`);
         
         const oldMasterSL = this.state.masterEntryPrice - priceOffset; 
         this.state.cycles++;
         this.emitStatus();
         this.startLocalMonitoring(oldMasterSL, newStop);

      } catch (err) {
         Logger.error("Re-entry Slave failed:", err);
         this.stop();
      }
  }
}
