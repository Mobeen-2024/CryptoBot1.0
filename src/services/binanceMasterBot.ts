import Database from 'better-sqlite3';
import { BinanceService } from './binanceService.js';
import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';
import { Server as SocketIOServer } from 'socket.io';
import EventEmitter from 'events';
import { AgenticSearchService } from './agenticSearchService.js';
import { SimulationService } from './simulationService.js';

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
    dynamicFriction: number;
    reasoningSnippet?: string;
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
    netExposureDelta: 0,
    accumulatedFees: 0
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
    
    Logger.info(`[BINANCE_MASTER] Initializing Phase 9 Exposure Orchestrator for ${config.symbol}...`);
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
      
      const offset = config.entryOffset || 5;
      this.state.entryB = this.intelligenceService.calculateSymmetricalOffset(currentPrice, offset, config.sideA);
      this.state.hedgeQty = config.qtyB;

      await this.binanceService.placeOrder(
        this.binanceService.getClientA(),
        config.symbol,
        'market',
        config.sideA,
        config.qtyA
      );

      await this.deployManagedExits();
      await this.redeployHedge();

      this.state.hmacStatus = 'active';
      this.state.phase = 'HEDGE_ACTIVE';
      this.startMonitoring();
      
      await this.logShadowFill('binance_master_a', config.symbol, config.sideA, config.qtyA, currentPrice);

      // Simulation Service Bridge
      SimulationService.getInstance().on('price_update', async (data: { symbol: string; price: number }) => {
        if (this.state.isActive && data.symbol === this.state.symbol) {
          try {
            const [positionsA, positionsB] = await Promise.all([
              this.binanceService.fetchPositions(this.binanceService.getClientA(), this.state.symbol),
              this.binanceService.fetchPositions(this.binanceService.getClientB(), this.state.symbol)
            ]);
            await this.processTick(data.price, positionsA, positionsB);
          } catch(e) {}
        }
      });

      const speed = Date.now() - startTime;
      if (!this.state.telemetry) {
        this.state.telemetry = { avgLatency: 0, executionSpeed: 0, heartbeat: Date.now() };
      }
      this.state.telemetry.executionSpeed = speed;
      
      Logger.info(`[BINANCE_MASTER] Phase 9 Architecture Deployed in ${speed}ms!`);
      this.emitStatus();
    } catch (error: any) {
      Logger.error('[BINANCE_MASTER] Deployment Failure:', error);
      this.stop();
      throw error;
    }
  }

  public async stop() {
    Logger.info('[BINANCE_MASTER] Initiating Atomic Exit Sequence...');
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
        currentQtyA = this.config.qtyA;
        currentQtyB = this.state.hedgeStatus === 'active' ? this.state.hedgeQty : 0;
      }
    }

    this.state.isActive = false;
    this.state.phase = 'CLOSED';
    this.state.hmacStatus = 'inactive';
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.sentimentInterval) clearInterval(this.sentimentInterval);

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
        const tStart = performance.now();
        const tFetchStart = performance.now();
        
        const ticker = await this.binanceService.fetchTicker(this.state.symbol);
        const currentPrice = ticker.last;
        this.state.lastPrice = currentPrice;

        const [positionsA, positionsB] = await Promise.all([
           this.binanceService.fetchPositions(this.binanceService.getClientA(), this.state.symbol),
           this.binanceService.fetchPositions(this.binanceService.getClientB(), this.state.symbol)
        ]);
        const fetchLatency = performance.now() - tFetchStart;

        await this.processTick(currentPrice, positionsA, positionsB, { tStart, tFetchStart, fetchLatency });

        const metrics = await this.binanceService.fetchLiquidityMetrics(this.state.symbol);
        const intel = await this.intelligenceService.analyzeSymbol(this.state.symbol, currentPrice, metrics.spread);
        
        this.state.intelligence = {
          sentiment: intel.sentiment,
          regime: intel.regime,
          volatilityScore: intel.volatilityScore,
          liquidityScore: intel.liquidityScore,
          atr: intel.atr,
          dynamicFriction: intel.atr ? Math.abs(this.intelligenceService.getFrictionOffset(this.config!.sideA, this.state.symbol)) : 0,
          reasoningSnippet: intel.reasoningSnippet
        };

        const balanceB = await this.binanceService.fetchBalance(this.binanceService.getClientB());
        this.state.availableMarginB = (balanceB as any).USDT?.free || 0;

        if (!this.sentimentInterval) this.startAgenticReasoning();
        this.emitStatus();
      } catch (error) {
        Logger.error('[BINANCE_MASTER] Monitoring Error:', error);
      }
    }, 2000);
  }

  private async processTick(currentPrice: number, positionsA: any[], positionsB: any[], telemetry?: any) {
    if (!this.state.isActive || !this.config) return;

    const tLogicStart = performance.now();
    const currentQtyA = positionsA.length > 0 ? Math.abs((positionsA[0] as any).contracts) : 0;
    const currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;

    if (currentQtyA === 0 && this.state.phase !== 'SYMMETRIC_DEPLOY') {
      Logger.info(`[BINANCE_MASTER] Primary Position Closed. Auto-Terminating...`);
      await this.stop();
      return;
    }

    const isBuy = this.config.sideA === 'buy';
    const sideB = isBuy ? 'sell' : 'buy';
    const sideBMult = sideB === 'buy' ? 1 : -1;
    const sideAMult = isBuy ? 1 : -1;

    const diffA = currentPrice - this.state.entryA;
    this.state.pnlA = (isBuy ? diffA : -diffA) * currentQtyA;
    this.state.netExposureDelta = (currentQtyA * sideAMult) + (currentQtyB * sideBMult);

    const diffB = currentPrice - this.state.entryB;
    this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * currentQtyB;
    this.state.netPnl = this.state.pnlA + this.state.pnlB;
    
    const tExecStart = performance.now();
    await this.syncTargetExposure(currentPrice, currentQtyA);

    if (this.state.phase !== 'PRINCIPAL_RECOVERY') {
      const closeSideA = isBuy ? 'sell' : 'buy';
      if (this.state.slOrder && ((isBuy && currentPrice <= this.state.slOrder.price) || (!isBuy && currentPrice >= this.state.slOrder.price))) {
        Logger.info(`[BINANCE_MASTER] STOP LOSS ACTIVATED @ ${currentPrice}`);
        const slQty = this.state.slOrder.qty;
        await this.binanceService.closePosition(this.binanceService.getClientA(), this.state.symbol, closeSideA, slQty);
        await this.logShadowFill('binance_master_a', this.state.symbol, closeSideA, slQty, currentPrice);
        this.state.slOrder.status = 'filled';
        
        if (this.state.hedgeStatus === 'active') {
          this.state.phase = 'PRINCIPAL_RECOVERY';
        } else {
          await this.stop();
        }
        return;
      }

      for (const tp of this.state.tpTiers) {
        if (tp.status === 'waiting' && ((isBuy && currentPrice >= tp.price) || (!isBuy && currentPrice <= tp.price))) {
          tp.status = 'filled';
          await this.binanceService.closePosition(this.binanceService.getClientA(), this.state.symbol, closeSideA, tp.qty);
          await this.logShadowFill('binance_master_a', this.state.symbol, closeSideA, tp.qty, currentPrice);
          
          if (tp.tier === 1 && this.state.slOrder && !this.state.slOrder.isBreakEven) {
            this.state.slOrder.price = this.state.entryA;
            this.state.slOrder.isBreakEven = true;
          }
        }
      }
    }

    if (this.state.hedgeStatus === 'active' && this.state.phase !== 'PRINCIPAL_RECOVERY') {
      const friction = this.intelligenceService.getFrictionOffset(this.config.sideA, this.state.symbol, this.config.atrMultiplier || 1.0);
      const threshold = this.state.entryB + friction;
      const trendRecovered = isBuy ? currentPrice >= threshold : currentPrice <= threshold;

      if (trendRecovered) {
        const closeSideB = sideB === 'buy' ? 'sell' : 'buy';
        await this.binanceService.closePosition(this.binanceService.getClientB(), this.state.symbol, closeSideB, currentQtyB);
        await this.logShadowFill('binance_master_b', this.state.symbol, closeSideB, currentQtyB, currentPrice);
        this.state.hedgeStatus = 'pending';
        await this.redeployHedge();
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
    const { qtyA, sideA } = this.config;
    const entry = this.state.entryA;
    const isBuy = sideA === 'buy';

    const slPct = (this.config.slPercent || 1.0) / 100;
    const slPrice = isBuy ? entry * (1 - slPct) : entry * (1 + slPct);
    this.state.slOrder = { id: 'pending_sl', price: slPrice, qty: qtyA, status: 'open', isBreakEven: false };

    const tpTiers = this.config.tpTiersArray || [2, 3, 4, 5];
    this.state.tpTiers = tpTiers.map((pct, i) => ({
      tier: i + 1,
      price: isBuy ? entry * (1 + (pct/100)) : entry * (1 - (pct/100)),
      qty: Number((qtyA / tpTiers.length).toFixed(3)),
      status: 'waiting'
    }));
  }

  private async redeployHedge() {
    if (!this.config) return;
    const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
    const baseOffset = this.config.entryOffset;
    let finalOffset = baseOffset;
    
    const intel = this.intelligenceService.getIntelligence(this.config.symbol);
    if (intel) {
      finalOffset = this.intelligenceService.recommendOffset(baseOffset, intel, this.config.sideA);
      this.state.entryB = this.intelligenceService.calculateSymmetricalOffset(this.state.entryA, finalOffset, this.config.sideA);
    }

    await this.binanceService.placeOrder(
      this.binanceService.getClientB(),
      this.config.symbol,
      'limit',
      sideB,
      this.state.hedgeQty,
      this.state.entryB
    );

    this.state.hedgeStatus = 'pending';
  }

  private async syncTargetExposure(markPrice: number, currentQtyA: number) {
    if (!this.config || !this.state.slOrder) return;

    const targetQty = this.intelligenceService.calculateRequiredHedge(
      markPrice,
      this.state.entryA,
      this.state.entryB,
      currentQtyA,
      this.config.sideA,
      this.state.slOrder.price
    );

    const positionsB = await this.binanceService.fetchPositions(this.binanceService.getClientB(), this.state.symbol);
    const currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;

    if (Math.abs(targetQty - currentQtyB) > 0.001) {
       const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
       if (targetQty > 0 && currentQtyB === 0) {
          this.state.hedgeStatus = 'active';
          await this.logShadowFill('binance_master_b', this.state.symbol, sideB, targetQty, markPrice);
       }
    }

    if (currentQtyB > 0) this.state.hedgeStatus = 'active';
    this.state.netExposureDelta = (currentQtyA * (this.config.sideA === 'buy' ? 1 : -1)) +
                                  (currentQtyB * (this.config.sideA === 'buy' ? -1 : 1));
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

  public getStatus() { return this.state; }

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
      
      const value = quantity * price;
      if (side.toLowerCase() === 'buy') {
        baseBal += quantity;
        quoteBal -= (value + fee);
      } else {
        baseBal -= quantity;
        quoteBal += (value - fee);
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
      Logger.error(`[BINANCE_MASTER] Shadow Fill Error:`, error);
    }
  }
}
