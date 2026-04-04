import ccxt from 'ccxt';
import dotenv from 'dotenv';
import { Logger } from '../../logger.js';

dotenv.config({ quiet: true });

export class BinanceService {
  private clientA: any;
  private clientB: any;
  private isTestnet: boolean;
  private isShadowMode: boolean;

  constructor() {
    this.isTestnet = process.env.BINANCE_USE_TESTNET === 'true' || process.env.BINANCE_USE_TESTNET === '1';
    this.isShadowMode = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';

    if (!this.isShadowMode) {
      // Account A: Primary Account (Spot)
      this.clientA = new (ccxt as any).binance({
        apiKey: process.env.BINANCE_API_KEY_A || '',
        secret: process.env.BINANCE_API_SECRET_A || '',
        enableRateLimit: true,
        options: { defaultType: 'spot' }
      });

      // Account B: Insurance Account (Spot/Margin)
      this.clientB = new (ccxt as any).binance({
        apiKey: process.env.BINANCE_API_KEY_B || '',
        secret: process.env.BINANCE_API_SECRET_B || '',
        enableRateLimit: true,
        options: { defaultType: 'spot' }
      });

      if (this.isTestnet) {
        this.clientA.setSandboxMode(true);
        this.clientB.setSandboxMode(true);
      }
    } else {
      this.clientA = { id: 'sim_binance_a' };
      this.clientB = { id: 'sim_binance_b' };
    }
    Logger.info(`BinanceService: Constructor [SHADOW: ${this.isShadowMode}, TESTNET: ${this.isTestnet}]`);
  }

  public async initialize() {
    if (this.isShadowMode) {
      Logger.info(`Binance Service Initialized in [SHADOW MODE]`);
      return;
    }
    try {
      await Promise.all([
        this.clientA.loadMarkets(),
        this.clientB.loadMarkets()
      ]);
      Logger.info(`Binance Service Initialized (Testnet: ${this.isTestnet})`);
    } catch (error) {
      Logger.error('Failed to initialize Binance clients:', error);
      throw error;
    }
  }

  public getClientA() { return this.clientA; }
  public getClientB() { return this.clientB; }

  public async placeOrder(client: any, symbol: string, type: 'market' | 'limit', side: 'buy' | 'sell', amount: number, price?: number, params: any = {}) {
    if (this.isShadowMode) {
      const simulatedId = `sim_binance_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      Logger.info(`[BINANCE_SHADOW] ${side.toUpperCase()} ${amount} ${symbol} @ ${price || 'MARKET'}`);
      return { id: simulatedId, symbol, side, amount, price, status: 'closed', simulated: true };
    }

    try {
      return await client.createOrder(symbol, type, side, amount, price, params);
    } catch (error) {
      Logger.error(`Binance Order Placement Failed (${side}):`, error);
      throw error;
    }
  }

  public async fetchTicker(symbol: string) {
    if (this.isShadowMode) {
      return { last: 65000 + (Math.random() * 100), symbol, timestamp: Date.now() };
    }
    return await this.clientA.fetchTicker(symbol);
  }

  public async fetchLiquidityMetrics(symbol: string) {
    if (this.isShadowMode) {
      return { spread: 0.5, spreadPct: 0.001, depth1Pct: 10, last: 65000 };
    }
    const ticker = await this.clientA.fetchTicker(symbol);
    const orderbook = await this.clientA.fetchOrderBook(symbol, 20);
    
    const bid = orderbook.bids[0][0];
    const ask = orderbook.asks[0][0];
    const spread = ask - bid;
    const spreadPct = (spread / bid) * 100;
    
    const mid = (bid + ask) / 2;
    const depth1Pct = orderbook.bids
      .filter(([p]) => p >= mid * 0.99)
      .reduce((sum, [_, q]) => sum + q, 0);

    return { spread, spreadPct, depth1Pct, last: ticker.last };
  }

  public async fetchOHLCV(symbol: string, timeframe = '1m', limit = 100) {
    if (this.isShadowMode) {
      const now = Date.now();
      return Array.from({ length: limit }, (_, i) => [
        now - (limit - i) * 60000,
        65000, 65100, 64900, 65050, 100
      ]);
    }
    return await this.clientA.fetchOHLCV(symbol, timeframe, undefined, limit);
  }

  public async fetchBalance(client: any) {
    if (this.isShadowMode) {
      return { USDT: { free: 10000, total: 10000 }, simulated: true };
    }
    return await client.fetchBalance();
  }

  public async closePosition(client: any, symbol: string, closeSide: 'buy' | 'sell', amount: number) {
    // closeSide is the ORDER side needed to close — callers are responsible for passing the correct
    // closing direction (opposite to the opening side). Do NOT flip here again.
    return await this.placeOrder(client, symbol, 'market', closeSide, amount);
  }

  public async cancelOrder(client: any, orderId: string, symbol: string) {
    if (this.isShadowMode) {
      Logger.info(`[BINANCE_SHADOW] CANCEL ORDER: ${orderId}`);
      return { id: orderId, status: 'canceled', simulated: true };
    }
    return await client.cancelOrder(orderId, symbol);
  }

  public async cancelAllOrders(client: any, symbol: string) {
    if (this.isShadowMode) {
      Logger.info(`[BINANCE_SHADOW] CANCEL ALL ORDERS: ${symbol}`);
      return { status: 'success', simulated: true };
    }
    try {
      return await client.cancelAllOrders(symbol);
    } catch (error) {
      const openOrders = await client.fetchOpenOrders(symbol);
      for (const order of openOrders) {
        await this.cancelOrder(client, order.id, symbol);
      }
      return { status: 'success' };
    }
  }

  public async fetchPositions(client: any, symbol: string) {
    if (this.isShadowMode) {
      return [{ symbol, contracts: 0.1, entryPrice: 65000, side: 'long', simulated: true }];
    }
    try {
      const parts = symbol.split('/');
      const baseAsset = parts[0];
      const balance = await this.fetchBalance(client);
      const free = balance[baseAsset] ? balance[baseAsset].free : 0;
      
      if (free > 0) {
        return [{ symbol, contracts: free, side: 'long' }];
      }
      return [];
    } catch (error) {
      Logger.error(`Failed to fetch pseudo-positions for ${symbol}:`, error);
      return [];
    }
  }

  public async editOrder(client: any, orderId: string, symbol: string, type: 'market' | 'limit', side: 'buy' | 'sell', amount: number, price?: number, params: any = {}) {
    if (this.isShadowMode) {
      Logger.info(`[BINANCE_SHADOW] EDIT ORDER ${orderId} -> ${side.toUpperCase()} ${amount} ${symbol} @ ${price || 'MARKET'}`);
      return { id: orderId, symbol, side, amount, price, status: 'closed', simulated: true };
    }
    
    try {
      await this.cancelOrder(client, orderId, symbol);
      return await this.placeOrder(client, symbol, type, side, amount, price, params);
    } catch (error) {
      Logger.error(`Binance Order Edit Failed (${orderId}):`, error);
      throw error;
    }
  }
}
