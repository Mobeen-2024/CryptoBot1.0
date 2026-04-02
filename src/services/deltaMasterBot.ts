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
  atrMultiplier?: number;
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
  netExposureDelta: number;
  intelligence?: {
    sentiment: number;
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
    atr?: number;
    dynamicFriction?: number;
  };
  rateLimit?: {
    accountA: { limit: number; remaining: number; reset: number };
    accountB: { limit: number; remaining: number; reset: number };
  };
  marginHealth?: {
    freeMargin: number;
    threshold: number;
    lastTransfer?: number;
  };
  telemetry?: {
    avgLatency: number;
    lastSlippage?: number;
    executionSpeed: number; // ms for order placement
    heartbeat: number;
  };
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
    hedgeQty: 0,
    netExposureDelta: 0
  };
  private dmsInterval: NodeJS.Timeout | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private sentimentInterval: NodeJS.Timeout | null = null;
  private config: DeltaMasterConfig | null = null;

  constructor(io?: SocketIOServer) {
    super();
    this.io = io || null;
    this.deltaService = new DeltaExchangeService();
    this.intelligenceService = IntelligenceService.getInstance();
  }

  public async start(config: DeltaMasterConfig) {
    if (this.state.isActive) throw new Error('Delta Master is already active');
    
    Logger.info(`[DELTA_MASTER] Initializing Phase 9 Exposure Orchestrator for ${config.symbol}...`);
    this.config = config;
    this.state.isActive = true;
    this.state.symbol = config.symbol;
    this.state.phase = 'SYMMETRIC_DEPLOY';
    this.emitStatus();

    const startTime = Date.now();
    try {
      await this.deltaService.initialize();
      const ticker = await this.deltaService.fetchTicker(config.symbol);
      const currentPrice = ticker.last || 65000;
      
      this.state.lastPrice = currentPrice;
      const entryA = currentPrice;
      this.state.entryA = entryA;
      
      // Phase 8/9: Calculate Symmetrical Hedge Entry
      const offset = config.entryOffset || 5;
      const entryB = this.intelligenceService.calculateSymmetricalOffset(entryA, offset, config.sideA);
      this.state.entryB = entryB;

      const slA = config.sideA === 'buy' ? entryA * 0.99 : entryA * 1.01;
      const lossA = Math.abs(entryA - slA) * config.qtyA;
      const gainPerUnitB = Math.abs(entryB - slA);
      const qtyB = Number((lossA / gainPerUnitB).toFixed(3));
      this.state.hedgeQty = qtyB;
      
      Logger.info(`[DELTA_MASTER] Insurance Engine Sizing: LossA=$${lossA.toFixed(2)}, EntryB=$${entryB.toFixed(2)}, SizeB=${qtyB}`);

      // Deploy Account A Brackets
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

      await this.deployManagedExits();
      await this.redeployHedge();

      await this.deployManagedExits();
      await this.redeployHedge();

      this.state.phase = 'HEDGE_ACTIVE';
      this.startMonitoring();
      this.startDMS();
      
      const speed = Date.now() - startTime;
      if (!this.state.telemetry) this.state.telemetry = { avgLatency: 0, executionSpeed: 0, heartbeat: Date.now() };
      this.state.telemetry.executionSpeed = speed;
      
      this.emitStatus();
      
      Logger.info(`[DELTA_MASTER] Phase 9 Architecture Deployed in ${speed}ms! mission: 'Always Protected'`);
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
    if (this.sentimentInterval) clearInterval(this.sentimentInterval);
    if (this.dmsInterval) clearInterval(this.dmsInterval);
    this.state.dmsStatus = 'inactive';
    
    Logger.info('[DELTA_MASTER] Sequence Terminated.');
    this.emitStatus();
  }

  private async closeAll() {
    if (!this.config) return;
    try {
      const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
      const promises: Promise<any>[] = [
        this.deltaService.closePosition(this.deltaService.getClientA(), this.state.symbol, this.config.sideA, this.config.qtyA),
        this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, sideB, this.state.hedgeQty),
        this.deltaService.cancelAllOrders(this.deltaService.getClientB(), this.state.symbol),
        this.deltaService.cancelAllOrders(this.deltaService.getClientA(), this.state.symbol)
      ];
      await Promise.all(promises);
      this.state.slOrder = null;
      this.state.tpTiers = [];
    } catch (error) {
      Logger.error('[DELTA_MASTER] Cleanup Failure:', error);
    }
  }

  private startMonitoring() {
    this.monitorInterval = setInterval(async () => {
      if (!this.state.isActive) return;
      
      try {
        const t0 = Date.now();
        const ticker = await this.deltaService.fetchTicker(this.state.symbol);
        const lat = Date.now() - t0;
        
        if (this.state.telemetry) {
          this.state.telemetry.avgLatency = lat;
        }

        const currentPrice = ticker.last;
        this.state.lastPrice = currentPrice;

        if (this.config) {
          // 1. ATR Update (Institutional Volatility Adjustment)
          const client = this.deltaService.getClientA();
          if (client && client.fetchOHLCV) {
             const ohlcv = await client.fetchOHLCV(this.state.symbol, '1m', undefined, 20);
             this.intelligenceService.updateATR(this.state.symbol, ohlcv);
          }

          // 2. Exposure & PnL Tracking
          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (this.config.sideA === 'buy' ? diffA : -diffA) * this.config.qtyA;
          
          const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
          const sideBMult = sideB === 'buy' ? 1 : -1;
          const sideAMult = this.config.sideA === 'buy' ? 1 : -1;

          // Fetch real positions for Account B to calculate Net Exposure
          const positionsB = await this.deltaService.fetchPositions(this.deltaService.getClientB(), this.state.symbol);
          const currentQtyB = positionsB.length > 0 ? (positionsB[0] as any).contracts : 0;
          this.state.netExposureDelta = (this.config.qtyA * sideAMult) + (currentQtyB * sideBMult);

          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * currentQtyB;
          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // 3. State-Based Exposure Sync
          const targetHedge = this.intelligenceService.calculateRequiredHedge(currentPrice, this.state.entryA, this.state.entryB, this.config.qtyA, this.config.sideA);
          if (targetHedge > 0 && this.state.hedgeStatus !== 'active') {
             this.state.hedgeStatus = 'active';
             Logger.info(`[DELTA_MASTER] Exposure Target Initialized: ${targetHedge} contracts.`);
          }

          // 4. Recursive Trend Recovery with ATR Friction
          if (this.state.hedgeStatus === 'active' && this.state.phase !== 'PRINCIPAL_RECOVERY') {
             const friction = this.intelligenceService.getFrictionOffset(this.config.sideA, this.state.symbol, this.config.atrMultiplier || 1.0);
             const threshold = this.state.entryB + friction;
             const trendRecovered = this.config.sideA === 'buy' ? currentPrice >= threshold : currentPrice <= threshold;

             if (trendRecovered) {
                const t0 = Date.now();
                Logger.info(`[DELTA_MASTER] V-Reversal Detected via ATR Friction. Closing Shield at B/E.`);
                await this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, sideB, currentQtyB);
                if (this.state.telemetry) this.state.telemetry.executionSpeed = Date.now() - t0;
                
                this.state.hedgeStatus = 'pending';
                await this.redeployHedge();
             }
          }

          // 5. Managed Exit Logic
          if (this.state.isActive && this.state.tpTiers.length > 0 && this.state.phase !== 'PRINCIPAL_RECOVERY') {
            for (const tier of this.state.tpTiers) {
              if (tier.status === 'waiting') {
                const reached = this.config.sideA === 'buy' ? currentPrice >= tier.price : currentPrice <= tier.price;
                if (reached) {
                  tier.status = 'filled';
                  if (tier.tier === 1 && this.state.slOrder && !this.state.slOrder.isBreakEven) {
                     this.state.slOrder.price = this.state.entryA;
                     this.state.slOrder.isBreakEven = true;
                     await this.deltaService.editOrder(this.deltaService.getClientA(), this.state.slOrder.id, this.state.symbol, 'limit', sideB, this.state.slOrder.qty, this.state.slOrder.price);
                  }
                }
              }
            }
          }

          // 6. Intelligence & Margin Guard Heartbeat
          const metrics = await this.deltaService.fetchLiquidityMetrics(this.state.symbol);
          const intel = await this.intelligenceService.analyzeSymbol(this.state.symbol, currentPrice, metrics.spread);
          this.state.intelligence = { 
            sentiment: intel.sentiment, 
            regime: intel.regime, 
            volatilityScore: intel.volatilityScore, 
            liquidityScore: intel.liquidityScore,
            atr: intel.atr,
            dynamicFriction: intel.atr ? Math.abs(this.intelligenceService.getFrictionOffset(this.config.sideA, this.state.symbol)) : undefined
          };

          const balanceB = await this.deltaService.fetchBalance(this.deltaService.getClientB());
          this.state.availableMarginB = (balanceB as any).total || 0;

          if (this.state.availableMarginB < 50 && this.state.isActive) {
             try {
                await this.deltaService.transferSubaccountFunds('master_a', 'hedge_b', 'USDT', 100);
                this.state.marginHealth = { freeMargin: this.state.availableMarginB, threshold: 50, lastTransfer: Date.now() };
             } catch {}
          }

          this.state.rateLimit = this.deltaService.getRateLimitStatus();
          
          // 7. Telemetry Update
          if (!this.state.telemetry) {
            this.state.telemetry = { avgLatency: 0, executionSpeed: 0, heartbeat: Date.now() };
          }
          this.state.telemetry.heartbeat = Date.now();

          // 8. Agentic Reasoning Cooldown (Run every 5 min if not already started)
          if (!this.sentimentInterval) {
            this.startAgenticReasoning();
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
    this.state.tpTiers = [1, 2, 3, 4].map(i => ({
      tier: i,
      price: side === 'buy' ? entry * (1 + 0.01 * (i + 1)) : entry * (1 - 0.01 * (i + 1)),
      qty: this.config!.qtyA * 0.25,
      status: 'waiting'
    }));
    this.state.slOrder = { id: 'bracket_sl', price: side === 'buy' ? entry * 0.99 : entry * 1.01, qty: this.config.qtyA, status: 'open', isBreakEven: false };
  }

  private async redeployHedge() {
    if (!this.config || !this.state.isActive) return;
    const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
    const intel = this.intelligenceService.getIntelligence(this.state.symbol);
    
    // Dynamic Offset Modulation based on Agentic Sentiment & ATR
    const baseOffset = this.config.entryOffset || 5;
    const dynamicOffset = intel ? this.intelligenceService.recommendOffset(baseOffset, intel, this.config.sideA) : baseOffset;
    
    this.state.entryB = this.intelligenceService.calculateSymmetricalOffset(this.state.entryA, dynamicOffset, this.config.sideA);
    
    try {
      const t0 = Date.now();
      const orderB = await this.deltaService.placeOrder(this.deltaService.getClientB(), this.state.symbol, 'stop_limit', sideB, this.state.hedgeQty, this.state.entryB, { stopPrice: this.state.entryB, leverage: 20 });
      if (this.state.telemetry) this.state.telemetry.executionSpeed = Date.now() - t0;
      
      this.state.hedgeStatus = 'pending';
      this.state.hedgeOrderId = orderB.id || 'hedge_reentry';
    } catch (e) {
      Logger.error('[DELTA_MASTER] Shield Redeplyment Failure:', e);
    }
  }

  private startAgenticReasoning() {
    const fetchReasoning = async () => {
      if (!this.state.isActive || !this.state.symbol) return;
      Logger.info(`[DELTA_MASTER] Seeking Agentic Consensus for ${this.state.symbol}...`);
      
      // Phase 11: In a real world scenario, we'd fetch actual news/data here.
      // For Phase 11, we pass the current price context to Gemini.
      const context = `Current Price: $${this.state.lastPrice}. Momentum is ${this.state.pnlA >= 0 ? 'Positive' : 'Negative'}. ATR: ${this.state.intelligence?.atr || 'Unknown'}.`;
      await this.intelligenceService.applyAgenticConsensus(this.state.symbol, context);
    };

    fetchReasoning();
    this.sentimentInterval = setInterval(fetchReasoning, 300000); // 5 Minutes
  }

  private startDMS() {
    const setDMS = async () => {
      try {
        await Promise.all([
          this.deltaService.setDeadMansSwitch(this.deltaService.getClientA(), 120000),
          this.deltaService.setDeadMansSwitch(this.deltaService.getClientB(), 120000)
        ]);
        this.state.dmsStatus = 'active';
      } catch {}
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
