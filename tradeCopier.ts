import ccxt from 'ccxt';
import WebSocket from 'ws';
import axios from 'axios';
import dotenv from 'dotenv';
import Database from 'better-sqlite3';
import { Logger } from './logger';
import { Server as SocketIOServer } from 'socket.io';

dotenv.config({ quiet: true });

interface ExecutionReport {
  e: string; // Event type
  E: number; // Event time
  s: string; // Symbol
  c: string; // Client order ID
  S: string; // Side
  o: string; // Order type
  f: string; // Time in force
  q: string; // Order quantity
  p: string; // Order price
  P: string; // Stop price
  F: string; // Iceberg quantity
  g: number; // OrderListId
  C: string; // Original client order ID
  x: string; // Current execution type
  X: string; // Current order status
  r: string; // Order reject reason
  i: number; // Order ID
  l: string; // Last executed quantity
  z: string; // Cumulative filled quantity
  L: string; // Last executed price
  n: string; // Commission amount
  N: string; // Commission asset
  T: number; // Transaction time
  t: number; // Trade ID
  I: number; // Ignore
  w: boolean; // Is the order on the book?
  m: boolean; // Is this trade the maker side?
  M: boolean; // Ignore
  O: number; // Order creation time
  Z: string; // Cumulative quote asset transacted quantity
  Y: string; // Last quote asset transacted quantity (i.e. lastPrice * lastQty)
  Q: string; // Quote Order Qty
}

export class TradeCopier {
  private masterClient: any;
  private slaveClients: { id: string; client: any }[] = [];
  private db: Database.Database;
  private spotListenKey: string | null = null;
  private marginListenKey: string | null = null;
  private spotWs: WebSocket | null = null;
  private marginWs: WebSocket | null = null;
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private isTestnet: boolean;
  private baseUrl: string;
  private wsUrl: string;
  private hasAutoSwitchedEnv: boolean = false;
  private isRateLimited: boolean = false;
  private rateLimitResetTime: number = 0;
  private isShadowMode: boolean;
  private io: SocketIOServer | null;

  constructor(io?: SocketIOServer) {
    this.io = io || null;
    // Robust check for boolean true
    this.isTestnet = process.env.BINANCE_USE_TESTNET === 'true' || process.env.BINANCE_USE_TESTNET === '1';
    this.isShadowMode = process.env.BINANCE_SHADOW_MODE === 'true' || process.env.BINANCE_SHADOW_MODE === '1';
    
    // Initialize Database
    this.db = new Database('trades.db');
    this.initDb();

    // Initialize Master Client
    this.masterClient = new (ccxt as any).binance({
      apiKey: process.env.BINANCE_API_KEY || '',
      secret: (process.env.BINANCE_API_SECRET || process.env.BINANCE_SECRET_KEY) || '',
      options: { defaultType: 'spot' },
      enableRateLimit: true,
    });

    // Initialize Slave Clients dynamically
    let slaveId = 0;
    
    // Check for base slave key
    if (process.env.BINANCE_SLAVE_API_KEY) {
      this.slaveClients.push({
        id: `slave_${slaveId++}`,
        client: new (ccxt as any).binance({
          apiKey: process.env.BINANCE_SLAVE_API_KEY || '',
          secret: (process.env.BINANCE_SLAVE_API_SECRET || process.env.BINANCE_SLAVE_SECRET_KEY) || '',
          options: { defaultType: 'spot' },
          enableRateLimit: true,
        })
      });
    }

    // Check for numbered slave keys up to 20 slaves
    for (let i = 1; i <= 20; i++) {
        if (process.env[`BINANCE_SLAVE_API_KEY_${i}`]) {
             this.slaveClients.push({
                id: `slave_${slaveId++}`,
                client: new (ccxt as any).binance({
                    apiKey: process.env[`BINANCE_SLAVE_API_KEY_${i}`] || '',
                    secret: (process.env[`BINANCE_SLAVE_API_SECRET_${i}`] || process.env[`BINANCE_SLAVE_SECRET_KEY_${i}`]) || '',
                    options: { defaultType: 'spot' },
                    enableRateLimit: true,
                })
             });
        }
    }

    if (this.slaveClients.length === 0 && this.isShadowMode) {
         Logger.info('Trade Copier: No valid slave keys found. Creating Virtual Slave ("slave_virtual_1") for Shadow Mode testing.');
         this.slaveClients.push({
            id: 'slave_virtual_1',
            client: new (ccxt as any).binance({
               options: { defaultType: 'spot' }
            })
         });
    }

    this.configureEnvironment();
  }

  private async executeWithRateLimit<T>(fn: () => Promise<T>, context: string, retries = 3): Promise<T> {
    if (this.isRateLimited) {
      const now = Date.now();
      if (now < this.rateLimitResetTime) {
        const waitTime = this.rateLimitResetTime - now;
        Logger.warn(`Trade Copier: Rate limit active. Waiting ${Math.ceil(waitTime / 1000)}s before executing ${context}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        this.isRateLimited = false;
      }
    }

    try {
      return await fn();
    } catch (error: any) {
      // Check for Rate Limit errors (CCXT types or HTTP status codes)
      const isRateLimit = 
        error instanceof ccxt.RateLimitExceeded || 
        error instanceof ccxt.DDoSProtection || 
        (error.message && (error.message.includes('429') || error.message.includes('418'))) ||
        (error.response && (error.response.status === 429 || error.response.status === 418));

      if (isRateLimit) {
        Logger.warn(`Trade Copier: Rate limit exceeded during ${context}. Pausing trading.`, error);
        this.isRateLimited = true;
        
        // Determine backoff time
        // 418 (IP Ban) requires longer wait (e.g., 5 mins), 429 is usually shorter (e.g., 1 min)
        const isBan = error.message?.includes('418') || error.response?.status === 418;
        const backoffMs = isBan ? 5 * 60 * 1000 : 60 * 1000;
        
        this.rateLimitResetTime = Date.now() + backoffMs;
        
        if (retries > 0) {
           Logger.info(`Trade Copier: Retrying ${context} after backoff... (${retries} attempts left)`);
           await new Promise(resolve => setTimeout(resolve, backoffMs));
           return this.executeWithRateLimit(fn, context, retries - 1);
        }
      }
      throw error;
    }
  }

  private configureEnvironment() {
    if (this.isTestnet) {
      this.masterClient.setSandboxMode(true);
      this.slaveClients.forEach(s => s.client.setSandboxMode(true));
      this.baseUrl = 'https://testnet.binance.vision';
      this.wsUrl = 'wss://testnet.binance.vision';
    } else {
      this.masterClient.setSandboxMode(false);
      this.slaveClients.forEach(s => s.client.setSandboxMode(false));
      this.baseUrl = 'https://api.binance.com';
      this.wsUrl = 'wss://stream.binance.com:9443';
    }
  }

  private toggleEnvironment() {
    this.isTestnet = !this.isTestnet;
    this.configureEnvironment();
    Logger.info(`Trade Copier: Auto-switched to ${this.isTestnet ? 'Testnet' : 'Live'} mode to resolve 410 error.`);
  }

  private initDb() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS copied_fills_v2 (
        slave_id TEXT,
        master_trade_id TEXT,
        master_order_id TEXT,
        slave_order_id TEXT,
        symbol TEXT,
        side TEXT,
        quantity REAL,
        price REAL,
        timestamp INTEGER,
        PRIMARY KEY (slave_id, master_trade_id)
      );
      CREATE TABLE IF NOT EXISTS shadow_balances (
        slave_id TEXT,
        asset TEXT,
        balance REAL,
        PRIMARY KEY (slave_id, asset)
      );
    `);
  }

  public async start() {
    if (!process.env.BINANCE_API_KEY || (!process.env.BINANCE_SLAVE_API_KEY && this.slaveClients.length === 0)) {
      if (!this.isShadowMode) {
         Logger.info('Trade Copier: Missing API keys for Master or Slave. Skipping initialization.');
         return;
      } else {
         Logger.info('Trade Copier: Running in fully Keyless Shadow Mode (Paper Trading Only).');
      }
    }

    // Check for self-copying configuration
    if (process.env.BINANCE_API_KEY === process.env.BINANCE_SLAVE_API_KEY && !this.isShadowMode) {
      Logger.error('Trade Copier: Master and Slave API Keys are identical. Aborting to prevent self-copying loops.');
      return;
    }

    Logger.info(`Trade Copier: Configuration - Testnet: ${this.isTestnet}, BaseURL: ${this.baseUrl}`);
    Logger.info('Starting Trade Copier...');
    try {
      // Load markets for precision handling and symbol mapping
      // Use public methods to avoid auth errors during market loading if keys are bad
      for (const slave of this.slaveClients) {
          await slave.client.loadMarkets();
      }
      await this.masterClient.loadMarkets();
      
      if (process.env.BINANCE_API_KEY) {
         await this.initUserDataStream();
      } else {
         Logger.info('Trade Copier: Bypassing User Data Stream WebSocket since no Master Binance API key is configured. Awaiting Webhooks/UI Signals.');
      }
    } catch (error: any) {
      Logger.error('Failed to start Trade Copier:', error);
      // If it's an auth error, we don't want to crash the whole server, just stop the copier
      if (error.message?.includes('Invalid Api-Key ID') || error.code === -2008) {
        Logger.error('Trade Copier: Invalid API keys detected. Copier will not run.');
      }
    }
  }

  public async getBalance(client: any, asset: string, slaveId?: string): Promise<number> {
    if (this.isShadowMode && slaveId) {
      // Intercept Request: Query from Virtual Shadow Balance SQLite table
      const stmt = this.db.prepare('SELECT balance FROM shadow_balances WHERE slave_id = ? AND asset = ?');
      const row = stmt.get(slaveId, asset) as { balance: number } | undefined;
      
      if (row) {
        return row.balance;
      } else {
        // If not found, Seed initial simulated balance
        let defaultBalance = 0;
        if (asset === 'USDT' || asset === 'USDC' || asset === 'BUSD') {
            defaultBalance = parseFloat(process.env.BINANCE_SHADOW_STARTING_BALANCE || '10000');
        }
        
        const insert = this.db.prepare('INSERT INTO shadow_balances (slave_id, asset, balance) VALUES (?, ?, ?)');
        insert.run(slaveId, asset, defaultBalance);
        return defaultBalance;
      }
    }

    if (!client.apiKey) return 0; // Return 0 if keyless live call attempted

    // Real Execution
    try {
      const balance = await this.executeWithRateLimit(
        () => client.fetchBalance(),
        `fetchBalance(${asset})`
      );
      const total = balance[asset]?.total || 0;
      return total;
    } catch (error) {
      Logger.error(`Trade Copier: Failed to fetch balance for ${asset}:`, error);
      return 0;
    }
  }

  public updateShadowBalance(slaveId: string, baseAsset: string, quoteAsset: string, side: 'buy' | 'sell', quantity: number, price: number) {
    if (!this.isShadowMode) return;
    
    // Fetch Current Holdings
    const getBase = this.db.prepare('SELECT balance FROM shadow_balances WHERE slave_id = ? AND asset = ?');
    const getQuote = this.db.prepare('SELECT balance FROM shadow_balances WHERE slave_id = ? AND asset = ?');
    
    // Initialize if empty using getBalance fallback logic
    let baseQty = 0;
    const baseRow = getBase.get(slaveId, baseAsset) as { balance: number } | undefined;
    if (baseRow) baseQty = baseRow.balance;
    
    let quoteQty = parseFloat(process.env.BINANCE_SHADOW_STARTING_BALANCE || '10000');
    const quoteRow = getQuote.get(slaveId, quoteAsset) as { balance: number } | undefined;
    if (quoteRow) quoteQty = quoteRow.balance;
    
    const value = quantity * price;

    if (side === 'buy') {
       baseQty += quantity;     // Acquire Base (e.g. BTC)
       quoteQty -= value;       // Spend Quote (e.g. USDT)
    } else {
       baseQty -= quantity;     // Sell Base
       quoteQty += value;       // Acquire Quote
    }

    // Upsert Back to Database
    const upsert = this.db.prepare(`
       INSERT INTO shadow_balances (slave_id, asset, balance) VALUES (?, ?, ?)
       ON CONFLICT(slave_id, asset) DO UPDATE SET balance = excluded.balance
    `);
    
    upsert.run(slaveId, baseAsset, baseQty);
    upsert.run(slaveId, quoteAsset, quoteQty);

    if (this.io) {
      this.io.emit('balance_update');
    }
  }

  private async initUserDataStream() {
    try {
      Logger.info(`Trade Copier: Initializing User Data Streams (Spot & Margin)...`);

      const apiKey = process.env.BINANCE_API_KEY;
      if (!apiKey) throw new Error('BINANCE_API_KEY is missing');

      // 1. Get Listen Keys for both Spot and Cross Margin
      try {
        // Spot Listen Key
        const spotRes = await axios.post(`${this.baseUrl}/api/v3/userDataStream`, null, {
          headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        this.spotListenKey = spotRes.data.listenKey;
        Logger.info('Trade Copier: Obtained Spot Listen Key');

        // Margin Listen Key
        const marginRes = await axios.post(`${this.baseUrl}/sapi/v1/userDataStream`, null, {
          headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        this.marginListenKey = marginRes.data.listenKey;
        Logger.info('Trade Copier: Obtained Cross Margin Listen Key');
      } catch (axiosError: any) {
         if (axiosError.response && axiosError.response.status === 410) {
           Logger.error('Trade Copier: Error 410 Gone. This usually means you are using Testnet keys on Live URL or vice versa.');
         }
         throw axiosError;
      }

      // 2. Start Keep-Alive Interval (every 30 mins)
      if (this.keepAliveInterval) clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = setInterval(() => this.keepListenKeyAlive(), 30 * 60 * 1000);

      // 3. Connect WebSockets
      this.connectWebSocket();

    } catch (error: any) {
      const errorMessage = error.message || '';
      const is410 = errorMessage.includes('410') || (error.response && error.response.status === 410) || error.code === 410 || errorMessage.includes('Gone');

      if (is410 && !this.hasAutoSwitchedEnv) {
        Logger.warn('Trade Copier: 410 Gone detected. API Key/Env mismatch. Auto-switching...');
        this.hasAutoSwitchedEnv = true;
        this.toggleEnvironment();
        for (const slave of this.slaveClients) await slave.client.loadMarkets();
        await this.masterClient.loadMarkets();
        this.initUserDataStream();
        return;
      }

      Logger.error('Trade Copier: Error initializing User Data Stream:', error);
      setTimeout(() => this.initUserDataStream(), 5000);
    }
  }

  private async keepListenKeyAlive() {
    const apiKey = process.env.BINANCE_API_KEY;
    if (!apiKey) return;

    if (this.spotListenKey) {
      try {
         await axios.put(`${this.baseUrl}/api/v3/userDataStream`, null, {
            params: { listenKey: this.spotListenKey },
            headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
         });
         Logger.info('Trade Copier: Spot Listen Key kept alive');
      } catch (e) { Logger.error('Trade Copier: Failed to keep Spot Listen Key alive'); }
    }

    if (this.marginListenKey) {
      try {
         await axios.put(`${this.baseUrl}/sapi/v1/userDataStream`, null, {
            params: { listenKey: this.marginListenKey },
            headers: { 'X-MBX-APIKEY': apiKey, 'Content-Type': 'application/x-www-form-urlencoded' }
         });
         Logger.info('Trade Copier: Margin Listen Key kept alive');
      } catch (e) { Logger.error('Trade Copier: Failed to keep Margin Listen Key alive'); }
    }
  }

  private connectWebSocket() {
    // Spot WS
    if (this.spotListenKey) {
      const spotWsEndpoint = `${this.wsUrl}/ws/${this.spotListenKey}`;
      Logger.info(`Trade Copier: Connecting Spot WS: ${spotWsEndpoint}`);
      this.spotWs = new WebSocket(spotWsEndpoint);

      this.spotWs.on('open', () => Logger.info('Trade Copier: Spot WS Connected'));
      this.spotWs.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.e === 'executionReport') this.handleExecutionReport(message as ExecutionReport, 'spot');
        } catch (error) { Logger.error('Trade Copier: Spot WS Parse Error', error); }
      });
      this.spotWs.on('close', () => {
        Logger.info('Trade Copier: Spot WS Closed. Reconnecting...');
        setTimeout(() => this.initUserDataStream(), 5000);
      });
      this.spotWs.on('error', (error) => Logger.error('Trade Copier: Spot WS Error:', error));
    }

    // Margin WS
    if (this.marginListenKey) {
      const marginWsEndpoint = `${this.wsUrl}/ws/${this.marginListenKey}`;
      Logger.info(`Trade Copier: Connecting Margin WS: ${marginWsEndpoint}`);
      this.marginWs = new WebSocket(marginWsEndpoint);

      this.marginWs.on('open', () => Logger.info('Trade Copier: Margin WS Connected'));
      this.marginWs.on('message', (data: WebSocket.Data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.e === 'executionReport') this.handleExecutionReport(message as ExecutionReport, 'margin');
        } catch (error) { Logger.error('Trade Copier: Margin WS Parse Error', error); }
      });
      this.marginWs.on('close', () => {
        Logger.info('Trade Copier: Margin WS Closed. Reconnecting...');
        setTimeout(() => this.initUserDataStream(), 5000);
      });
      this.marginWs.on('error', (error) => Logger.error('Trade Copier: Margin WS Error:', error));
    }
  }

  private async handleExecutionReport(report: ExecutionReport, streamType: 'spot' | 'margin' = 'spot') {
    // Only copy trades that are FILLED or PARTIALLY_FILLED
    if (report.X !== 'FILLED' && report.X !== 'PARTIALLY_FILLED') {
      return;
    }

    // Avoid double execution (Master Trade ID)
    const masterTradeId = report.t.toString();
    const masterOrderId = report.i.toString();
    
    // Check DB - only check non-master entries to avoid blocking slave copies
    // when called from processSimulatedMasterTrade (which inserts the master row first)
    const stmt = this.db.prepare('SELECT master_trade_id FROM copied_fills_v2 WHERE master_trade_id = ? AND slave_id != ?');
    const existing = stmt.get(masterTradeId, 'master');

    if (existing) {
      return;
    }

    Logger.info(`Trade Copier: Detected Trade on Master. Symbol: ${report.s}, Side: ${report.S}, Qty: ${report.l}, Price: ${report.L}`);

    try {
      // Execute on Slave
      // Robust Symbol Mapping: Use CCXT's markets_by_id if available, fallback to string manipulation
      let symbol = report.s;
      
      // Try to find market in loaded markets
      // Note: CCXT stores markets by ID (e.g. BTCUSDT) in markets_by_id
      // We need to access the internal property safely
      if (typeof this.masterClient.markets_by_id === 'object' && this.masterClient.markets_by_id[report.s]?.symbol) {
        symbol = this.masterClient.markets_by_id[report.s].symbol;
      } else {
        // Fallback logic
        if (symbol && !symbol.includes('/') && symbol.endsWith('USDT')) {
          symbol = symbol.replace('USDT', '/USDT');
        }
      }

      if (!symbol) symbol = 'BTC/USDT'; // Safety fallback

      const side = report.S.toLowerCase() as 'buy' | 'sell';
      const type = report.o.toLowerCase();
      const masterQuantity = parseFloat(report.l); // Last executed quantity
      const price = parseFloat(report.L); // Last executed price
      
      const parts = symbol.split('/');
      const baseAsset = parts[0];
      const quoteAsset = parts[1] || 'USDT'; // Default to USDT if split fails

      // Apply margin tag if it came from the margin stream (so backend maps it to Cross)
      if (streamType === 'margin' && !symbol.includes('-CROSS')) {
        symbol = `${symbol}-CROSS`;
      }
      // Or if it natively had marginType attached (like in shadow mode)
      else if ((report as any).marginType && (report as any).marginType !== 'SPOT' && !symbol.includes('-' + (report as any).marginType)) {
        symbol = `${symbol}-${(report as any).marginType}`;
      }

      let balanceAsset = quoteAsset;
      if (side === 'sell') {
        balanceAsset = baseAsset;
      }
      
      // FIX: Insert the master trade into the database for LIVE trades.
      // processSimulatedMasterTrade inserts it before calling handleExecutionReport,
      // but live trades from WebSocket never get inserted as 'master'.
      const masterCheckStmt = this.db.prepare('SELECT master_trade_id FROM copied_fills_v2 WHERE master_trade_id = ? AND slave_id = ?');
      const masterExisting = masterCheckStmt.get(masterTradeId, 'master');
      
      if (!masterExisting) {
         try {
           const insertMaster = this.db.prepare(`
             INSERT INTO copied_fills_v2 (slave_id, master_trade_id, master_order_id, slave_order_id, symbol, side, quantity, price, timestamp)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           `);
           const tradeTimestamp = report.T || Date.now();
           insertMaster.run('master', masterTradeId, masterOrderId, masterOrderId, symbol, side, masterQuantity, price, tradeTimestamp);
           
           if (this.io) {
             this.io.emit('new_trade', {
               slave_id: 'master',
               master_trade_id: masterTradeId,
               symbol: symbol,
               side: side,
               quantity: masterQuantity,
               price: price,
               timestamp: tradeTimestamp
             });
           }
         } catch (dbErr) {
           Logger.error('Trade Copier: Failed to insert live master trade into DB:', dbErr);
         }
      }
      
      const masterBalance = await this.getBalance(this.masterClient, balanceAsset, 'master');

      if (masterBalance <= 0 && !this.isShadowMode) {
        Logger.warn(`Trade Copier: Master balance for ${balanceAsset} is 0 or less. Skipping order execution for slaves.`);
        return;
      }
      
      const effectiveMasterBalance = masterBalance > 0 ? masterBalance : 10000; // Fallback for shadow mode dividing

      // Loop over configured slave clients
      for (const slave of this.slaveClients) {
          const slaveId = slave.id;
          
          // Check DB per slave
          const stmt = this.db.prepare('SELECT master_trade_id FROM copied_fills_v2 WHERE master_trade_id = ? AND slave_id = ?');
          const existing = stmt.get(masterTradeId, slaveId);

          if (existing) {
             Logger.debug(`Trade Copier: Trade ${masterTradeId} already copied for ${slaveId}. Skipping.`);
             continue;
          }

          try {
            // Include slaveId to trigger Shadow Interceptor natively
            const slaveBalance = await this.getBalance(slave.client, balanceAsset, slaveId);
            const effectiveSlaveBalance = slaveBalance > 0 ? slaveBalance : (this.isShadowMode ? 10000 : 0);
            
            let ratio = effectiveSlaveBalance / effectiveMasterBalance;
            let slaveQuantity = masterQuantity * ratio;

            Logger.info(`Trade Copier [${slaveId}]: Balance Ratio Calculation (${side.toUpperCase()} -> use ${balanceAsset}):`);
            Logger.info(`- Master ${balanceAsset}: ${masterBalance}`);
            Logger.info(`- Slave ${balanceAsset}: ${slaveBalance}`);
            Logger.info(`- Ratio: ${ratio.toFixed(4)}`);
            Logger.info(`- Master Qty: ${masterQuantity} -> Slave Qty: ${slaveQuantity}`);

            // Apply Precision (Step Size) utilizing this specific slave's fetched markets
            const formattedQuantity = slave.client.amountToPrecision(symbol, slaveQuantity);
            
            if (parseFloat(formattedQuantity) === 0) {
              Logger.warn(`Trade Copier [${slaveId}]: Calculated slave quantity is 0 (Ratio: ${ratio}). Skipping order for this account.`);
              continue; // Move to the next slave instead of exiting the whole report
            }

            Logger.info(`Trade Copier [${slaveId}]: Executing on Slave... ${side.toUpperCase()} ${formattedQuantity} ${symbol}`);

            let order;
            if (this.isShadowMode) {
              const simulatedId = `sim_order_${Date.now()}`;
              Logger.info(`Trade Copier [${slaveId}]: Virtual Execution (Shadow Mode). Simulated ID: ${simulatedId}`);
              order = { id: simulatedId };
            } else {
              if (type === 'market') {
                order = await this.executeWithRateLimit(
                  () => slave.client.createOrder(symbol, 'market', side, formattedQuantity),
                  `createOrder(${slaveId} MARKET ${symbol})`
                );
              } else if (type === 'limit' || type === 'limit_maker') {
                order = await this.executeWithRateLimit(
                  () => slave.client.createOrder(symbol, 'limit', side, formattedQuantity, price),
                  `createOrder(${slaveId} LIMIT ${symbol})`
                );
              } else {
                Logger.info(`Trade Copier [${slaveId}]: Order type ${type} filled. Executing as MARKET on slave to ensure sync.`);
                order = await this.executeWithRateLimit(
                  () => slave.client.createOrder(symbol, 'market', side, formattedQuantity),
                  `createOrder(${slaveId} MARKET-Fallback ${symbol})`
                );
              }
            }

            Logger.info(`Trade Copier [${slaveId}]: Slave Order Executed. ID: ${order.id}`);

            // Insert into DB
            const insert = this.db.prepare(`
              INSERT INTO copied_fills_v2 (slave_id, master_trade_id, master_order_id, slave_order_id, symbol, side, quantity, price, timestamp)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);
            const timestamp = Date.now();
            insert.run(slaveId, masterTradeId, masterOrderId, order.id, symbol, side, parseFloat(formattedQuantity), price, timestamp);

            if (this.isShadowMode) {
               this.updateShadowBalance(slaveId, baseAsset, quoteAsset, side, parseFloat(formattedQuantity), price);
            } else {
               if (this.io) this.io.emit('balance_update'); // Live mode triggers balance fetch
            }

            if (this.io) {
              this.io.emit('new_trade', {
                slave_id: slaveId,
                master_trade_id: masterTradeId,
                symbol,
                side,
                quantity: parseFloat(formattedQuantity),
                price,
                timestamp
              });
            }

          } catch (slaveError) {
             Logger.error(`Trade Copier: Failed to execute slave order for ${slaveId}:`, slaveError);
          }
      }

    } catch (error) {
      Logger.error('Trade Copier: Failed processing master fill:', error);
    }
  }

  public async processSimulatedMasterTrade(report: any) {
    Logger.info(`Trade Copier: Received Simulated Master Trade from UI: ${report.S} ${report.l} ${report.s}`);
    
    try {
      // Convert symbol to Binance format
      let ccxtSymbol = report.s;
      if (!ccxtSymbol.includes('/') && ccxtSymbol.endsWith('USDT')) {
        ccxtSymbol = ccxtSymbol.replace('USDT', '/USDT');
      }
      
      if (report.marginType && report.marginType !== 'SPOT') {
        ccxtSymbol = `${ccxtSymbol}-${report.marginType}`;
      }

      const side = report.S.toLowerCase() as 'buy' | 'sell';
      const masterTradeId = report.t.toString();
      const masterOrderId = report.i.toString();
      const executedPrice = parseFloat(report.L || '0');
      const executedQuantity = parseFloat(report.l || '0');
      const timestamp = report.T || Date.now();

      // Explicitly log the Master's own simulated trade into the db 
      // so the UI Positions tab can calculate PnL against the master.
      const insert = this.db.prepare(`
        INSERT INTO copied_fills_v2 (slave_id, master_trade_id, master_order_id, slave_order_id, symbol, side, quantity, price, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run('master', masterTradeId, masterOrderId, masterOrderId, ccxtSymbol, side, executedQuantity, executedPrice, timestamp);

      if (this.io) {
        this.io.emit('new_trade', {
          slave_id: 'master',
          master_trade_id: masterTradeId,
          symbol: ccxtSymbol,
          side,
          quantity: executedQuantity,
          price: executedPrice,
          timestamp
        });
      }
    } catch (err) {
      Logger.error('Trade Copier: Failed to log Simulated Master Trade in DB:', err);
    }

    this.handleExecutionReport(report);
  }

  public async executeWebhookSignal(symbol: string, side: 'buy' | 'sell', quantity: number, price?: number) {
    Logger.info(`Trade Copier: Processing Webhook Signal - ${side.toUpperCase()} ${quantity} ${symbol}`);
    
    // Convert symbol to Binance format
    let ccxtSymbol = symbol;
    if (!ccxtSymbol.includes('/') && ccxtSymbol.endsWith('USDT')) {
      ccxtSymbol = ccxtSymbol.replace('USDT', '/USDT');
    }

    const type = price ? 'limit' : 'market';
    const timestamp = Date.now();
    const webhookTradeId = `webhook_${timestamp}`;

    for (const slave of this.slaveClients) {
      const slaveId = slave.id;
      try {
        // Apply Precision (Step Size) based on this specific slave's fetched markets
        const formattedQuantity = slave.client.amountToPrecision(ccxtSymbol, quantity);
        
        if (parseFloat(formattedQuantity) === 0) {
          Logger.warn(`Trade Copier [${slaveId}]: Webhook quantity formatted to 0. Skipping.`);
          continue;
        }

        Logger.info(`Trade Copier [${slaveId}]: Executing Webhook on Slave... ${side.toUpperCase()} ${formattedQuantity} ${ccxtSymbol}`);

        let order;
        if (this.isShadowMode) {
          const simulatedId = `sim_webhook_${Date.now()}`;
          Logger.info(`Trade Copier [${slaveId}]: Virtual Execution (Shadow Mode). Simulated ID: ${simulatedId}`);
          order = { id: simulatedId, average: price };
        } else {
          if (type === 'market') {
            order = await this.executeWithRateLimit(
              () => slave.client.createOrder(ccxtSymbol, 'market', side, formattedQuantity),
              `webhookCreateOrder(${slaveId} MARKET ${ccxtSymbol})`
            );
          } else {
            order = await this.executeWithRateLimit(
              () => slave.client.createOrder(ccxtSymbol, 'limit', side, formattedQuantity, price),
              `webhookCreateOrder(${slaveId} LIMIT ${ccxtSymbol})`
            );
          }
        }

        Logger.info(`Trade Copier [${slaveId}]: Webhook Order Executed. ID: ${order.id}`);

        // DB Insertion
        const insert = this.db.prepare(`
          INSERT INTO copied_fills_v2 (slave_id, master_trade_id, master_order_id, slave_order_id, symbol, side, quantity, price, timestamp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        // We use the same webhookTradeId for all slaves to group them in analytics if needed
        const executedPrice = price || parseFloat(order.average || order.price || 0);
        const executedQuantity = parseFloat(formattedQuantity);
        insert.run(slaveId, webhookTradeId, webhookTradeId, order.id, ccxtSymbol, side, executedQuantity, executedPrice, timestamp);

        if (this.isShadowMode) {
            const parts = ccxtSymbol.split('/');
            const baseAsset = parts[0];
            const quoteAsset = parts[1] || 'USDT';
            this.updateShadowBalance(slaveId, baseAsset, quoteAsset, side, executedQuantity, executedPrice);
        } else {
            if (this.io) this.io.emit('balance_update');
        }

        if (this.io) {
          this.io.emit('new_trade', {
            slave_id: slaveId,
            master_trade_id: webhookTradeId,
            symbol: ccxtSymbol,
            side,
            quantity: executedQuantity,
            price: executedPrice,
            timestamp
          });
        }

      } catch (slaveError) {
        Logger.error(`Trade Copier [${slaveId}]: Failed to execute webhook order:`, slaveError);
      }
    }
  }
}
