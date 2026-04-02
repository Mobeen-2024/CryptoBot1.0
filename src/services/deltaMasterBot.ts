import { DeltaExchangeService } from './deltaExchangeService.js';
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
}

export class DeltaMasterBot extends EventEmitter {
  private deltaService: DeltaExchangeService;
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
    symbol: ''
  };
  private monitorInterval: NodeJS.Timeout | null = null;
  private config: DeltaMasterConfig | null = null;

  constructor(io?: SocketIOServer) {
    super();
    this.io = io || null;
    this.deltaService = new DeltaExchangeService();
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
      const currentPrice = ticker.last;
      
      this.state.lastPrice = currentPrice;
      this.state.entryA = currentPrice;
      this.state.entryB = currentPrice + (config.sideA === 'buy' ? -config.entryOffset : config.entryOffset);

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
      this.state.entryA = orderA.price || currentPrice;

      // Deploy Account B (Insurance)
      const sideB = config.sideA === 'buy' ? 'sell' : 'buy';
      Logger.info(`[DELTA_MASTER] Deploying Account B Insurance: ${sideB.toUpperCase()} ${config.qtyB} @ ${this.state.entryB}`);
      
      // Use Limit order for insurance for precision if possible, or MARKET if offset is 0
      const orderB = await this.deltaService.placeOrder(
        this.deltaService.getClientB(),
        config.symbol,
        config.entryOffset === 0 ? 'market' : 'limit',
        sideB,
        config.qtyB,
        this.state.entryB,
        { leverage: config.leverB }
      );
      this.state.entryB = orderB.price || this.state.entryB;

      this.state.phase = 'HEDGE_ACTIVE';
      this.startMonitoring();
      this.emitStatus();
      
      Logger.info(`[DELTA_MASTER] Architecture Deployed! Primary: $${this.state.entryA}, Hedge: $${this.state.entryB}`);
    } catch (error: any) {
      Logger.error('[DELTA_MASTER] Deployment Failure:', error);
      this.stop();
      throw error;
    }
  }

  public async stop() {
    this.state.isActive = false;
    this.state.phase = 'CLOSED';
    if (this.monitorInterval) clearInterval(this.monitorInterval);
    
    Logger.info('[DELTA_MASTER] Sequence Terminated.');
    this.emitStatus();
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

          // Calculate PnL B (Assume it filled or is filling)
          const sideB = this.config.sideA === 'buy' ? 'sell' : 'buy';
          const diffB = currentPrice - this.state.entryB;
          this.state.pnlB = (sideB === 'buy' ? diffB : -diffB) * this.config.qtyB;

          this.state.netPnl = this.state.pnlA + this.state.pnlB;

          // Principal Protection Logic:
          // If Net PnL drops below a certain threshold relative to principal, or if Account A is underwater but Account B is protecting.
          if (this.state.pnlA < 0 && Math.abs(this.state.pnlA) > (this.state.pnlB * 1.5)) {
             // Protection weakening — check for re-entry or scaling Account B
             Logger.warn(`[DELTA_MASTER] Alert: Insurance coverage for Account A principal is weakening. Net: ${this.state.netPnl}`);
          }

          // Recursive Re-entry logic can be added here (monitoring orderB status)
          
          this.emitStatus();
        }
      } catch (error) {
        Logger.error('[DELTA_MASTER] Monitoring Error:', error);
      }
    }, 2000);
  }

  public getStatus() { return this.state; }

  private emitStatus() {
    if (this.io) this.io.emit('delta_master_status', this.state);
    this.emit('status', this.state);
  }
}
