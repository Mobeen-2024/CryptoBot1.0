import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DecisionEngine, DecisionContext, AdvisorySignal, RiskState } from './decisionEngine.js';
import { DeltaExchangeService } from './deltaExchangeService.js';

vi.mock('./deltaExchangeService.js');
vi.mock('../../logger.js');

describe('Decision Hierarchy Engine (DHE)', () => {
  let dhe: DecisionEngine;
  let mockDeltaService: any;

  beforeEach(() => {
    mockDeltaService = {
      getClientA: vi.fn().mockReturnValue({}),
      getClientB: vi.fn().mockReturnValue({}),
      placeBracketOrder: vi.fn().mockResolvedValue({ id: 'bracket_1' }),
      placeOrder: vi.fn().mockResolvedValue({ id: 'order_1' }),
      cancelAllOrders: vi.fn().mockResolvedValue(true),
      closePosition: vi.fn().mockResolvedValue(true),
    };
    dhe = new DecisionEngine(mockDeltaService);
  });

  const defaultContext: DecisionContext = {
    symbol: 'BTC/USDT:USDT',
    currentPrice: 50000,
    entryA: 50000,
    entryB: 49500,
    sideA: 'buy',
    qtyA: 0.1,
    qtyB: 0.1,
    intent: 'MONITORING'
  };

  const safeRisk: RiskState = {
    marginOk: true,
    drawdownPct: 0,
    maxDrawdownPct: 3.0,
    liquidityScore: 100
  };

  it('should authorize OPEN_PRIMARY when intent is TRADE_ARMED and risk is safe', async () => {
    const context = { ...defaultContext, intent: 'TRADE_ARMED' as const };
    const decision = await dhe.resolve(context, [], safeRisk);
    
    expect(decision.action).toBe('OPEN_PRIMARY');
    expect(decision.reason).toContain('Strategy Armed');
  });

  it('should trigger EMERGENCY_EXIT if drawdown exceeds max', async () => {
    const highRisk: RiskState = { ...safeRisk, drawdownPct: 4.0 };
    const decision = await dhe.resolve(defaultContext, [], highRisk);
    
    expect(decision.action).toBe('EMERGENCY_EXIT');
    expect(decision.reason).toContain('Risk Breach');
  });

  it('should block trade if margin is insufficient', async () => {
    const lowMargin: RiskState = { ...safeRisk, marginOk: false };
    const context = { ...defaultContext, intent: 'TRADE_ARMED' as const };
    const decision = await dhe.resolve(context, [], lowMargin);
    
    expect(decision.action).toBe('IDLE');
    expect(decision.reason).toContain('Insufficient Margin');
  });

  it('should defer hedge if AI sentiment strongly conflicts (Consensus Gate)', async () => {
    const context = { ...defaultContext, intent: 'HEDGE_ARMED' as const };
    const bearishAdvisory: AdvisorySignal = {
      source: 'AI_SENTIMENT',
      bias: 'BULLISH', // SideA is 'buy', so Hedge is 'sell'. If AI is Bullish, Hedge is anti-trend.
      confidence: 0.9,
      reason: 'Strong Bullish Trend'
    };
    
    const decision = await dhe.resolve(context, [bearishAdvisory], safeRisk);
    
    expect(decision.action).toBe('IDLE');
    expect(decision.reason).toContain('conflicts with Hedge Trigger');
  });

  it('should execute OPEN_HEDGE when authorized', async () => {
    const params = {
      clientB: {},
      symbol: 'BTC/USDT',
      sideB: 'sell',
      qtyB: 0.1,
      entryB: 49500,
      leverageB: 20,
      reason: 'Authorized'
    };

    await dhe.execute('OPEN_HEDGE', params);
    expect(mockDeltaService.placeOrder).toHaveBeenCalledWith(
      params.clientB,
      params.symbol,
      'stop_limit',
      'sell',
      0.1,
      49500,
      { stopPrice: 49500, leverage: 20 }
    );
  });
});
