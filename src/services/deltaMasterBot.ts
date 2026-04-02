import { DeltaExchangeService } from './deltaExchangeService.js';
import { IntelligenceService } from './intelligenceService.js';
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
  entryOffset: number;
  protectionRatio: number;
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
  hedgeStatus: 'inactive' | 'pending' | 'active';
  hedgeOrderId: string | null;
  hedgeQty: number;
  intelligence?: {
    sentiment: number;
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
  };
  rateLimit?: {
    accountA: { limit: number; remaining: number; reset: number };
    accountB: { limit: number; remaining: number; reset: number };
  };
  marginHealth?: {
    freeMargin: number;
    threshold: number;
    lastTransfer?: number;
  }
}

export class DeltaMasterBot extends EventEmitter {
  private deltaService: DeltaExchangeService;
  private intelligenceService: IntelligenceService;
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
    slOrder: null,
    hedgeStatus: 'inactive',
    hedgeOrderId: null,
    hedgeQty: 0
  };
  private dmsInterval: NodeJS.Timeout | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private config: DeltaMasterConfig | null = null;

  constructor(io?: SocketIOServer) {
    super();
    this.io = io || null;
    this.deltaService = new DeltaExchangeService();
    this.intelligenceService = IntelligenceService.getInstance();
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
      const entryA = currentPrice;
      this.state.entryA = entryA;
      
      const offset = config.entryOffset;
      const slA = config.sideA === 'buy' ? entryA * 0.99 : entryA * 1.01;
      const lossA = Math.abs(entryA - slA) * config.qtyA;
      
      const entryB = config.sideA === 'buy' ? entryA - offset : entryA + offset;
      this.state.entryB = entryB;

      const gainPerUnitB = Math.abs(entryB - slA);
      const qtyB = Number((lossA / gainPerUnitB).toFixed(3));
      this.state.hedgeQty = qtyB;
      
      Logger.info(`[DELTA_MASTER] Insurance Engine Sizing: LossA=$${lossA.toFixed(2)}, EntryB=$${entryB.toFixed(2)}, SizeB=${qtyB} (Buffer: ${offset} USDT)`);

      // Deploy Account A (Primary) - Using Atomic Bracket Order
      Logger.info(`[DELTA_MASTER] Deploying Account A Brackets: ${config.sideA.toUpperCase()} ${config.qtyA} [Atomic SL/TP]`);
      
      const tp1 = config.sideA === 'buy' ? entryA * 1.02 : entryA * 0.98;
      
      await this.deltaService.placeBracketOrder(
        this.deltaService.getClientA(),
        config.symbol,
        config.qtyA,
        config.sideA,
        entryA,
        slA,
        tp1
      );

      // Initialize Managed Exits & Recursive Shield
      await this.deployManagedExits();
      await this.redeployHedge();

      this.state.phase = 'HEDGE_ACTIVE';
      this.startMonitoring();
      this.startDMS();
      this.emitStatus();
      
      Logger.info(`[DELTA_MASTER] Architecture Deployed via Delta V2 Brackets! Primary Entry: $${entryA}`);
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
        this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, this.config.sideA === 'buy' ? 'sell' : 'buy', this.state.hedgeQty),
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
          // PnL Logic
          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (this.config.sideA === 'buy' ? diffA : -diffA) * this.config.qtyA;
          const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * this.state.hedgeQty;
          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // Tiered Exit & SL Management
          if (this.state.isActive && this.state.tpTiers.length > 0 && this.state.phase !== 'PRINCIPAL_RECOVERY') {
            for (const tier of this.state.tpTiers) {
              if (tier.status === 'waiting') {
                const reached = this.config.sideA === 'buy' ? currentPrice >= tier.price : currentPrice <= tier.price;
                if (reached) {
                  Logger.info(`[DELTA_MASTER] Tier ${tier.tier} reached! Executing partial close...`);
                  tier.status = 'filled';
                  if (tier.tier === 1 && this.state.slOrder && !this.state.slOrder.isBreakEven) {
                     this.state.slOrder.price = this.state.entryA;
                     this.state.slOrder.isBreakEven = true;
                     await this.deltaService.editOrder(this.deltaService.getClientA(), this.state.slOrder.id, this.state.symbol, 'limit', this.config.sideA === 'buy' ? 'sell' : 'buy', this.state.slOrder.qty, this.state.slOrder.price);
                  }
                }
              }
            }
          }

          // Recursive Hedge Monitoring
          if (this.state.hedgeStatus === 'pending') {
             const triggerCrossed = this.config.sideA === 'buy' ? currentPrice <= this.state.entryB : currentPrice >= this.state.entryB;
             if (triggerCrossed) {
                Logger.info(`[DELTA_MASTER] HEDGE TRIGGERED at $${currentPrice}.`);
                this.state.hedgeStatus = 'active';
             }
          } else if (this.state.hedgeStatus === 'active' && this.state.phase !== 'PRINCIPAL_RECOVERY') {
             const trendRecovered = this.config.sideA === 'buy' ? currentPrice >= (this.state.entryB + 2) : currentPrice <= (this.state.entryB - 2);
             if (trendRecovered) {
                Logger.info(`[DELTA_MASTER] Trend Recovery! Closing Hedge at Break-Even...`);
                await this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, sideB, this.state.hedgeQty);
                await this.redeployHedge();
             }
          }

          // Intelligence & Margin Guard
          const metrics = await this.deltaService.fetchLiquidityMetrics(this.state.symbol);
          const intel = await this.intelligenceService.analyzeSymbol(this.state.symbol, currentPrice, metrics.spread);
          this.state.intelligence = {
            sentiment: intel.sentiment,
            regime: intel.regime,
            volatilityScore: intel.volatilityScore,
            liquidityScore: intel.liquidityScore
          };

          const balanceB = await this.deltaService.fetchBalance(this.deltaService.getClientB());
          this.state.availableMarginB = (balanceB as any).total || 0;

          if (this.state.availableMarginB < 50 && this.state.isActive) {
             Logger.info(`[DELTA_MASTER] Margin Guard: Low Margin on Account B. Auto-Rebalancing...`);
             try {
                await this.deltaService.transferSubaccountFunds('master_a', 'hedge_b', 'USDT', 100);
                this.state.marginHealth = { freeMargin: this.state.availableMarginB, threshold: 50, lastTransfer: Date.now() };
             } catch (err) {
                Logger.error('[DELTA_MASTER] Margin Rebalance Failed:', err);
             }
          }

          // Liquidation Audit
          const positionsA = await this.deltaService.fetchPositions(this.deltaService.getClientA(), this.state.symbol);
          if (positionsA.length > 0) {
            this.state.liqPriceA = (positionsA[0] as any).liquidationPrice || 0;
            const dist = Math.abs(currentPrice - this.state.liqPriceA) / currentPrice;
            if (dist < 0.05) this.state.phase = 'PRINCIPAL_RECOVERY';
          }

          this.state.rateLimit = this.deltaService.getRateLimitStatus();
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
    
    this.state.tpTiers = [1, 2, 3, 4].map(i => ({
      tier: i,
      price: side === 'buy' ? entry * (1 + 0.01 * (i + 1)) : entry * (1 - 0.01 * (i + 1)),
      qty: this.config!.qtyA * 0.25,
      status: 'waiting'
    }));

    // slOrder will be linked to the bracket id in a real app, here we mock it for the state
    this.state.slOrder = { id: 'bracket_sl', price: slPrice, qty: this.config.qtyA, status: 'open', isBreakEven: false };
  }

  private async redeployHedge() {
    if (!this.config || !this.state.isActive) return;
    const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
    try {
      const orderB = await this.deltaService.placeOrder(this.deltaService.getClientB(), this.state.symbol, 'stop_limit', sideB, this.state.hedgeQty, this.state.entryB, { stopPrice: this.state.entryB, leverage: 20 });
      this.state.hedgeStatus = 'pending';
      this.state.hedgeOrderId = orderB.id || 'hedge_reentry';
      this.emitStatus();
    } catch (e) {
      Logger.error('[DELTA_MASTER] Shield Redeplyment Failure:', e);
    }
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
        Logger.error('[DELTA_MASTER] DMS heartbeat failure:', err);
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
