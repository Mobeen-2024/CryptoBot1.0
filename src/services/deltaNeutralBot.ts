import ccxt from 'ccxt';
import { Logger } from '../../logger.js';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { RSI, WilliamsR } from 'technicalindicators';

dotenv.config({ quiet: true });

export interface BotConfig {
  // Core Parameters
  takeProfitUSDT?: number;
  slUSDT?: number;
  timeLimitMins?: number;

  // Smart Trailing
  useSmartTrailing?: boolean;
  trailingMode?: 'BREAKEVEN' | 'PROGRESSIVE'; // new: progressive ratchet SL
  trailingStep?: number;                       // new: % to ratchet SL by (e.g. 0.5%)

  // Indicators
  rsiPeriod?: number;
  rsiOverbought?: number;
  rsiOversold?: number;
  wrPeriod?: number;
  wrOverbought?: number;
  wrOversold?: number;

  // NEW: Multi-Cycle Config
  enableMultiCycle?: boolean;
  maxCycles?: number;    // how many full cycles to run before stopping

  // NEW: Entry Conditions
  entryMode?: 'INSTANT' | 'RSI_DIP'; // INSTANT = market now, RSI_DIP = wait for RSI < 40 before entry
  entryRsiThreshold?: number;         // RSI level to wait for before entry

  // NEW: Risk % per trade (auto-calc qty from balance)
  useRiskPercent?: boolean;
  riskPercent?: number; // e.g. 1 = 1% of available balance
}

export interface BotState {
  isActive: boolean;
  symbol: string;
  qty: number;
  stopLossUSDT: number;
  takeProfitUSDT?: number;
  timeLimitMins?: number;
  useSmartTrailing?: boolean;
  masterEntryPrice: number;
  slaveEntryPrice: number;
  longStopTriggered: boolean;
  shortStopTriggered: boolean;
  cycles: number;
  totalCyclesCompleted: number;
  statusText?: string;
  livePnL?: number;         // real-time combined PnL
  trailingSL?: number;      // current active trailing SL price for survivor
  phase?: 'ENTRY_PENDING' | 'HEDGED' | 'TRAILING_LONG' | 'TRAILING_SHORT' | 'CLOSED';
  preflightPass?: boolean;  // did balance check pass?
  preflightDetails?: string;
}

export interface TradeLogEntry {
  timestamp: number;
  event: string;
  phase: string;
  price: number;
  pnl: number;
  details: string;
}

export class DeltaNeutralBot {
  private masterClient: any;
  private slaveClient: any;
  private publicClient: any;
  private io: SocketIOServer | null;
  
  public state: BotState = {
    isActive: false, symbol: '', qty: 0, stopLossUSDT: 1,
    masterEntryPrice: 0, slaveEntryPrice: 0,
    longStopTriggered: false, shortStopTriggered: false,
    cycles: 0, totalCyclesCompleted: 0, statusText: 'OFFLINE',
    livePnL: 0, phase: 'CLOSED'
  };

  private priceCheckInterval: NodeJS.Timeout | null = null;
  private entryCheckInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private mode: 'HEDGED' | 'TRAILING_LONG' | 'TRAILING_SHORT' = 'HEDGED';
  private config: BotConfig = {};
  private trailingSLPrice: number = 0;
  private highWaterMark: number = 0; // for progressive trailing SL
  private tradeLog: TradeLogEntry[] = [];

  private logEvent(event: string, price: number, details: string) {
    const entry: TradeLogEntry = {
      timestamp: Date.now(),
      event,
      phase: this.state.phase || this.mode,
      price,
      pnl: this.state.livePnL || 0,
      details,
    };
    this.tradeLog.push(entry);
    Logger.info(`[TRADE_LOG] ${event}: ${details} @ ${price}`);
  }

  public getTradeLog(): TradeLogEntry[] { return this.tradeLog; }

  constructor(io?: SocketIOServer) {
    this.io = io || null;

    this.masterClient = new (ccxt as any).binance({
      apiKey: process.env.BINANCE_API_KEY || '',
      secret: (process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY) || '',
      options: { defaultType: 'spot' },
      enableRateLimit: true,
    });

    this.slaveClient = new (ccxt as any).binance({
      apiKey: process.env.BINANCE_SLAVE_API_KEY || '',
      secret: (process.env.BINANCE_SLAVE_API_SECRET || process.env.BINANCE_SLAVE_SECRET_KEY) || '',
      options: { defaultType: 'spot' },
      enableRateLimit: true,
    });

    this.publicClient = new (ccxt as any).binance({
      enableRateLimit: true
    });

    if (process.env.BINANCE_USE_TESTNET === 'true' || process.env.BINANCE_USE_TESTNET === '1') {
      this.masterClient.setSandboxMode(true);
      this.slaveClient.setSandboxMode(true);
    }
  }

  public async start(symbol: string, qty: number, stopLossUSDT: number, config: BotConfig = {}) {
    if (this.state.isActive) throw new Error("Bot is already active");

    let ccxtSymbol = symbol;
    if (!ccxtSymbol.includes('/') && ccxtSymbol.endsWith('USDT')) {
      ccxtSymbol = ccxtSymbol.replace('USDT', '/USDT');
    }

    this.state = {
      ...this.state,
      isActive: true, symbol: ccxtSymbol, qty,
      stopLossUSDT, totalCyclesCompleted: 0,
      masterEntryPrice: 0, slaveEntryPrice: 0,
      longStopTriggered: false, shortStopTriggered: false,
      cycles: 0, livePnL: 0, statusText: 'PREFLIGHT CHECK',
      phase: 'ENTRY_PENDING', preflightPass: false
    };
    this.config = config;
    this.mode = 'HEDGED';
    this.emitStatus();

    try {
      await this.runPreflightCheck(ccxtSymbol, qty, stopLossUSDT, config);
    } catch (error) {
      Logger.error("DeltaNeutralBot Preflight Failed:", error);
      this.state.isActive = false;
      this.state.statusText = 'PREFLIGHT FAILED';
      this.emitStatus();
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  //  PHASE 0: PRE-FLIGHT CHECK
  // ─────────────────────────────────────────────
  private async runPreflightCheck(symbol: string, qty: number, slUSDT: number, config: BotConfig) {
    Logger.info(`[PREFLIGHT] Running checks for ${qty} ${symbol}...`);
    this.state.statusText = 'PREFLIGHT: Validating...';
    this.emitStatus();

    const ticker = await this.publicClient.fetchTicker(symbol);
    const price = ticker.last;

    // Auto-calc qty from risk % if enabled
    let finalQty = qty;
    if (config.useRiskPercent && config.riskPercent) {
      // Shadow mode: estimate from price only
      const riskUSDT = slUSDT;
      const offset = (slUSDT / qty);
      finalQty = parseFloat((riskUSDT / offset).toFixed(5));
      this.state.qty = finalQty;
      Logger.info(`[PREFLIGHT] Risk-based Qty calculated: ${finalQty}`);
    }

    const requiredUSDT = price * finalQty;
    this.state.preflightPass = true;
    this.state.preflightDetails = `Required ~${requiredUSDT.toFixed(2)} USDT per leg. SL triggers at ${slUSDT} USDT loss.`;
    Logger.info(`[PREFLIGHT] PASS — ${this.state.preflightDetails}`);
    this.state.statusText = 'PREFLIGHT PASS';
    this.emitStatus();

    // Hand off to entry logic
    if (config.entryMode === 'RSI_DIP') {
      this.state.statusText = 'WAITING: RSI Dip Entry...';
      this.emitStatus();
      await this.waitForRsiEntry(symbol, config.entryRsiThreshold || 40);
    } else {
      await this.initiateBidirectionalEntry();
    }
  }

  // ─────────────────────────────────────────────
  //  CONDITIONAL ENTRY: Wait for RSI dip
  // ─────────────────────────────────────────────
  private async waitForRsiEntry(symbol: string, threshold: number) {
    Logger.info(`[ENTRY_WAIT] Waiting for RSI < ${threshold} before entering...`);

    return new Promise<void>((resolve, reject) => {
      this.entryCheckInterval = setInterval(async () => {
        if (!this.state.isActive) {
          clearInterval(this.entryCheckInterval!);
          return reject(new Error('Bot stopped while waiting for entry'));
        }
        try {
          const ohlcv = await this.publicClient.fetchOHLCV(symbol, '1m', undefined, 20);
          const close = ohlcv.map((d: any[]) => Number(d[4]));
          const rsiValues = RSI.calculate({ period: 14, values: close });
          const currentRSI = rsiValues[rsiValues.length - 1];
          this.state.statusText = `ENTRY WAIT: RSI ${currentRSI?.toFixed(1)} / Need < ${threshold}`;
          this.emitStatus();
          if (currentRSI && currentRSI < threshold) {
            clearInterval(this.entryCheckInterval!);
            Logger.info(`[ENTRY_WAIT] RSI condition met (${currentRSI.toFixed(1)}). Entering now!`);
            resolve();
            await this.initiateBidirectionalEntry();
          }
        } catch (e) {
          Logger.error('[ENTRY_WAIT] Error:', e);
        }
      }, 5000);
    });
  }

  // ─────────────────────────────────────────────
  //  PHASE I: SYNCHRONIZED ENTRY
  // ─────────────────────────────────────────────
  private async initiateBidirectionalEntry() {
    if (!this.state.isActive) return;
    this.state.statusText = 'PHASE I: ENTERING POSITIONS';
    this.state.phase = 'ENTRY_PENDING';
    this.emitStatus();
    Logger.info(`DeltaNeutralBot: [SHADOW] Initiating Bidirectional Entry for ${this.state.qty} ${this.state.symbol}`);

    try {
      const ticker = await this.publicClient.fetchTicker(this.state.symbol);
      const currentPrice = ticker.last;
      if (!currentPrice) throw new Error("Could not fetch current price");

      Logger.info(`[SHADOW] Simulated MARKET BUY Master @ ${currentPrice}`);
      Logger.info(`[SHADOW] Simulated MARKET SELL Slave @ ${currentPrice}`);

      this.state.masterEntryPrice = currentPrice;
      this.state.slaveEntryPrice = currentPrice;
      this.state.longStopTriggered = false;
      this.state.shortStopTriggered = false;
      this.state.livePnL = 0;
      this.highWaterMark = currentPrice;
      this.startTime = Date.now();
      this.mode = 'HEDGED';
      this.state.phase = 'HEDGED';
      this.state.statusText = 'PHASE II: NEUTRAL MONITORING';

      this.logEvent('ENTRY', currentPrice, `Hedged entry: BUY+SELL @ ${currentPrice}`);
      this.emitStatus();
      this.startStateEngine();
    } catch (error) {
      Logger.error("DeltaNeutralBot Entry Failed:", error);
      this.stop();
    }
  }

  public async stop() {
    this.state.isActive = false;
    this.state.statusText = 'ABORTED';
    this.state.phase = 'CLOSED';
    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);
    if (this.entryCheckInterval) clearInterval(this.entryCheckInterval);
    Logger.info("Delta Neutral Bot Aborted.");
    this.logEvent('ABORT', 0, 'User manually aborted the bot');
    this.emitStatus();
  }

  public getStatus() { return this.state; }

  private emitStatus() {
    if (this.io) this.io.emit('delta_neutral_status', this.state);
  }

  private async closeAll(reason: string) {
    Logger.warn(`DeltaNeutralBot: [SHADOW] Closing ALL. Reason: ${reason}`);
    this.state.statusText = `CLOSING: ${reason}`;
    this.state.phase = 'CLOSED';
    this.logEvent('CLOSE_ALL', 0, reason);
    this.emitStatus();

    this.state.longStopTriggered = true;
    this.state.shortStopTriggered = true;
    this.state.totalCyclesCompleted++;

    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);

    // Multi-Cycle: if enabled and under max, re-enter immediately
    const maxCycles = this.config.maxCycles || 1;
    if (this.config.enableMultiCycle && this.state.totalCyclesCompleted < maxCycles) {
      Logger.info(`[MULTI-CYCLE] Completed cycle ${this.state.totalCyclesCompleted}/${maxCycles}. Re-entering...`);
      this.state.statusText = `CYCLE ${this.state.totalCyclesCompleted}/${maxCycles}: Re-entering...`;
      this.state.longStopTriggered = false;
      this.state.shortStopTriggered = false;
      this.state.masterEntryPrice = 0;
      this.state.slaveEntryPrice = 0;
      this.state.livePnL = 0;
      this.emitStatus();
      await new Promise(r => setTimeout(r, 1500)); // brief pause
      await this.initiateBidirectionalEntry();
    } else {
      this.state.isActive = false;
      this.state.statusText = `DONE: ${reason}`;
      this.emitStatus();
    }
  }

  // ─────────────────────────────────────────────
  //  PHASE II & III: STATE ENGINE
  // ─────────────────────────────────────────────
  private startStateEngine() {
    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);

    const priceOffset = this.state.stopLossUSDT / this.state.qty;
    const masterStopPrice = this.state.masterEntryPrice - priceOffset;
    const slaveStopPrice  = this.state.slaveEntryPrice  + priceOffset;

    this.priceCheckInterval = setInterval(async () => {
      if (!this.state.isActive) { clearInterval(this.priceCheckInterval!); return; }

      try {
        // ── Chronological Abort (Time Limit) ────────────────
        if (this.config.timeLimitMins) {
          const elapsedMins = (Date.now() - this.startTime) / 60000;
          if (elapsedMins >= this.config.timeLimitMins) {
            await this.closeAll(`Time Limit Reached (${this.config.timeLimitMins}m)`);
            return;
          }
        }

        const ticker = await this.publicClient.fetchTicker(this.state.symbol);
        const currentPrice = ticker.last;
        if (!currentPrice) return;

        // ── Live Combined PnL ─────────────────────────────────
        const masterPnL = (currentPrice - this.state.masterEntryPrice) * this.state.qty;
        const slavePnL  = (this.state.slaveEntryPrice - currentPrice) * this.state.qty;
        this.state.livePnL = parseFloat((masterPnL + slavePnL).toFixed(4));

        // ─────────────────────────────────────────────────────
        //  STATE: PHASE II — HEDGED / NEUTRAL MONITORING
        // ─────────────────────────────────────────────────────
        if (this.mode === 'HEDGED') {
          this.state.statusText = 'PHASE II: NEUTRAL MONITORING';
          this.state.phase = 'HEDGED';

          // Global TP (combined net)
          if (this.config.takeProfitUSDT && this.state.livePnL >= this.config.takeProfitUSDT) {
            await this.closeAll(`Net TP Hit (+${this.state.livePnL.toFixed(2)} USDT)`);
            return;
          }

          // ── Asymmetric Break: Master Long SL Hit ─────────
          if (currentPrice <= masterStopPrice) {
            Logger.warn(`[SHADOW] Master Long SL Hit @ ${currentPrice}. Closing Master.`);
            this.state.longStopTriggered = true;
            this.state.cycles++;

            if (this.config.useSmartTrailing) {
              this.mode = 'TRAILING_SHORT';
              this.state.phase = 'TRAILING_SHORT';
              // Breakeven + 0.2% fee buffer (slave is short, so SL is above entry)
              this.trailingSLPrice = this.state.slaveEntryPrice * 0.998;
              this.highWaterMark = this.state.slaveEntryPrice; // for progressive mode
              this.state.trailingSL = this.trailingSLPrice;
              Logger.info(`[PHASE III] TRAILING_SHORT. Slave BE SL: ${this.trailingSLPrice.toFixed(2)}`);
            } else {
              await this.closeAll('Master SL hit. Smart Trailing OFF.');
              return;
            }

          // ── Asymmetric Break: Slave Short SL Hit ─────────
          } else if (currentPrice >= slaveStopPrice) {
            Logger.warn(`[SHADOW] Slave Short SL Hit @ ${currentPrice}. Closing Slave.`);
            this.state.shortStopTriggered = true;
            this.state.cycles++;

            if (this.config.useSmartTrailing) {
              this.mode = 'TRAILING_LONG';
              this.state.phase = 'TRAILING_LONG';
              // Breakeven + 0.2% fee buffer (master is long, so SL is below entry)
              this.trailingSLPrice = this.state.masterEntryPrice * 1.002;
              this.highWaterMark = this.state.masterEntryPrice; // for progressive mode
              this.state.trailingSL = this.trailingSLPrice;
              Logger.info(`[PHASE III] TRAILING_LONG. Master BE SL: ${this.trailingSLPrice.toFixed(2)}`);
            } else {
              await this.closeAll('Slave SL hit. Smart Trailing OFF.');
              return;
            }
          }

        // ─────────────────────────────────────────────────────
        //  STATE: PHASE III — INDICATOR TRAILING (EXTRACTION)
        // ─────────────────────────────────────────────────────
        } else if (this.mode === 'TRAILING_LONG' || this.mode === 'TRAILING_SHORT') {
          this.state.statusText = `PHASE III: ${this.mode} EXTRACTION`;

          // ── Progressive Trailing SL Ratchet ──────────────
          const step = (this.config.trailingStep || 0.5) / 100;
          if (this.mode === 'TRAILING_LONG') {
            if (currentPrice > this.highWaterMark) {
              this.highWaterMark = currentPrice;
              if (this.config.trailingMode === 'PROGRESSIVE') {
                this.trailingSLPrice = this.highWaterMark * (1 - step);
                this.state.trailingSL = this.trailingSLPrice;
                Logger.info(`[PROGRESSIVE SL] New SL: ${this.trailingSLPrice.toFixed(2)} (HWM: ${this.highWaterMark.toFixed(2)})`);
              }
            }
            // Breakeven / Progressive SL hit
            if (currentPrice <= this.trailingSLPrice) {
              await this.closeAll(`Trailing Long SL Hit @ ${currentPrice.toFixed(2)}`);
              return;
            }
          } else if (this.mode === 'TRAILING_SHORT') {
            if (currentPrice < this.highWaterMark) {
              this.highWaterMark = currentPrice;
              if (this.config.trailingMode === 'PROGRESSIVE') {
                this.trailingSLPrice = this.highWaterMark * (1 + step);
                this.state.trailingSL = this.trailingSLPrice;
                Logger.info(`[PROGRESSIVE SL] New SL: ${this.trailingSLPrice.toFixed(2)} (LWM: ${this.highWaterMark.toFixed(2)})`);
              }
            }
            if (currentPrice >= this.trailingSLPrice) {
              await this.closeAll(`Trailing Short SL Hit @ ${currentPrice.toFixed(2)}`);
              return;
            }
          }

          // ── RSI + Williams %R Indicator Exit ─────────────
          const ohlcv = await this.publicClient.fetchOHLCV(this.state.symbol, '1m', undefined, 50);
          if (ohlcv.length < 20) return;

          const high  = ohlcv.map((d: any[]) => Number(d[2]));
          const low   = ohlcv.map((d: any[]) => Number(d[3]));
          const close = ohlcv.map((d: any[]) => Number(d[4]));

          const rsiValues = RSI.calculate({ period: this.config.rsiPeriod || 14, values: close });
          const wrValues  = WilliamsR.calculate({ period: this.config.wrPeriod || 14, high, low, close });

          if (!rsiValues.length || !wrValues.length) return;

          const currentRSI = rsiValues[rsiValues.length - 1];
          const currentWR  = wrValues[wrValues.length - 1];

          // Exit LONG: Overbought exhaustion
          if (this.mode === 'TRAILING_LONG') {
            if (currentRSI > (this.config.rsiOverbought || 70) && currentWR > (this.config.wrOverbought || -20)) {
              await this.closeAll(`Indicator EXIT LONG. RSI:${currentRSI.toFixed(1)} WR:${currentWR.toFixed(1)}`);
              return;
            }
          }
          // Exit SHORT: Oversold exhaustion
          if (this.mode === 'TRAILING_SHORT') {
            if (currentRSI < (this.config.rsiOversold || 30) && currentWR < (this.config.wrOversold || -80)) {
              await this.closeAll(`Indicator EXIT SHORT. RSI:${currentRSI.toFixed(1)} WR:${currentWR.toFixed(1)}`);
              return;
            }
          }
        }

        this.state.cycles++;
        this.emitStatus();

      } catch (error) {
        Logger.error("DeltaNeutralBot State Engine Error:", error);
      }
    }, 1000);
  }
}
