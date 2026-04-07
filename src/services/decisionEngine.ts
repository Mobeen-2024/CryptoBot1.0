import { Logger } from '../../logger.js';
import { DeltaExchangeService } from './deltaExchangeService.js';
import { eventBus, EventName } from './eventBus.js';

export type ActionType = 'OPEN_PRIMARY' | 'OPEN_HEDGE' | 'CLOSE_PRIMARY' | 'CLOSE_HEDGE' | 'ADJUST_TP_SL' | 'IDLE' | 'EMERGENCY_EXIT';

export enum BotState {
  IDLE = 'IDLE',
  PRIMARY_ACTIVE = 'PRIMARY_ACTIVE', 
  HEDGE_PENDING = 'HEDGE_PENDING',
  HEDGE_ACTIVE = 'HEDGE_ACTIVE',
  TP_SCALING = 'TP_SCALING',
  EMERGENCY = 'EMERGENCY'
}

export interface AdvisorySignal {
  source: 'RESEARCH_REGIME' | 'EXECUTION_METRICS' | 'STRATEGY_GRID' | 'TREND_TRAP';
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number; 
  reason: string;
}

export interface RiskState {
  marginOk: boolean;
  drawdownPct: number;
  maxDrawdownPct: number;
  liquidityScore: number;
  totalRiskScore: number;
}

export interface DecisionContext {
  symbol: string;
  currentPrice: number;
  entryA: number;
  entryB: number;
  slPrice: number;
  sideA: 'buy' | 'sell';
  qtyA: number;
  qtyB: number;
  botState: BotState;
  volatilityScore: number;
  strategy: string;
}

export class DecisionEngine {
  private deltaService: DeltaExchangeService;

  constructor(deltaService: DeltaExchangeService, skipListeners: boolean = false) {
    this.deltaService = deltaService;
    if (!skipListeners) {
      // Default to no listeners in constructor to avoid multi-bot pollution
      // Listeners should be initialized globally via initGlobalExecution
    }
  }

  public static initGlobalExecution(deltaService: DeltaExchangeService) {
    Logger.info('[DHE_SUPREME] Initializing Global Execution Bridge...');
    const engine = new DecisionEngine(deltaService, true);
    engine.setupListeners();
    return engine;
  }

  private setupListeners() {
    Logger.info('[DHE_SUPREME] Initializing Event Intelligence Listeners...');
    
    eventBus.on(EventName.PRIMARY_REQUEST, async (payload) => {
      try {
        await this.execute('OPEN_PRIMARY', payload);
        eventBus.emit(EventName.EXECUTION_COMPLETED, { symbol: payload.symbol, action: 'OPEN_PRIMARY' });
      } catch (error: any) {
        eventBus.emit(EventName.EXECUTION_FAILED, { symbol: payload.symbol, action: 'OPEN_PRIMARY', error: error.message });
      }
    });

    eventBus.on(EventName.HEDGE_REQUEST, async (payload) => {
      try {
        await this.execute('OPEN_HEDGE', payload);
        eventBus.emit(EventName.EXECUTION_COMPLETED, { symbol: payload.symbol, action: 'OPEN_HEDGE' });
      } catch (error: any) {
        eventBus.emit(EventName.EXECUTION_FAILED, { symbol: payload.symbol, action: 'OPEN_HEDGE', error: error.message });
      }
    });

    eventBus.on(EventName.EXIT_REQUEST, async (payload) => {
      try {
        await this.execute('EMERGENCY_EXIT', payload);
        eventBus.emit(EventName.EXECUTION_COMPLETED, { symbol: payload.symbol, action: 'EMERGENCY_EXIT' });
      } catch (error: any) {
        eventBus.emit(EventName.EXECUTION_FAILED, { symbol: payload.symbol, action: 'EMERGENCY_EXIT', error: error.message });
      }
    });
  }

  /**
   * The Resolve Gate: The only place where decisions become execution.
   */
  public async decide(
    context: DecisionContext,
    advisories: AdvisorySignal[],
    risk: RiskState
  ): Promise<{ action: ActionType; reason: string; score: number; components: any }> {
    
    // 🏛️ Rule 0: Global Emergency (Absolute Safety)
    if (risk.drawdownPct >= risk.maxDrawdownPct) {
      return { 
        action: 'EMERGENCY_EXIT', 
        reason: `Risk Breach: Drawdown (${risk.drawdownPct.toFixed(2)}%) > Max (${risk.maxDrawdownPct}%)`, 
        score: 100,
        components: { drawdown: 100 }
      };
    }

    // 🏛️ Rule 1: Unified Hedge Trigger (HedgeScore)
    const { score, components, reason: scoreReason } = this.calculateHedgeScore(context, advisories, risk);

    // Score > 70: Open Hedge NOW
    if (score > 70 && context.botState === BotState.HEDGE_PENDING) {
      return { action: 'OPEN_HEDGE', reason: `HedgeScore > 70 (${score.toFixed(1)}): ${scoreReason}`, score, components };
    }

    if (!risk.marginOk && context.botState === BotState.IDLE) {
      return { action: 'IDLE', reason: 'Risk Block: Insufficient Margin for deployment.', score, components };
    }

    // Default: Follow State Machine Intent based on Score thresholds
    switch (context.botState) {
      case BotState.IDLE: 
        return { action: 'OPEN_PRIMARY', reason: 'DHE: Deploying Primary Exposure.', score, components };
      
      case BotState.PRIMARY_ACTIVE:
        if (score >= 50) return { action: 'IDLE', reason: `HedgeScore >= 50 (${score.toFixed(1)}): Preparing Shield.`, score, components };
        return { action: 'ADJUST_TP_SL', reason: 'DHE: Monitoring primary leg telemetry.', score, components };

      case BotState.HEDGE_PENDING:
        if (score < 50) return { action: 'IDLE', reason: `HedgeScore < 50 (${score.toFixed(1)}): Market Recovered. De-arming Shield.`, score, components };
        return { action: 'IDLE', reason: `HedgeScore ${score.toFixed(1)}: Shield Armed (Waiting for > 70).`, score, components };

      case BotState.HEDGE_ACTIVE:
        if (score < 30) return { action: 'CLOSE_HEDGE', reason: `HedgeScore < 30 (${score.toFixed(1)}): Shield Retired.`, score, components };
        return { action: 'ADJUST_TP_SL', reason: 'DHE: Managing dual-leg maintenance.', score, components };

      case BotState.TP_SCALING: 
        return { action: 'ADJUST_TP_SL', reason: 'DHE: Scaling out and trailing stops.', score, components };

      case BotState.EMERGENCY: 
        return { action: 'EMERGENCY_EXIT', reason: 'DHE: Executing atomic exit.', score, components };

      default: 
        return { action: 'IDLE', reason: 'DHE: Monitoring Mode.', score, components };
    }
  }

  /**
   * Calculate Unified HedgeScore (0-100)
   * Formula: (DistToSL * 0.4) + (Vol * 0.3) + (Drawdown * 0.2) + (AI * 0.1)
   */
  private calculateHedgeScore(context: DecisionContext, advisories: AdvisorySignal[], risk: RiskState) {
    // 1. DistanceToSL (40%)
    const distToSL = Math.abs(context.entryA - context.slPrice) || 1;
    const progressToSL = Math.abs(context.entryA - context.currentPrice) / distToSL;
    const distScore = Math.min(100, Math.max(0, progressToSL * 100));

    // 2. Volatility (30%)
    const volScore = Math.min(100, Math.max(0, context.volatilityScore));

    // 3. Drawdown (20%)
    const drawdownScore = Math.min(100, Math.max(0, (risk.drawdownPct / (risk.maxDrawdownPct || 3)) * 100));

    // 4. AI Confidence (10%)
    const regime = advisories.find(a => a.source === 'RESEARCH_REGIME');
    let aiScore = 0;
    if (regime) {
      const isBuy = context.sideA === 'buy';
      // If AI is Bearish on a Long, or Bullish on a Short, increase HedgeScore
      const isContrary = (isBuy && regime.bias === 'BEARISH') || (!isBuy && regime.bias === 'BULLISH');
      aiScore = isContrary ? (regime.confidence * 100) : (regime.bias === 'NEUTRAL' ? 50 : 0);
    }

    const totalScore = (distScore * 0.4) + (volScore * 0.3) + (drawdownScore * 0.2) + (aiScore * 0.1);

    return {
      score: totalScore,
      components: {
        distance: distScore,
        volatility: volScore,
        drawdown: drawdownScore,
        ai: aiScore
      },
      reason: `Dist:${distScore.toFixed(0)}% Vol:${volScore.toFixed(0)}% Risk:${drawdownScore.toFixed(0)}% AI:${aiScore.toFixed(0)}%`
    };
  }

  /* 🏛️ Execution Matrix: Only DHE can call these */
  
  public async execute(action: ActionType, params: any) {
    Logger.info(`[DHE_SUPREME] Executing Authority Action: ${action} - ${params.reason || ''}`);
    
    switch (action) {
      case 'OPEN_PRIMARY':
        return await this.deltaService.placeBracketOrder(
          params.clientA, params.symbol, params.qtyA, params.sideA,
          params.entryA, params.slA, params.tpFinal
        );
      case 'OPEN_HEDGE':
        return await this.deltaService.placeOrder(
          params.clientB, params.symbol, 'stop_limit', params.sideB,
          params.qtyB, params.entryB, { stopPrice: params.entryB, leverage: params.leverageB || 20 }
        );
      case 'CLOSE_PRIMARY':
      case 'CLOSE_HEDGE':
      case 'EMERGENCY_EXIT':
        if (params.isPanic) {
          return await this.parallelPanicExit(params);
        } else {
          return await this.sequentialAtomicExit(params);
        }
      default:
        return null;
    }
  }

  private async parallelPanicExit(params: any) {
    Logger.warn(`[DHE_SUPREME] 🚨 INITIATING PARALLEL PANIC EXIT for ${params.symbol}!!! 🚨`);
    const promises = [
      this.deltaService.cancelAllOrders(params.clientA, params.symbol),
      this.deltaService.cancelAllOrders(params.clientB, params.symbol)
    ];
    if (params.qtyA > 0) promises.push(this.deltaService.closePosition(params.clientA, params.symbol, params.closeSideA, params.qtyA));
    if (params.qtyB > 0) promises.push(this.deltaService.closePosition(params.clientB, params.symbol, params.closeSideB, params.qtyB));
    
    return await Promise.allSettled(promises);
  }

  private async sequentialAtomicExit(params: any) {
    Logger.info(`[DHE_SUPREME] Initiating Sequential Atomic Exit for ${params.symbol}...`);
    try {
      // 1. Primary Leg Finalization
      await this.deltaService.cancelAllOrders(params.clientA, params.symbol);
      if (params.qtyA > 0) {
        Logger.info(`[DHE_SUPREME] Closing Primary Leg (${params.qtyA} ${params.symbol})...`);
        await this.deltaService.closePosition(params.clientA, params.symbol, params.closeSideA, params.qtyA);
      }

      // 2. Hedge Leg Finalization
      await this.deltaService.cancelAllOrders(params.clientB, params.symbol);
      if (params.qtyB > 0) {
        Logger.info(`[DHE_SUPREME] Closing Hedge Leg (${params.qtyB} ${params.symbol})...`);
        await this.deltaService.closePosition(params.clientB, params.symbol, params.closeSideB, params.qtyB);
      }
      
      return { success: true, mode: 'sequential' };
    } catch (e: any) {
      Logger.error(`[DHE_SUPREME] Sequential Exit Error: ${e.message}. System may be in unhedged state.`);
      throw e;
    }
  }
}
