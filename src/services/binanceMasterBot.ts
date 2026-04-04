import Database from 'better-sqlite3';
import { BinanceService } from './binanceService.js';
import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';
import { Server as SocketIOServer } from 'socket.io';
import EventEmitter from 'events';
import { AgenticSearchService } from './agenticSearchService.js';

export interface BinanceMasterConfig {
  symbol: string;
  qtyA: number;
  qtyB: number;
  sideA: 'buy' | 'sell';
  entryOffset: number;
  protectionRatio: number;
  atrMultiplier?: number;
  slPercent?: number;
  tpTiersArray?: number[];
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
    reasoningSnippet?: string;
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
  private sentimentInterval: NodeJS.Timeout | null = null;
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
      
      // Log Shadow Fill for Account A
      await this.logShadowFill('binance_master_a', config.symbol, config.sideA, config.qtyA, currentPrice);

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
    const { qtyA, sideA } = this.config;
    const entry = this.state.entryA;
    const isBuy = sideA === 'buy';

    // Dynamic Stop Loss from Phase 12 Config
    const slPct = (this.config.slPercent || 1.0) / 100;
    const slPrice = isBuy ? entry * (1 - slPct) : entry * (1 + slPct);
    this.state.slOrder = { id: 'pending_sl', price: slPrice, qty: qtyA, status: 'open', isBreakEven: false };

    // Dynamic Tiered TP from Phase 12 Config — qty truncated to 3dp to prevent floating-point drift
    const tpTiers = this.config.tpTiersArray || [2, 3, 4, 5];
    this.state.tpTiers = tpTiers.map((pct, i) => ({
      tier: i + 1,
      price: isBuy ? entry * (1 + (pct/100)) : entry * (1 - (pct/100)),
      qty: Number((qtyA / tpTiers.length).toFixed(3)),
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
    Logger.info('[BINANCE_MASTER] Initiating Atomic Exit Sequence...');

    // Phase 12: Pre-fetch live position sizes BEFORE closing — avoids logging 0-contracts
    // after the exchange has already closed them (which causes the UI "trade stuck open" bug)
    let currentQtyA = 0;
    let currentQtyB = 0;

    if (this.config) {
      try {
        const [positionsA, positionsB] = await Promise.all([
          this.binanceService.fetchPositions(this.binanceService.getClientA(), this.state.symbol),
          this.binanceService.fetchPositions(this.binanceService.getClientB(), this.state.symbol)
        ]);
        currentQtyA = positionsA.length > 0 ? Math.abs((positionsA[0] as any).contracts) : 0;
        currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;
      } catch (e) {
        // Fallback: use config as upper bound if fetch fails
        currentQtyA = this.config.qtyA;
        currentQtyB = this.state.hedgeStatus === 'active' ? this.state.hedgeQty : 0;
      }
    }

    // Stop intervals first to prevent monitor loop from racing with teardown
    this.state.isActive = false;
    this.state.phase = 'CLOSED';
    this.state.hmacStatus = 'inactive';
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.sentimentInterval) clearInterval(this.sentimentInterval);
    this.monitorInterval = null;
    this.sentimentInterval = null;

    // Physical close — allSettled so a failed Account B never aborts Account A cleanup
    if (this.config) {
      const sideA_close = this.config.sideA === 'buy' ? 'sell' : 'buy';
      const sideB_close = this.config.sideA === 'buy' ? 'buy' : 'sell';

      const closeTasks: Promise<any>[] = [
        this.binanceService.cancelAllOrders(this.binanceService.getClientA(), this.state.symbol),
        this.binanceService.cancelAllOrders(this.binanceService.getClientB(), this.state.symbol)
      ];
      if (currentQtyA > 0) closeTasks.push(this.binanceService.closePosition(this.binanceService.getClientA(), this.state.symbol, sideA_close, currentQtyA));
      if (currentQtyB > 0) closeTasks.push(this.binanceService.closePosition(this.binanceService.getClientB(), this.state.symbol, sideB_close, currentQtyB));
      await Promise.allSettled(closeTasks);

      // Shadow fills use cached qty (not re-fetched) so UI registers the close
      if (currentQtyA > 0) await this.logShadowFill('binance_master_a', this.state.symbol, sideA_close, currentQtyA, this.state.lastPrice);
      if (currentQtyB > 0) await this.logShadowFill('binance_master_b', this.state.symbol, sideB_close, currentQtyB, this.state.lastPrice);
    }

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
          
          // 2. Fetch Live Positions (both accounts) for accurate PnL & dynamic sizing
          const [positionsA, positionsB] = await Promise.all([
            this.binanceService.fetchPositions(this.binanceService.getClientA(), this.state.symbol),
            this.binanceService.fetchPositions(this.binanceService.getClientB(), this.state.symbol)
          ]);
          const currentQtyA = positionsA.length > 0 ? Math.abs((positionsA[0] as any).contracts) : 0;
          const currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;

          // Phase 12: Auto-teardown if Account A is fully closed natively (all TPs hit or native SL fired)
          if (this.state.phase !== 'SYMMETRIC_DEPLOY' && currentQtyA === 0 && this.state.isActive) {
            Logger.info(`[BINANCE_MASTER] Primary Position Closed (Zero Contracts). Auto-Terminating Agent...`);
            await this.stop();
            return;
          }

          const sideB = isBuy ? 'sell' : 'buy';
          const sideBMult = sideB === 'buy' ? 1 : -1;
          const sideAMult = isBuy ? 1 : -1;

          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (isBuy ? diffA : -diffA) * currentQtyA;
          this.state.netExposureDelta = (currentQtyA * sideAMult) + (currentQtyB * sideBMult);

          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * currentQtyB;
          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // 3. State-Based Exposure Orchestration — pass live A qty for dynamic delta-neutral hedge sizing
          await this.syncTargetExposure(currentPrice, currentQtyA);

          // 4. Managed Exit Engine (TP/SL Logic)
          if (this.state.phase !== 'PRINCIPAL_RECOVERY') {
            // Check SL — closeSide is always opposite to the opening side
            const closeSideA = isBuy ? 'sell' : 'buy';
            if (this.state.slOrder && ((isBuy && currentPrice <= this.state.slOrder.price) || (!isBuy && currentPrice >= this.state.slOrder.price))) {
              Logger.info(`[BINANCE_MASTER] STOP LOSS ACTIVATED @ ${currentPrice}`);
              // Use live position size; fallback to slOrder qty if unavailable
              const slQty = this.state.slOrder.qty;
              await this.binanceService.closePosition(this.binanceService.getClientA(), this.state.symbol, closeSideA, slQty);
              await this.logShadowFill('binance_master_a', this.state.symbol, closeSideA, slQty, currentPrice);
              this.state.slOrder.status = 'filled';
              
              if (this.state.hedgeStatus === 'active') {
                this.state.phase = 'PRINCIPAL_RECOVERY';
                Logger.info('[BINANCE_MASTER] Switching to SHIELD-ONLY Momentum Mode');
              } else {
                await this.stop();
              }
              return; // Exit this tick — stop() will clean up
            }

            // Check TPs — physically close partial qty and log shadow fill
            for (const tp of this.state.tpTiers) {
              if (tp.status === 'waiting' && ((isBuy && currentPrice >= tp.price) || (!isBuy && currentPrice <= tp.price))) {
                Logger.info(`[BINANCE_MASTER] TP TIER ${tp.tier} FILLED @ ${currentPrice}. Executing partial close.`);
                tp.status = 'filled';
                await this.binanceService.closePosition(this.binanceService.getClientA(), this.state.symbol, closeSideA, tp.qty);
                await this.logShadowFill('binance_master_a', this.state.symbol, closeSideA, tp.qty, currentPrice);
                
                // After TP1: Move SL to Break-Even
                if (tp.tier === 1 && this.state.slOrder && !this.state.slOrder.isBreakEven) {
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
              const closeSideB = sideB === 'buy' ? 'sell' : 'buy';
              await this.binanceService.closePosition(this.binanceService.getClientB(), this.state.symbol, closeSideB, currentQtyB);
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
            dynamicFriction: intel.atr ? Math.abs(this.intelligenceService.getFrictionOffset(this.config.sideA, this.state.symbol)) : undefined,
            reasoningSnippet: intel.reasoningSnippet
          };

          // 7. Agentic Reasoning Heartbeat (5 min)
          if (!this.sentimentInterval) {
            this.startAgenticReasoning();
          }

          // 8. Telemetry Update
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

  /**
   * Institutional Exposure Orchestration
   * Synchronizes the physical position with the tactical target.
   * @param markPrice  Current mark price
   * @param currentQtyA Live Account A position size (shrinks as TPs are hit)
   */
  private async syncTargetExposure(markPrice: number, currentQtyA: number) {
    if (!this.config || !this.state.slOrder) return;

    // Dynamic sizing: use live A qty so hedge shrinks proportionally as TPs are hit
    const targetQty = this.intelligenceService.calculateRequiredHedge(
      markPrice,
      this.state.entryA,
      this.state.entryB,
      currentQtyA,
      this.config.sideA,
      this.state.slOrder.price
    );

    // Current Physical Hedge Position
    const positionsB = await this.binanceService.fetchPositions(this.binanceService.getClientB(), this.state.symbol);
    const currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;

    const delta = targetQty - currentQtyB;

    if (Math.abs(delta) > 0.001) {
       Logger.info(`[BINANCE_MASTER] Syncing Exposure Delta: ${delta.toFixed(3)} contracts.`);
       const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
       
       if (targetQty > 0 && currentQtyB === 0) {
          // Initial Activation
          this.state.hedgeStatus = 'active';
          await this.logShadowFill('binance_master_b', this.state.symbol, sideB, targetQty, markPrice);
       }
    }

    // Always reflect physical reality: if B has contracts, hedge is active
    if (currentQtyB > 0) this.state.hedgeStatus = 'active';

    this.state.netExposureDelta = (currentQtyA * (this.config.sideA === 'buy' ? 1 : -1)) +
                                  (currentQtyB * (this.config.sideA === 'buy' ? -1 : 1));
  }

  public getStatus() { return this.state; }

  private startAgenticReasoning() {
    const fetchReasoning = async () => {
      if (!this.state.isActive || !this.state.symbol) return;
      Logger.info(`[BINANCE_MASTER] Seeking Agentic Consensus for ${this.state.symbol}...`);
      
      try {
        const headlines = await AgenticSearchService.fetchTopHeadlines(this.state.symbol);
        const news = AgenticSearchService.sanitizeNews(headlines);
        await this.intelligenceService.applyAgenticConsensus(this.state.symbol, news);
      } catch (err) {
        Logger.error('[BINANCE_MASTER] Agentic News Fetch Failed:', err);
      }
    };

    fetchReasoning();
    this.sentimentInterval = setInterval(fetchReasoning, 300000); // 5 Minutes
  }

  private emitStatus() {
    if (this.io) this.io.emit('binance_master_status', this.state);
    this.emit('status', this.state);
  }

  private async logShadowFill(slave_id: string, symbol: string, side: string, quantity: number, price: number) {
    try {
      const db = new Database('trades.db');
      const ts = Date.now();
      const tradeId = `shadow_${ts}_${Math.random().toString(36).substring(2, 7)}`;
      const ccxtSymbol = symbol.replace('USDT', '/USDT');

      db.prepare(`
        INSERT INTO copied_fills_v2 (slave_id, master_trade_id, master_order_id, slave_order_id, symbol, side, quantity, price, timestamp) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(slave_id, tradeId, tradeId, tradeId, ccxtSymbol, side.toLowerCase(), quantity, price, ts);
      db.close();
      
      // Notify UI to refresh positions
      if (this.io) {
        this.io.emit('new_trade');
      }
    } catch (error) {
      Logger.error(`[BINANCE_MASTER] Failed to log shadow fill for ${slave_id}:`, error);
    }
  }
}
