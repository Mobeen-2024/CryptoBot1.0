import ccxt from 'ccxt';
import dotenv from 'dotenv';
import { Logger } from '../../logger.js';

dotenv.config({ quiet: true });

export class DeltaExchangeService {
  private clientA: any;
  private clientB: any;
  private isTestnet: boolean;
  private isShadowMode: boolean;

  constructor() {
    this.isTestnet = process.env.DELTA_USE_TESTNET === 'true' || process.env.DELTA_USE_TESTNET === '1';
    this.isShadowMode = process.env.DELTA_SHADOW_MODE === 'true' || process.env.DELTA_SHADOW_MODE === '1';

    // Account A: Primary Account
    this.clientA = new (ccxt as any).delta({
      apiKey: process.env.DELTA_API_KEY_A || '',
      secret: process.env.DELTA_API_SECRET_A || '',
      enableRateLimit: true,
    });

    // Account B: Insurance Account
    this.clientB = new (ccxt as any).delta({
      apiKey: process.env.DELTA_API_KEY_B || '',
      secret: process.env.DELTA_API_SECRET_B || '',
      enableRateLimit: true,
    });

    if (this.isTestnet) {
      this.clientA.setSandboxMode(true);
      this.clientB.setSandboxMode(true);
    }
  }

  public async initialize() {
    try {
      await Promise.all([
        this.clientA.loadMarkets(),
        this.clientB.loadMarkets()
      ]);
      Logger.info(`Delta Exchange Service Initialized (Testnet: ${this.isTestnet}, Shadow: ${this.isShadowMode})`);
    } catch (error) {
      Logger.error('Failed to initialize Delta Exchange clients:', error);
      throw error;
    }
  }

  public getClientA() { return this.clientA; }
  public getClientB() { return this.clientB; }

  public async setMarginMode(client: any, symbol: string, marginMode: 'CROSS' | 'ISOLATED') {
    if (this.isShadowMode) return { status: 'success', marginMode, simulated: true };
    try {
      // Delta Exchange specific margin mode setup if needed
      // Note: Delta often uses cross by default on subaccounts
      // Some exchanges use setMarginMode, others require it in order params
      return await client.setMarginMode(marginMode.toLowerCase(), symbol);
    } catch (error: any) {
      if (error.message?.includes('already')) return { status: 'success', message: 'already set' };
      throw error;
    }
  }

  public async setLeverage(client: any, symbol: string, leverage: number) {
    if (this.isShadowMode) return { status: 'success', leverage, simulated: true };
    try {
      return await client.setLeverage(leverage, symbol);
    } catch (error) {
      Logger.error(`Failed to set leverage for ${symbol}:`, error);
      throw error;
    }
  }

  public async placeOrder(client: any, symbol: string, type: string, side: 'buy' | 'sell', amount: number, price?: number, params: any = {}) {
    if (this.isShadowMode) {
      const simulatedId = `sim_delta_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      Logger.info(`[DELTA_SHADOW] ${side.toUpperCase()} ${amount} ${symbol} @ ${price || 'MARKET'}`);
      return { id: simulatedId, symbol, side, amount, price, status: 'closed', simulated: true };
    }

    try {
      return await client.createOrder(symbol, type, side, amount, price, params);
    } catch (error) {
      Logger.error(`Delta Order Placement Failed (${side}):`, error);
      throw error;
    }
  }

  public async fetchTicker(symbol: string) {
    // Both clients share market data
    return await this.clientA.fetchTicker(symbol);
  }

  public async fetchBalance(client: any) {
    if (this.isShadowMode) {
       return { USDT: { free: 10000, total: 10000 }, simulated: true };
    }
    return await client.fetchBalance();
  }
}
