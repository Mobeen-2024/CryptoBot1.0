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

  public async fetchBalance(client: any) {
    if (this.isShadowMode) {
      return { USDT: { free: 10000, total: 10000 }, simulated: true };
    }
    return await client.fetchBalance();
  }

  public async closePosition(client: any, symbol: string, side: 'buy' | 'sell', amount: number) {
    // For Spot, "closing" means selling what you bought or buying what you sold
    return await this.placeOrder(client, symbol, 'market', side === 'buy' ? 'sell' : 'buy', amount);
  }
}
