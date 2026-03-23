import ccxt from 'ccxt';
import { Logger } from '../../logger.js';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import Database from 'better-sqlite3';

dotenv.config({ quiet: true });

export interface BotConfig {
  entryMode: 'INSTANT' | 'SCHEDULED';
  scheduleTimeStr: string;
  sessionTarget: 'LONDON' | 'NEW_YORK' | 'ASIA';
  usePreviousDayAvg: boolean;
  customAnchorPrice: number;
  bullishSL: number;
  bullishTP: number;
  bearishSL: number;
  bearishTP: number;
}

export interface BotState {
  isActive: boolean;
  symbol: string;
  qty: number;
  masterEntryPrice: number;
  slaveEntryPrice: number;
  livePnL: number;
  phase: 'IDLE' | 'ARMED' | 'SCHEDULED' | 'HEDGED' | 'NAKED_LONG' | 'NAKED_SHORT' | 'PARTIAL_EXIT' | 'RECOVERY_MODE' | 'ASYMMETRIC_BREAK' | 'CLOSED';
  scheduledTime?: number;
  anchorPrice?: number;
  
  // Voltron Execution Hands
  bullishSL?: number;
  bullishTP?: number;
  bearishSL?: number;
  bearishTP?: number;
  
  realizedLoss?: number;

  // Recovery System (§6)
  recoveryTarget?: number;
  recoveryMode?: 'AUTO' | 'CONFIRM' | 'HOLD';
  recoveryDeadline?: number;
  
  // Re-Anchoring System (§7)
  reAnchorCount?: number;
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
  private publicClient: any;
  private io: SocketIOServer | null;
  private db: Database.Database;
  private tradeCopier: any = null;
  
  public setTradeCopier(copier: any) { this.tradeCopier = copier; }
  
  public state: BotState = {
    isActive: false, symbol: '', qty: 0,
    masterEntryPrice: 0, slaveEntryPrice: 0,
    livePnL: 0, phase: 'IDLE', realizedLoss: 0
  };

  private priceCheckInterval: NodeJS.Timeout | null = null;
  private scheduleInterval: NodeJS.Timeout | null = null;
  private startTime: number = 0;
  private config: BotConfig = {} as BotConfig;
  private tradeLog: TradeLogEntry[] = [];

  constructor(io?: SocketIOServer) {
    this.io = io || null;
    this.db = new Database('shadow_orders.db');
    this.publicClient = new (ccxt as any).binance({ enableRateLimit: true });
  }

  private insertShadowTrade(slaveId: string, side: 'BUY' | 'SELL', qty: number, price: number) {
    const tradeId = `straddle_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    this.db.prepare(`
      INSERT INTO copied_fills_v2 
      (slave_id, master_trade_id, master_order_id, slave_order_id, symbol, side, quantity, price, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(slaveId, tradeId, tradeId, tradeId, this.state.symbol, side, qty, price, Date.now());
    
    const baseAsset = this.state.symbol.split('/')[0] || '';
    const row: any = this.db.prepare(`SELECT balance FROM shadow_balances WHERE slave_id = ? AND asset = ?`).get(slaveId, baseAsset) || { balance: 0 };
    let newBal = Number(row.balance || 0);
    newBal += (side === 'BUY' ? qty : -qty);
    this.db.prepare(`
       INSERT INTO shadow_balances (slave_id, asset, balance) VALUES (?, ?, ?)
       ON CONFLICT(slave_id, asset) DO UPDATE SET balance = excluded.balance
    `).run(slaveId, baseAsset, newBal);

    if (this.io) {
       this.io.emit('trade_copied');
       this.io.emit('new_trade');
    }
  }

  private addVisualGuard(idPrefix: string, limitPrice: number, side: 'buy' | 'sell', type: 'limit' | 'stop') {
    const baseAsset = this.state.symbol.split('/')[0] || '';
    let quoteAsset = this.state.symbol.split('/')[1] || 'USDT';
    if (this.state.symbol.indexOf('/') === -1) quoteAsset = 'USDT';
    
    const id = `sim_pending_${idPrefix}_${Date.now()}`;
    this.db.prepare(`
        INSERT OR REPLACE INTO shadow_pending_orders 
        (id, symbol, side, type, amount, limitPrice, stopPrice, marginMode, baseAsset, quoteAsset, balanceAsset, status)
        VALUES (@id, @symbol, @side, @type, @amount, @limitPrice, @stopPrice, @marginMode, @baseAsset, @quoteAsset, @balanceAsset, @status)
    `).run({
        id, symbol: this.state.symbol.replace('/', ''), side, type, amount: this.state.qty,
        limitPrice: type === 'limit' ? limitPrice : null, stopPrice: type === 'stop' ? limitPrice : null,
        marginMode: 'cross', baseAsset, quoteAsset, balanceAsset: quoteAsset, status: 'open'
    });
  }

  private clearPendingShadowOrders() {
    const sym = this.state.symbol.replace('/', '');
    this.db.prepare(`UPDATE shadow_pending_orders SET status = 'canceled' WHERE symbol = ? AND status = 'open' AND id LIKE '%sim_pending_%'`).run(sym);
  }

  private logEvent(event: string, price: number, details: string) {
    const entry: TradeLogEntry = {
      timestamp: Date.now(),
      event,
      phase: this.state.phase,
      price,
      pnl: this.state.livePnL || 0,
      details,
    };
    this.tradeLog.push(entry);
    Logger.info(`[STRADDLE_LOG] ${event}: ${details} @ ${price}`);
  }

  public getTradeLog(): TradeLogEntry[] { return this.tradeLog; }

  public async start(symbol: string, qty: number, config: BotConfig) {
    if (this.state.isActive) throw new Error("Bot is already active");

    let ccxtSymbol = symbol;
    if (!ccxtSymbol.includes('/') && ccxtSymbol.endsWith('USDT')) {
      ccxtSymbol = ccxtSymbol.replace('USDT', '/USDT');
    }

    this.state = {
      ...this.state,
      isActive: true, symbol: ccxtSymbol, qty,
      masterEntryPrice: 0, slaveEntryPrice: 0, livePnL: 0, realizedLoss: 0,
      phase: config.entryMode === 'SCHEDULED' ? 'SCHEDULED' : 'IDLE'
    };
    this.config = config;
    this.tradeLog = [];

    this.emitStatus();

    if (config.entryMode === 'SCHEDULED') {
      const targetTime = new Date(config.scheduleTimeStr).getTime();
      if (isNaN(targetTime) || targetTime <= Date.now()) {
        throw new Error("Invalid or past schedule time. Cannot schedule.");
      }
      this.state.scheduledTime = targetTime;
      this.logEvent('SCHEDULED', 0, `Hedge scheduled to drop at ${new Date(targetTime).toISOString()}`);
      this.emitStatus();
      this.waitForExecution();
    } else {
      await this.executeHedge();
    }
  }

  private waitForExecution() {
    this.scheduleInterval = setInterval(async () => {
      if (!this.state.isActive) {
        clearInterval(this.scheduleInterval!);
        return;
      }
      if (this.state.scheduledTime && Date.now() >= this.state.scheduledTime) {
        clearInterval(this.scheduleInterval!);
        Logger.info("[SCHEDULE] Target time reached. Executing Phase 1 Asymmetric Hedge!");
        await this.executeHedge();
      }
    }, 500); 
  }

  private async executeHedge() {
    // §3: ARMED → HEDGED transition
    this.state.phase = 'ARMED';
    this.state.reAnchorCount = this.state.reAnchorCount || 0;
    this.emitStatus();
    Logger.info(`[ASYMMETRIC STRADDLE] Phase 1 Execution for ${this.state.qty} ${this.state.symbol}`);

    try {
      const ticker = await this.publicClient.fetchTicker(this.state.symbol);
      const currentPrice = ticker.last;
      if (!currentPrice) throw new Error("Could not fetch current price");

      // Calculate Anchor Price
      let anchor = this.config.customAnchorPrice;
      if (this.config.usePreviousDayAvg) {
        const ohlcv = await this.publicClient.fetchOHLCV(this.state.symbol, '1d', undefined, 2);
        if (ohlcv && ohlcv.length >= 2) {
           const yesterday = ohlcv[0]; 
           const high = Number(yesterday[2]);
           const low = Number(yesterday[3]);
           const close = Number(yesterday[4]);
           anchor = (high + low + close) / 3;
           Logger.info(`[PHASE 1] Calculated Previous Day Avg Anchor: $${anchor.toFixed(4)}`);
        } else {
           Logger.warn(`[PHASE 1] Failed to fetch 1d kline, falling back to current price anchor.`);
           anchor = currentPrice;
        }
      }

      this.state.anchorPrice = anchor;

      // Voltron Execution Hands Math Calculation
      const bullishSL = (currentPrice + anchor) / 2;
      const bullishTP = currentPrice + 3 * (currentPrice - bullishSL);
      const offset = Math.abs(currentPrice - anchor);
      const bearishSL = currentPrice + (offset * 2);
      const bearishTP = anchor;

      // Assign to state (override config provided if zero)
      this.state.bullishSL = this.config.bullishSL > 0 ? this.config.bullishSL : bullishSL;
      this.state.bullishTP = this.config.bullishTP > 0 ? this.config.bullishTP : bullishTP;
      this.state.bearishSL = this.config.bearishSL > 0 ? this.config.bearishSL : bearishSL;
      this.state.bearishTP = this.config.bearishTP > 0 ? this.config.bearishTP : bearishTP;

      this.state.masterEntryPrice = currentPrice;
      this.state.slaveEntryPrice = currentPrice;
      this.state.livePnL = 0;
      this.state.realizedLoss = 0;
      this.startTime = Date.now();

      this.logEvent('ENTRY', currentPrice, `Hedged Voltron Phase 1 Lock established. Anchor: ${anchor.toFixed(2)} | Bull[SL:${this.state.bullishSL.toFixed(2)} TP:${this.state.bullishTP.toFixed(2)}] | Bear[SL:${this.state.bearishSL.toFixed(2)} TP:${this.state.bearishTP.toFixed(2)}]`);
      
      this.clearPendingShadowOrders();
      this.insertShadowTrade('master', 'BUY', this.state.qty, currentPrice);
      this.insertShadowTrade('slave_1', 'SELL', this.state.qty, currentPrice);
      
      this.addVisualGuard('BULLISH_SL', this.state.bullishSL, 'sell', 'stop');
      this.addVisualGuard('BEARISH_SL', this.state.bearishSL, 'buy', 'stop');

      // §5: ATOMIC EXECUTION with rollback
      const isShadowMode = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';
      if (!isShadowMode && this.tradeCopier) {
        const master = this.tradeCopier.getMasterClient();
        const slave = this.tradeCopier.getSlaveClient(0);
        const straddleId = `STRADDLE_${Date.now()}`;
        if (master && slave) {
          this.logEvent('LIVE_EXECUTION', currentPrice, `Deploying Atomic Margin Hedge to Binance API...`);
          let masterOrder: any = null;
          try {
            // Step 1: Execute Bullish leg (BUY)
            masterOrder = await master.createOrder(this.state.symbol, 'market', 'buy', this.state.qty, undefined, { marginMode: 'cross', newClientOrderId: `${straddleId}_M` });
            
            // Step 2: Execute Bearish leg (SELL) — if this fails, rollback Step 1
            let slaveOrder: any = null;
            try {
              slaveOrder = await slave.createOrder(this.state.symbol, 'market', 'sell', this.state.qty, undefined, { marginMode: 'cross', sideEffectType: 'MARGIN_BUY', newClientOrderId: `${straddleId}_S` });
            } catch (slaveErr: any) {
              // §5 ATOMIC ROLLBACK: Cancel/reverse the master order immediately
              this.logEvent('ATOMIC_ROLLBACK', currentPrice, `Bearish leg FAILED (${slaveErr.message}). Rolling back Bullish order...`);
              try {
                await master.createOrder(this.state.symbol, 'market', 'sell', this.state.qty, undefined, { marginMode: 'cross', newClientOrderId: `${straddleId}_ROLLBACK` });
                this.logEvent('ATOMIC_ROLLBACK_OK', currentPrice, `Bullish leg successfully reversed. System safe.`);
              } catch (rollbackErr: any) {
                this.logEvent('ATOMIC_ROLLBACK_FAIL', currentPrice, `CRITICAL: Rollback FAILED (${rollbackErr.message}). Manual intervention required!`);
              }
              if (this.io) this.io.emit('execution_failed', { error: slaveErr.message, side: 'BEARISH' });
              this.stop();
              return;
            }

            // §5 FILL PRICE ADJUSTMENT: Recalculate SL/TP from actual fills
            const masterFillPrice = masterOrder?.average || masterOrder?.price || currentPrice;
            const slaveFillPrice = slaveOrder?.average || slaveOrder?.price || currentPrice;
            this.state.masterEntryPrice = masterFillPrice;
            this.state.slaveEntryPrice = slaveFillPrice;
            
            // Recalculate bounds from actual fill prices
            const fillAnchor = this.state.anchorPrice || anchor;
            const adjBullSL = (masterFillPrice + fillAnchor) / 2;
            const adjBullTP = masterFillPrice + 3 * (masterFillPrice - adjBullSL);
            const adjOffset = Math.abs(slaveFillPrice - fillAnchor);
            const adjBearSL = slaveFillPrice + (adjOffset * 2);
            
            this.state.bullishSL = adjBullSL;
            this.state.bullishTP = adjBullTP;
            this.state.bearishSL = adjBearSL;
            this.state.bearishTP = fillAnchor;
            
            this.logEvent('FILL_ADJUSTED', masterFillPrice, `SL/TP recalculated from actual fills. Master: $${masterFillPrice.toFixed(2)}, Slave: $${slaveFillPrice.toFixed(2)}`);
            this.clearPendingShadowOrders();
            this.addVisualGuard('BULLISH_SL', this.state.bullishSL, 'sell', 'stop');
            this.addVisualGuard('BEARISH_SL', this.state.bearishSL, 'buy', 'stop');

          } catch (masterErr: any) {
            // Master (Bullish) order itself failed — nothing to rollback
            this.logEvent('LIVE_ERROR', currentPrice, `Bullish leg FAILED: ${masterErr.message}. No orders placed.`);
            if (this.io) this.io.emit('execution_failed', { error: masterErr.message, side: 'BULLISH' });
            this.stop();
            return;
          }
        }
      }

      // Transition ARMED → HEDGED
      this.state.phase = 'HEDGED';
      this.emitStatus();
      this.startStateEngine();
    } catch (error) {
      Logger.error("Straddle Phase 1 Execution Failed:", error);
      this.stop();
    }
  }

  public async stop() {
    this.state.isActive = false;
    this.state.phase = 'CLOSED';
    this.state.scheduledTime = undefined;
    if (this.scheduleInterval) clearInterval(this.scheduleInterval);
    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);
    Logger.info("Asymmetric Bot Phase 1 Aborted.");
    this.logEvent('ABORT', 0, 'User manually killed the execution array');
    this.emitStatus();
  }

  public getStatus() { return this.state; }

  private emitStatus() {
    if (this.io) this.io.emit('delta_neutral_status', this.state);
  }

  // §6: Set recovery mode from external UI 
  public setRecoveryMode(mode: 'AUTO' | 'CONFIRM' | 'HOLD', deadlineMs?: number) {
    this.state.recoveryMode = mode;
    if (deadlineMs) this.state.recoveryDeadline = Date.now() + deadlineMs;
    this.logEvent('RECOVERY_CONFIG', 0, `Recovery mode set to ${mode}${deadlineMs ? `, deadline in ${deadlineMs / 1000}s` : ''}`);
    this.emitStatus();
  }

  // §7: Re-Anchor from external UI
  public async reAnchor(newAnchorPrice: number) {
    if ((this.state.reAnchorCount || 0) >= 4) {
      this.logEvent('REANCHOR_LIMIT', newAnchorPrice, `Re-anchor limit (4) reached. System halted.`);
      this.stop();
      return;
    }
    this.state.reAnchorCount = (this.state.reAnchorCount || 0) + 1;
    this.config.customAnchorPrice = newAnchorPrice;
    this.logEvent('REANCHOR', newAnchorPrice, `Re-anchored to $${newAnchorPrice.toFixed(2)} (cycle ${this.state.reAnchorCount}/4)`);
    await this.executeHedge();
  }

  private startStateEngine() {
    if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);

    this.priceCheckInterval = setInterval(async () => {
      if (!this.state.isActive) { 
        clearInterval(this.priceCheckInterval!); 
        return; 
      }

      try {
        const ticker = await this.publicClient.fetchTicker(this.state.symbol);
        const currentPrice = ticker.last;
        if (!currentPrice) return;

        const isShadowMode = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';

        // ──────────────────────────────────────────────────
        //  STATE: HEDGED (Both legs active)
        // ──────────────────────────────────────────────────
        if (this.state.phase === 'HEDGED') {
          const masterPnL = (currentPrice - this.state.masterEntryPrice) * this.state.qty;
          const slavePnL  = (this.state.slaveEntryPrice - currentPrice) * this.state.qty;
          this.state.livePnL = parseFloat((masterPnL + slavePnL).toFixed(4));

          if (this.state.bearishSL && currentPrice >= this.state.bearishSL) {
             const slaveLoss = (this.state.slaveEntryPrice - currentPrice) * this.state.qty;
             this.state.realizedLoss = parseFloat(slaveLoss.toFixed(4));
             this.state.recoveryTarget = currentPrice; // §6: Store recovery target
             
             this.logEvent('GUARD_BREACH_UPPER', currentPrice, `Bearish SL hit (${this.state.bearishSL.toFixed(2)}). Realized loss: ${this.state.realizedLoss} USDT.`);
             
             this.state.bullishSL = this.state.masterEntryPrice; 
             this.logEvent('WHIPSAW_PROTECT', currentPrice, `Moved Survivor (Long) SL to Breakeven @ ${this.state.bullishSL}`);

             this.clearPendingShadowOrders();
             this.insertShadowTrade('slave_1', 'BUY', this.state.qty, currentPrice);
             this.addVisualGuard('MASTER_BE', this.state.bullishSL, 'sell', 'limit');

             if (!isShadowMode && this.tradeCopier) {
               try {
                 const slave = this.tradeCopier.getSlaveClient(0);
                 if (slave) await slave.createOrder(this.state.symbol, 'market', 'buy', this.state.qty, undefined, { marginMode: 'cross', sideEffectType: 'AUTO_REPAY', newClientOrderId: `VOLTRON_CLOSES_${Date.now()}` });
               } catch (e: any) { this.logEvent('LIVE_ERROR', currentPrice, `Phase 2 Slave Liquidation Failed: ${e.message}`); }
             }

             this.state.phase = 'NAKED_LONG';
             this.emitStatus();
          }
          else if (this.state.bullishSL && currentPrice <= this.state.bullishSL) {
             const masterLoss = (currentPrice - this.state.masterEntryPrice) * this.state.qty;
             this.state.realizedLoss = parseFloat(masterLoss.toFixed(4));
             this.state.recoveryTarget = currentPrice; // §6: Store recovery target

             this.logEvent('GUARD_BREACH_LOWER', currentPrice, `Bullish SL hit (${this.state.bullishSL.toFixed(2)}). Realized loss: ${this.state.realizedLoss} USDT.`);
             
             this.state.bearishSL = this.state.slaveEntryPrice;
             this.logEvent('WHIPSAW_PROTECT', currentPrice, `Moved Survivor (Short) SL to Breakeven @ ${this.state.bearishSL}`);

             this.clearPendingShadowOrders();
             this.insertShadowTrade('master', 'SELL', this.state.qty, currentPrice);
             this.addVisualGuard('SLAVE_BE', this.state.bearishSL, 'buy', 'limit');

             if (!isShadowMode && this.tradeCopier) {
               try {
                 const master = this.tradeCopier.getMasterClient();
                 if (master) await master.createOrder(this.state.symbol, 'market', 'sell', this.state.qty, undefined, { marginMode: 'cross', newClientOrderId: `VOLTRON_CLOSEM_${Date.now()}` });
               } catch (e: any) { this.logEvent('LIVE_ERROR', currentPrice, `Phase 2 Master Liquidation Failed: ${e.message}`); }
             }

             this.state.phase = 'NAKED_SHORT';
             this.emitStatus();
          } else {
             this.emitStatus();
          }
        }
        // ──────────────────────────────────────────────────
        //  STATE: NAKED_LONG (Account A riding solo)
        // ──────────────────────────────────────────────────
        else if (this.state.phase === 'NAKED_LONG') {
          const nakedPnL = (currentPrice - this.state.masterEntryPrice) * this.state.qty;
          this.state.livePnL = parseFloat((nakedPnL + (this.state.realizedLoss || 0)).toFixed(4));
          
          // §5: Catastrophic Close — whipsaw hits survivor SL
          if (this.state.bullishSL && currentPrice <= this.state.bullishSL) {
             this.logEvent('WHIPSAW_TRIGGERED', currentPrice, `Market reversed! Stopped out Naked Long at Breakeven.`);
             this.insertShadowTrade('master', 'SELL', this.state.qty, currentPrice);
             this.clearPendingShadowOrders();

             if (!isShadowMode && this.tradeCopier) {
               try {
                 const master = this.tradeCopier.getMasterClient();
                 if (master) await master.createOrder(this.state.symbol, 'market', 'sell', this.state.qty, undefined, { marginMode: 'cross', newClientOrderId: `VOLTRON_WHIPM_${Date.now()}` });
               } catch (e: any) { this.logEvent('LIVE_ERROR', currentPrice, `Phase 3 Master Liquidation Failed: ${e.message}`); }
             }

             // §6: Enter RECOVERY_MODE instead of immediate CLOSED
             this.state.phase = 'RECOVERY_MODE';
             if (!this.state.recoveryDeadline) this.state.recoveryDeadline = Date.now() + (4 * 60 * 60 * 1000); // Default: 4 hours
             this.logEvent('RECOVERY_ENTER', currentPrice, `Entering Recovery Mode. Target: $${(this.state.recoveryTarget || currentPrice).toFixed(2)}, Deadline: ${new Date(this.state.recoveryDeadline).toISOString()}`);
             if (this.io) this.io.emit('recovery_triggered', { target: this.state.recoveryTarget, deadline: this.state.recoveryDeadline });
             this.emitStatus();
          }
          // §7: Take Profit → PARTIAL_EXIT (allows re-anchor)
          else if (this.state.bullishTP && currentPrice >= this.state.bullishTP) {
             this.logEvent('TAKE_PROFIT_HIT', currentPrice, `Bullish Take Profit Extracted! Gained max R:R.`);
             this.insertShadowTrade('master', 'SELL', this.state.qty, currentPrice);
             this.clearPendingShadowOrders();

             if (!isShadowMode && this.tradeCopier) {
               try {
                 const master = this.tradeCopier.getMasterClient();
                 if (master) await master.createOrder(this.state.symbol, 'market', 'sell', this.state.qty, undefined, { marginMode: 'cross', newClientOrderId: `VOLTRON_TP_M_${Date.now()}` });
               } catch (e: any) { this.logEvent('LIVE_ERROR', currentPrice, `Phase 3 TP Master Liquidation Failed: ${e.message}`); }
             }

             this.state.phase = 'PARTIAL_EXIT';
             if (this.io) this.io.emit('tp_hit', { side: 'BULLISH', price: currentPrice, reAnchorCount: this.state.reAnchorCount || 0 });
             this.emitStatus();
          }
          else {
             this.emitStatus();
          }
        }
        // ──────────────────────────────────────────────────
        //  STATE: NAKED_SHORT (Account B riding solo)
        // ──────────────────────────────────────────────────
        else if (this.state.phase === 'NAKED_SHORT') {
          const nakedPnL = (this.state.slaveEntryPrice - currentPrice) * this.state.qty;
          this.state.livePnL = parseFloat((nakedPnL + (this.state.realizedLoss || 0)).toFixed(4));
          
          // §5: Catastrophic Close — whipsaw hits survivor SL
          if (this.state.bearishSL && currentPrice >= this.state.bearishSL) {
             this.logEvent('WHIPSAW_TRIGGERED', currentPrice, `Market reversed! Stopped out Naked Short at Breakeven.`);
             this.insertShadowTrade('slave_1', 'BUY', this.state.qty, currentPrice);
             this.clearPendingShadowOrders();

             if (!isShadowMode && this.tradeCopier) {
               try {
                 const slave = this.tradeCopier.getSlaveClient(0);
                 if (slave) await slave.createOrder(this.state.symbol, 'market', 'buy', this.state.qty, undefined, { marginMode: 'cross', sideEffectType: 'AUTO_REPAY', newClientOrderId: `VOLTRON_WHIPS_${Date.now()}` });
               } catch (e: any) { this.logEvent('LIVE_ERROR', currentPrice, `Phase 3 Slave Liquidation Failed: ${e.message}`); }
             }

             // §6: Enter RECOVERY_MODE
             this.state.phase = 'RECOVERY_MODE';
             if (!this.state.recoveryDeadline) this.state.recoveryDeadline = Date.now() + (4 * 60 * 60 * 1000);
             this.logEvent('RECOVERY_ENTER', currentPrice, `Entering Recovery Mode. Target: $${(this.state.recoveryTarget || currentPrice).toFixed(2)}`);
             if (this.io) this.io.emit('recovery_triggered', { target: this.state.recoveryTarget, deadline: this.state.recoveryDeadline });
             this.emitStatus();
          }
          // §7: Take Profit → PARTIAL_EXIT
          else if (this.state.bearishTP && currentPrice <= this.state.bearishTP) {
             this.logEvent('TAKE_PROFIT_HIT', currentPrice, `Bearish Mean-Reversion Take Profit Extracted!`);
             this.insertShadowTrade('slave_1', 'BUY', this.state.qty, currentPrice);
             this.clearPendingShadowOrders();

             if (!isShadowMode && this.tradeCopier) {
               try {
                 const slave = this.tradeCopier.getSlaveClient(0);
                 if (slave) await slave.createOrder(this.state.symbol, 'market', 'buy', this.state.qty, undefined, { marginMode: 'cross', sideEffectType: 'AUTO_REPAY', newClientOrderId: `VOLTRON_TP_S_${Date.now()}` });
               } catch (e: any) { this.logEvent('LIVE_ERROR', currentPrice, `Phase 3 TP Slave Liquidation Failed: ${e.message}`); }
             }

             this.state.phase = 'PARTIAL_EXIT';
             if (this.io) this.io.emit('tp_hit', { side: 'BEARISH', price: currentPrice, reAnchorCount: this.state.reAnchorCount || 0 });
             this.emitStatus();
          }
          else {
             this.emitStatus();
          }
        }
        // ──────────────────────────────────────────────────
        //  STATE: RECOVERY_MODE (§6 — monitoring for recovery target)
        // ──────────────────────────────────────────────────
        else if (this.state.phase === 'RECOVERY_MODE') {
          // §6: Check deadline first
          if (this.state.recoveryDeadline && Date.now() >= this.state.recoveryDeadline) {
            this.logEvent('RECOVERY_TIMEOUT', currentPrice, `Recovery deadline expired. Force closing system.`);
            if (this.io) this.io.emit('recovery_timeout');
            this.state.phase = 'CLOSED';
            this.emitStatus();
            if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);
            return;
          }

          // §6: Check if price returned to recovery target
          if (this.state.recoveryTarget) {
            const distanceToTarget = Math.abs(currentPrice - this.state.recoveryTarget);
            const tolerance = this.state.recoveryTarget * 0.001; // 0.1% tolerance

            if (distanceToTarget <= tolerance) {
              if (this.state.recoveryMode === 'AUTO' || !this.state.recoveryMode) {
                this.logEvent('RECOVERY_HIT', currentPrice, `Price returned to recovery target $${this.state.recoveryTarget.toFixed(2)}. Auto-closing at break-even.`);
                this.state.phase = 'CLOSED';
                if (this.io) this.io.emit('recovery_completed', { action: 'breakeven', price: currentPrice });
                this.emitStatus();
                if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);
              } else if (this.state.recoveryMode === 'CONFIRM') {
                // Emit event for UI to show confirmation dialog
                if (this.io) this.io.emit('recovery_confirm_needed', { price: currentPrice, target: this.state.recoveryTarget });
              }
              // HOLD mode: do nothing, just keep monitoring
            }
          }
          this.emitStatus();
        }
        // ──────────────────────────────────────────────────
        //  STATE: PARTIAL_EXIT (§7 — waiting for re-anchor decision)
        // ──────────────────────────────────────────────────
        else if (this.state.phase === 'PARTIAL_EXIT') {
          // Idle state — waiting for user to call reAnchor() or stop()
          // Auto-close after 30 minutes if no decision
          if (this.startTime && Date.now() - this.startTime > 30 * 60 * 1000) {
            this.logEvent('PARTIAL_TIMEOUT', currentPrice, `No re-anchor decision within 30 minutes. Closing.`);
            this.state.phase = 'CLOSED';
            this.emitStatus();
            if (this.priceCheckInterval) clearInterval(this.priceCheckInterval);
          } else {
            this.emitStatus();
          }
        }

      } catch (error) {
        Logger.error("State Engine Error:", error);
      }
    }, 1000);
  }
}
