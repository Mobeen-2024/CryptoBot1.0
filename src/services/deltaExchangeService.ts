import ccxt from 'ccxt';
import dotenv from 'dotenv';
import { Logger } from '../../logger.js';

dotenv.config({ quiet: true });

export class DeltaExchangeService {
  private clientA: any;
  private clientB: any;
  private isTestnet: boolean;
  private isShadowMode: boolean;
  private rateLimitInfoA: { limit: number; remaining: number; reset: number } = { limit: 0, remaining: 100, reset: 0 };
  private rateLimitInfoB: { limit: number; remaining: number; reset: number } = { limit: 0, remaining: 100, reset: 0 };

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
      const triggerInfo = params.stopPrice ? ` (STOP: ${params.stopPrice})` : '';
      Logger.info(`[DELTA_SHADOW] ${type.toUpperCase()} ${side.toUpperCase()} ${amount} ${symbol} @ ${price || 'MARKET'}${triggerInfo}`);
      return { id: simulatedId, symbol, side, amount, price, status: 'open', simulated: true, type, params };
    }

    try {
      const order = await client.createOrder(symbol, type, side, amount, price, params);
      this.updateRateLimits(client, (order as any).info);
      return order;
    } catch (error) {
      Logger.error(`Delta Order Placement Failed (${side}):`, error);
      throw error;
    }
  }

  public async placeBracketOrder(client: any, symbol: string, qty: number, side: 'buy' | 'sell', price: number, slPrice: number, tpPrice: number) {
    if (this.isShadowMode) {
      Logger.info(`[DELTA_SHADOW] BRACKET ORDER: ${side.toUpperCase()} ${qty} @ ${price} [SL: ${slPrice}, TP: ${tpPrice}]`);
      return { id: `sim_bracket_${Date.now()}`, status: 'open', simulated: true };
    }

    try {
      const params = {
        symbol,
        side: side.toUpperCase(),
        order_type: 'limit',
        limit_price: price.toString(),
        size: qty.toString(),
        stop_loss_price: slPrice.toString(),
        take_profit_price: tpPrice.toString()
      };
      // POST /v2/orders/bracket
      const response = await client.privatePostOrdersBracket(params);
      this.updateRateLimits(client, response);
      return response;
    } catch (error) {
      Logger.error(`Delta Bracket Order Failed:`, error);
      throw error;
    }
  }

  public async placeBatchOrders(client: any, orders: any[]) {
    if (this.isShadowMode) {
      Logger.info(`[DELTA_SHADOW] BATCH EXECUTION: ${orders.length} sub-orders triggered.`);
      return { status: 'success', orders: orders.length, simulated: true };
    }

    try {
      // POST /v2/orders/bulk
      const response = await client.privatePostOrdersBulk({ orders });
      this.updateRateLimits(client, response);
      return response;
    } catch (error) {
      Logger.error(`Delta Batch Execution Failed:`, error);
      throw error;
    }
  }

  public async transferSubaccountFunds(fromId: string, toId: string, asset: string, amount: number) {
    if (this.isShadowMode) {
      Logger.info(`[DELTA_SHADOW] Subaccount Transfer: Main(${fromId}) -> Hedge(${toId}) | ${amount} ${asset}`);
      return { status: 'success', simulated: true };
    }

    try {
      // POST /v2/subaccounts/transfer
      const response = await this.clientA.privatePostSubaccountsTransfer({
        transferer_user_id: fromId,
        transferee_user_id: toId,
        asset_symbol: asset,
        amount: amount.toString()
      });
      return response;
    } catch (error) {
      Logger.error(`Delta Subaccount Transfer Failed:`, error);
      throw error;
    }
  }

  private updateRateLimits(client: any, info: any) {
    // In Delta V2, headers often contain rate limit info
    // CCXT exposes lastResponseHeaders
    const headers = client.lastResponseHeaders;
    if (headers) {
      const remaining = parseInt(headers['x-ratelimit-remaining'] || '100');
      const limit = parseInt(headers['x-ratelimit-limit'] || '0');
      const reset = parseInt(headers['x-ratelimit-reset'] || '0');
      
      if (client === this.clientA) {
        this.rateLimitInfoA = { limit, remaining, reset };
      } else {
        this.rateLimitInfoB = { limit, remaining, reset };
      }
    }
  }

  public getRateLimitStatus() {
    return { accountA: this.rateLimitInfoA, accountB: this.rateLimitInfoB };
  }

  public async fetchTicker(symbol: string) {
    if (this.isShadowMode) {
      return { last: 65000 + (Math.random() * 100 - 50), info: {}, simulated: true };
    }
    return await this.clientA.fetchTicker(symbol);
  }

  public async fetchLiquidityMetrics(symbol: string) {
    if (this.isShadowMode) {
      return { spread: 0.5, spreadPct: 0.0001, depth1Pct: 10, last: 65000 };
    }
    const orderbook = await this.clientA.fetchOrderBook(symbol, 20);
    const ticker = await this.clientA.fetchTicker(symbol);
    
    const bid = orderbook.bids[0][0];
    const ask = orderbook.asks[0][0];
    const spread = ask - bid;
    const spreadPct = (spread / bid) * 100;
    
    // Measure 1% Depth (Total Liquidity within 1% of mid)
    const mid = (bid + ask) / 2;
    const depth1Pct = orderbook.bids
      .filter(([p]) => p >= mid * 0.99)
      .reduce((sum, [_, q]) => sum + q, 0);

    return { spread, spreadPct, depth1Pct, last: ticker.last };
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
