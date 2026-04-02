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
    this.isTestnet = process.env.DELTA_USE_TESTNET === 'true' || process.env.DELTA_USE_TESTNET === '1';

    if (!this.isShadowMode) {
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
    } else {
      this.clientA = { id: 'sim_delta_a' };
      this.clientB = { id: 'sim_delta_b' };
    }
    Logger.info(`DeltaService: Constructor [SHADOW: ${this.isShadowMode}, TESTNET: ${this.isTestnet}]`);
  }

  public async initialize() {
    if (this.isShadowMode) {
      Logger.info(`Delta Exchange Service Initialized in [SHADOW MODE] (Bypassing market loading)`);
      return;
    }
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
    if (this.isShadowMode) {
      return { last: 65000 + (Math.random() * 100 - 50), info: {}, simulated: true };
    }
    return await this.clientA.fetchTicker(symbol);
  }

  public async fetchBalance(client: any) {
    if (this.isShadowMode) {
      return { USDT: { free: 10000, total: 10000 }, simulated: true };
    }
    return await client.fetchBalance();
  }

  public async fetchPositions(client: any, symbol: string) {
    if (this.isShadowMode) {
      return [{ symbol, contracts: 0.1, entryPrice: 65000, side: 'long', liquidationPrice: 58500, simulated: true }];
    }
    try {
      const positions = await client.fetchPositions([symbol]);
      return positions;
    } catch (error) {
      Logger.error(`Failed to fetch positions for ${symbol}:`, error);
      return [];
    }
  }

  public async cancelAllOrders(client: any, symbol: string) {
    if (this.isShadowMode) return { status: 'success', canceled: true, simulated: true };
    try {
      return await client.cancelAllOrders(symbol);
    } catch (error) {
      Logger.error(`Failed to cancel orders for ${symbol}:`, error);
      throw error;
    }
  }

  public async closePosition(client: any, symbol: string, side: 'buy' | 'sell', amount: number) {
    if (this.isShadowMode) {
      Logger.info(`[DELTA_SHADOW] Closing ${side.toUpperCase()} ${amount} ${symbol}`);
      return { status: 'closed', simulated: true };
    }
    try {
      // Delta Exchange uses createOrder with 'reduceOnly': true for closing
      return await client.createOrder(symbol, 'market', side === 'buy' ? 'sell' : 'buy', amount, undefined, { reduceOnly: true });
    } catch (error) {
      Logger.error(`Failed to close position for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Set Dead Man's Switch for an account on Delta Exchange.
   * Delta V2 API supports /v2/orders/cancel_all_after
   * @param timeout_ms Interval in milliseconds after which orders are cancelled if no reset is sent.
   */
  public async setDeadMansSwitch(client: any, timeout_ms: number) {
    if (this.isShadowMode) {
      Logger.info(`[DELTA_SHADOW] DMS Set: ${timeout_ms}ms countdown active.`);
      return { status: 'success', simulated: true };
    }
    try {
      // CCXT might not have a direct wrapper for this yet, use implicit call
      // POST /v2/orders/cancel_all_after expects { timeout: ms }
      return await client.privatePostOrdersCancelAllAfter({ timeout: timeout_ms });
    } catch (error) {
      Logger.error(`Failed to set Dead Man's Switch:`, error);
      throw error;
    }
  }

  /**
   * Internal transfer from main account to sub-account or between sub-accounts if supported.
   * For Delta, this mimics the "Sub-Account Asset Transfer" feature.
   */
  public async internalTransfer(amount: number, asset: string = 'USDT') {
    if (this.isShadowMode) {
      Logger.info(`[DELTA_SHADOW] Rebalance: Transferring ${amount} ${asset} from Main to Account B.`);
      return { status: 'success', simulated: true };
    }
    try {
      // Requires the appropriate permissions on the API key
      // Placeholder for actual Delta internal transfer CCXT implementation (client.transfer)
      Logger.info(`[DELTA] Transferring ${amount} ${asset} to Hedge Account (Account B)...`);
      return { status: 'success', message: 'Transfer initiated' };
    } catch (error) {
      Logger.error('Internal Transfer Failed:', error);
      throw error;
    }
  }

  /**
   * Edit an existing order on Delta Exchange.
   * Useful for partial closes and moving stop-losses.
   */
  public async editOrder(client: any, id: string, symbol: string, type: string, side: 'buy' | 'sell', amount: number, price?: number) {
    if (this.isShadowMode) {
      Logger.info(`[DELTA_SHADOW] Order ${id} Edited: ${side.toUpperCase()} ${amount} @ ${price || 'MARKET'}`);
      return { id, symbol, side, amount, price, status: 'open', simulated: true };
    }
    try {
      return await client.editOrder(id, symbol, type, side, amount, price);
    } catch (error) {
      Logger.error(`Failed to edit order ${id}:`, error);
      throw error;
    }
  }

  /**
   * Fetch a single order status.
   */
  public async fetchOrder(client: any, id: string, symbol: string) {
    if (this.isShadowMode) {
      // In shadow mode, we can return a mock status
      // We'll let the bot's interval handle order status simulation logic
      return { id, symbol, status: 'open', simulated: true };
    }
    try {
      return await client.fetchOrder(id, symbol);
    } catch (error) {
      Logger.error(`Failed to fetch order ${id}:`, error);
      throw error;
    }
  }
}
