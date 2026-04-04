import Database from 'better-sqlite3';
import { DeltaExchangeService } from './deltaExchangeService.js';
import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';
import { Server as SocketIOServer } from 'socket.io';
import EventEmitter from 'events';
import { AgenticSearchService } from './agenticSearchService.js';

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
  slPercent?: number; // Phase 12: User SL % (e.g. 1.0)
  tpTiersArray?: number[]; // Phase 12: User TP levels (e.g. [2, 3, 4, 5])
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

      const slA = config.sideA === 'buy' ? entryA * (1 - (config.slPercent || 1.0) / 100) : entryA * (1 + (config.slPercent || 1.0) / 100);
      const lossA = Math.abs(entryA - slA) * config.qtyA;
      const gainPerUnitB = Math.abs(entryB - slA);
      const qtyB = Number((lossA / gainPerUnitB).toFixed(3));
      this.state.hedgeQty = qtyB;
      
      Logger.info(`[DELTA_MASTER] Insurance Engine Sizing: LossA=$${lossA.toFixed(2)}, EntryB=$${entryB.toFixed(2)}, SizeB=${qtyB}`);

      // Deploy Account A Brackets (Safety Net at furthest TP)
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

      // Log Shadow Fill for Account A
      await this.logShadowFill('delta_master_a', config.symbol, config.sideA, config.qtyA, entryA);

      // Phase 12: Atomic Deployment
      await this.deployManagedExits();
      await this.redeployHedge();

      this.state.phase = 'HEDGE_ACTIVE';
      this.startMonitoring();
      this.startDMS();
      
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
      } catch (e) {
        currentQtyA = this.config.qtyA;
        currentQtyB = this.state.hedgeStatus === 'active' ? this.state.hedgeQty : 0;
      }
    }

    await this.closeAll(currentQtyA, currentQtyB);
    
    // Log Shadow Fills to "Close" positions in UI
    if (this.config) {
      const sideA_close = this.config.sideA === 'buy' ? 'sell' : 'buy';
      const sideB_close = this.config.sideA === 'buy' ? 'buy' : 'sell';
      
      // Close Account A
      if (currentQtyA > 0) {
        await this.logShadowFill('delta_master_a', this.state.symbol, sideA_close, currentQtyA, this.state.lastPrice);
      }
      
      // Close Account B
      if (currentQtyB > 0) {
        await this.logShadowFill('delta_master_b', this.state.symbol, sideB_close, currentQtyB, this.state.lastPrice);
      }
    }

    this.state.isActive = false;
    this.state.phase = 'CLOSED';
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    if (this.sentimentInterval) clearInterval(this.sentimentInterval);
    if (this.dmsInterval) clearInterval(this.dmsInterval);
    this.state.dmsStatus = 'inactive';
    
    Logger.info('[DELTA_MASTER] Sequence Terminated.');
    this.emitStatus();
  }

  private async closeAll(currentQtyA: number, currentQtyB: number) {
    if (!this.config) return;
    try {
      // Closing side is always OPPOSITE to the opening side
      const closeSideA = this.config.sideA === 'buy' ? 'sell' : 'buy';
      const closeSideB = this.config.sideA === 'buy' ? 'buy' : 'sell'; // B opened opposite to A
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

          // 2. Exposure & Fetch Real Positions
          const [positionsA, positionsB] = await Promise.all([
             this.deltaService.fetchPositions(this.deltaService.getClientA(), this.state.symbol),
             this.deltaService.fetchPositions(this.deltaService.getClientB(), this.state.symbol)
          ]);
          
          const currentQtyA = positionsA.length > 0 ? Math.abs((positionsA[0] as any).contracts) : 0;
          const currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;

          // Phase 12: Auto-teardown if Account A is fully closed natively
          if (this.state.phase !== 'SYMMETRIC_DEPLOY' && currentQtyA === 0 && this.state.isActive) {
             Logger.info(`[DELTA_MASTER] Primary Position Closed (Zero Contracts). Auto-Terminating Agent...`);
             await this.stop();
             return;
          }

          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (this.config.sideA === 'buy' ? diffA : -diffA) * currentQtyA;
          
          const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
          const sideBMult = sideB === 'buy' ? 1 : -1;
          const sideAMult = this.config.sideA === 'buy' ? 1 : -1;

          this.state.netExposureDelta = (currentQtyA * sideAMult) + (currentQtyB * sideBMult);

          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * currentQtyB;
          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // 3. State-Based Exposure Orchestration (Phase 9)
          await this.syncTargetExposure(currentPrice, currentQtyA);

          // 4. Recursive Trend Recovery with ATR Friction & Break-Even Loop
          if (this.state.hedgeStatus === 'active' && this.state.phase !== 'PRINCIPAL_RECOVERY') {
             const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
             const friction = this.intelligenceService.getFrictionOffset(this.config.sideA, this.state.symbol, this.config.atrMultiplier || 1.0);
             const threshold = this.state.entryB + friction;
             const trendRecovered = this.config.sideA === 'buy' ? currentPrice >= threshold : currentPrice <= threshold;

             if (trendRecovered) {
                const t0 = Date.now();
                Logger.info(`[DELTA_MASTER] Shield Reversal Detected (ATR Friction). Closing Shield.`);
                // closeSideB = closing side for Account B (opposite of hedge opening side)
                const closeSideB = sideB === 'buy' ? 'sell' : 'buy';
                await this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, closeSideB, currentQtyB);
                
                // Shadow Balance for B closing
                await this.logShadowFill('delta_master_b', this.state.symbol, sideB === 'buy' ? 'sell' : 'buy', currentQtyB, currentPrice);

                if (this.state.telemetry) this.state.telemetry.executionSpeed = Date.now() - t0;
                
                this.state.hedgeStatus = 'pending';
                await this.redeployHedge();
             }
          }

          // 5. Managed Exit Logic (Phase 12: Physical Execution)
          if (this.state.isActive && this.state.tpTiers.length > 0 && this.state.phase !== 'PRINCIPAL_RECOVERY') {
            for (const tier of this.state.tpTiers) {
              if (tier.status === 'waiting') {
                const reached = this.config.sideA === 'buy' ? currentPrice >= tier.price : currentPrice <= tier.price;
                if (reached) {
                  Logger.info(`[DELTA_MASTER] TP Tier ${tier.tier} reached @ ${tier.price}. Executing partial close.`);
                  tier.status = 'filled';
                  
                  // Partially close the tier quantity on Account A (closeSide = opposite of opening side)
                  const closeSide = this.config.sideA === 'buy' ? 'sell' : 'buy';
                  await this.deltaService.closePosition(this.deltaService.getClientA(), this.state.symbol, closeSide, tier.qty);
                  
                  // Log Shadow Fill for the partial close
                  await this.logShadowFill('delta_master_a', this.state.symbol, closeSide, tier.qty, currentPrice);

                  if (tier.tier === 1 && this.state.slOrder && !this.state.slOrder.isBreakEven) {
                     this.state.slOrder.price = this.state.entryA;
                     this.state.slOrder.isBreakEven = true;
                     try {
                        // Break-even SL amendment: stop is a close order (closeSide) on Account A
                        await this.deltaService.editOrder(this.deltaService.getClientA(), this.state.slOrder.id, this.state.symbol, 'limit', closeSide, this.state.slOrder.qty, this.state.slOrder.price);
                     } catch(e) {}
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
    const slPct = this.config.slPercent || 1.0;
    const tpTiers = this.config.tpTiersArray || [2, 3, 4, 5];

    this.state.tpTiers = tpTiers.map((pct, i) => ({
      tier: i + 1,
      price: side === 'buy' ? entry * (1 + pct / 100) : entry * (1 - pct / 100),
      qty: Number((this.config!.qtyA * (1 / tpTiers.length)).toFixed(3)),
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

  /**
   * Institutional Exposure Orchestration
   * Synchronizes the physical position with the tactical target.
   */
  private async syncTargetExposure(markPrice: number, currentQtyA: number) {
    if (!this.config || !this.state.slOrder) return;

    const targetQty = this.intelligenceService.calculateRequiredHedge(
      markPrice,
      this.state.entryA,
      this.state.entryB,
      currentQtyA, // Dynamic size based on partial TP hits
      this.config.sideA,
      this.state.slOrder.price
    );

    // Current Physical Hedge Position
    const positionsB = await this.deltaService.fetchPositions(this.deltaService.getClientB(), this.state.symbol);
    const currentQtyB = positionsB.length > 0 ? Math.abs((positionsB[0] as any).contracts) : 0;

    const delta = targetQty - currentQtyB;

    if (Math.abs(delta) > 0.001) {
       Logger.info(`[DELTA_MASTER] Syncing Exposure Delta: ${delta.toFixed(3)} contracts.`);
       const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
       
       if (targetQty > 0 && currentQtyB === 0) {
          // Initial Activation
          this.state.hedgeStatus = 'active';
          await this.logShadowFill('delta_master_b', this.state.symbol, sideB, targetQty, markPrice);
       } else if (targetQty === 0 && currentQtyB > 0) {
          // Deactivation (Trend Recovery) handled by monitor loop break-even check
       }
    }

    // Always reflect physical reality: if B has contracts, hedge is active
    if (currentQtyB > 0) this.state.hedgeStatus = 'active';

    this.state.netExposureDelta = (this.config.sideA === 'buy' ? this.config.qtyA : -this.config.qtyA) + 
                                  (currentQtyB * (this.config.sideA === 'buy' ? -1 : 1));
  }

  private startAgenticReasoning() {
    const fetchReasoning = async () => {
      if (!this.state.isActive || !this.state.symbol) return;
      Logger.info(`[DELTA_MASTER] Seeking Agentic Consensus for ${this.state.symbol}...`);
      
      try {
        const headlines = await AgenticSearchService.fetchTopHeadlines(this.state.symbol);
        const news = AgenticSearchService.sanitizeNews(headlines);
        await this.intelligenceService.applyAgenticConsensus(this.state.symbol, news);
      } catch (err) {
        Logger.error('[DELTA_MASTER] Agentic News Fetch Failed:', err);
      }
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

      // NEW Phase 12: Trigger Balance Update for Shadow Accounts if in shadow mode
      // We look for tradeCopier.updateShadowBalance logic from the main trade engine
      // Since bots are internal, we simulate it here:
      const parts = ccxtSymbol.split('/');
      const baseAsset = parts[0];
      const quoteAsset = parts[1] || 'USDT';
      
      // We need access to the tradeCopier instance or mimic its logic.
      // Assuming tradeCopier is available globally or can be reached:
      // For now, mirroring the logic to update shadow_balances table directly:
      const shadowDb = new Database('trades.db');
      const getBal = shadowDb.prepare('SELECT balance FROM shadow_balances WHERE slave_id = ? AND asset = ?');
      
      let baseBal = (getBal.get(slave_id, baseAsset) as any)?.balance || 0;
      let quoteBal = (getBal.get(slave_id, quoteAsset) as any)?.balance || 10000;
      
      const value = quantity * price;
      if (side.toLowerCase() === 'buy') {
        baseBal += quantity;
        quoteBal -= value;
      } else {
        baseBal -= quantity;
        quoteBal += value;
      }
      
      const upsert = shadowDb.prepare(`
        INSERT INTO shadow_balances (slave_id, asset, balance) VALUES (?, ?, ?)
        ON CONFLICT(slave_id, asset) DO UPDATE SET balance = excluded.balance
      `);
      upsert.run(slave_id, baseAsset, baseBal);
      upsert.run(slave_id, quoteAsset, quoteBal);
      shadowDb.close();
      
      // Notify UI
      if (this.io) {
        this.io.emit('new_trade');
        this.io.emit('balance_update');
      }
    } catch (error) {
      Logger.error(`[DELTA_MASTER] Failed to log shadow fill for ${slave_id}:`, error);
    }
  }
}
