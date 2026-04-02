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
  hedgeStatus: 'inactive' | 'pending' | 'active';
  hedgeOrderId: string | null;
  hedgeQty: number;
  intelligence?: {
    sentiment: number;
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
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

      // Calculate SizeB to cover LossA at SLA trigger: GainB = abs(EntryB - SLA) * SizeB = LossA
      const gainPerUnitB = Math.abs(entryB - slA);
      const qtyB = Number((lossA / gainPerUnitB).toFixed(3));
      
      Logger.info(`[DELTA_MASTER] Insurance Engine Sizing: LossA=$${lossA.toFixed(2)}, EntryB=$${entryB.toFixed(2)}, SizeB=${qtyB} (Buffer: ${offset} USDT)`);

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
      this.state.entryA = orderA.price || entryA;

      // Deploy Account B (Insurance Engine - Stop Market)
      const sideB = config.sideA === 'buy' ? 'sell' : 'buy';
      const limitBuffer = 20; // 20 USDT slippage buffer for guaranteed fill
      const limitPriceB = sideB === 'sell' ? entryB - limitBuffer : entryB + limitBuffer;
      
      Logger.info(`[DELTA_MASTER] Deploying Account B Insurance: ${sideB.toUpperCase()} ${qtyB} @ STOP_LIMIT Trigger: ${entryB}, Limit: ${limitPriceB}`);
      
      const orderB = await this.deltaService.placeOrder(
        this.deltaService.getClientB(),
        config.symbol,
        'stop_limit',
        sideB,
        qtyB,
        limitPriceB,
        { 
          stopPrice: entryB,
          leverage: 20 
        }
      );
      // In stop-market, orderB.price will be undefined until trigger. We use the theoretical entry for PnL tracking.
      
      this.state.hedgeStatus = 'pending';
      this.state.hedgeOrderId = orderB.id || 'hedge_sim';
      this.state.hedgeQty = qtyB;

      this.state.phase = 'HEDGE_ACTIVE';
      await this.deployManagedExits();
      this.startMonitoring();
      this.startDMS();
      this.emitStatus();
      
      Logger.info(`[DELTA_MASTER] Recursive Shield Established! Size: ${qtyB} @ ${entryB}`);
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
          // Calculate PnL A
          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (this.config.sideA === 'buy' ? diffA : -diffA) * this.config.qtyA;

          // Calculate PnL B
          const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * this.state.hedgeQty;

          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // -- Phase 5: Tiered Exit & SL Management --
          if (this.state.isActive && this.state.tpTiers.length > 0 && this.state.phase !== 'PRINCIPAL_RECOVERY') {
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
                 Logger.warn(`[DELTA_MASTER] Capital Protection Triggered! SLA hit at $${currentPrice}. Entering SHIELDED state.`);
                 
                 // Capital Shielded: Close A, Keep B
                 try {
                   await this.deltaService.closePosition(this.deltaService.getClientA(), this.state.symbol, this.config.sideA, this.config.qtyA);
                   await this.deltaService.cancelAllOrders(this.deltaService.getClientA(), this.state.symbol);
                   this.state.slOrder = null;
                   this.state.tpTiers = [];
                   this.state.phase = 'PRINCIPAL_RECOVERY'; // Shield-Only momentum capture
                 } catch (e) {
                   Logger.error('[DELTA_MASTER] Failed to atomize SLA exit:', e);
                 }
                 this.emitStatus();
               }
            }
          }

          // -- Recursive Vigilance: Account B Status Tracking --
          if (this.state.isActive && this.state.phase !== 'CLOSED') {
             if (this.state.hedgeStatus === 'pending') {
                const triggerCrossed = this.config.sideA === 'buy' ? currentPrice <= this.state.entryB : currentPrice >= this.state.entryB;
                if (triggerCrossed) {
                   Logger.info(`[DELTA_MASTER] HEDGE TRIGGERED at $${currentPrice}. Capital Shield Active.`);
                   this.state.hedgeStatus = 'active';
                }
             } else if (this.state.hedgeStatus === 'active' && this.state.phase !== 'PRINCIPAL_RECOVERY') {
                // Break-Even Trend Recovery logic: Return to entryB from the wrong side
                const trendRecovered = this.config.sideA === 'buy' ? currentPrice >= (this.state.entryB + 2) : currentPrice <= (this.state.entryB - 2);
                if (trendRecovered) {
                   Logger.info(`[DELTA_MASTER] Trend Recovery Detected! Closing Hedge at Break-Even and re-arming...`);
                   try {
                     const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
                     await this.deltaService.closePosition(this.deltaService.getClientB(), this.state.symbol, sideB, this.state.hedgeQty);
                     await this.redeployHedge();
                   } catch (e) {
                     Logger.error('[DELTA_MASTER] Recursive re-entry failure:', e);
                   }
                }
             }
          }

          // -- Phase 3: Margin Audit & Rebalancing --
          const balanceB = await this.deltaService.fetchBalance(this.deltaService.getClientB());
          this.state.availableMarginB = (balanceB as any).total || 0;

          // 4. Intelligence Loop
          const metrics = await this.deltaService.fetchLiquidityMetrics(this.state.symbol);
          const intel = await this.intelligenceService.analyzeSymbol(this.state.symbol, currentPrice, metrics.spread);
          this.state.intelligence = {
            sentiment: intel.sentiment,
            regime: intel.regime,
            volatilityScore: intel.volatilityScore,
            liquidityScore: intel.liquidityScore
          };

          // Dynamic Re-calibration if Hedge is Pending
          if (this.state.hedgeStatus === 'pending') {
            const recommended = this.intelligenceService.recommendOffset(this.config.entryOffset, intel, this.config.sideA);
            const currentOffset = Math.abs(this.state.entryB - this.state.entryA);
            
            if (Math.abs(recommended - currentOffset) > 0.5) {
              Logger.info(`[DELTA_MASTER] Bot Pilot: Recalibrating Offset to ${recommended} due to ${intel.regime}`);
              await this.deltaService.cancelAllOrders(this.deltaService.getClientB(), this.state.symbol);
              this.state.entryB = this.state.entryA + (this.config.sideA === 'buy' ? -recommended : recommended);
              await this.redeployHedge();
            }
          }
          
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

  private async redeployHedge() {
    if (!this.config || !this.state.isActive) return;
    
    Logger.info(`[DELTA_MASTER] Re-arming Capital Shield at $${this.state.entryB}...`);
    const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
    const limitBuffer = 20;
    const limitPriceB = sideB === 'sell' ? this.state.entryB - limitBuffer : this.state.entryB + limitBuffer;

    try {
      const orderB = await this.deltaService.placeOrder(
        this.deltaService.getClientB(),
        this.state.symbol,
        'stop_limit',
        sideB,
        this.state.hedgeQty,
        limitPriceB,
        { 
          stopPrice: this.state.entryB,
          leverage: 20 
        }
      );
      this.state.hedgeStatus = 'pending';
      this.state.hedgeOrderId = orderB.id || 'hedge_sim_reentry';
      this.emitStatus();
    } catch (e) {
      Logger.error('[DELTA_MASTER] Fatal: Shield Redeplyment Failure:', e);
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
