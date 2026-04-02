import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BinanceMasterBot, BinanceMasterConfig } from './binanceMasterBot';
import { BinanceService } from './binanceService';
import { IntelligenceService } from './intelligenceService';

// Mock Logger
vi.mock('../../logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock BinanceService
vi.mock('./binanceService', () => {
    return {
        BinanceService: vi.fn().mockImplementation(() => {
            const mock = {
                initialize: vi.fn().mockResolvedValue(true),
                fetchTicker: vi.fn().mockResolvedValue({ last: 50000 }),
                placeOrder: vi.fn().mockImplementation(() => Promise.resolve({ id: 'order_123' })),
                fetchPositions: vi.fn().mockResolvedValue([]),
                closePosition: vi.fn().mockImplementation((client: any, symbol: string, side: string, amount: number) => {
                    return mock.placeOrder(client, symbol, 'market', side === 'buy' ? 'sell' : 'buy', amount);
                }),
                fetchBalance: vi.fn().mockResolvedValue({ USDT: { free: 1000 } }),
                fetchLiquidityMetrics: vi.fn().mockResolvedValue({ spread: 2 }),
                getClientA: vi.fn().mockReturnValue({}),
                getClientB: vi.fn().mockReturnValue({}),
            };
            return mock;
        })
    };
});

describe('BinanceMasterBot Orchestration', () => {
  let bot: BinanceMasterBot;
  let mockBinance: any;
  let mockIntel: any;

  const config: BinanceMasterConfig = {
    symbol: 'BTC/USDT',
    qtyA: 1.0,
    qtyB: 1.0,
    sideA: 'buy',
    entryOffset: 50,
    protectionRatio: 1.0
  };

  beforeEach(() => {
    vi.useFakeTimers();
    bot = new BinanceMasterBot();
    mockBinance = (bot as any).binanceService;
    mockIntel = (bot as any).intelligenceService;
    
    // Reset singleton data
    (mockIntel as any).data = new Map();
  });

  afterEach(() => {
    bot.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should initialize and deploy symmetric architecture', async () => {
    await bot.start(config);
    const state = bot.getStatus();
    
    expect(state.isActive).toBe(true);
    expect(state.phase).toBe('HEDGE_ACTIVE');
    expect(state.entryA).toBe(50000);
    expect(state.entryB).toBe(49950); // 50000 - 50 for BUY
    expect(mockBinance.placeOrder).toHaveBeenCalledTimes(2); // Account A market, Account B limit
  });

  it('should trigger hedge when price crosses entryB', async () => {
    await bot.start(config);
    
    // Simulate monitor interval
    // 1. Set current price below entryB (49950)
    mockBinance.fetchTicker.mockResolvedValue({ last: 49940 });
    
    // Simulate 20 OHLCV candles to satisfy ATR calculation
    const ohlcv = Array(20).fill(0).map(() => [0, 50000, 50010, 49990, 50000, 1000]);
    mockBinance.getClientA().fetchOHLCV = vi.fn().mockResolvedValue(ohlcv);

    // Run one interval cycle
    await vi.advanceTimersByTimeAsync(2000);
    
    const state = bot.getStatus();
    expect(state.hedgeStatus).toBe('active');
    expect(state.lastPrice).toBe(49940);
  });

  it('should recover and redeploy hedge via ATR friction', async () => {
    await bot.start(config);
    
    // 1. Activate hedge
    mockBinance.fetchTicker.mockResolvedValue({ last: 49940 });
    const ohlcv = Array(20).fill(0).map(() => [0, 50000, 50010, 49990, 50000, 1000]); // ATR approx 20
    mockBinance.getClientA().fetchOHLCV = vi.fn().mockResolvedValue(ohlcv);
    mockBinance.fetchPositions.mockResolvedValue([{ contracts: 1.0 }]); // Hedge is active
    
    await vi.advanceTimersByTimeAsync(2000);
    expect(bot.getStatus().hedgeStatus).toBe('active');

    // 2. Simulate price recovery past friction threshold
    // entryB (49950) + friction (ATR=20 * k=1.0) = 49970
    mockBinance.fetchTicker.mockResolvedValue({ last: 49975 });
    
    await vi.advanceTimersByTimeAsync(2000);
    
    const state = bot.getStatus();
    expect(mockBinance.closePosition).toHaveBeenCalledWith(expect.anything(), 'BTC/USDT', 'sell', 1.0);
    expect(state.hedgeStatus).toBe('pending'); // Redeployed
    expect(mockBinance.placeOrder).toHaveBeenCalledTimes(4); // Init(2) + Close(1) + Redeploy(1)
  });

  it('should move SL to Break-Even after TP1 is hit', async () => {
    await bot.start(config);
    
    // TP1 is at 2% offset = 50000 * 1.02 = 51000
    mockBinance.fetchTicker.mockResolvedValue({ last: 51100 });
    
    await vi.advanceTimersByTimeAsync(2000);
    
    const state = bot.getStatus();
    expect(state.tpTiers[0].status).toBe('filled');
    expect(state.slOrder?.price).toBe(state.entryA);
    expect(state.slOrder?.isBreakEven).toBe(true);
  });
});
