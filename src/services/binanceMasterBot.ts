import { BinanceService } from './binanceService.js';
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
}

export class BinanceMasterBot extends EventEmitter {
  private binanceService: BinanceService;
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
    hmacStatus: 'inactive'
  };
  private monitorInterval: NodeJS.Timeout | null = null;
  private config: BinanceMasterConfig | null = null;

  constructor(io?: SocketIOServer) {
    super();
    this.io = io || null;
    this.binanceService = new BinanceService();
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

      // Deploy Account A
      await this.binanceService.placeOrder(
        this.binanceService.getClientA(),
        config.symbol,
        'market',
        config.sideA,
        config.qtyA
      );

      // Deploy Account B (Hedge/Strategic DCA)
      const sideB = config.sideA === 'buy' ? 'sell' : 'buy';
      await this.binanceService.placeOrder(
        this.binanceService.getClientB(),
        config.symbol,
        config.entryOffset === 0 ? 'market' : 'limit',
        sideB,
        config.qtyB,
        this.state.entryB
      );

      this.state.hmacStatus = 'active';
      this.state.phase = 'HEDGE_ACTIVE';
      this.startMonitoring();
      this.emitStatus();
      
      Logger.info(`[BINANCE_MASTER] Architecture Deployed! Primary: $${this.state.entryA}, Hedge: $${this.state.entryB}`);
    } catch (error: any) {
      Logger.error('[BINANCE_MASTER] Deployment Failure:', error);
      this.stop();
      throw error;
    }
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
          const diffA = currentPrice - this.state.entryA;
          this.state.pnlA = (this.config.sideA === 'buy' ? diffA : -diffA) * this.config.qtyA;

          const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * this.config.qtyB;

          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          const balanceB = await this.binanceService.fetchBalance(this.binanceService.getClientB());
          this.state.availableMarginB = (balanceB as any).USDT?.free || 0;

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
