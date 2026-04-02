import { DeltaExchangeService } from './deltaExchangeService.js';
import { Logger } from '../../logger.js';
import { Server as SocketIOServer } from 'socket.io';
import EventEmitter from 'events';

export interface DeltaMasterConfig {
  symbol: string;
  qtyA: number;
  qtyB: number;
  sideA: 'buy' | 'sell';
  leverA: number;
  leverB: number;
  entryOffset: number; // Offset from current price for Account B
  protectionRatio: number; // Ratio of Account A's risk to cover
}

export interface DeltaMasterState {
  isActive: boolean;
  phase: 'IDLE' | 'SYMMETRIC_DEPLOY' | 'HEDGE_ACTIVE' | 'PRINCIPAL_RECOVERY' | 'CLOSED';
  pnlA: number;
  pnlB: number;
  netPnl: number;
  lastPrice: number;
  entryA: number;
  entryB: number;
  symbol: string;
  liqPriceA: number;
  hedgeRatio: number;
  availableMarginB: number;
  dmsStatus: 'active' | 'inactive';
  tpTiers: { price: number; qty: number; status: 'waiting' | 'filled'; tier: number }[];
  slOrder: { id: string; price: number; qty: number; status: 'open' | 'filled' | 'closed'; isBreakEven: boolean } | null;
}

export class DeltaMasterBot extends EventEmitter {
  private deltaService: DeltaExchangeService;
  private io: SocketIOServer | null;
  private state: DeltaMasterState = {
    isActive: false,
    phase: 'IDLE',
    pnlA: 0,
    pnlB: 0,
    netPnl: 0,
    lastPrice: 0,
    entryA: 0,
    entryB: 0,
    symbol: '',
    liqPriceA: 0,
    hedgeRatio: 1.0,
    availableMarginB: 0,
    dmsStatus: 'inactive',
    tpTiers: [],
    slOrder: null
  };
  private dmsInterval: NodeJS.Timeout | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private config: DeltaMasterConfig | null = null;

  constructor(io?: SocketIOServer) {
    super();
    this.io = io || null;
    this.deltaService = new DeltaExchangeService();
  }

  public async start(config: DeltaMasterConfig) {
    if (this.state.isActive) throw new Error('Delta Master is already active');
    
    Logger.info(`[DELTA_MASTER] Initializing Agent for ${config.symbol}...`);
    this.config = config;
    this.state.isActive = true;
    this.state.symbol = config.symbol;
    this.state.phase = 'SYMMETRIC_DEPLOY';
    this.emitStatus();

    try {
      await this.deltaService.initialize();
      const ticker = await this.deltaService.fetchTicker(config.symbol);
      const currentPrice = ticker.last || 65000;
      
      this.state.lastPrice = currentPrice;
      this.state.entryA = currentPrice;
      this.state.entryB = currentPrice + (config.sideA === 'buy' ? -config.entryOffset : config.entryOffset);

      // Deploy Account A (Primary)
      Logger.info(`[DELTA_MASTER] Deploying Account A: ${config.sideA.toUpperCase()} ${config.qtyA} @ MARKET`);
      const orderA = await this.deltaService.placeOrder(
        this.deltaService.getClientA(),
        config.symbol,
        'market',
        config.sideA,
        config.qtyA,
        undefined,
        { leverage: config.leverA }
      );
      this.state.entryA = orderA.price || currentPrice;

      // Deploy Account B (Insurance)
      const sideB = config.sideA === 'buy' ? 'sell' : 'buy';
      Logger.info(`[DELTA_MASTER] Deploying Account B Insurance: ${sideB.toUpperCase()} ${config.qtyB} @ ${this.state.entryB}`);
      
      const orderB = await this.deltaService.placeOrder(
        this.deltaService.getClientB(),
        config.symbol,
        config.entryOffset === 0 ? 'market' : 'limit',
        sideB,
        config.qtyB,
        this.state.entryB,
        { leverage: config.leverB }
      );
      this.state.entryB = orderB.price || this.state.entryB;

      this.state.phase = 'HEDGE_ACTIVE';
      await this.deployManagedExits();
      this.startMonitoring();
      this.startDMS();
      this.emitStatus();
      
      Logger.info(`[DELTA_MASTER] Architecture Deployed! Primary: $${this.state.entryA}, Hedge: $${this.state.entryB}`);
    } catch (error: any) {
      Logger.error('[DELTA_MASTER] Deployment Failure:', error);
      this.stop();
      throw error;
    }
  }

  public async stop() {
    Logger.info('[DELTA_MASTER] Initiating Atomic Exit Sequence...');
    await this.closeAll();
    
    this.state.isActive = false;
    this.state.phase = 'CLOSED';
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.dmsInterval) clearInterval(this.dmsInterval);
    this.state.dmsStatus = 'inactive';
    
    Logger.info('[DELTA_MASTER] Sequence Terminated.');
    this.emitStatus();
  }

  private async closeAll() {
    if (!this.config) return;
    try {
      const promises: Promise<any>[] = [
        this.deltaService.closePosition(this.deltaService.getClientA(), this.state.symbol, this.config.sideA, this.config.qtyA),
        this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, this.config.sideA === 'buy' ? 'sell' : 'buy', this.config.qtyB),
        this.deltaService.cancelAllOrders(this.deltaService.getClientB(), this.state.symbol),
        this.deltaService.cancelAllOrders(this.deltaService.getClientA(), this.state.symbol)
      ];
      await Promise.all(promises);
      this.state.slOrder = null;
      this.state.tpTiers = [];
      Logger.info('[DELTA_MASTER] All positions and orders cleared across A/B accounts.');
    } catch (error) {
      Logger.error('[DELTA_MASTER] Cleanup Failure:', error);
    }
  }

  private startMonitoring() {
    this.monitorInterval = setInterval(async () => {
      if (!this.state.isActive) return;
      
      try {
        const ticker = await this.deltaService.fetchTicker(this.state.symbol);
        const currentPrice = ticker.last;
        this.state.lastPrice = currentPrice;

        if (this.config) {
          // Calculate PnL A
          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (this.config.sideA === 'buy' ? diffA : -diffA) * this.config.qtyA;

          // Calculate PnL B
          const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * this.config.qtyB;

          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // -- Phase 5: Tiered Exit & SL Management --
          if (this.state.isActive && this.state.tpTiers.length > 0) {
            for (let i = 0; i < this.state.tpTiers.length; i++) {
              const tier = this.state.tpTiers[i];
              if (tier.status === 'waiting') {
                const reached = this.config.sideA === 'buy' ? currentPrice >= tier.price : currentPrice <= tier.price;
                if (reached) {
                  Logger.info(`[DELTA_MASTER] Tier ${tier.tier} reached at $${currentPrice}! Executing partial close...`);
                  tier.status = 'filled';
                  
                  // Move SL to Break-Even on Tier 1
                  if (tier.tier === 1 && this.state.slOrder && !this.state.slOrder.isBreakEven) {
                     Logger.info(`[DELTA_MASTER] TP1 Hit: Moving Stop Loss to Break-Even ($${this.state.entryA})`);
                     this.state.slOrder.price = this.state.entryA;
                     this.state.slOrder.isBreakEven = true;
                     await this.deltaService.editOrder(this.deltaService.getClientA(), this.state.slOrder.id, this.state.symbol, 'limit', this.config.sideA === 'buy' ? 'sell' : 'buy', this.state.slOrder.qty, this.state.slOrder.price);
                  }

                  // Reduce SL size by 25% of initial
                  if (this.state.slOrder) {
                     const reduction = this.config.qtyA * 0.25;
                     this.state.slOrder.qty = Math.max(0, this.state.slOrder.qty - reduction);
                     if (this.state.slOrder.qty > 0) {
                       await this.deltaService.editOrder(this.deltaService.getClientA(), this.state.slOrder.id, this.state.symbol, 'limit', this.config.sideA === 'buy' ? 'sell' : 'buy', this.state.slOrder.qty, this.state.slOrder.price);
                     } else {
                       Logger.info('[DELTA_MASTER] Full Position Exited via TPs.');
                       await this.stop();
                       return;
                     }
                  }
                }
              }
            }
            
            // Check SL fill
            if (this.state.slOrder) {
               const slHit = this.config.sideA === 'buy' ? currentPrice <= this.state.slOrder.price : currentPrice >= this.state.slOrder.price;
               if (slHit) {
                 Logger.warn(`[DELTA_MASTER] STOP LOSS HIT at $${currentPrice}. Terminating position.`);
                 await this.stop();
                 return;
               }
            }
          }

          // -- Phase 3: Margin Audit & Rebalancing --
          const balanceB = await this.deltaService.fetchBalance(this.deltaService.getClientB());
          this.state.availableMarginB = (balanceB as any).USDT?.free || 0;
          
          if (this.state.availableMarginB < 50 && this.state.isActive) {
             Logger.info(`[DELTA_MASTER] Low Margin on Account B ($${this.state.availableMarginB}). Triggering Rebalance...`);
             await this.deltaService.internalTransfer(500); 
          }

          // -- Phase 2: Liquidation & Protection Audit --
          const positionsA = await this.deltaService.fetchPositions(this.deltaService.getClientA(), this.state.symbol);
          if (positionsA.length > 0) {
            this.state.liqPriceA = positionsA[0].liquidationPrice || 0;
            const dist = Math.abs(currentPrice - this.state.liqPriceA) / currentPrice;
            if (dist < 0.05) {
              this.state.phase = 'PRINCIPAL_RECOVERY';
              Logger.warn(`[DELTA_MASTER] EMERGENCY: Account A is < 5% from liquidation!`);
              if (dist < 0.02) {
                await this.stop();
                return;
              }
            }
          }

          // Principal Protection Logic:
          if (this.state.pnlA < 0) {
            const riskCoverage = this.state.pnlB / Math.abs(this.state.pnlA);
            this.state.hedgeRatio = riskCoverage;
          }
          
          this.emitStatus();
        }
      } catch (error) {
        Logger.error('[DELTA_MASTER] Monitoring Error:', error);
      }
    }, 2000);
  }

  private async deployManagedExits() {
    if (!this.config) return;
    const entry = this.state.entryA;
    const side = this.config.sideA;

    const slPrice = side === 'buy' ? entry * 0.99 : entry * 1.01;
    const tpPrices = [
      side === 'buy' ? entry * 1.02 : entry * 0.98,
      side === 'buy' ? entry * 1.03 : entry * 0.97,
      side === 'buy' ? entry * 1.04 : entry * 0.96,
      side === 'buy' ? entry * 1.05 : entry * 0.95
    ];

    Logger.info(`[DELTA_MASTER] Deploying Advanced Exit Framework. SL: $${slPrice.toFixed(2)}, TPs: $${tpPrices[0].toFixed(2)}..$${tpPrices[3].toFixed(2)}`);

    const slRes = await this.deltaService.placeOrder(
      this.deltaService.getClientA(),
      this.state.symbol,
      'limit',
      side === 'buy' ? 'sell' : 'buy',
      this.config.qtyA,
      slPrice,
      { stopPrice: slPrice }
    );

    this.state.slOrder = {
      id: slRes.id || 'sl_sim',
      price: slPrice,
      qty: this.config.qtyA,
      status: 'open',
      isBreakEven: false
    };

    this.state.tpTiers = tpPrices.map((price, i) => ({
      tier: i + 1,
      price,
      qty: this.config!.qtyA * 0.25,
      status: 'waiting'
    }));
  }

  private startDMS() {
    const setDMS = async () => {
      try {
        await Promise.all([
          this.deltaService.setDeadMansSwitch(this.deltaService.getClientA(), 120000),
          this.deltaService.setDeadMansSwitch(this.deltaService.getClientB(), 120000)
        ]);
        this.state.dmsStatus = 'active';
        this.emitStatus();
      } catch (err) {
        Logger.error('[DELTA_MASTER] Failed to heart-beat Dead Man\'s Switch:', err);
      }
    };

    setDMS();
    this.dmsInterval = setInterval(setDMS, 60000);
  }

  public getStatus() { return this.state; }

  private emitStatus() {
    if (this.io) this.io.emit('delta_master_status', this.state);
    this.emit('status', this.state);
  }
}
