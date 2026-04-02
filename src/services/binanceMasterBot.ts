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
  intelligence?: {
    sentiment: number;
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
  }
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
    hedgeQty: 0
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

    try {
      await this.binanceService.initialize();
      const ticker = await this.binanceService.fetchTicker(config.symbol);
      const currentPrice = ticker.last || 65000;
      
      this.state.lastPrice = currentPrice;
      this.state.entryA = currentPrice;
      this.state.entryB = currentPrice + (config.sideA === 'buy' ? -config.entryOffset : config.entryOffset);
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
      this.emitStatus();
      
      Logger.info(`[BINANCE_MASTER] Architecture Deployed! Primary: $${this.state.entryA}, Shield: $${this.state.entryB}`);
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
      this.state.entryB = this.state.entryA + (this.config.sideA === 'buy' ? -finalOffset : finalOffset);
      Logger.info(`[BINANCE_MASTER] Bot Pilot: Dynamic Offset Applied: ${finalOffset} USDT (Base: ${baseOffset})`);
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
        const ticker = await this.binanceService.fetchTicker(this.state.symbol);
        const currentPrice = ticker.last;
        this.state.lastPrice = currentPrice;

        if (this.config) {
          const isBuy = this.config.sideA === 'buy';
          
          // 1. Update PnL
          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (isBuy ? diffA : -diffA) * this.config.qtyA;
          
          const sideB = isBuy ? 'sell' : 'buy';
          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * this.state.hedgeQty;
          
          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // 2. Managed Exit Engine (TP/SL Logic)
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

          // 3. Recursive Shield Logic
          if (this.state.hedgeStatus === 'pending' && ((isBuy && currentPrice <= this.state.entryB) || (!isBuy && currentPrice >= this.state.entryB))) {
            this.state.hedgeStatus = 'active';
            Logger.info('[BINANCE_MASTER] Recursive Shield ENGAGED');
          }

          if (this.state.hedgeStatus === 'active' && this.state.phase !== 'PRINCIPAL_RECOVERY') {
            // Break-Even Recovery (Exit Hedge if price returns to entryA)
            const exitTrigger = isBuy ? this.state.entryA - 2 : this.state.entryA + 2; 
            if ((isBuy && currentPrice >= exitTrigger) || (!isBuy && currentPrice <= exitTrigger)) {
              Logger.info('[BINANCE_MASTER] Market Recovered. Closing Shield at Break-Even.');
              await this.binanceService.closePosition(this.binanceService.getClientB(), this.state.symbol, isBuy ? 'sell' : 'buy', this.state.hedgeQty);
              await this.redeployHedge();
            }
          }

          const balanceB = await this.binanceService.fetchBalance(this.binanceService.getClientB());
          this.state.availableMarginB = (balanceB as any).USDT?.free || 0;

          // 4. Intelligence Loop
          const metrics = await this.binanceService.fetchLiquidityMetrics(this.state.symbol);
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
              Logger.info(`[BINANCE_MASTER] Bot Pilot: Recalibrating Offset to ${recommended} due to ${intel.regime}`);
              await this.binanceService.cancelAllOrders(this.binanceService.getClientB(), this.state.symbol);
              this.state.entryB = this.state.entryA + (this.config.sideA === 'buy' ? -recommended : recommended);
              await this.redeployHedge();
            }
          }

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
