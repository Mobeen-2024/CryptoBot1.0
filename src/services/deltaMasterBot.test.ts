import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeltaMasterBot } from './deltaMasterBot.js';
import { DeltaExchangeService } from './deltaExchangeService.js';
import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';

// Mock Dependencies
vi.mock('./deltaExchangeService.js');
vi.mock('./intelligenceService.js');
vi.mock('../../logger.js');

describe('DeltaMasterBot (Phase 9 Orchestrator)', () => {
  let bot: DeltaMasterBot;
  let mockDeltaService: any;
  let mockIntelligenceService: any;

  beforeEach(() => {
    vi.useFakeTimers();
    
    // Setup Mocks
    mockDeltaService = {
      initialize: vi.fn().mockResolvedValue(true),
      fetchTicker: vi.fn().mockResolvedValue({ last: 50000 }),
      getClientA: vi.fn().mockReturnValue({ fetchOHLCV: vi.fn().mockResolvedValue([]) }),
      getClientB: vi.fn().mockReturnValue({}),
      placeBracketOrder: vi.fn().mockResolvedValue({ id: 'bracket_a' }),
      placeOrder: vi.fn().mockResolvedValue({ id: 'hedge_b' }),
      cancelAllOrders: vi.fn().mockResolvedValue(true),
      closePosition: vi.fn().mockResolvedValue(true),
      fetchPositions: vi.fn().mockResolvedValue([{ contracts: 0.1 }]),
      fetchBalance: vi.fn().mockResolvedValue({ total: 1000 }),
      fetchLiquidityMetrics: vi.fn().mockResolvedValue({ spread: 0.5 }),
      setDeadMansSwitch: vi.fn().mockResolvedValue(true),
      getRateLimitStatus: vi.fn().mockReturnValue({ accountA: {}, accountB: {} }),
      editOrder: vi.fn().mockResolvedValue(true),
    };

    mockIntelligenceService = {
      calculateSymmetricalOffset: vi.fn().mockReturnValue(49500), // EntryB for a Buy sideA
      calculateRequiredHedge: vi.fn().mockReturnValue(0.1),
      updateATR: vi.fn(),
      getFrictionOffset: vi.fn().mockReturnValue(100),
      analyzeSymbol: vi.fn().mockResolvedValue({ 
        sentiment: 0.5, 
        regime: 'TRENDING_UP', 
        volatilityScore: 0.7, 
        liquidityScore: 0.9,
        atr: 500
      }),
      getIntelligence: vi.fn().mockReturnValue({
        sentiment: 0.5,
        sentimentConfidence: 0.8,
        regime: 'TRENDING_UP',
        volatilityScore: 0.7,
        liquidityScore: 0.9,
        atr: 500
      }),
      recommendOffset: vi.fn().mockReturnValue(100),
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

  it('should initialize and deploy Phase 9 architecture correctly', async () => {
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

    expect(mockDeltaService.initialize).toHaveBeenCalled();
    expect(mockDeltaService.fetchTicker).toHaveBeenCalledWith(config.symbol);
    
    // Verify Bracket Order for Account A
    expect(mockDeltaService.placeBracketOrder).toHaveBeenCalled();
    
    // Verify Hedge Order for Account B
    expect(mockDeltaService.placeOrder).toHaveBeenCalledWith(
      expect.anything(),
      config.symbol,
      'stop_limit',
      'sell',
      expect.any(Number),
      49500, // EntryB
      expect.objectContaining({ stopPrice: 49500 })
    );

    const state = bot.getStatus();
    expect(state.isActive).toBe(true);
    expect(state.phase).toBe('HEDGE_ACTIVE');
  });

  it('should synchronize exposure and calculate net delta during monitoring', async () => {
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

    // Speed up initial monitoring
    await vi.advanceTimersByTimeAsync(2100);

    const state = bot.getStatus();
    
    // Net Delta Calculation Check
    // (QtyA * sideAMult) + (QtyB * sideBMult)
    // (0.1 * 1) + (0.1 * -1) = 0
    expect(state.netExposureDelta).toBe(0);
    expect(mockIntelligenceService.analyzeSymbol).toHaveBeenCalled();
    expect(state.intelligence?.regime).toBe('TRENDING_UP');
  });

  it('should trigger ATR-based trend recovery and close hedge', async () => {
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

    // Initial state: Price is at entry
    // Now trigger Trend Recovery: Price > EntryB + Friction
    mockDeltaService.fetchTicker.mockResolvedValue({ last: 50000 }); // Threshold is 49500 + 100 = 49600
    
    await vi.advanceTimersByTimeAsync(2100);

    // Verify closePosition was called on Account B
    expect(mockDeltaService.closePosition).toHaveBeenCalledWith(
      expect.anything(),
      config.symbol,
      'sell',
      0.1
    );
  });

  it('should perform atomic cleanup on stop', async () => {
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
    await bot.stop();

    expect(mockDeltaService.closePosition).toHaveBeenCalledTimes(2); // One for A, one for B
    expect(mockDeltaService.cancelAllOrders).toHaveBeenCalledTimes(2);
    
    const state = bot.getStatus();
    expect(state.isActive).toBe(false);
    expect(state.phase).toBe('CLOSED');
  });
});
