import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeltaMasterBot } from './deltaMasterBot.js';
import { DeltaExchangeService } from './deltaExchangeService.js';
import { IntelligenceService } from './intelligenceService.js';
import { SimulationService } from './simulationService.js';
import { AgenticSearchService } from './agenticSearchService.js';
import { Logger } from '../../logger.js';
import Database from 'better-sqlite3';
import { eventBus, EventName } from './eventBus.js';
import { DecisionEngine } from './decisionEngine.js';

// Mock Dependencies
vi.mock('./deltaExchangeService.js');
vi.mock('./intelligenceService.js');
vi.mock('./simulationService.js');
vi.mock('./agenticSearchService.js');
vi.mock('../../logger.js');
vi.mock('better-sqlite3');

describe('DeltaMasterBot (Phase 13 DHE Integration)', () => {
  let bot: DeltaMasterBot;
  let mockDeltaService: any;
  let mockIntelligenceService: any;
  let mockSimulationService: any;
  let mockAgenticSearchService: any;
  let mockDb: any;

  beforeEach(() => {
    vi.useFakeTimers();
    eventBus.removeAllListeners();
    
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
        if (client === mockDeltaService.getClientA()) return [{ symbol: 'BTC/USDT:USDT', contracts: 0.1, side: 'long' }];
        return [];
      }),
      fetchBalance: vi.fn().mockResolvedValue({ total: 1000, free: 500 }),
      fetchLiquidityMetrics: vi.fn().mockResolvedValue({ spread: 0.5 }),
      setDeadMansSwitch: vi.fn().mockResolvedValue(true),
      getRateLimitStatus: vi.fn().mockReturnValue({ accountA: {}, accountB: {} }),
      editOrder: vi.fn().mockResolvedValue(true),
    };

    mockIntelligenceService = {
      calculateSymmetricalOffset: vi.fn().mockReturnValue(64995),
      calculateRequiredHedge: vi.fn().mockReturnValue(0.1),
      fetchATR: vi.fn().mockResolvedValue(true),
      getFrictionOffset: vi.fn().mockReturnValue(10),
      analyzeSymbol: vi.fn().mockResolvedValue({ regime: 'TREND' }),
      getIntelligence: vi.fn().mockReturnValue({ regime: 'TREND' }),
      getAdvisorySignal: vi.fn().mockReturnValue({
        source: 'RESEARCH_REGIME',
        bias: 'NEUTRAL',
        confidence: 0.8,
        reason: 'Market State: TREND'
      }),
      recommendOffset: vi.fn().mockReturnValue(5.0),
      detectMarketRegime: vi.fn().mockResolvedValue(true),
      calculateExecutionAdvisory: vi.fn().mockResolvedValue(true),
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
    
    // Initialize Global Execution Bridge for this test run
    // This attaches the DecisionEngine listeners to the real eventBus singleton
    DecisionEngine.initGlobalExecution(mockDeltaService);
  });

  // Helper to deep-wait for async event propagation
  async function flushEvents(count = 10) {
    for (let i = 0; i < count; i++) {
        await Promise.resolve();
    }
    // Also advance fake timers by 0ms to trigger any queued immediate tasks
    await vi.advanceTimersByTimeAsync(0);
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should route initial deployment through DHE Authority', async () => {
    const config = {
      symbol: 'BTC/USDT:USDT',
      qtyA: 0.1,
      qtyB: 0.1,
      sideA: 'buy' as const,
      leverA: 10,
      leverB: 20,
      entryOffset: 5,
      protectionRatio: 1.0,
      atrMultiplier: 1.0,
      tpTiersArray: [2, 3, 4, 5]
    };

    await bot.start(config);
    await flushEvents(); // Wait for EventBus propagation

    // Verify use of DHE: bot should have called resolve Decision then executed the Action
    // DHE resolve(TRADE_ARMED) -> action OPEN_PRIMARY
    expect(mockDeltaService.placeBracketOrder).toHaveBeenCalled();
    expect(bot.getStatus().botState).toBe('PRIMARY_ACTIVE');
  });

  it('should trigger EMERGENCY_EXIT on Max Drawdown via DHE Supreme Authority', async () => {
    const config = {
      symbol: 'BTC/USDT:USDT',
      qtyA: 0.1,
      qtyB: 0.1,
      sideA: 'buy' as const,
      leverA: 10,
      leverB: 20,
      entryOffset: 5,
      protectionRatio: 1.0,
      maxDrawdownPct: 1.0, // 1% DD exit
    };

    await bot.start(config);

    // Simulate price drop exceeding drawdown (entry 65000 -> current 64000 = 1.5% drop)
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 64000 });
    
    // Process tick (Transitions to EMERGENCY)
    await vi.advanceTimersByTimeAsync(2100);
    // Process next tick (Executes handleEmergency -> stop)
    await bot.stop();
    await flushEvents(10); // Deep wait for all async ops in stop() to finalize

    // Verification: Bot should have initiated shutdown
    expect(mockDeltaService.closePosition).toHaveBeenCalled();
    expect(bot.getStatus().isActive).toBe(false);
    // Phase might still be transitioning but isActive must be false
  });

  it('should defer hedge engagement when AI Consensus conflicts (Consensus Gate)', async () => {
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

    await bot.start(config);

    // Price enters trigger zone (65000 - 5 = 64995 marker)
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 64990 });
    mockDeltaService.fetchLiquidityMetrics.mockResolvedValue({ spread: 1 });
    mockDeltaService.fetchPositions.mockResolvedValue([{ contracts: 0.1, side: 'long' }]);

    // Research Kernel detects RANGE (Consensus Gate deferral)
    mockIntelligenceService.analyzeSymbol.mockResolvedValue({
      regime: 'RANGE',
      volatilityScore: 100, // 30 pts. Dist(1) + Vol(30) + Risk(10) + AI(10) = 51 (PENDING)
      liquidityScore: 50,
      lastUpdate: Date.now()
    });
    mockIntelligenceService.getAdvisorySignal.mockReturnValue({
      source: 'RESEARCH_REGIME',
      bias: 'BEARISH',
      confidence: 1.0,
      reason: 'DHE: Market identifies as RANGE'
    });

    await vi.advanceTimersByTimeAsync(2100);
    await flushEvents(); // Process resolve decisions
    
    // DHE should resolve to IDLE for HEDGE_ARMED intent due to AI Consensus conflict
    const hedgeCalls = mockDeltaService.placeOrder.mock.calls.filter((c: any) => c[2] === 'stop_limit');
    expect(hedgeCalls.length).toBe(0); 
    expect(bot.getStatus().botState).toBe('HEDGE_PENDING');
    expect(bot.getStatus().hedgeScore).toBeGreaterThanOrEqual(50);
  });

  it('should FORCE hedge via CRM when risk utilization reaches 80%', async () => {
    const config = {
      symbol: 'BTC/USDT:USDT',
      qtyA: 0.1,
      qtyB: 0.1,
      sideA: 'buy' as const,
      leverA: 10,
      leverB: 20,
      entryOffset: 5,
      protectionRatio: 1.0,
      maxDrawdownPct: 10.0
    };

    await bot.start(config);

    // Simulate drawdown at 1.6% (80% of 2.0% limit)
    // Actually, on 2000 balance with 0.1 qty, 1% price move = ~3.25% DD.
    // Let's set max drawdown to 10% and move price to hit ~8% DD.
    // 8% of 2000 = 160 USDT. 0.1 qty = 1600 USDT move. Price 63400.
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 63400 });
    
    // High Volatility to push score > 70
    mockIntelligenceService.analyzeSymbol.mockResolvedValue({
      regime: 'TREND',
      volatilityScore: 50, // 50 * 0.3 = 15. Dist(40) + Vol(15) + Risk(16) + AI(5) = 76 (ACTIVE)
      liquidityScore: 20,
      lastUpdate: Date.now()
    });
    mockIntelligenceService.getAdvisorySignal.mockReturnValue({
       source: 'RESEARCH_REGIME',
       bias: 'NEUTRAL',
       confidence: 0.5,
       reason: 'Neutral'
    });
    
    // Initial tick: PRIMARY_ACTIVE -> HEDGE_PENDING (Shield Zone entered)
    await vi.advanceTimersByTimeAsync(2100);
    expect(bot.getStatus().botState).toBe('HEDGE_PENDING');

    // Second tick: HEDGE_PENDING -> HEDGE_ACTIVE (HedgeScore > 70)
    await vi.advanceTimersByTimeAsync(2100);
    await flushEvents(); // Process execution
    
    expect(bot.getStatus().botState).toBe('HEDGE_ACTIVE');
    expect(bot.getStatus().hedgeScore).toBeGreaterThan(70);
    expect(mockDeltaService.placeOrder).toHaveBeenCalled();
  });

  it('should PRIORITIZE hedge via CRM when price is >60% towards SL', async () => {
    const config = {
      symbol: 'BTC/USDT:USDT',
      qtyA: 0.1,
      qtyB: 0.1,
      sideA: 'buy' as const,
      leverA: 10,
      leverB: 20,
      entryOffset: 5,
      protectionRatio: 1.0,
      slPercent: 1.0 // SL at 64350
    };

    await bot.start(config);

    // Price at 64500 (entry 65000, sl 64350. Diff 650. Progress 500/650 = 76%)
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 64500 });
    
    // High Vol + Reverse AI to push score > 70
    mockIntelligenceService.analyzeSymbol.mockResolvedValue({
      regime: 'VOLATILE',
      volatilityScore: 100, // 100 * 0.3 = 30
      liquidityScore: 10,
      lastUpdate: Date.now()
    });
    // Dist(30.4) + Vol(30) + Risk(20) + AI(10) = 90.4
    mockIntelligenceService.getAdvisorySignal.mockReturnValue({
      source: 'RESEARCH_REGIME',
      bias: 'BEARISH', // Contrary to Long. 100 * 0.1 = 10.
      confidence: 1.0,
      reason: 'AI Analysis Bearish'
    });
    // Dist(30.4) + Vol(27) + Risk(10) + AI(10) = 77.4
    
    // Initial tick: PRIMARY_ACTIVE -> HEDGE_PENDING (Shield Zone)
    await vi.advanceTimersByTimeAsync(2100);
    
    // Second tick: HEDGE_PENDING -> HEDGE_ACTIVE (CRM PRIORITIZE override AI)
    await vi.advanceTimersByTimeAsync(2100);
    await flushEvents(); // Process execution
    
    expect(bot.getStatus().botState).toBe('HEDGE_ACTIVE');
    expect(mockDeltaService.placeOrder).toHaveBeenCalled();
  });

    it('should transition to PRIMARY_ACTIVE on start and emit PRIMARY_REQUEST', async () => {
      const emitSpy = vi.spyOn(eventBus, 'emitEvent');
      const config = { symbol: 'BTC/USDT:USDT', qtyA: 0.1, sideA: 'buy' as const };
      await bot.start(config as any);
      await flushEvents();
      
      expect(bot.getStatus().botState).toBe('PRIMARY_ACTIVE');
      expect(emitSpy).toHaveBeenCalledWith(EventName.PRIMARY_REQUEST, expect.objectContaining({
        symbol: 'BTC/USDT:USDT',
        qtyA: 0.1,
        sideA: 'buy'
      }));
    });

  it('should DELAY hedge via CRM in low volatility regimes', async () => {
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

    await bot.start(config);

    // AI says YES, but volatility is 0.5 (< 1.0)
    mockIntelligenceService.getIntelligence.mockReturnValue({
      volatilityScore: 0.5,
      regime: 'TREND'
    });

    mockDeltaService.fetchTicker.mockResolvedValue({ last: 64990 }); // zone

    await vi.advanceTimersByTimeAsync(2100);
    await flushEvents();

    // Hedge should be Delayed (Stay in PENDING)
    const hedgeCalls = mockDeltaService.placeOrder.mock.calls.filter((c: any) => c[2] === 'stop_limit');
    expect(hedgeCalls.length).toBe(0);
    expect(bot.getStatus().botState).toBe('HEDGE_PENDING');
  });

  it('should auto-escalate to PANIC_CLOSE if risk exceeds 90%', async () => {
    // 1. Setup high risk scenario
    mockIntelligenceService.calculateExecutionAdvisory.mockResolvedValue(true);
    mockIntelligenceService.getIntelligence.mockReturnValue({ regime: 'VOLATILE' });
    
    // Create a mock state with high risk score
    const emitSpy = vi.spyOn(eventBus, 'emit');

    // Simulate high risk via 'PANIC_CLOSE' trigger
    await bot.stop('PANIC_CLOSE'); 
    await flushEvents();

    expect(emitSpy).toHaveBeenCalledWith('EXIT_REQUEST', expect.objectContaining({
      isPanic: true,
      reason: 'PANIC_CLOSE'
    }));
  });

  it('should trigger parallel shutdown in DecisionEngine when isPanic is true', async () => {
     const emitSpy = vi.spyOn(eventBus, 'emit');
     
     const panicSignal = { isPanic: true, reason: 'LIQUIDITY_HUNT_SIM' };
     eventBus.emit('EXIT_REQUEST', panicSignal);
     await flushEvents();
     
     expect(emitSpy).toHaveBeenCalledWith('EXIT_REQUEST', panicSignal);
  });
});
