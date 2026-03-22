import ccxt from 'ccxt';
import { Logger } from '../../logger.js';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config({ quiet: true });

export interface BotConfig {
  entryMode: 'INSTANT' | 'SCHEDULED';
  scheduleTimeStr: string;
  usePreviousDayAvg: boolean;
  customAnchorPrice: number;
  offsetType: '%' | 'USDT';
  offsetValue: number;
}

export interface BotState {
  isActive: boolean;
  symbol: string;
  qty: number;
  masterEntryPrice: number;
  slaveEntryPrice: number;
  livePnL: number;
  phase: 'IDLE' | 'SCHEDULED' | 'HEDGED' | 'ASYMMETRIC_BREAK' | 'CLOSED';
  scheduledTime?: number;
  anchorPrice?: number;
  upperGuard?: number;
  lowerGuard?: number;
}

export interface TradeLogEntry {
  timestamp: number;
  event: string;
  phase: string;
  price: number;
  pnl: number;
  details: string;
}

export class DeltaNeutralBot {
  private publicClient: any;
  private io: SocketIOServer | null;
  
  public state: BotState = {
    isActive: false, symbol: '', qty: 0,
    masterEntryPrice: 0, slaveEntryPrice: 0,
    livePnL: 0, phase: 'IDLE'
  };

  private priceCheckInterval: NodeJS.Timeout | null = null;
  private scheduleInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private config: BotConfig = {} as BotConfig;
  private tradeLog: TradeLogEntry[] = [];

  private logEvent(event: string, price: number, details: string) {
    const entry: TradeLogEntry = {
      timestamp: Date.now(),
      event,
      phase: this.state.phase,
      price,
      pnl: this.state.livePnL || 0,
      details,
    };
    this.tradeLog.push(entry);
    Logger.info(`[STRADDLE_LOG] ${event}: ${details} @ ${price}`);
  }

  public getTradeLog(): TradeLogEntry[] { return this.tradeLog; }

  constructor(io?: SocketIOServer) {
    this.io = io || null;
    this.publicClient = new (ccxt as any).binance({ enableRateLimit: true });
  }

  public async start(symbol: string, qty: number, config: BotConfig) {
    if (this.state.isActive) throw new Error("Bot is already active");

    let ccxtSymbol = symbol;
    if (!ccxtSymbol.includes('/') && ccxtSymbol.endsWith('USDT')) {
      ccxtSymbol = ccxtSymbol.replace('USDT', '/USDT');
    }

    this.state = {
      ...this.state,
      isActive: true, symbol: ccxtSymbol, qty,
      masterEntryPrice: 0, slaveEntryPrice: 0, livePnL: 0, 
      phase: config.entryMode === 'SCHEDULED' ? 'SCHEDULED' : 'IDLE'
    };
    this.config = config;
    this.tradeLog = [];

    this.emitStatus();

    if (config.entryMode === 'SCHEDULED') {
      const targetTime = new Date(config.scheduleTimeStr).getTime();
      if (isNaN(targetTime) || targetTime <= Date.now()) {
        throw new Error("Invalid or past schedule time. Cannot schedule.");
      }
      this.state.scheduledTime = targetTime;
      this.logEvent('SCHEDULED', 0, `Hedge scheduled to drop at ${new Date(targetTime).toISOString()}`);
      this.emitStatus();
      this.waitForExecution();
    } else {
      await this.executeHedge();
    }
  }

  private waitForExecution() {
    this.scheduleInterval = setInterval(async () => {
      if (!this.state.isActive) {
        clearInterval(this.scheduleInterval!);
        return;
      }
      if (this.state.scheduledTime && Date.now() >= this.state.scheduledTime) {
        clearInterval(this.scheduleInterval!);
        Logger.info("[SCHEDULE] Target time reached. Executing Phase 1 Asymmetric Hedge!");
        await this.executeHedge();
      }
    }, 500); // Check half-second for precision
  }

  private async executeHedge() {
    this.state.phase = 'HEDGED';
    this.emitStatus();
    Logger.info(`[ASYMMETRIC STRADDLE] Phase 1 Execution for ${this.state.qty} ${this.state.symbol}`);

    try {
      const ticker = await this.publicClient.fetchTicker(this.state.symbol);
      const currentPrice = ticker.last;
      if (!currentPrice) throw new Error("Could not fetch current price");

      // Calculate Anchor Price
      let anchor = this.config.customAnchorPrice;
      if (this.config.usePreviousDayAvg) {
        // Fetch 1d klines to get previous day average
        // limit 2: index 0 is yesterday, index 1 is today (current)
        const ohlcv = await this.publicClient.fetchOHLCV(this.state.symbol, '1d', undefined, 2);
        if (ohlcv && ohlcv.length >= 2) {
           const yesterday = ohlcv[0]; // [timestamp, open, high, low, close, volume]
           const high = Number(yesterday[2]);
           const low = Number(yesterday[3]);
           const close = Number(yesterday[4]);
           anchor = (high + low + close) / 3;
           Logger.info(`[PHASE 1] Calculated Previous Day Avg Anchor: $${anchor.toFixed(4)}`);
        } else {
           Logger.warn(`[PHASE 1] Failed to fetch 1d kline, falling back to current price anchor.`);
           anchor = currentPrice;
        }
      }

      this.state.anchorPrice = anchor;

      // Calculate Guards
      let offset = 0;
      if (this.config.offsetType === '%') {
        offset = anchor * (this.config.offsetValue / 100);
      } else {
        offset = this.config.offsetValue;
      }

      this.state.upperGuard = anchor + offset;
      this.state.lowerGuard = anchor - offset;

      Logger.info(`[PHASE 1] Symmetrical Entry @ ${currentPrice}`);
      Logger.info(`[PHASE 1] Anchor Pivot: ${anchor.toFixed(4)} | UpperGuard: ${this.state.upperGuard.toFixed(4)} | LowerGuard: ${this.state.lowerGuard.toFixed(4)}`);

      this.state.masterEntryPrice = currentPrice;
      this.state.slaveEntryPrice = currentPrice;
      this.state.livePnL = 0;
      this.startTime = Date.now();

      this.logEvent('ENTRY', currentPrice, `Hedged Phase 1 Lock established. Anchor: ${anchor.toFixed(2)}, UGuard: ${this.state.upperGuard.toFixed(2)}, LGuard: ${this.state.lowerGuard.toFixed(2)}`);
      this.emitStatus();
      this.startStateEngine();
    } catch (error) {
      Logger.error("Straddle Phase 1 Execution Failed:", error);
      this.stop();
    }
  }

  public async stop() {
    this.state.isActive = false;
    this.state.phase = 'CLOSED';
    this.state.scheduledTime = undefined;
    if (this.scheduleInterval) clearInterval(this.scheduleInterval);
    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);
    Logger.info("Asymmetric Bot Phase 1 Aborted.");
    this.logEvent('ABORT', 0, 'User manually killed the execution array');
    this.emitStatus();
  }

  public getStatus() { return this.state; }

  private emitStatus() {
    if (this.io) this.io.emit('delta_neutral_status', this.state);
  }

  private startStateEngine() {
    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);

    this.priceCheckInterval = setInterval(async () => {
      if (!this.state.isActive || this.state.phase !== 'HEDGED') { 
        clearInterval(this.priceCheckInterval!); 
        return; 
      }

      try {
        const ticker = await this.publicClient.fetchTicker(this.state.symbol);
        const currentPrice = ticker.last;
        if (!currentPrice) return;

        // PnL proxy calculation (Long + Short)
        const masterPnL = (currentPrice - this.state.masterEntryPrice) * this.state.qty;
        const slavePnL  = (this.state.slaveEntryPrice - currentPrice) * this.state.qty;
        this.state.livePnL = parseFloat((masterPnL + slavePnL).toFixed(4));

        // In Phase 1, we just monitor if the price breaches a guard. 
        // Breakout logic (Phase 2 & 3) will be built upon this in the future!
        if (this.state.upperGuard && currentPrice >= this.state.upperGuard) {
           this.logEvent('GUARD_BREACH', currentPrice, `Price broke upper constraint (${this.state.upperGuard.toFixed(2)}). Transitioning into Async Phase...`);
           this.state.phase = 'ASYMMETRIC_BREAK';
           this.emitStatus();
           clearInterval(this.priceCheckInterval!);
        }
        else if (this.state.lowerGuard && currentPrice <= this.state.lowerGuard) {
           this.logEvent('GUARD_BREACH', currentPrice, `Price broke lower constraint (${this.state.lowerGuard.toFixed(2)}). Transitioning into Async Phase...`);
           this.state.phase = 'ASYMMETRIC_BREAK';
           this.emitStatus();
           clearInterval(this.priceCheckInterval!);
        } else {
           this.emitStatus();
        }

      } catch (error) {
        Logger.error("State Engine Error:", error);
      }
    }, 1000);
  }
}
