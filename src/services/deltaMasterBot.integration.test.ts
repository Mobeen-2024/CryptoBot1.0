import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeltaMasterBot } from './deltaMasterBot.js';
import { DeltaExchangeService } from './deltaExchangeService.js';
import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';

// Mock Dependencies
vi.mock('./deltaExchangeService.js');
vi.mock('./intelligenceService.js');
vi.mock('../../logger.js');

describe('DeltaMasterBot (Phase 9 Integration)', () => {
  let bot: DeltaMasterBot;
  let mockDeltaService: any;
  let mockIntelligenceService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Setup Service Mocks
    mockDeltaService = {
      initialize: vi.fn().mockResolvedValue(true),
      fetchTicker: vi.fn().mockResolvedValue({ last: 65000 }),
      getClientA: vi.fn().mockReturnValue({ fetchOHLCV: vi.fn().mockResolvedValue([]) }),
      getClientB: vi.fn().mockReturnValue({}),
      placeBracketOrder: vi.fn().mockResolvedValue({ id: 'bracket_a' }),
      placeOrder: vi.fn().mockResolvedValue({ id: 'hedge_b' }),
      cancelAllOrders: vi.fn().mockResolvedValue(true),
      closePosition: vi.fn().mockResolvedValue(true),
      fetchPositions: vi.fn().mockImplementation(async (client: any) => {
        // Default: Account A has a live position; Account B is flat
        if (client === mockDeltaService.getClientA()) return [{ symbol: 'BTC/USDT:USDT', contracts: 0.1, side: 'long' }];
        return [];
      }),
      fetchBalance: vi.fn().mockResolvedValue({ total: 1000 }),
      fetchLiquidityMetrics: vi.fn().mockResolvedValue({ spread: 0.5 }),
      setDeadMansSwitch: vi.fn().mockResolvedValue(true),
      getRateLimitStatus: vi.fn().mockReturnValue({ accountA: {}, accountB: {} }),
      editOrder: vi.fn().mockResolvedValue(true),
    };

    mockIntelligenceService = {
      calculateSymmetricalOffset: vi.fn().mockReturnValue(64995), // EntryB for Buy A @ 65000, 5 offset
      calculateRequiredHedge: vi.fn().mockReturnValue(1.0),
      updateATR: vi.fn(),
      getFrictionOffset: vi.fn().mockReturnValue(10), // Threshold = 64995 + 10 = 65005
      analyzeSymbol: vi.fn().mockResolvedValue({ 
        sentiment: 0.5, 
        regime: 'STABLE', 
        volatilityScore: 0.1, 
        liquidityScore: 0.9,
        atr: 100
      }),
      getIntelligence: vi.fn().mockReturnValue({
        sentiment: 0.5,
        sentimentConfidence: 0.8,
        regime: 'STABLE',
        volatilityScore: 0.1,
        liquidityScore: 0.9,
        atr: 100
      }),
      recommendOffset: vi.fn().mockReturnValue(5.0),
      applyAgenticConsensus: vi.fn().mockResolvedValue(true),
      getInstance: vi.fn().mockReturnThis(),
    };

    (DeltaExchangeService as any).mockImplementation(() => mockDeltaService);
    (IntelligenceService.getInstance as any).mockReturnValue(mockIntelligenceService);

    bot = new DeltaMasterBot();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should execute full V-REVERSAL recovery cycle', async () => {
    const config = {
      symbol: 'BTC/USDT:USDT',
      qtyA: 0.1,
      qtyB: 0.1,
      sideA: 'buy' as const,
      leverA: 10,
      leverB: 20,
      entryOffset: 5,
      protectionRatio: 1.0,
      atrMultiplier: 1.0
    };

    // 1. START: Initial Deployment
    await bot.start(config);
    expect(bot.getStatus().phase).toBe('HEDGE_ACTIVE');
    expect(bot.getStatus().entryA).toBe(65000);
    expect(bot.getStatus().entryB).toBe(64995);

    // 2. DROP: Trigger Hedge Activation
    // Simulate price drop to 64990 (trigger is entryB 64995)
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 64990 });
    
    // Client-aware: Account A still open, Account B now has a hedge position
    mockDeltaService.fetchPositions.mockImplementation(async (client: any) => {
      if (client === mockDeltaService.getClientA()) return [{ symbol: config.symbol, contracts: 0.101, side: 'long' }];
      return [{ symbol: config.symbol, contracts: 0.101, side: 'sell' }]; // hedge active
    });

    // Run one interval to process logic
    await vi.advanceTimersByTimeAsync(2100);
    
    let status = bot.getStatus();
    expect(status.hedgeStatus).toBe('active');
    expect(status.netExposureDelta).toBeLessThan(0.01);
    expect(status.pnlA).toBeLessThan(0);
    expect(status.pnlB).toBeGreaterThan(0);

    // 3. RECOVERY: V-Reversal back above threshold
    // Threshold = EntryB(64995) + Friction(10) = 65005
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 65010 });
    
    // Process monitoring logic
    await vi.advanceTimersByTimeAsync(2100);

    // Verify closePosition was called for Account B with its CLOSING side
    // hedgeB opened as 'sell' (short) → closing requires 'buy'
    expect(mockDeltaService.closePosition).toHaveBeenCalledWith(
        expect.anything(),
        config.symbol,
        'buy',    // closeSideB — opposite of hedge opening side ('sell')
        0.101
    );

    // Verify Redeployment of Stop Order (Recursive Vigilance)
    expect(mockDeltaService.placeOrder).toHaveBeenCalledWith(
        expect.anything(),
        config.symbol,
        'stop_limit',
        'sell',
        0.101,
        64995,
        expect.objectContaining({ stopPrice: 64995 })
    );

    status = bot.getStatus();
    expect(status.hedgeStatus).toBe('pending'); // Back to waiting mode
    expect(status.phase).toBe('HEDGE_ACTIVE'); 
  });
});
