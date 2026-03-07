import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import dotenv from 'dotenv';
import ccxt from 'ccxt';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import { Logger } from './logger';
import Database from 'better-sqlite3';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import { TradeCopier } from './tradeCopier';

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
      res.json({ status: 'ok', exchange: 'binance', sandbox: isSandbox });
    } catch (error) {
      res.status(500).json({ status: 'error', message: 'Internal server error' });
    }
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
      const ohlcv = await publicExchange.fetchOHLCV(ccxtSymbol, interval as string, undefined, Number(limit) || 500);
      res.json(ohlcv);
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
      const { symbol, side, type, quantity, price, stopPrice, limitPrice, params = {} } = req.body;
      const ccxtSymbol = formatSymbol(symbol);
      const isShadow = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';
      
      Logger.info(`${isShadow ? '[SHADOW] ' : ''}Placing order:`, { ccxtSymbol, side, type, quantity, price, stopPrice, limitPrice, params });

      if (!isShadow && (!process.env.BINANCE_API_KEY || (!process.env.BINANCE_API_SECRET && !process.env.BINANCE_SECRET_KEY))) {
        return res.status(400).json({ error: 'Binance API keys not configured. Please set them in .env' });
      }

      let order;
      const amount = Number(quantity);
      const orderSide = side.toLowerCase() as 'buy' | 'sell';
      const orderType = type.toLowerCase();
      
      if (isShadow) {
         let executePrice = Number(price);
         if (orderType === 'market' || !executePrice) {
            const ticker = await publicExchange.fetchTicker(ccxtSymbol);
            executePrice = ticker.last || 0;
         }

         const parts = ccxtSymbol.split('/');
         const baseAsset = parts[0];
         const quoteAsset = parts[1] || 'USDT';

         // Verify Master Balance before allowing internal shadow order
         let balanceAsset = quoteAsset;
         if (orderSide === 'sell') balanceAsset = baseAsset;
         
         const shadowBalance = await tradeCopier.getBalance(publicExchange, balanceAsset, 'master');
         const orderValue = orderSide === 'buy' ? (amount * executePrice) : amount;
         
         if (shadowBalance < orderValue) {
            return res.status(400).json({ error: 'Insufficient Virtual Shadow Balance' });
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
            N: 'USDT',
            T: timestamp,
            t: timestamp,
            I: 123456,
            w: false,
            m: false,
            M: false,
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
          order = await authenticatedExchange.createOrder(ccxtSymbol, 'market', orderSide, amount);
        } else if (orderType === 'limit') {
          order = await authenticatedExchange.createOrder(ccxtSymbol, 'limit', orderSide, amount, Number(price));
        } else if (orderType === 'stop_limit') {
          const stopParams = { ...params, stopPrice: Number(stopPrice) };
          order = await authenticatedExchange.createOrder(ccxtSymbol, 'limit', orderSide, amount, Number(limitPrice), stopParams);
        } else if (orderType === 'oco') {
          return res.status(400).json({ error: 'OCO orders not fully implemented in this bridge yet' });
        } else {
          order = await authenticatedExchange.createOrder(ccxtSymbol, orderType, orderSide, amount, price ? Number(price) : undefined, params);
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

  // Analytics Endpoint (PnL Equity Curve Data)
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

  // Current Positions Endpoint (Aggregated PnL Calculation)
  app.get('/api/backend/positions', (req, res) => {
    try {
      const db = new Database('trades.db', { readonly: true });
      const trades = db.prepare(`
        SELECT symbol, side, quantity, price 
        FROM copied_fills_v2 
        WHERE slave_id LIKE 'master%' OR slave_id LIKE 'slave_virtual%' OR slave_id = 'webhook'
        ORDER BY timestamp ASC
      `).all() as any[];
      db.close();

      const positions: Record<string, { symbol: string, netQuantity: number, totalCost: number, averageEntryPrice: number }> = {};

      trades.forEach(trade => {
         const { symbol, side, quantity, price } = trade;
         if (!positions[symbol]) {
            positions[symbol] = { symbol, netQuantity: 0, totalCost: 0, averageEntryPrice: 0 };
         }

         const qty = typeof quantity === 'string' ? parseFloat(quantity) : quantity;
         const prc = typeof price === 'string' ? parseFloat(price) : price;

         if (side.toUpperCase() === 'BUY') {
            positions[symbol].netQuantity += qty;
            positions[symbol].totalCost += (qty * prc);
         } else if (side.toUpperCase() === 'SELL') {
            // Calculate proportional cost removal to maintain accurate average entry price
            if (positions[symbol].netQuantity > 0) {
               const avgPrice = positions[symbol].totalCost / positions[symbol].netQuantity;
               positions[symbol].totalCost -= (qty * avgPrice);
            }
            positions[symbol].netQuantity -= qty;
         }

         // Update Average Entry Price based dynamically on active cost
         if (positions[symbol].netQuantity > 0.000001) { // Floating point safety
             positions[symbol].averageEntryPrice = Math.max(0, positions[symbol].totalCost / positions[symbol].netQuantity);
         } else {
             // Position closed or flipped short (if shorting supported)
             positions[symbol].averageEntryPrice = 0;
             positions[symbol].totalCost = 0;
             positions[symbol].netQuantity = 0; // Prevent float artifacts like 1e-16
         }
      });

      // Filter out zeroed positions (closed trades)
      const activePositions = Object.values(positions).filter(p => p.netQuantity > 0);
      res.json(activePositions);

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
    Logger.info(`Server running at http://localhost:${port} (and http://0.0.0.0:${port})`);
  });
}

startServer().catch((err) => Logger.error('Server failed to start', err));
