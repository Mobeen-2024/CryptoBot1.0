import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeltaMasterBot } from './deltaMasterBot.js';
import { DeltaExchangeService } from './deltaExchangeService.js';
import { IntelligenceService } from './intelligenceService.js';
import { SimulationService } from './simulationService.js';
import { AgenticSearchService } from './agenticSearchService.js';
import { Logger } from '../../logger.js';
import Database from 'better-sqlite3';

// Mock Dependencies
vi.mock('./deltaExchangeService.js');
vi.mock('./intelligenceService.js');
vi.mock('./simulationService.js');
vi.mock('./agenticSearchService.js');
vi.mock('../../logger.js');
vi.mock('better-sqlite3');

describe('DeltaMasterBot (Phase 9 Integration)', () => {
  let bot: DeltaMasterBot;
  let mockDeltaService: any;
  let mockIntelligenceService: any;
  let mockSimulationService: any;
  let mockAgenticSearchService: any;
  let mockDb: any;

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
      calculateSymmetricalOffset: vi.fn().mockReturnValue(64995),
      calculateRequiredHedge: vi.fn().mockReturnValue(0.1), // Match qtyA
      fetchATR: vi.fn().mockResolvedValue(true),
      getFrictionOffset: vi.fn().mockReturnValue(10),
      analyzeSymbol: vi.fn().mockResolvedValue({ 
        sentiment: 0.5, 
        regime: 'STABLE_TREND', 
        volatilityScore: 0.1, 
        liquidityScore: 0.9,
        atr: 100
      }),
      getIntelligence: vi.fn().mockReturnValue({
        sentiment: 0.5,
        sentimentConfidence: 0.8,
        regime: 'STABLE_TREND',
        volatilityScore: 0.1,
        liquidityScore: 0.9,
        atr: 100
      }),
      recommendOffset: vi.fn().mockReturnValue(5.0),
      applyAgenticConsensus: vi.fn().mockResolvedValue(true),
      getInstance: vi.fn().mockReturnThis(),
    };

    mockSimulationService = {
      getInstance: vi.fn().mockReturnThis(),
      on: vi.fn(),
      emit: vi.fn(),
    };

    mockAgenticSearchService = {
      fetchTopHeadlines: vi.fn().mockResolvedValue([]),
      sanitizeNews: vi.fn().mockReturnValue(''),
    };

    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      run: vi.fn(),
      get: vi.fn(),
      close: vi.fn(),
    };

    (DeltaExchangeService as any).mockImplementation(() => mockDeltaService);
    (IntelligenceService.getInstance as any).mockReturnValue(mockIntelligenceService);
    (SimulationService.getInstance as any).mockReturnValue(mockSimulationService);
    (AgenticSearchService as any).fetchTopHeadlines = mockAgenticSearchService.fetchTopHeadlines;
    (AgenticSearchService as any).sanitizeNews = mockAgenticSearchService.sanitizeNews;
    (Database as any).mockImplementation(() => mockDb);

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

  it('should process tick via high-fidelity simulation bridge (Event-Driven)', async () => {
    const config = {
      symbol: 'BTC/USDT:USDT',
      qtyA: 0.1,
      qtyB: 0.1,
      sideA: 'buy' as const,
      leverA: 10,
      leverB: 20,
      entryOffset: 5,
      protectionRatio: 1.0
    };

    // 1. Setup Simulation Listener Capture
    let simulationHandler: any = null;
    mockSimulationService.on.mockImplementation((event: string, handler: any) => {
      if (event === 'price_update') simulationHandler = handler;
    });

    await bot.start(config);
    expect(simulationHandler).toBeDefined();

    // 2. Inject Synthetic Price Update (Drop to trigger)
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 64990 });
    mockDeltaService.fetchPositions.mockImplementation(async (client: any) => {
      if (client === mockDeltaService.getClientA()) return [{ symbol: config.symbol, contracts: 0.1, side: 'long' }];
      return []; // Account B Flat
    });
    
    // Simulate event emission from SimulationService
    await simulationHandler({ symbol: config.symbol, price: 64990 });

    // 3. Verify Logic Processing
    const status = bot.getStatus();
    expect(status.lastPrice).toBe(64990);
    expect(status.pnlA).toBeLessThan(0); // Basic check for drop
    
    // 4. Verify Institutional Telemetry (Phase 9)
    expect(status.telemetry?.latencyBreakdown).toBeDefined();
  });

  it('should apply dynamic friction on reversal (Phase 12 Hardening)', async () => {
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

    await bot.start(config);

    // Trigger hedge
    mockDeltaService.fetchPositions.mockImplementation(async (client: any) => {
      if (client === mockDeltaService.getClientA()) return [{ symbol: config.symbol, contracts: 0.1, side: 'long' }];
      return [{ symbol: config.symbol, contracts: 0.1, side: 'sell' }]; // Active hedge
    });

    // 1. Friction Offset = 10 (as mocked). EntryB = 64995. Reversal Threshold = 65005.
    // Price recovers to 65002 (Above EntryB but BELOW threshold)
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 65002 });
    
    await vi.advanceTimersByTimeAsync(2100);

    // Result: Hedge should NOT close yet due to friction buffer
    expect(mockDeltaService.closePosition).not.toHaveBeenCalled();
    expect(bot.getStatus().hedgeStatus).toBe('active');

    // 2. Price recovers to 65010 (Above threshold)
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 65010 });
    await vi.advanceTimersByTimeAsync(2100);

    // Result: Hedge closes
    expect(mockDeltaService.closePosition).toHaveBeenCalledWith(
        expect.anything(),
        config.symbol,
        'buy',
        0.1
    );
  });

  it('should correctly audit cumulative fees after simulated fills', async () => {
     const config = {
      symbol: 'BTC/USDT:USDT',
      qtyA: 1.0, // 1 BTC for easy fee math
      qtyB: 1.0,
      sideA: 'buy' as const,
      leverA: 10,
      leverB: 20,
      entryOffset: 100,
      protectionRatio: 1.0
    };

    await bot.start(config);
    // Initial fill: qty 1.0 @ 65000. Fee (0.05%) = 65000 * 1.0 * 0.0005 = 32.5
    expect(bot.getStatus().accumulatedFees).toBeGreaterThanOrEqual(32.5);

    // Simulate TP fill
    const tpPrice = 65000 * 1.02; // T1 @ 2% = 66300
    mockDeltaService.fetchTicker.mockResolvedValue({ last: tpPrice });
    
    // Tiers are created as qty 0.25 (for 4 tiers)
    // Fee = 66300 * 0.25 * 0.0005 = 8.2875
    await vi.advanceTimersByTimeAsync(2100);

    const status = bot.getStatus();
    expect(status.accumulatedFees).toBeGreaterThanOrEqual(32.5 + 8.2875);
  });
});
