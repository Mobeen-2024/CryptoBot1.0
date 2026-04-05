import Database from 'better-sqlite3';
import { DeltaExchangeService } from './deltaExchangeService.js';
import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';
import { Server as SocketIOServer } from 'socket.io';
import EventEmitter from 'events';
import { AgenticSearchService } from './agenticSearchService.js';
import { SimulationService } from './simulationService.js';

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
  slPercent?: number; 
  tpTiersArray?: number[]; 
  entryPrice?: number;
  autoHedgeMode?: 'OFF' | 'CONDITIONAL' | 'INSTANT';
  maxDrawdownPct?: number;
  minVolatilityThreshold?: number;
}

export interface DeltaMasterState {
  isActive: boolean;
  phase: 'IDLE' | 'SYMMETRIC_DEPLOY' | 'HEDGE_ACTIVE' | 'PRINCIPAL_RECOVERY' | 'CLOSED';
  pnlA: number;
  pnlB: number;
  realizedPnLA: number;
  realizedPnLB: number;
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
    reasoningSnippet?: string;
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
    executionSpeed: number;
    heartbeat: number;
    latencyBreakdown?: {
      exchangeFetch: number;
      logicProcessing: number;
      orderExecution: number;
    };
  };
  accumulatedFees: number;
  events: { id: string; type: string; message: string; timestamp: number; metadata?: any }[];
  hedgeCooldownUntil?: number;
  intent: 'MONITORING' | 'TRADE_ARMED' | 'POSITION_ACTIVE' | 'HEDGE_ARMED' | 'HEDGING_ACTIVE';
  marginStats?: {
    accountA: { balance: number; used: number; free: number; pnlPct: number };
    accountB: { balance: number; used: number; free: number; pnlPct: number };
  };
  distanceToHedge?: number;
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
    realizedPnLA: 0,
    realizedPnLB: 0,
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
    netExposureDelta: 0,
    accumulatedFees: 0,
    events: [],
    intent: 'MONITORING',
    marginStats: {
      accountA: { balance: 1000, used: 0, free: 1000, pnlPct: 0 },
      accountB: { balance: 1000, used: 0, free: 1000, pnlPct: 0 }
    }
  };
  private dmsInterval: NodeJS.Timeout | null = null;
  private monitorInterval: NodeJS.Timeout | null = null;
  private sentimentInterval: NodeJS.Timeout | null = null;
  private config: DeltaMasterConfig | null = null;
  private sessionBalanceA: number = 1000;
  private sessionBalanceB: number = 1000;
  private priceUpdateListener: ((data: { symbol: string; price: number }) => void) | null = null;

  constructor(io?: SocketIOServer) {
    super();
    this.io = io || null;
    this.deltaService = new DeltaExchangeService();
    this.intelligenceService = IntelligenceService.getInstance();
  }

  private emitEventLog(type: string, message: string, metadata?: any) {
    const event = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      message,
      timestamp: Date.now(),
      metadata
    };
    this.state.events = [event, ...this.state.events].slice(0, 50); // Keep last 50
    Logger.info(`[DELTA_EVENTS] ${type}: ${message}`);
    this.emitStatus();
  }

  public async start(config: DeltaMasterConfig) {
    if (this.state.isActive) throw new Error('Delta Master is already active');
    
    Logger.info(`[DELTA_MASTER] Initializing Phase 9 Exposure Orchestrator for ${config.symbol}...`);
    this.config = config;
    this.state.isActive = true;
    this.state.symbol = config.symbol;
    this.state.phase = 'SYMMETRIC_DEPLOY';
    this.state.realizedPnLA = 0;
    this.state.realizedPnLB = 0;
    this.emitStatus();

    const startTime = Date.now();
    try {
      await this.deltaService.initialize();
      const ticker = await this.deltaService.fetchTicker(config.symbol);
      const currentPrice = ticker.last || 65000;
      
      const entryA = config.entryPrice || currentPrice;
      
      const intel = this.intelligenceService.getIntelligence(config.symbol);
      if (config.minVolatilityThreshold && intel?.atr && intel.atr < config.minVolatilityThreshold) {
         this.emitEventLog('system_halted', `Volatility (ATR: ${intel.atr.toFixed(2)}) is below minimum threshold (${config.minVolatilityThreshold}). Avoiding chop.`, { atr: intel.atr });
         Logger.warn(`[DELTA_MASTER] Execution aborted. Market volatility is too low.`);
         throw new Error(`Execution aborted: Market volatility too low (${intel.atr.toFixed(2)} < ${config.minVolatilityThreshold})`);
      }

      if (config.entryPrice) {
         const diffPct = Math.abs(currentPrice - config.entryPrice) / currentPrice;
         if (diffPct > 0.05) {
            this.emitEventLog('warning', `Entry price $${config.entryPrice} is >5% away from market $${currentPrice}.`, { entry: config.entryPrice, market: currentPrice });
         } else {
            this.emitEventLog('info', `Limit Entry Configured near market.`, { entry: entryA });
         }
      }

      this.state.lastPrice = currentPrice;
      this.state.entryA = entryA;
      
      const offset = config.entryOffset || 5;
      const entryB = this.intelligenceService.calculateSymmetricalOffset(entryA, offset, config.sideA);
      this.state.entryB = entryB;

      const slA = config.sideA === 'buy' ? entryA * (1 - (config.slPercent || 1.0) / 100) : entryA * (1 + (config.slPercent || 1.0) / 100);
      const lossA = Math.abs(entryA - slA) * config.qtyA;
      const gainPerUnitB = Math.abs(entryB - slA);
      const qtyB = Number((lossA / gainPerUnitB).toFixed(3));
      this.state.hedgeQty = qtyB;
      
      Logger.info(`[DELTA_MASTER] Insurance Engine Sizing: LossA=$${lossA.toFixed(2)}, EntryB=$${entryB.toFixed(2)}, SizeB=${qtyB}`);
      this.emitEventLog('system_armed', `[HEDGE_ARMED] Shield configured at ${entryB.toFixed(2)}. Dist: ${offset} USDT`, { currentPrice, slA, entryB, qtyB });

      const tpTiers = config.tpTiersArray || [2, 3, 4, 5];
      const farthest_tp_percent = tpTiers[tpTiers.length - 1];
      const tpFinal = config.sideA === 'buy' ? entryA * (1 + farthest_tp_percent / 100) : entryA * (1 - farthest_tp_percent / 100);
      
      await this.deltaService.placeBracketOrder(
        this.deltaService.getClientA(),
        config.symbol,
        config.qtyA,
        config.sideA,
        entryA,
        slA,
        tpFinal
      );

      this.emitEventLog('trade_opened', `[TRADE_OPENED] Account A ${config.sideA.toUpperCase()} @ ${entryA}`);
      await this.logShadowFill('delta_master_a', config.symbol, config.sideA, config.qtyA, entryA);

      await this.deployManagedExits();
      await this.redeployHedge();

      this.state.phase = 'HEDGE_ACTIVE';
      this.startMonitoring();
      this.startDMS();

      // Phase 9/12: Simulation Service Bridge (Managed)
      this.priceUpdateListener = async (data: { symbol: string; price: number }) => {
        if (this.state.isActive && data.symbol === this.state.symbol) {
          try {
            const [positionsA, positionsB] = await Promise.all([
              this.deltaService.fetchPositions(this.deltaService.getClientA(), this.state.symbol),
              this.deltaService.fetchPositions(this.deltaService.getClientB(), this.state.symbol)
            ]);
            await this.processTick(data.price, positionsA, positionsB);
          } catch(e) {}
        }
      };
      if (this.priceUpdateListener) {
        SimulationService.getInstance().on('price_update', this.priceUpdateListener);
      }
      
      const speed = Date.now() - startTime;
      if (this.state.telemetry) this.state.telemetry.executionSpeed = speed;
      
      Logger.info(`[DELTA_MASTER] Phase 12 Architecture Deployed in ${speed}ms!`);
    } catch (error: any) {
      Logger.error('[DELTA_MASTER] Deployment Failure:', error);
      this.stop();
      throw error;
    }
  }

  public async stop() {
    Logger.info('[DELTA_MASTER] Initiating Atomic Exit Sequence...');
    
    try {
      let currentQtyA = 0;
      let currentQtyB = 0;

      if (this.config) {
        try {
          const [positionsA, positionsB] = await Promise.all([
            this.deltaService.fetchPositions(this.deltaService.getClientA(), this.state.symbol),
            this.deltaService.fetchPositions(this.deltaService.getClientB(), this.state.symbol)
          ]);
          currentQtyA = positionsA.length > 0 ? Math.abs((positionsA[0] as any).contracts) : 0;
          currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;
        } catch (e: any) {
          Logger.warn(`[DELTA_MASTER] Fetch positions failed during stop, using config fallbacks. Error: ${e.message}`);
          currentQtyA = this.config.qtyA || 0;
          currentQtyB = this.state.intent === 'HEDGING_ACTIVE' ? this.state.hedgeQty : 0;
        }
      }

      // 1. Attempt to close all exchange orders and positions
      try {
        await this.closeAll(currentQtyA, currentQtyB);
        
        if (this.config) {
          const sideA_close = this.config.sideA === 'buy' ? 'sell' : 'buy';
          const sideB_close = this.config.sideA === 'buy' ? 'buy' : 'sell';

          if (currentQtyA > 0) {
            const closedPnlA = (this.config.sideA === 'buy' ? this.state.lastPrice - this.state.entryA : this.state.entryA - this.state.lastPrice) * currentQtyA;
            this.state.realizedPnLA += closedPnlA;
            await this.logShadowFill('delta_master_a', this.state.symbol, sideA_close, currentQtyA, this.state.lastPrice);
          }
          if (currentQtyB > 0) {
            const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
            const closedPnlB = (sideB === 'buy' ? this.state.lastPrice - this.state.entryB : this.state.entryB - this.state.lastPrice) * currentQtyB;
            this.state.realizedPnLB += closedPnlB;
            await this.logShadowFill('delta_master_b', this.state.symbol, sideB_close, currentQtyB, this.state.lastPrice);
          }
          
          this.sessionBalanceA += this.state.realizedPnLA;
          this.sessionBalanceB += this.state.realizedPnLB;
        }
      } catch (closeErr: any) {
        Logger.error(`[DELTA_MASTER] closeAll failure during stop: ${closeErr.message}`);
        this.emitEventLog('error', `Closed failed on exchange: ${closeErr.message}`);
      }
    } finally {
      // 2. Ensure state is cleared regardless of API success
      if (this.priceUpdateListener) {
      SimulationService.getInstance().off('price_update', this.priceUpdateListener);
      this.priceUpdateListener = null;
    }
    
    this.state.isActive = false;
      this.state.phase = 'CLOSED';
      this.state.intent = 'MONITORING';
      
      if (this.monitorInterval) {
        clearInterval(this.monitorInterval);
        this.monitorInterval = null;
      }
      if (this.sentimentInterval) {
        clearInterval(this.sentimentInterval);
        this.sentimentInterval = null;
      }
      if (this.dmsInterval) {
        clearInterval(this.dmsInterval);
        this.dmsInterval = null;
      }
      
      this.state.dmsStatus = 'inactive';
      
      this.emitEventLog('system_halted', 'Delta Master Agent Terminated.');
      Logger.info('[DELTA_MASTER] Sequence Terminated.');
      this.emitStatus();
    }
  }

  private async closeAll(currentQtyA: number, currentQtyB: number) {
    if (!this.config) return;
    try {
      const closeSideA = this.config.sideA === 'buy' ? 'sell' : 'buy';
      const closeSideB = this.config.sideA === 'buy' ? 'buy' : 'sell';
      const promises: Promise<any>[] = [
        this.deltaService.cancelAllOrders(this.deltaService.getClientB(), this.state.symbol),
        this.deltaService.cancelAllOrders(this.deltaService.getClientA(), this.state.symbol)
      ];
      if (currentQtyA > 0) {
        promises.push(this.deltaService.closePosition(this.deltaService.getClientA(), this.state.symbol, closeSideA, currentQtyA));
      }
      if (currentQtyB > 0) {
        promises.push(this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, closeSideB, currentQtyB));
      }
      await Promise.allSettled(promises);
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
        const tStart = performance.now();
        const tFetchStart = performance.now();
        
        const ticker = await this.deltaService.fetchTicker(this.state.symbol);
        const currentPrice = ticker.last;
        this.state.lastPrice = currentPrice;

        const [positionsA, positionsB] = await Promise.all([
           this.deltaService.fetchPositions(this.deltaService.getClientA(), this.state.symbol),
           this.deltaService.fetchPositions(this.deltaService.getClientB(), this.state.symbol)
        ]);
        
        await this.intelligenceService.fetchATR(this.deltaService.getClientA(), this.state.symbol);
        const fetchLatency = performance.now() - tFetchStart;

        await this.processTick(currentPrice, positionsA, positionsB, { tStart, tFetchStart, fetchLatency });

        const metrics = await this.deltaService.fetchLiquidityMetrics(this.state.symbol);
        const intel = await this.intelligenceService.analyzeSymbol(this.state.symbol, currentPrice, metrics.spread);
        
        this.state.intelligence = { 
          sentiment: intel.sentiment, 
          regime: intel.regime, 
          volatilityScore: intel.volatilityScore, 
          liquidityScore: intel.liquidityScore,
          atr: intel.atr,
          dynamicFriction: intel.atr ? Math.abs(this.intelligenceService.getFrictionOffset(this.config!.sideA, this.state.symbol)) : undefined,
          reasoningSnippet: intel.reasoningSnippet
        };

        const balanceB = await this.deltaService.fetchBalance(this.deltaService.getClientB());
        this.state.availableMarginB = (balanceB as any).total || 0;

        if (this.state.availableMarginB < 50 && this.state.isActive) {
           try {
              await this.deltaService.transferSubaccountFunds('master_a', 'hedge_b', 'USDT', 100);
           } catch {}
        }

        this.state.rateLimit = this.deltaService.getRateLimitStatus();
        if (!this.sentimentInterval) this.startAgenticReasoning();
        
        this.emitStatus();
      } catch (error) {
        Logger.error('[DELTA_MASTER] Monitoring Error:', error);
      }
    }, 2000);
  }

  private async processTick(currentPrice: number, positionsA: any[], positionsB: any[], telemetry?: any) {
    if (!this.state.isActive) return;
    this.state.lastPrice = currentPrice;

    const tLogicStart = performance.now();
    const currentQtyA = positionsA.length > 0 ? Math.abs((positionsA[0] as any).contracts) : 0;
    const currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;

    if (this.state.phase !== 'SYMMETRIC_DEPLOY' && currentQtyA === 0 && this.state.isActive) {
       Logger.info(`[DELTA_MASTER] Primary Position Closed. Auto-Terminating...`);
       await this.stop();
       return;
    }

    const diffA = currentPrice - this.state.entryA;
    this.state.pnlA = (this.config!.sideA === 'buy' ? diffA : -diffA) * currentQtyA;
    
    // Risk Layer: Max Drawdown
    if (this.config!.maxDrawdownPct && currentQtyA > 0) {
       const drawdownThreshold = this.state.entryA * (this.config!.maxDrawdownPct / 100); // Value of max allowed drop in price terms
       const currentDrop = this.config!.sideA === 'buy' ? this.state.entryA - currentPrice : currentPrice - this.state.entryA;
       
       if (currentDrop > drawdownThreshold) {
          this.emitEventLog('risk_breach', `Max Drawdown (${this.config!.maxDrawdownPct}%) breached. Stopping Agent.`);
          Logger.warn(`[DELTA_MASTER] Drawdown Guard Triggered. Liquidating...`);
          await this.stop();
          return;
       }
    }

    const sideB = this.config!.sideA === 'buy' ? 'sell' : 'buy';
    const sideBMult = sideB === 'buy' ? 1 : -1;
    const sideAMult = this.config!.sideA === 'buy' ? 1 : -1;
    this.state.netExposureDelta = (currentQtyA * sideAMult) + (currentQtyB * sideBMult);

    const diffB = currentPrice - this.state.entryB;
    this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * currentQtyB;
    this.state.netPnl = this.state.pnlA + this.state.pnlB;
    
    const tExecStart = performance.now();
    await this.syncTargetExposure(currentPrice, currentQtyA);

    if (this.state.hedgeStatus === 'active') {
       const friction = this.intelligenceService.getFrictionOffset(this.config!.sideA, this.state.symbol, this.config!.atrMultiplier || 1.0);
       const threshold = this.state.entryB + friction;
       const trendRecovered = this.config!.sideA === 'buy' ? currentPrice >= threshold : currentPrice <= threshold;

       if (trendRecovered) {
          this.emitEventLog('reversal_detected', `Shield Reversal. Trend recovered, closing shield.`);
          Logger.info(`[DELTA_MASTER] Shield Reversal. Closing Shield.`);
          const closeSideB = sideB === 'buy' ? 'sell' : 'buy';
          const closedPnlB = (sideB === 'buy' ? currentPrice - this.state.entryB : this.state.entryB - currentPrice) * currentQtyB;
          this.state.realizedPnLB += closedPnlB;
          await this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, closeSideB, currentQtyB);
          await this.logShadowFill('delta_master_b', this.state.symbol, closeSideB, currentQtyB, currentPrice);
          this.state.hedgeStatus = 'pending';
          // Re-arm cooldown calculation
          this.state.hedgeCooldownUntil = Date.now() + 60000; // 1 minute cooldown to prevent spam
          this.emitEventLog('system_rearmed', `Hedge Re-arming locked for 60s.`);
          await this.redeployHedge();
       }
    }

    // --- MODERN TELEMETRY INJECTION ---
    const leverage = this.config!.leverA || 10;
    const usedA = (currentQtyA * currentPrice) / leverage;
    const balanceA = this.sessionBalanceA + this.state.realizedPnLA + this.state.pnlA;
    const freeA = Math.max(0, balanceA - usedA);
    const pnlPctA = this.state.entryA > 0 ? (this.state.pnlA / (usedA || 1)) * 100 : 0;

    const usedB = (currentQtyB * currentPrice) / (this.config!.leverB || 10);
    const balanceB = this.sessionBalanceB + this.state.realizedPnLB + this.state.pnlB;
    const freeB = Math.max(0, balanceB - usedB);
    const pnlPctB = this.state.entryB > 0 ? (this.state.pnlB / (usedB || 1)) * 100 : 0;

    this.state.marginStats = {
      accountA: { balance: balanceA, used: usedA, free: freeA, pnlPct: pnlPctA },
      accountB: { balance: balanceB, used: usedB, free: freeB, pnlPct: pnlPctB }
    };

    this.state.distanceToHedge = Math.abs(currentPrice - this.state.entryB);

    // Update Intent
    if (this.state.hedgeStatus === 'active') {
      this.state.intent = 'HEDGING_ACTIVE';
    } else if (this.state.hedgeStatus === 'pending') {
      this.state.intent = 'HEDGE_ARMED';
    } else if (currentQtyA > 0) {
      this.state.intent = 'POSITION_ACTIVE';
    } else if (this.state.isActive) {
      this.state.intent = 'TRADE_ARMED';
    } else {
      this.state.intent = 'MONITORING';
    }
    // ----------------------------------

    if (this.state.tpTiers.length > 0) {
      for (const tier of this.state.tpTiers) {
        if (tier.status === 'waiting') {
          const reached = this.config!.sideA === 'buy' ? currentPrice >= tier.price : currentPrice <= tier.price;
          if (reached) {
            tier.status = 'filled';
            this.emitEventLog('tp_hit', `[TP_HIT] Tier ${tier.tier} Filled at $${currentPrice.toFixed(2)}`);
            const closeSide = this.config!.sideA === 'buy' ? 'sell' : 'buy';
            const closedPnl = (this.config!.sideA === 'buy' ? currentPrice - this.state.entryA : this.state.entryA - currentPrice) * tier.qty;
            this.state.realizedPnLA += closedPnl;
            await this.deltaService.closePosition(this.deltaService.getClientA(), this.state.symbol, closeSide, tier.qty);
            await this.logShadowFill('delta_master_a', this.state.symbol, closeSide, tier.qty, currentPrice);

            if (tier.tier === 1 && this.state.slOrder && !this.state.slOrder.isBreakEven) {
               this.state.slOrder.price = this.state.entryA;
               this.state.slOrder.isBreakEven = true;
               try {
                  await this.deltaService.editOrder(this.deltaService.getClientA(), this.state.slOrder.id, this.state.symbol, 'limit', closeSide, this.state.slOrder.qty, this.state.slOrder.price);
               } catch(e) {}
            }
          }
        }
      }
    }

    if (telemetry) {
      const execLatency = performance.now() - tExecStart;
      const logicLatency = performance.now() - tLogicStart;
      this.state.telemetry = {
        avgLatency: performance.now() - telemetry.tStart,
        executionSpeed: execLatency,
        heartbeat: Date.now(),
        latencyBreakdown: {
          exchangeFetch: telemetry.fetchLatency || 0,
          logicProcessing: logicLatency,
          orderExecution: execLatency
        }
      };
    }
    this.emitStatus();
  }

  private async deployManagedExits() {
    if (!this.config) return;
    const entry = this.state.entryA;
    const side = this.config.sideA;
    const slPct = this.config.slPercent || 1.0;
    const tpTiersData = this.config.tpTiersArray || [2, 3, 4, 5];

    this.state.tpTiers = tpTiersData.map((pct, i) => ({
      tier: i + 1,
      price: side === 'buy' ? entry * (1 + pct / 100) : entry * (1 - pct / 100),
      qty: Number((this.config!.qtyA * (1 / tpTiersData.length)).toFixed(3)),
      status: 'waiting'
    }));
    this.state.slOrder = { 
      id: 'bracket_sl', 
      price: side === 'buy' ? entry * (1 - slPct / 100) : entry * (1 + slPct / 100), 
      qty: this.config.qtyA, 
      status: 'open', 
      isBreakEven: false 
    };
  }

  private async redeployHedge() {
    if (!this.config || !this.state.isActive) return;
    
    if (this.state.hedgeCooldownUntil && Date.now() < this.state.hedgeCooldownUntil) {
       return; // Re-arm cooldown active
    }

    const mode = this.config.autoHedgeMode || 'INSTANT';
    if (mode === 'OFF') {
      this.state.hedgeStatus = 'inactive';
      return;
    }

    const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
    const intel = this.intelligenceService.getIntelligence(this.state.symbol);
    const baseOffset = this.config.entryOffset || 5;
    const dynamicOffset = intel ? this.intelligenceService.recommendOffset(baseOffset, intel, this.config.sideA) : baseOffset;
    
    this.state.entryB = this.intelligenceService.calculateSymmetricalOffset(this.state.entryA, dynamicOffset, this.config.sideA);
    
    if (mode === 'CONDITIONAL') {
       // Do not place order yet, wait until price approaches SL
       const distanceToSL = Math.abs(this.state.lastPrice - (this.state.slOrder ? this.state.slOrder.price : 0));
       const distanceToEntry = Math.abs(this.state.lastPrice - this.state.entryA);
       // Only place hedge if we are more than 50% towards SL
       if (distanceToSL > distanceToEntry) {
         this.state.hedgeStatus = 'inactive';
         return; 
       }
    }

    try {
      const orderB = await this.deltaService.placeOrder(this.deltaService.getClientB(), this.state.symbol, 'stop_limit', sideB, this.state.hedgeQty, this.state.entryB, { stopPrice: this.state.entryB, leverage: 20 });
      this.state.hedgeStatus = 'pending';
      this.state.hedgeOrderId = orderB.id || 'hedge_reentry';
      this.emitEventLog('hedge_ready', `Hedge Shield dynamically mapped to $${this.state.entryB.toFixed(2)}`);
    } catch (e) {
      Logger.error('[DELTA_MASTER] Shield Redeplyment Failure:', e);
    }
  }

  private async syncTargetExposure(markPrice: number, currentQtyA: number) {
    if (!this.config || !this.state.slOrder) return;
    
    // Auto Hedge OFF guard
    if (this.config.autoHedgeMode === 'OFF') {
       return;
    }
    
    // Re-attempt conditional hedge placement if active
    if (this.state.hedgeStatus === 'inactive' && this.config.autoHedgeMode === 'CONDITIONAL') {
       await this.redeployHedge();
    }
    
    const targetQty = this.intelligenceService.calculateRequiredHedge(markPrice, this.state.entryA, this.state.entryB, currentQtyA, this.config.sideA, this.state.slOrder.price);
    const positionsB = await this.deltaService.fetchPositions(this.deltaService.getClientB(), this.state.symbol);
    const currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;

    if (Math.abs(targetQty - currentQtyB) > 0.001) {
       const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
       if (targetQty > 0 && currentQtyB === 0) {
          this.state.hedgeStatus = 'active';
          this.emitEventLog('hedge_activated', `⚠️ Hedge Activated! Shorting $${markPrice.toFixed(2)} to protect downside.`);
          await this.logShadowFill('delta_master_b', this.state.symbol, sideB, targetQty, markPrice);
       }
    }
    if (currentQtyB > 0) this.state.hedgeStatus = 'active';
    this.state.netExposureDelta = (this.config.sideA === 'buy' ? currentQtyA : -currentQtyA) + (currentQtyB * (this.config.sideA === 'buy' ? -1 : 1));
  }

  private startAgenticReasoning() {
    const fetchReasoning = async () => {
      if (!this.state.isActive || !this.state.symbol) return;
      try {
        const headlines = await AgenticSearchService.fetchTopHeadlines(this.state.symbol);
        const news = AgenticSearchService.sanitizeNews(headlines);
        await this.intelligenceService.applyAgenticConsensus(this.state.symbol, news);
      } catch (err) {}
    };
    fetchReasoning();
    this.sentimentInterval = setInterval(fetchReasoning, 300000);
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
    if (this.io) this.io.emit('delta_master_status_' + this.state.symbol, this.state);
    this.emit('status', this.state);
  }

  private async logShadowFill(slave_id: string, symbol: string, side: string, quantity: number, price: number) {
    try {
      const db = new Database('trades.db');
      const ts = Date.now();
      const tradeId = `shadow_${ts}_${Math.random().toString(36).substring(2, 7)}`;
      const ccxtSymbol = (symbol.includes('/') || !symbol.includes('USDT')) ? symbol : symbol.replace('USDT', '/USDT');
      const fee = (quantity * price) * 0.0005;
      this.state.accumulatedFees = (this.state.accumulatedFees || 0) + fee;

      db.prepare(`INSERT INTO copied_fills_v2 (slave_id, master_trade_id, master_order_id, slave_order_id, symbol, side, quantity, price, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(slave_id, tradeId, tradeId, tradeId, ccxtSymbol, side.toLowerCase(), quantity, price, ts);
      db.close();
      
      const shadowDb = new Database('trades.db');
      const getBal = shadowDb.prepare('SELECT balance FROM shadow_balances WHERE slave_id = ? AND asset = ?');
      const parts = ccxtSymbol.split('/');
      const baseAsset = parts[0];
      const quoteAsset = parts[1] || 'USDT';

      let baseBal = (getBal.get(slave_id, baseAsset) as any)?.balance || 0;
      let quoteBal = (getBal.get(slave_id, quoteAsset) as any)?.balance || 10000;
      
      if (side.toLowerCase() === 'buy') {
        baseBal += quantity;
        quoteBal -= (quantity * price + fee);
      } else {
        baseBal -= quantity;
        quoteBal += (quantity * price - fee);
      }
      
      const upsert = shadowDb.prepare(`INSERT INTO shadow_balances (slave_id, asset, balance) VALUES (?, ?, ?) ON CONFLICT(slave_id, asset) DO UPDATE SET balance = excluded.balance`);
      upsert.run(slave_id, baseAsset, baseBal);
      upsert.run(slave_id, quoteAsset, quoteBal);
      shadowDb.close();
      
      if (this.io) {
        this.io.emit('new_trade');
        this.io.emit('balance_update');
      }
    } catch (error) {
      Logger.error(`[DELTA_MASTER] Shadow Fill Error:`, error);
    }
  }
}
