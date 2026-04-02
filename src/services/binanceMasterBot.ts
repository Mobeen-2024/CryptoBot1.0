import { BinanceService } from './binanceService.js';
import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';
import { Server as SocketIOServer } from 'socket.io';
import EventEmitter from 'events';

export interface BinanceMasterConfig {
  symbol: string;
  qtyA: number;
  qtyB: number;
  sideA: 'buy' | 'sell';
  entryOffset: number;
  protectionRatio: number;
  atrMultiplier?: number;
}

export interface BinanceMasterState {
  isActive: boolean;
  phase: 'IDLE' | 'SYMMETRIC_DEPLOY' | 'HEDGE_ACTIVE' | 'PRINCIPAL_RECOVERY' | 'CLOSED';
  pnlA: number;
  pnlB: number;
  netPnl: number;
  lastPrice: number;
  entryA: number;
  entryB: number;
  symbol: string;
  availableMarginB: number;
  hmacStatus: 'active' | 'inactive';
  tpTiers: { price: number; qty: number; status: 'waiting' | 'filled'; tier: number }[];
  slOrder: { id: string; price: number; qty: number; status: 'open' | 'filled' | 'closed'; isBreakEven: boolean } | null;
  hedgeStatus: 'inactive' | 'pending' | 'active';
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
  telemetry?: {
    avgLatency: number;
    lastSlippage?: number;
    executionSpeed: number; // ms for order placement
    heartbeat: number;
  };
}

export class BinanceMasterBot extends EventEmitter {
  private binanceService: BinanceService;
  private intelligenceService: IntelligenceService;
  private io: SocketIOServer | null;
  private state: BinanceMasterState = {
    isActive: false,
    phase: 'IDLE',
    pnlA: 0,
    pnlB: 0,
    netPnl: 0,
    lastPrice: 0,
    entryA: 0,
    entryB: 0,
    symbol: '',
    availableMarginB: 0,
    hmacStatus: 'inactive',
    tpTiers: [],
    slOrder: null,
    hedgeStatus: 'inactive',
    hedgeQty: 0,
    netExposureDelta: 0
  };
  private monitorInterval: NodeJS.Timeout | null = null;
  private config: BinanceMasterConfig | null = null;

  constructor(io?: SocketIOServer) {
    super();
    this.io = io || null;
    this.binanceService = new BinanceService();
    this.intelligenceService = IntelligenceService.getInstance();
  }

  public async start(config: BinanceMasterConfig) {
    if (this.state.isActive) throw new Error('Binance Master is already active');
    
    Logger.info(`[BINANCE_MASTER] Initializing Agent for ${config.symbol}...`);
    this.config = config;
    this.state.isActive = true;
    this.state.symbol = config.symbol;
    this.state.phase = 'SYMMETRIC_DEPLOY';
    this.emitStatus();

    const startTime = Date.now();
    try {
      await this.binanceService.initialize();
      const ticker = await this.binanceService.fetchTicker(config.symbol);
      const currentPrice = ticker.last || 65000;
      
      this.state.lastPrice = currentPrice;
      this.state.entryA = currentPrice;
      
      // Phase 8: Centralized Symmetrical Offset
      const offset = config.entryOffset || 5;
      this.state.entryB = this.intelligenceService.calculateSymmetricalOffset(currentPrice, offset, config.sideA);
      this.state.hedgeQty = config.qtyB;

      // Deploy Account A
      await this.binanceService.placeOrder(
        this.binanceService.getClientA(),
        config.symbol,
        'market',
        config.sideA,
        config.qtyA
      );

      // Initialize Managed Exits (TP/SL)
      await this.deployManagedExits();

      // Initialize Recursive Shield
      await this.redeployHedge();

      this.state.hmacStatus = 'active';
      this.state.phase = 'HEDGE_ACTIVE';
      this.startMonitoring();
      
      const speed = Date.now() - startTime;
      if (!this.state.telemetry) this.state.telemetry = { avgLatency: 0, executionSpeed: 0, heartbeat: Date.now() };
      this.state.telemetry.executionSpeed = speed;
      
      this.emitStatus();
      
      Logger.info(`[BINANCE_MASTER] Phase 9 Architecture Deployed in ${speed}ms! mission: 'Always Protected'`);
    } catch (error: any) {
      Logger.error('[BINANCE_MASTER] Deployment Failure:', error);
      this.stop();
      throw error;
    }
  }

  private async deployManagedExits() {
    if (!this.config) return;
    const { symbol, qtyA, sideA } = this.config;
    const entry = this.state.entryA;
    const isBuy = sideA === 'buy';

    // 1% Protective Stop Loss
    const slPrice = isBuy ? entry * 0.99 : entry * 1.01;
    this.state.slOrder = { id: 'pending_sl', price: slPrice, qty: qtyA, status: 'open', isBreakEven: false };

    // Tiered TP (2%, 3%, 4%, 5%) - 25% each
    const tpTiers = [0.02, 0.03, 0.04, 0.05];
    this.state.tpTiers = tpTiers.map((pct, i) => ({
      tier: i + 1,
      price: isBuy ? entry * (1 + pct) : entry * (1 - pct),
      qty: qtyA * 0.25,
      status: 'waiting'
    }));
    
    Logger.info(`[BINANCE_MASTER] Managed Exits Armed. SL: $${slPrice.toFixed(2)}`);
  }

  private async redeployHedge() {
    if (!this.config) return;
    const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
    
    // Agentic Reasoning: Calculate Dynamic Offset
    const baseOffset = this.config.entryOffset;
    let finalOffset = baseOffset;
    
    const intel = this.intelligenceService.getIntelligence(this.config.symbol);
    if (intel) {
      finalOffset = this.intelligenceService.recommendOffset(baseOffset, intel, this.config.sideA);
      this.state.entryB = this.intelligenceService.calculateSymmetricalOffset(this.state.entryA, finalOffset, this.config.sideA);
      Logger.info(`[BINANCE_MASTER] Bot Pilot: Dynamic Offset Applied: ${finalOffset} USDT`);
    }

    // Deploy Account B (Recursive Shield trigger)
    const order = await this.binanceService.placeOrder(
      this.binanceService.getClientB(),
      this.config.symbol,
      'limit',
      sideB,
      this.state.hedgeQty,
      this.state.entryB
    );

    this.state.hedgeStatus = 'pending';
    Logger.info(`[BINANCE_MASTER] Recursive Shield Triggered at $${this.state.entryB.toFixed(2)} [Offset: ${finalOffset}]`);
  }

  public async stop() {
    this.state.isActive = false;
    this.state.phase = 'CLOSED';
    this.state.hmacStatus = 'inactive';
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    
    Logger.info('[BINANCE_MASTER] Sequence Terminated.');
    this.emitStatus();
  }

  private startMonitoring() {
    this.monitorInterval = setInterval(async () => {
      if (!this.state.isActive) return;
      
      try {
        const t0 = Date.now();
        const ticker = await this.binanceService.fetchTicker(this.state.symbol);
        const lat = Date.now() - t0;
        
        if (this.state.telemetry) {
          this.state.telemetry.avgLatency = lat;
        }

        const currentPrice = ticker.last;
        this.state.lastPrice = currentPrice;

        if (this.config) {
          const isBuy = this.config.sideA === 'buy';

          // 1. ATR Update (Institutional Volatility Adjustment)
          const clientA = this.binanceService.getClientA();
          if (clientA && clientA.fetchOHLCV) {
             const ohlcv = await clientA.fetchOHLCV(this.state.symbol, '1m', undefined, 20);
             this.intelligenceService.updateATR(this.state.symbol, ohlcv);
          }
          
          // 2. Exposure & PnL Tracking
          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (isBuy ? diffA : -diffA) * this.config.qtyA;
          
          const sideB = isBuy ? 'sell' : 'buy';
          const sideBMult = sideB === 'buy' ? 1 : -1;
          const sideAMult = isBuy ? 1 : -1;

          // Fetch real positions for Account B to calculate Net Exposure
          const positionsB = await this.binanceService.fetchPositions(this.binanceService.getClientB(), this.state.symbol);
          const currentQtyB = positionsB.length > 0 ? (positionsB[0] as any).contracts : 0;
          this.state.netExposureDelta = (this.config.qtyA * sideAMult) + (currentQtyB * sideBMult);

          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * currentQtyB;
          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // 3. State-Based Exposure Sync
          const targetHedge = this.intelligenceService.calculateRequiredHedge(currentPrice, this.state.entryA, this.state.entryB, this.config.qtyA, this.config.sideA);
          if (targetHedge > 0 && this.state.hedgeStatus !== 'active') {
             this.state.hedgeStatus = 'active';
             Logger.info(`[BINANCE_MASTER] Exposure Target Initialized: ${targetHedge} contracts.`);
          }

          // 4. Managed Exit Engine (TP/SL Logic)
          if (this.state.phase !== 'PRINCIPAL_RECOVERY') {
            // Check SL
            if (this.state.slOrder && ((isBuy && currentPrice <= this.state.slOrder.price) || (!isBuy && currentPrice >= this.state.slOrder.price))) {
              Logger.info(`[BINANCE_MASTER] STOP LOSS ACTIVATED @ ${currentPrice}`);
              await this.binanceService.closePosition(this.binanceService.getClientA(), this.state.symbol, this.config.sideA, this.config.qtyA);
              this.state.slOrder.status = 'filled';
              
              if (this.state.hedgeStatus === 'active') {
                this.state.phase = 'PRINCIPAL_RECOVERY';
                Logger.info('[BINANCE_MASTER] Switching to SHIELD-ONLY Momentum Mode');
              } else {
                this.stop();
              }
            }

            // Check TPs
            for (const tp of this.state.tpTiers) {
              if (tp.status === 'waiting' && ((isBuy && currentPrice >= tp.price) || (!isBuy && currentPrice <= tp.price))) {
                Logger.info(`[BINANCE_MASTER] TP TIER ${tp.tier} FILLED @ ${currentPrice}`);
                await this.binanceService.placeOrder(this.binanceService.getClientA(), this.state.symbol, 'market', isBuy ? 'sell' : 'buy', tp.qty);
                tp.status = 'filled';
                
                // After TP1: Move SL to Break-Even
                if (tp.tier === 1 && this.state.slOrder) {
                  this.state.slOrder.price = this.state.entryA;
                  this.state.slOrder.isBreakEven = true;
                  Logger.info('[BINANCE_MASTER] Protective SL moved to Break-Even');
                }
              }
            }
          }

          // 5. Recursive Shield Logic with ATR Friction
          if (this.state.hedgeStatus === 'active' && this.state.phase !== 'PRINCIPAL_RECOVERY') {
            const friction = this.intelligenceService.getFrictionOffset(this.config.sideA, this.state.symbol, this.config.atrMultiplier || 1.0);
            const threshold = this.state.entryB + friction;
            const trendRecovered = isBuy ? currentPrice >= threshold : currentPrice <= threshold;

            if (trendRecovered) {
              Logger.info('[BINANCE_MASTER] Market Recovered via ATR Friction. Closing Shield at B/E.');
              await this.binanceService.closePosition(this.binanceService.getClientB(), this.state.symbol, sideB, currentQtyB);
              this.state.hedgeStatus = 'pending';
              await this.redeployHedge();
            }
          }

          const balanceB = await this.binanceService.fetchBalance(this.binanceService.getClientB());
          this.state.availableMarginB = (balanceB as any).USDT?.free || 0;

          // 6. Intelligence Loop
          const metrics = await this.binanceService.fetchLiquidityMetrics(this.state.symbol);
          const intel = await this.intelligenceService.analyzeSymbol(this.state.symbol, currentPrice, metrics.spread);
          this.state.intelligence = {
            sentiment: intel.sentiment,
            regime: intel.regime,
            volatilityScore: intel.volatilityScore,
            liquidityScore: intel.liquidityScore,
            atr: intel.atr,
            dynamicFriction: intel.atr ? Math.abs(this.intelligenceService.getFrictionOffset(this.config.sideA, this.state.symbol)) : undefined
          };

          // 7. Telemetry Update
          if (!this.state.telemetry) {
            this.state.telemetry = { avgLatency: 0, executionSpeed: 0, heartbeat: Date.now() };
          }
          this.state.telemetry.heartbeat = Date.now();

          this.emitStatus();
        }
      } catch (error) {
        Logger.error('[BINANCE_MASTER] Monitoring Error:', error);
      }
    }, 2000);
  }

  public getStatus() { return this.state; }

  private emitStatus() {
    if (this.io) this.io.emit('binance_master_status', this.state);
    this.emit('status', this.state);
  }
}
