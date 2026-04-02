import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import ccxt from 'ccxt';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import WebSocketClient from 'ws';
import { Logger } from './logger';
import Database from 'better-sqlite3';
import os from 'os';
import { EMA, MACD, RSI, BollingerBands, ATR, SMA, PSAR, WilliamsR, OBV, StochasticRSI, Stochastic } from 'technicalindicators';
import { TradeCopier } from './tradeCopier';
import { DeltaNeutralBot } from './src/services/deltaNeutralBot.js';
import { DeltaMasterBot } from './src/services/deltaMasterBot.js';
import { BinanceMasterBot } from './src/services/binanceMasterBot.js';
import { Logger as LoggerJs } from './logger.js';

dotenv.config({ quiet: true });

const shadowDb = new Database('shadow_orders.db');
shadowDb.exec(`
  CREATE TABLE IF NOT EXISTS shadow_pending_orders (
    id TEXT PRIMARY KEY,
    symbol TEXT,
    side TEXT,
    type TEXT,
    amount REAL,
    limitPrice REAL,
    stopPrice REAL,
    marginMode TEXT,
    baseAsset TEXT,
    quoteAsset TEXT,
    balanceAsset TEXT,
    status TEXT
  )
`);

// Clear any open shadow orders on startup to prevent "stale" orders from auto-executing on refresh
shadowDb.prepare("DELETE FROM shadow_pending_orders WHERE status = 'open'").run();

export const pendingShadowOrders: any[] = shadowDb.prepare('SELECT * FROM shadow_pending_orders WHERE status = ?').all('open');

export function addPendingShadowOrder(order: any) {
  pendingShadowOrders.push(order);
  const stmt = shadowDb.prepare(`
        INSERT OR REPLACE INTO shadow_pending_orders
        (id, symbol, side, type, amount, limitPrice, stopPrice, marginMode, baseAsset, quoteAsset, balanceAsset, status)
        VALUES (@id, @symbol, @side, @type, @amount, @limitPrice, @stopPrice, @marginMode, @baseAsset, @quoteAsset, @balanceAsset, @status)
    `);
  stmt.run({
    id: order.id, symbol: order.symbol, side: order.side, type: order.type,
    amount: order.amount, limitPrice: order.limitPrice || null, stopPrice: order.stopPrice || null,
    marginMode: order.marginMode || null, baseAsset: order.baseAsset, quoteAsset: order.quoteAsset,
    balanceAsset: order.balanceAsset, status: order.status
  });
}

export function updatePendingShadowOrderStatus(id: string, status: string) {
  const order = pendingShadowOrders.find((o: any) => o.id === id);
  if (order) order.status = status;
  shadowDb.prepare('UPDATE shadow_pending_orders SET status = ? WHERE id = ?').run(status, id);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { analyzeTradeAction } from './aiAnalyzer.ts';

async function startServer() {
  const app = express();
  const port = 3000;

  const httpServer = createServer(app);
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    Logger.info(`New client connected to UI WebSockets: ${socket.id}`);
    socket.on('disconnect', () => {
      Logger.info(`Client disconnected: ${socket.id}`);
    });
  });

  // Start Trade Copier Service
  const tradeCopier = new TradeCopier(io);
  tradeCopier.start().catch(err => Logger.error('Failed to start Trade Copier:', err));

  // Initialize Delta Neutral Bot
  const deltaNeutralBot = new DeltaNeutralBot(io);
  deltaNeutralBot.setTradeCopier(tradeCopier);

  // Initialize Delta Master Bot (Account A/B Insurance System)
  const deltaMasterBot = new DeltaMasterBot(io);
  const binanceMasterBot = new BinanceMasterBot(io);

  let isPendingEngineRunning = false;
  // ─── Shadow Pending Order Price-Matching Engine ────────────────────
  // Monitors live prices and fills pending shadow orders when targets are hit.
  async function startPendingOrderEngine() {
    if (pendingShadowOrders.length === 0) return;
    if (isPendingEngineRunning) return;
    isPendingEngineRunning = true;

    // Collect unique symbols from pending orders
    const symbols = [...new Set(pendingShadowOrders.map((o: any) => o.symbol.replace('/', '').toLowerCase()))];
    const streams = symbols.map(s => `${s}@trade`).join('/');
    const wsUrl = process.env.BINANCE_USE_TESTNET === 'true'
      ? `wss://testnet.binance.vision/stream?streams=${streams}`
      : `wss://stream.binance.com:9443/stream?streams=${streams}`;

    const pendingWs = new WebSocketClient(wsUrl);

    pendingWs.on('message', (raw: any) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (!payload.data) return;
        const tradePrice = parseFloat(payload.data.p);
        const tradeSymbol = payload.data.s; // e.g. BTCUSDT

        // Scan pending orders for fills
        for (let i = pendingShadowOrders.length - 1; i >= 0; i--) {
          const order = pendingShadowOrders[i];
          if (order.status !== 'open') continue;

          const orderSymbolFlat = order.symbol.replace('/', '');
          if (orderSymbolFlat !== tradeSymbol) continue;

          let triggered = false;

          if (order.type === 'limit') {
            // Limit BUY fills when price drops to or below limit price
            if (order.side === 'buy' && tradePrice <= order.limitPrice) triggered = true;
            // Limit SELL fills when price rises to or above limit price
            if (order.side === 'sell' && tradePrice >= order.limitPrice) triggered = true;
          } else if (order.type === 'oco') {
            // OCO: Take Profit leg (limit) or Stop Loss leg (stop)
            if (order.side === 'sell') {
              // Long position: TP triggers when price >= limitPrice, SL triggers when price <= stopPrice
              if (order.limitPrice && tradePrice >= order.limitPrice) triggered = true;
              if (order.stopPrice && tradePrice <= order.stopPrice) triggered = true;
            } else {
              // Short position: TP triggers when price <= limitPrice, SL triggers when price >= stopPrice
              if (order.limitPrice && tradePrice <= order.limitPrice) triggered = true;
              if (order.stopPrice && tradePrice >= order.stopPrice) triggered = true;
            }
          } else if (order.type === 'stop_limit' || order.type === 'stop_loss_limit') {
            if (order.side === 'sell' && tradePrice <= order.stopPrice) triggered = true;
            if (order.side === 'buy' && tradePrice >= order.stopPrice) triggered = true;
          }

          if (triggered) {
            updatePendingShadowOrderStatus(order.id, 'filled');
            const fillPrice = tradePrice;

            Logger.info(`[SHADOW ENGINE] Pending order FILLED: ${order.type.toUpperCase()} ${order.side.toUpperCase()} ${order.amount} ${order.symbol} @ ${fillPrice}`);

            // Update shadow balances
            const parts = order.symbol.split('/');
            const baseAsset = parts[0];
            const quoteAsset = parts[1] || 'USDT';
            tradeCopier.updateShadowBalance('master', baseAsset, quoteAsset, order.side, order.amount, fillPrice);

            // Record in DB
            const fakeReport = {
              e: 'executionReport', E: Date.now(), s: orderSymbolFlat,
              c: order.id, S: order.side.toUpperCase(), o: order.type.toUpperCase(),
              f: 'GTC', q: order.amount.toString(), p: fillPrice.toString(),
              P: '0', F: '0', g: -1, C: '', x: 'TRADE', X: 'FILLED', r: 'NONE',
              i: Date.now(), l: order.amount.toString(), z: order.amount.toString(),
              L: fillPrice.toString(), n: '0', T: Date.now(), t: Date.now(),
              I: 123456, w: false, M: false, marginType: order.marginMode ? order.marginMode.toUpperCase() : 'SPOT',
              O: Date.now(), Z: (order.amount * fillPrice).toString(),
              Y: (order.amount * fillPrice).toString(), Q: '0'
            };

            tradeCopier.processSimulatedMasterTrade(fakeReport).catch((err: any) => Logger.error('[SHADOW ENGINE] Fill processing error:', err));

            // Remove from array
            pendingShadowOrders.splice(i, 1);
          }
        }

        // If all pending orders filled, close connection naturally
        if (!pendingShadowOrders.some((o: any) => o.status === 'open')) {
          pendingWs.close();
        }
      } catch (e) {
        // Silently ignore parse errors on the price feed
      }
    });

    let _lastShadowWsErr = 0;
    pendingWs.on('error', (err: any) => {
      const now = Date.now();
      if (now - _lastShadowWsErr > 60_000) {
        _lastShadowWsErr = now;
        Logger.warn(`[SHADOW ENGINE] WS unavailable (${err.message}) — will retry`);
      }
    });
    pendingWs.on('close', () => {
      isPendingEngineRunning = false;
      // Reconnect if there are still pending orders
      if (pendingShadowOrders.some((o: any) => o.status === 'open')) {
        setTimeout(() => startPendingOrderEngine(), 3000);
      }
    });
  }

  // Check for new pending orders periodically and start the engine
  setInterval(() => {
    if (!isPendingEngineRunning && pendingShadowOrders.some((o: any) => o.status === 'open')) {
      startPendingOrderEngine();
    }
  }, 5000);

  app.use(cors());
  app.use(express.json());

  // Initialize Public Binance exchange (for market data)
  // Explicitly set apiKey/secret to undefined to ensure it's truly public
  const publicExchange = new (ccxt as any).binance({
    apiKey: undefined,
    secret: undefined,
    enableRateLimit: true,
    options: {
      defaultType: 'spot',
    },
  });

  // Initialize Authenticated Binance exchange (for trading/account)
  const authenticatedExchange = new (ccxt as any).binance({
    apiKey: process.env.BINANCE_API_KEY || '',
    secret: (process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY) || '',
    enableRateLimit: true,
    options: {
      defaultType: 'spot',
    },
  });

  if (process.env.BINANCE_USE_TESTNET === 'true') {
    publicExchange.setSandboxMode(true);
    authenticatedExchange.setSandboxMode(true);
  }

  // Helper to ensure symbol is in CCXT format (e.g. BTC/USDT)
  const formatSymbol = (symbol: string) => {
    if (symbol.includes('/') || !symbol.includes('USDT')) return symbol;
    return symbol.replace('USDT', '/USDT');
  };

  // API Routes
  app.get('/api/health', (req, res) => {
    try {
      const isSandbox = process.env.BINANCE_USE_TESTNET === 'true' || process.env.BINANCE_USE_TESTNET === '1';
      res.json({ status: 'ok', exchange: 'binance', sandbox: isSandbox, version: '1.0.0' });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
  });

  // ─── AI Analysis Endpoint ────────────────────────────────────────
  app.post('/api/ai/analyze', async (req, res) => {
    try {
      const { symbol, side, amount, price } = req.body;
      if (!symbol) {
        return res.status(400).json({ error: 'symbol is required' });
      }

      // Default values if not provided (for general market analysis)
      const tradeSide = side || 'buy';
      const tradeAmount = amount || 1;
      const tradePrice = price || 0;

      const analysis = await analyzeTradeAction(symbol, tradeSide, tradeAmount, tradePrice);

      if (!analysis) {
        return res.status(500).json({ error: 'Failed to generate AI analysis' });
      }

      res.json({ symbol, analysis });
    } catch (error: any) {
      Logger.error('AI Analysis Route Error:', error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // ─── Request Logger Middleware ───────────────────────────────────
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      if (duration > 1000) {
        Logger.warn(`Slow request: ${req.method} ${req.path} → ${res.statusCode} (${duration}ms)`);
      }
    });
    next();
  });

  // ─── System Health & Telemetry ──────────────────────────────────
  const serverStartTime = Date.now();
  let wsConnectionCount = 0;
  io.on('connection', () => { wsConnectionCount++; });
  io.on('disconnect', () => { wsConnectionCount = Math.max(0, wsConnectionCount - 1); });

  app.get('/api/system/info', (req, res) => {
    const mem = process.memoryUsage();
    const uptimeSec = Math.floor((Date.now() - serverStartTime) / 1000);
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const s = uptimeSec % 60;

    res.json({
      version: '1.0.0',
      uptime: `${h}h ${m}m ${s}s`,
      uptimeSeconds: uptimeSec,
      memory: {
        heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024),
        external: Math.round(mem.external / 1024 / 1024),
      },
      wsConnections: wsConnectionCount,
      bot: {
        isActive: deltaNeutralBot.getStatus().isActive,
        phase: deltaNeutralBot.getStatus().phase || 'CLOSED',
        symbol: deltaNeutralBot.getStatus().symbol || '—',
        cycles: 0,
      },
      copier: {
        isActive: typeof (tradeCopier as any).isActive === 'function' ? (tradeCopier as any).isActive() : true,
      },
      os: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
        freeMemMB: Math.round(os.freemem() / 1024 / 1024),
      },
    });
  });

  // ─── Bot Trade History Log ──────────────────────────────────────
  app.get('/api/bot/history', (req, res) => {
    res.json(deltaNeutralBot.getTradeLog());
  });

  // ─── Graceful Shutdown ──────────────────────────────────────────
  const gracefulShutdown = async (signal: string) => {
    Logger.warn(`Received ${signal}. Graceful shutdown started...`);
    try {
      if (deltaNeutralBot.getStatus().isActive) {
        await deltaNeutralBot.stop();
        Logger.info('Delta Neutral Bot stopped.');
      }
      shadowDb.close();
      Logger.info('Database connections closed.');
      Logger.close();
    } catch (err) {
      Logger.error('Shutdown error:', err);
    }
    process.exit(0);
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // ─── Leverage / Margin Type Endpoint ─────────────────────────────
  app.post('/api/binance/leverage', async (req, res) => {
    try {
      const { symbol, leverage, marginType } = req.body;
      if (!symbol || !leverage) {
        return res.status(400).json({ error: 'symbol and leverage are required' });
      }
      const isShadow = process.env.BINANCE_SHADOW_MODE === 'true';
      const ccxtSymbol = formatSymbol(symbol);

      if (isShadow) {
        Logger.info(`[SHADOW] Set leverage ${leverage}x and marginType ${marginType} for ${ccxtSymbol}`);
        return res.json({ symbol: ccxtSymbol, leverage: Number(leverage), marginType: marginType || 'CROSS', simulated: true });
      }

      // Live — use futures exchange instance
      const futuresExchange = new (ccxt as any).binance({
        apiKey: process.env.BINANCE_API_KEY || '',
        secret: (process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY) || '',
        enableRateLimit: true,
        options: { defaultType: 'future' }
      });
      if (process.env.BINANCE_USE_TESTNET === 'true') futuresExchange.setSandboxMode(true);

      // Set margin type first (ISOLATED or CROSSED)
      if (marginType) {
        try {
          await futuresExchange.setMarginMode(marginType.toLowerCase(), ccxtSymbol);
        } catch (marginErr: any) {
          // Binance throws if already set to this margin type — ignore that specific error
          if (!marginErr.message?.includes('already')) throw marginErr;
        }
      }

      const result = await futuresExchange.setLeverage(Number(leverage), ccxtSymbol);
      Logger.info(`Leverage set: ${ccxtSymbol} → ${leverage}x (${marginType})`);
      res.json({ symbol: ccxtSymbol, leverage: Number(leverage), marginType, result });
    } catch (error: any) {
      handleBinanceError(error, res, 'Failed to set leverage');
    }
  });

  // Voltron Master Bot Endpoints
  app.post('/api/bot/start', async (req, res) => {
    try {
      const {
        symbol, qty,
        entryMode, scheduleTimeStr, sessionTarget,
        usePreviousDayAvg, customAnchorPrice,
        bullishSL, bullishTP, bearishSL, bearishTP
      } = req.body;

      if (!symbol || !qty) {
        return res.status(400).json({ error: 'Missing required parameters: symbol, qty' });
      }

      const config = {
        entryMode: entryMode || 'INSTANT',
        scheduleTimeStr: scheduleTimeStr || '',
        sessionTarget: sessionTarget || 'LONDON',
        usePreviousDayAvg: Boolean(usePreviousDayAvg),
        customAnchorPrice: customAnchorPrice ? Number(customAnchorPrice) : 0,
        bullishSL: Number(bullishSL) || 0,
        bullishTP: Number(bullishTP) || 0,
        bearishSL: Number(bearishSL) || 0,
        bearishTP: Number(bearishTP) || 0,
      };

      await deltaNeutralBot.start(symbol, Number(qty), config as any);
      res.json({ message: 'Voltron Master scheduled successfully', status: deltaNeutralBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to initialize straddle' });
    }
  });

  app.post('/api/bot/stop', async (req, res) => {
    try {
      await deltaNeutralBot.stop();
      res.json({ message: 'Bot stopped successfully', status: deltaNeutralBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to stop bot' });
    }
  });

  app.get('/api/bot/status', (req, res) => {
    res.json(deltaNeutralBot.getStatus());
  });

  // §6: Recovery mode configuration
  app.post('/api/bot/recovery-mode', (req, res) => {
    try {
      const { mode, deadlineMs } = req.body;
      if (!['AUTO', 'CONFIRM', 'HOLD'].includes(mode)) {
        return res.status(400).json({ error: 'Invalid mode. Use AUTO, CONFIRM, or HOLD.' });
      }
      deltaNeutralBot.setRecoveryMode(mode, deadlineMs ? Number(deadlineMs) : undefined);
      res.json({ message: `Recovery mode set to ${mode}`, status: deltaNeutralBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // §7: Re-anchor at new price
  app.post('/api/bot/reanchor', async (req, res) => {
    try {
      const { anchorPrice } = req.body;
      if (!anchorPrice || Number(anchorPrice) <= 0) {
        return res.status(400).json({ error: 'Invalid anchor price.' });
      }
      await deltaNeutralBot.reAnchor(Number(anchorPrice));
      res.json({ message: `Re-anchored to $${anchorPrice}`, status: deltaNeutralBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // §9.1: Pause state engine without closing positions
  app.post('/api/bot/pause', (req, res) => {
    try {
      const status = deltaNeutralBot.getStatus();
      if (!status.isActive) return res.status(400).json({ error: 'Bot is not active.' });
      // Pause by halting state engine but keeping positions open
      (deltaNeutralBot as any).state.phase = 'IDLE';
      (deltaNeutralBot as any).emitStatus();
      if ((deltaNeutralBot as any).priceCheckInterval) {
        clearInterval((deltaNeutralBot as any).priceCheckInterval);
        (deltaNeutralBot as any).priceCheckInterval = null;
      }
      res.json({ message: 'State engine paused. Positions remain open.', status: deltaNeutralBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // §9.1: Close ALL positions immediately
  app.post('/api/bot/close-all', async (req, res) => {
    try {
      await deltaNeutralBot.stop();
      // TODO: Also close live Binance positions if not in shadow mode
      res.json({ message: 'All positions closed. System terminated.', status: deltaNeutralBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ─── Delta Master (Account A/B Insurance System) Endpoints ───
  app.post('/api/delta-master/start', async (req, res) => {
    try {
      const config = req.body;
      if (!config.symbol || !config.qtyA) {
        return res.status(400).json({ error: 'Missing required parameters: symbol, qtyA' });
      }
      await deltaMasterBot.start(config);
      res.json({ message: 'Delta Master Agent Deployed', status: deltaMasterBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to start Delta Master' });
    }
  });

  app.post('/api/delta-master/stop', async (req, res) => {
    try {
      await deltaMasterBot.stop();
      res.json({ message: 'Delta Master Agent Stopped', status: deltaMasterBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to stop Delta Master' });
    }
  });

  app.get('/api/delta-master/status', (req, res) => {
    res.json(deltaMasterBot.getStatus());
  });

  // ─── Binance Master (Account A/B Insurance System) Endpoints ───
  app.post('/api/binance-master/start', async (req, res) => {
    try {
      const config = req.body;
      if (!config.symbol || !config.qtyA) {
        return res.status(400).json({ error: 'Missing required parameters: symbol, qtyA' });
      }
      await binanceMasterBot.start(config);
      res.json({ message: 'Binance Master Agent Deployed', status: binanceMasterBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to start Binance Master' });
    }
  });

  app.post('/api/binance-master/stop', async (req, res) => {
    try {
      await binanceMasterBot.stop();
      res.json({ message: 'Binance Master Agent Stopped', status: binanceMasterBot.getStatus() });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to stop Binance Master' });
    }
  });

  app.get('/api/binance-master/status', (req, res) => {
    res.json(binanceMasterBot.getStatus());
  });

  const handleBinanceError = (error: any, res: express.Response, defaultMessage: string) => {
    Logger.error(`${defaultMessage}:`, error);

    // Handle CCXT / Binance specific errors
    if (error.message?.includes('Invalid Api-Key ID') || error.code === -2008 || error.message?.includes('API-key format invalid')) {
      return res.status(401).json({
        error: 'Invalid Binance API Key',
        details: 'The API key provided is rejected by Binance. Please check your .env file and ensure you are using the correct key for the selected environment (Testnet vs Live).',
        code: 'INVALID_API_KEY'
      });
    }

    if (error.message?.includes('Timestamp for this request is outside of the recvWindow')) {
      return res.status(400).json({
        error: 'Sync Error',
        details: 'Your system clock might be out of sync with Binance servers.',
        code: 'SYNC_ERROR'
      });
    }

    if (error.message?.includes('Account has insufficient balance')) {
      return res.status(400).json({
        error: 'Insufficient Balance',
        details: 'You do not have enough funds to complete this operation.',
        code: 'INSUFFICIENT_BALANCE'
      });
    }

    if (error.message?.includes('MIN_NOTIONAL')) {
      return res.status(400).json({
        error: 'Order Too Small',
        details: 'The total value of your order must be at least 5-10 USDT (depending on the pair).',
        code: 'MIN_NOTIONAL'
      });
    }

    if (error.message?.includes('Filter failure: LOT_SIZE')) {
      return res.status(400).json({
        error: 'Invalid Quantity',
        details: 'The quantity provided does not meet the minimum step size requirements for this asset.',
        code: 'LOT_SIZE'
      });
    }

    res.status(500).json({
      error: error.message || defaultMessage,
      details: error.toString(),
      code: 'UNKNOWN_ERROR'
    });
  };

  app.get('/api/binance/klines', async (req, res) => {
    try {
      const { symbol, interval, limit } = req.query;
      const ccxtSymbol = formatSymbol(symbol as string);
      // Use public exchange for market data
      const limitVal = Number(limit) === 5 ? 1000 : Number(limit) || 1000;
      const ohlcv = await publicExchange.fetchOHLCV(ccxtSymbol, interval as string, undefined, limitVal);

      const close = ohlcv.map((d: any[]) => Number(d[4]));
      const high = ohlcv.map((d: any[]) => Number(d[2]));
      const low = ohlcv.map((d: any[]) => Number(d[3]));
      const volume = ohlcv.map((d: any[]) => Number(d[5]));

      // Bill Williams Alligator (Typical Price)
      const typical = ohlcv.map((d: any[]) => (Number(d[2]) + Number(d[3]) + Number(d[4])) / 3);
      const jaw = SMA.calculate({ period: 13, values: typical });
      const teeth = SMA.calculate({ period: 8, values: typical });
      const lips = SMA.calculate({ period: 5, values: typical });

      // Alligator shift: SMA(period P) output index j maps to candle i = j + (P-1)
      // To project it S bars forward, assign it to candle i' = j + (P-1) + S
      // => j = i' - (P-1) - S, valid when i' >= (P-1) + S
      const alligator = ohlcv.map((_, i) => ({
        jaw: i >= (13 - 1) + 8 ? jaw[i - (13 - 1) - 8] : null, // i >= 20
        teeth: i >= (8 - 1) + 5 ? teeth[i - (8 - 1) - 5] : null, // i >= 12
        lips: i >= (5 - 1) + 3 ? lips[i - (5 - 1) - 3] : null, // i >= 7
      }));

      const sma = SMA.calculate({ period: 20, values: close });
      const ema200 = EMA.calculate({ period: 200, values: close });
      const rsi = RSI.calculate({ period: 14, values: close });
      const macd = MACD.calculate({
        fastPeriod: 12, slowPeriod: 26, signalPeriod: 9,
        SimpleMAOscillator: false, SimpleMASignal: false, values: close
      });
      const boll = BollingerBands.calculate({ period: 20, stdDev: 2, values: close });
      const atr = ATR.calculate({ period: 14, high, low, close });

      const sar = PSAR.calculate({ step: 0.02, max: 0.2, high, low });
      const wr = WilliamsR.calculate({ period: 14, high, low, close });
      const obv = OBV.calculate({ close, volume });
      const stochRsi = StochasticRSI.calculate({ rsiPeriod: 14, stochasticPeriod: 14, kPeriod: 3, dPeriod: 3, values: close });
      const stoch = Stochastic.calculate({ period: 9, signalPeriod: 3, high, low, close });
      const kdj = stoch.map(s => ({ k: s.k, d: s.d, j: 3 * s.k - 2 * s.d }));

      res.json({
        klines: ohlcv,
        indicators: {
          sma,
          ema200,
          rsi,
          macd,
          boll,
          atr,
          sar,
          wr,
          obv,
          stochRsi,
          kdj,
          alligator
        }
      });
    } catch (error: any) {
      handleBinanceError(error, res, 'Failed to fetch klines');
    }
  });

  app.get('/api/binance/ticker/24hr', async (req, res) => {
    try {
      // Use public exchange for tickers
      const tickers = await publicExchange.fetchTickers();
      // Transform CCXT format to match what CoinSelector expects (Binance API format)
      const formattedTickers = Object.values(tickers).map((t: any) => ({
        symbol: t.symbol.replace('/', ''),
        lastPrice: t.last?.toString() || '0',
        quoteVolume: t.quoteVolume?.toString() || '0',
        priceChangePercent: t.percentage?.toString() || '0'
      }));
      res.json(formattedTickers);
    } catch (error: any) {
      handleBinanceError(error, res, 'Failed to fetch tickers');
    }
  });

  app.get('/api/binance/account', async (req, res) => {
    try {
      const isShadow = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';

      if (isShadow) {
        // Fetch simulated master balances
        const usdtBalance = await tradeCopier.getBalance(publicExchange, 'USDT', 'master');
        const btcBalance = await tradeCopier.getBalance(publicExchange, 'BTC', 'master');
        const ethBalance = await tradeCopier.getBalance(publicExchange, 'ETH', 'master');

        return res.json({
          balances: [
            { asset: 'USDT', free: usdtBalance.toString(), locked: '0.00' },
            { asset: 'BTC', free: btcBalance.toString(), locked: '0.00' },
            { asset: 'ETH', free: ethBalance.toString(), locked: '0.00' },
          ]
        });
      }

      if (!process.env.BINANCE_API_KEY || (!process.env.BINANCE_API_SECRET && !process.env.BINANCE_SECRET_KEY)) {
        // Return mock balance if keys are missing to avoid crashing the UI
        return res.json({
          balances: [
            { asset: 'USDT', free: '0.00', locked: '0.00' },
            { asset: 'BTC', free: '0.0000', locked: '0.00' }
          ]
        });
      }
      // Use authenticated exchange for account data
      const balance = await authenticatedExchange.fetchBalance();
      // Format to match what App.tsx expects (data.balances)
      const balances = Object.entries(balance.free).map(([asset, free]) => ({
        asset,
        free: (free as number).toString(),
        locked: (balance.used[asset] || 0).toString()
      }));
      res.json({ balances });
    } catch (error: any) {
      handleBinanceError(error, res, 'Failed to fetch account');
    }
  });

  app.post('/api/binance/order', async (req, res) => {
    try {
      const {
        symbol, side, type, quantity, price, stopPrice, limitPrice,
        marginMode, leverage, autoBorrow, autoRepay,
        takeProfit, slTrigger, slLimit, isIceberg,
        params = {}
      } = req.body;
      const ccxtSymbol = formatSymbol(symbol);
      const isShadow = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';

      const ccxtParams: any = { ...params };

      // Map Advanced UI Features to Binance CCXT Parameters
      if (marginMode) {
        ccxtParams.marginMode = marginMode.toLowerCase(); // 'cross' or 'isolated'
        if (ccxtParams.marginMode === 'isolated') {
          ccxtParams.isIsolated = 'TRUE'; // Force Binance isolated margin endpoint routing
        }
        if (autoBorrow) ccxtParams.sideEffectType = 'MARGIN_BUY';
        if (autoRepay) ccxtParams.sideEffectType = 'AUTO_REPAY';
      }

      if (isIceberg) {
        // Binance requires icebergQty. Mocking as a fraction of order, or 0 to hide.
        ccxtParams.icebergQty = (Number(quantity) * 0.1).toFixed(4);
      }

      Logger.info(`${isShadow ? '[SHADOW] ' : ''}Placing order:`, { ccxtSymbol, side, type, quantity, price, ccxtParams });

      if (!isShadow && (!process.env.BINANCE_API_KEY || (!process.env.BINANCE_API_SECRET && !process.env.BINANCE_SECRET_KEY))) {
        return res.status(400).json({ error: 'Binance API keys not configured. Please set them in .env' });
      }

      let order;
      const amount = Number(quantity);
      const orderSide = side.toLowerCase() as 'buy' | 'sell';
      const orderType = type.toLowerCase();

      if (isShadow) {
        const parts = ccxtSymbol.split('/');
        const baseAsset = parts[0];
        const quoteAsset = parts[1] || 'USDT';

        // If Spot Sell, you must own the physical Base Asset (e.g. BTC)
        // If Margin Sell (Short), you use Quote Asset (USDT) as collateral to auto-borrow Base Asset
        let balanceAsset = quoteAsset;
        if (orderSide === 'sell' && !marginMode) {
          balanceAsset = baseAsset;
        }

        if (orderType !== 'market' || takeProfit || slTrigger) {
          const pendingOrderId = `sim_pending_${Date.now()}`;
          const computedType = (takeProfit || slTrigger) ? 'oco' : orderType;

          // Cancel old pending shadow orders for the same symbol, side & marginMode (e.g., replacing old TP/SL)
          const expectedMarginMode = marginMode ? marginMode.toLowerCase() : undefined;
          for (let reverseIdx = pendingShadowOrders.length - 1; reverseIdx >= 0; reverseIdx--) {
            const o = pendingShadowOrders[reverseIdx];
            const currentOrderMarginMode = o.marginMode ? o.marginMode.toLowerCase() : undefined;
            if (o.symbol === ccxtSymbol && o.status === 'open' && o.side === orderSide && currentOrderMarginMode === expectedMarginMode) {
              updatePendingShadowOrderStatus(o.id, 'canceled');
              pendingShadowOrders.splice(reverseIdx, 1);
            }
          }

          const pendingOrder = {
            id: pendingOrderId, symbol: ccxtSymbol, side: orderSide, type: computedType,
            amount: amount, limitPrice: Number(takeProfit || price),
            stopPrice: Number(slTrigger || stopPrice),
            marginMode: expectedMarginMode, baseAsset, quoteAsset, balanceAsset,
            status: 'open'
          };

          addPendingShadowOrder(pendingOrder); // Use helper to add to DB and in-memory
          Logger.info(`[SHADOW] Placed Pending Order: ${pendingOrder.type} ${pendingOrder.symbol} (Limit: ${pendingOrder.limitPrice}, Stop: ${pendingOrder.stopPrice})`);
          return res.json(pendingOrder);
        }

        let executePrice = Number(price);
        if (!executePrice) {
          const ticker = await publicExchange.fetchTicker(ccxtSymbol);
          executePrice = ticker.last || 0;
        }

        // Shadow balance validation
        if (!ccxtParams.isClosingPosition) {
          const shadowBalance = await tradeCopier.getBalance(publicExchange, balanceAsset, 'master');

          // If requiring Base Asset (Spot Sell), we just need 'amount' coins.
          // If requiring Quote Asset (Spot Buy or Margin Trade), we need (amount * price) value in USDT.
          const requiredBalance = (balanceAsset === baseAsset) ? amount : (amount * executePrice);
          const effectiveLeverage = marginMode ? (Number(leverage) || 1) : 1;

          if ((shadowBalance * effectiveLeverage) < requiredBalance) {
            return res.status(400).json({ error: `Insufficient Virtual Shadow Balance. Required: ${requiredBalance.toFixed(4)} ${balanceAsset} (Effective Leverage ${effectiveLeverage}x) - Available: ${shadowBalance.toFixed(4)}` });
          }
        }

        // Update Master locally
        tradeCopier.updateShadowBalance('master', baseAsset, quoteAsset, orderSide, amount, executePrice);

        order = {
          id: `sim_master_${Date.now()}`,
          symbol: ccxtSymbol,
          side: orderSide,
          type: orderType,
          price: executePrice,
          amount: amount,
          status: 'closed'
        };

        const timestamp = Date.now();
        const fakeReport = {
          e: 'executionReport',
          E: timestamp,
          s: symbol.replace('/', ''),
          c: order.id,
          S: orderSide.toUpperCase(),
          o: orderType.toUpperCase(),
          f: 'GTC',
          q: amount.toString(),
          p: executePrice.toString(),
          P: '0',
          F: '0',
          g: -1,
          C: '',
          x: 'TRADE',
          X: 'FILLED',
          r: 'NONE',
          i: timestamp,
          l: amount.toString(),
          z: amount.toString(),
          L: executePrice.toString(),
          n: '0',
          T: timestamp,
          t: timestamp,
          I: 123456,
          w: false,
          M: false,
          marginType: marginMode ? marginMode.toUpperCase() : 'SPOT',
          O: timestamp,
          Z: (amount * executePrice).toString(),
          Y: (amount * executePrice).toString(),
          Q: '0'
        };

        // Trigger copier directly without WebSockets
        tradeCopier.processSimulatedMasterTrade(fakeReport as any).catch(err => Logger.error('TradeCopier Shadow execution failed:', err));

      } else {
        // Use authenticated exchange for real live orders
        if (orderType === 'market') {
          order = await authenticatedExchange.createOrder(ccxtSymbol, 'market', orderSide, amount, undefined, ccxtParams);
        } else if (orderType === 'limit') {
          order = await authenticatedExchange.createOrder(ccxtSymbol, 'limit', orderSide, amount, Number(price), ccxtParams);
        } else if (orderType === 'stop_limit') {
          ccxtParams.stopPrice = Number(stopPrice);
          order = await authenticatedExchange.createOrder(ccxtSymbol, 'limit', orderSide, amount, Number(limitPrice), ccxtParams);
        } else if (orderType === 'oco') {
          // Explicit OCO logic
          ccxtParams.stopPrice = Number(stopPrice);
          if (limitPrice) ccxtParams.stopLimitPrice = Number(limitPrice);
          order = await authenticatedExchange.createOrder(ccxtSymbol, 'limit', orderSide, amount, Number(price), ccxtParams);
        } else {
          order = await authenticatedExchange.createOrder(ccxtSymbol, orderType, orderSide, amount, price ? Number(price) : undefined, ccxtParams);
        }

        // Auto-attach OCO (TP/SL) immediately after filling the main entry order
        if (takeProfit && slTrigger && (orderType === 'market' || orderType === 'limit')) {
          const tpSlSide = orderSide === 'buy' ? 'sell' : 'buy';
          const tpSlParams: any = {
            stopPrice: Number(slTrigger),
            stopLimitPrice: slLimit ? Number(slLimit) : Number(slTrigger)
          };
          Logger.info('Attaching TP/SL OCO to successful entry order', { ccxtSymbol, tpSlSide, amount, takeProfit, tpSlParams });
          try {
            // Binance CCXT OCO: createOrder(symbol, 'limit', side, amount, price, { stopPrice, stopLimitPrice })
            // where `price` is the Take Profit limit leg, and `stopPrice` is the Stop Loss trigger leg.
            await authenticatedExchange.createOrder(ccxtSymbol, 'limit', tpSlSide, amount, Number(takeProfit), tpSlParams);
          } catch (tpErr: any) {
            Logger.error('Failed to attach TP/SL OCO', tpErr);
            // Note: Returning main order success even if trailing OCO fails, but logging error.
          }
        }
      }

      res.json(order);
    } catch (error: any) {
      handleBinanceError(error, res, 'Failed to place order');
    }
  });

  // TradingView Webhook Endpoint
  app.post('/api/webhook/tradingview', async (req, res) => {
    try {
      const { secret, symbol, side, quantity, price } = req.body;

      if (!secret || secret !== process.env.TRADINGVIEW_WEBHOOK_SECRET) {
        return res.status(401).json({ error: 'Unauthorized webhook request.' });
      }

      if (!symbol || !side || !quantity) {
        return res.status(400).json({ error: 'Missing required webhook parameters (symbol, side, quantity).' });
      }

      Logger.info(`Incoming Webhook Signal: ${side.toUpperCase()} ${quantity} ${symbol} @ ${price || 'MARKET'}`);

      // Execute signal asynchronously (don't block the webhook response)
      tradeCopier.executeWebhookSignal(symbol, side, quantity, price).catch(err => {
        Logger.error('TradeCopier Webhook Error:', err);
      });

      res.status(200).json({ message: 'Webhook received and processing started.' });
    } catch (error: any) {
      Logger.error('Failed to process webhook:', error);
      res.status(500).json({ error: 'Internal server error processing webhook.' });
    }
  });

  // ─── Shadow Balance Reset Endpoint ─────────────────────────────
  // Resets the virtual paper trading balance back to the starting amount.
  app.post('/api/backend/shadow/reset', (req, res) => {
    try {
      const isShadow = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';
      if (!isShadow) {
        return res.status(400).json({ error: 'Not in shadow mode. Live account balances cannot be reset here.' });
      }
      const startingBalance = parseFloat(process.env.BINANCE_SHADOW_STARTING_BALANCE || '10000');
      const db = new Database('trades.db');
      // Clear all existing shadow balances — they will be re-seeded on next getBalance call
      db.prepare('DELETE FROM shadow_balances').run();
      db.close();
      Logger.info(`[SHADOW] Balances reset. All accounts will re-seed to $${startingBalance} on next access.`);
      res.json({ message: `Shadow balances reset to $${startingBalance.toLocaleString()}`, startingBalance });
    } catch (error: any) {
      Logger.error('Failed to reset shadow balances:', error);
      res.status(500).json({ error: 'Failed to reset shadow balances' });
    }
  });


  app.get('/api/backend/trades', (req, res) => {
    try {
      // Create a temporary db connection just for this query to keep it clean
      const db = new Database('trades.db', { readonly: true });

      // Fetch all trades, sorted chronologically
      const trades = db.prepare(`
        SELECT slave_id, master_trade_id, symbol, side, quantity, price, timestamp
        FROM copied_fills_v2
        ORDER BY timestamp ASC
      `).all();

      db.close();

      // Send raw chronological trades to frontend for PnL charting calculations
      res.json(trades);
    } catch (error: any) {
      Logger.error('Failed to fetch analytics trades:', error);
      res.status(500).json({ error: 'Failed to fetch analytics data' });
    }
  });

  // Wipe Database Endpoint
  app.delete('/api/backend/trades', (req, res) => {
    try {
      const db = new Database('trades.db');
      db.prepare('DELETE FROM copied_fills_v2').run();
      db.prepare('DELETE FROM shadow_balances').run();
      db.close();

      Logger.info('Backend: Database successfully wiped via UI command.');
      res.status(200).json({ message: 'Database cleared successfully' });
    } catch (error: any) {
      Logger.error('Failed to wipe database:', error);
      res.status(500).json({ error: 'Failed to wipe database' });
    }
  });

  app.delete('/api/binance/order', async (req, res) => {
    try {
      const { symbol, orderId } = req.query;
      const isShadow = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';

      if (isShadow) {
        // Remove from in-memory array
        const idx = pendingShadowOrders.findIndex((o: any) => o.id === orderId);
        if (idx !== -1) {
          updatePendingShadowOrderStatus(orderId as string, 'canceled');
          pendingShadowOrders.splice(idx, 1);
        }
        return res.json({ message: 'Shadow order canceled' });
      }

      const ccxtSymbol = (symbol as string).replace('USDT', '/USDT');
      const order = await authenticatedExchange.cancelOrder(orderId as string, ccxtSymbol);
      res.json(order);
    } catch (error: any) {
      handleBinanceError(error, res, 'Failed to cancel order');
    }
  });

  app.delete('/api/binance/orders/all', async (req, res) => {
    try {
      const isShadow = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';

      if (isShadow) {
        shadowDb.prepare("UPDATE shadow_pending_orders SET status = 'canceled' WHERE status = 'open'").run();
        pendingShadowOrders.length = 0; // Clear the in-memory array
        return res.json({ message: 'All shadow orders cleared' });
      }

      const { symbol } = req.query;
      if (symbol) {
        const ccxtSymbol = (symbol as string).replace('USDT', '/USDT');
        await authenticatedExchange.cancelAllOrders(ccxtSymbol);
      } else {
        return res.status(400).json({ error: 'Symbol required for live order cancellation' });
      }
      
      res.json({ message: 'Orders canceled' });
    } catch (error: any) {
      handleBinanceError(error, res, 'Failed to clear orders');
    }
  });

  // Open / Pending Orders Endpoint
  app.get('/api/backend/openOrders', (req, res) => {
    try {
      const openOrders = shadowDb.prepare("SELECT * FROM shadow_pending_orders WHERE status = 'open'").all();
      res.json(openOrders);
    } catch (error: any) {
      Logger.error('Failed to fetch open orders:', error);
      res.status(500).json({ error: 'Failed to fetch open orders data' });
    }
  });

  // Current Positions Endpoint (Aggregated PnL Calculation)
  app.get('/api/backend/positions', (req, res) => {
    try {
      const db = new Database('trades.db', { readonly: true });
      const trades = db.prepare(`
        SELECT slave_id, symbol, side, quantity, price
        FROM copied_fills_v2
        WHERE slave_id IN ('master', 'slave_1')
        ORDER BY timestamp ASC
      `).all() as any[];
      db.close();

      const positions: Record<string, { symbol: string, netQuantity: number, totalCost: number, averageEntryPrice: number, tpPrice?: number, slPrice?: number, isVoltron?: boolean }> = {};

      trades.forEach(trade => {
        const { slave_id, symbol, side, quantity, price } = trade;
        // Partition Voltron Hands
        const isVoltron = slave_id === 'slave_1';
        const internalSymbol = isVoltron ? `${symbol}-BEAR` : symbol;

        if (!positions[internalSymbol]) {
          positions[internalSymbol] = { symbol: internalSymbol, netQuantity: 0, totalCost: 0, averageEntryPrice: 0, isVoltron };
        }

        const qty = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
        const prc = typeof price === 'string' ? parseFloat(price) : price;

        if (side.toUpperCase() === 'BUY') {
          if (positions[internalSymbol].netQuantity < -0.000001) {
            // Covering a short
            const currentShortQty = Math.abs(positions[internalSymbol].netQuantity);
            if (qty > currentShortQty) {
              // Covered everything AND opened a long
              const overCoverQty = qty - currentShortQty;
              positions[internalSymbol].netQuantity = overCoverQty;
              positions[internalSymbol].totalCost = overCoverQty * prc;
            } else {
              const avgPrice = positions[internalSymbol].totalCost / currentShortQty;
              positions[internalSymbol].totalCost -= (qty * avgPrice);
              positions[internalSymbol].netQuantity += qty;
            }
          } else {
            // Opening or adding to LONG
            positions[internalSymbol].netQuantity += qty;
            positions[internalSymbol].totalCost += (qty * prc);
          }
        } else if (side.toUpperCase() === 'SELL') {
          if (positions[internalSymbol].netQuantity > 0.000001) {
            // Closing a long
            const currentLongQty = positions[internalSymbol].netQuantity;
            if (qty > currentLongQty) {
              // Closed everything AND opened a short
              const overSellQty = qty - currentLongQty;
              positions[internalSymbol].netQuantity = -overSellQty;
              positions[internalSymbol].totalCost = overSellQty * prc;
            } else {
              const avgPrice = positions[internalSymbol].totalCost / currentLongQty;
              positions[internalSymbol].totalCost -= (qty * avgPrice);
              positions[internalSymbol].netQuantity -= qty;
            }
          } else {
            // Opening or adding to SHORT
            positions[internalSymbol].netQuantity -= qty;
            positions[internalSymbol].totalCost += (qty * prc);
          }
        }

        // Update Average Entry Price based dynamically on active cost
        if (Math.abs(positions[internalSymbol].netQuantity) > 0.000001) { // Floating point safety
          positions[internalSymbol].averageEntryPrice = Math.max(0, positions[internalSymbol].totalCost / Math.abs(positions[internalSymbol].netQuantity));
        } else {
          // Position completely closed
          positions[internalSymbol].averageEntryPrice = 0;
          positions[internalSymbol].totalCost = 0;
          positions[internalSymbol].netQuantity = 0; // Prevent float artifacts like 1e-16
        }
      });

      // Filter out zeroed positions (closed trades)
      // Allow shorts (negative netQuantity)
      const activePositions = Object.values(positions).filter(p => Math.abs(p.netQuantity) > 0.000001);

      // Attach any open pending shadow orders as TP / SL targets
      const augmentedPositions = activePositions.map(pos => {
        const cleanPosSymbol = pos.symbol.replace('-ISOLATED', '').replace('-CROSS', '').replace('/', '');
        const expectedMarginMode = pos.symbol.includes('-ISOLATED') ? 'isolated' : (pos.symbol.includes('-CROSS') ? 'cross' : undefined);
        const matchingOrders = pendingShadowOrders.filter((o: any) => {
          const currentOrderMarginMode = o.marginMode ? o.marginMode.toLowerCase() : undefined;
          return o.status === 'open' && 
                 o.symbol.replace('/', '') === cleanPosSymbol &&
                 currentOrderMarginMode === expectedMarginMode;
        });

        let tpPrice: number | undefined = undefined;
        let slPrice: number | undefined = undefined;

        for (const order of matchingOrders) {
          if (order.type === 'limit' && order.limitPrice) {
            tpPrice = order.limitPrice; // Crude check: Assume standalone limit pending is TP
          } else if ((order.type === 'stop_limit' || order.type === 'stop_loss_limit') && order.stopPrice) {
            slPrice = order.stopPrice;
          } else if (order.type === 'oco') {
            if (order.limitPrice) tpPrice = order.limitPrice;
            if (order.stopPrice) slPrice = order.stopPrice;
          }
        }

        Logger.info(`[DEBUG] Augmented Position ${pos.symbol}: TP=${tpPrice}, SL=${slPrice}. Open Pending Orders matched: ${matchingOrders.length}`);

        return {
          ...pos,
          tpPrice,
          slPrice
        };
      });

      res.json(augmentedPositions);

    } catch (error: any) {
      Logger.error('Failed to fetch positions:', error);
      res.status(500).json({ error: 'Failed to fetch positions data' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(port, '0.0.0.0', () => {
    Logger.info(`Server running at http://localhost:${port} (Local)`);

    // Find Local Network IP
    const interfaces = os.networkInterfaces();
    const addresses: string[] = [];
    for (const k in interfaces) {
      for (const k2 in interfaces[k]!) {
        const address = interfaces[k]![Number(k2)];
        if (address.family === 'IPv4' && !address.internal) {
          addresses.push(address.address);
        }
      }
    }
    const lanIP = addresses.length > 0 ? addresses[0] : '0.0.0.0';
    Logger.info(`Server running at http://${lanIP}:${port} (Network)`);
  });
}

startServer().catch((err) => Logger.error('Server failed to start', err));
