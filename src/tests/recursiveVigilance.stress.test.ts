import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BinanceMasterBot } from '../services/binanceMasterBot';
import { IntelligenceService } from '../services/intelligenceService';
import { Logger } from '../../logger';

vi.mock('../../logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Partial mock for BinanceService to handle stress simulation
vi.mock('../services/binanceService', () => {
    return {
        BinanceService: vi.fn().mockImplementation(() => {
            const mock = {
                initialize: vi.fn().mockResolvedValue(true),
                fetchTicker: vi.fn().mockResolvedValue({ last: 60000 }),
                placeOrder: vi.fn().mockImplementation(() => Promise.resolve({ id: 'stress_order' })),
                fetchPositions: vi.fn().mockResolvedValue([]),
                closePosition: vi.fn().mockImplementation((client: any, symbol: string, side: string, amount: number) => {
                    return mock.placeOrder(client, symbol, 'market', side === 'buy' ? 'sell' : 'buy', amount);
                }),
                fetchBalance: vi.fn().mockResolvedValue({ USDT: { free: 5000 } }),
                fetchLiquidityMetrics: vi.fn().mockResolvedValue({ spread: 5 }),
                getClientA: vi.fn().mockReturnValue({ fetchOHLCV: vi.fn() }),
                getClientB: vi.fn().mockReturnValue({}),
            };
            return mock;
        })
    };
});

describe('Recursive Vigilance Stress Test', () => {
  let bot: BinanceMasterBot;
  let mockBinance: any;
  let mockIntel: any;

  const config = {
    symbol: 'BTC/USDT',
    qtyA: 1.0,
    qtyB: 1.0,
    sideA: 'buy' as const,
    entryOffset: 100,
    protectionRatio: 1.0
  };

  beforeEach(() => {
    vi.useFakeTimers();
    bot = new BinanceMasterBot();
    mockBinance = (bot as any).binanceService;
    mockIntel = (bot as any).intelligenceService;
    (mockIntel as any).data = new Map();
  });

  afterEach(() => {
    bot.stop();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should survive a LIQUIDITY SWEEP and enter PRINCIPAL_RECOVERY mode', async () => {
    // 1. Initial State: Entry at 60000
    mockBinance.fetchTicker.mockResolvedValue({ last: 60000 });
    const ohlcv = Array(20).fill(0).map(() => [0, 60000, 60010, 59990, 60000, 1000]);
    mockBinance.getClientA().fetchOHLCV.mockResolvedValue(ohlcv);
    
    await bot.start(config);
    
    // Shield (EntryB) is at 59900 (60000 - 100)
    // SL for A is at 59400 (60000 * 0.99)
    
    // 2. Liquidity Sweep Event: Price drops to 59850 (Hits EntryB)
    mockBinance.fetchTicker.mockResolvedValue({ last: 59850 });
    mockBinance.fetchPositions.mockResolvedValue([{ contracts: 1.0 }]); // Assume hedge filled
    
    await vi.advanceTimersByTimeAsync(2000);
    expect(bot.getStatus().hedgeStatus).toBe('active');
    expect(bot.getStatus().phase).toBe('HEDGE_ACTIVE');

    // 3. Price drops further to 59300 (Hits SL_A at 59400)
    mockBinance.fetchTicker.mockResolvedValue({ last: 59300 });
    
    await vi.advanceTimersByTimeAsync(2000);
    
    const state = bot.getStatus();
    expect(state.phase).toBe('PRINCIPAL_RECOVERY');
    expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('SHIELD-ONLY Momentum Mode'));
    expect(state.slOrder?.status).toBe('filled');
    
    // Account A closed, but Bot is still active in Recovery mode
    expect(state.isActive).toBe(true);
  });

  it('should apply ATR Dynamic Friction during high volatility to prevent premature shield exit', async () => {
     // 1. Setup high ATR regime
     mockBinance.fetchTicker.mockResolvedValue({ last: 60000 });
     await bot.start(config);
     
     // Set ATR to 500 (Massive volatility)
     // Friction k=1.0 -> Friction = 500
     // EntryB = 59900. Threshold = 59900 + 500 = 60400
     const highVolOHLCV = Array(20).fill(0).map(() => [0, 60000, 60500, 59500, 60000, 1000]);
     mockBinance.getClientA().fetchOHLCV.mockResolvedValue(highVolOHLCV);
     
     // Trigger Hedge
     mockBinance.fetchTicker.mockResolvedValue({ last: 59850 });
     mockBinance.fetchPositions.mockResolvedValue([{ contracts: 1.0 }]);
     await vi.advanceTimersByTimeAsync(2000);
     expect(bot.getStatus().hedgeStatus).toBe('active');

     // 2. Price recovers to 60100 (Above EntryB 59900 but BELOW threshold 60400)
     mockBinance.fetchTicker.mockResolvedValue({ last: 60100 });
     await vi.advanceTimersByTimeAsync(2000);
     
     // Shield should NOT close yet because of ATR friction
     expect(bot.getStatus().hedgeStatus).toBe('active');
     expect(Logger.info).not.toHaveBeenCalledWith(expect.stringContaining('Market Recovered via ATR Friction'));

     // 3. Price recovers to 61000 (Above threshold 60900)
     mockBinance.fetchTicker.mockResolvedValue({ last: 61000 });
     await vi.advanceTimersByTimeAsync(2000);
     
     expect(bot.getStatus().hedgeStatus).toBe('pending'); // Closed and redeployed
     expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('Market Recovered via ATR Friction'));
  });
});
