import { Logger } from '../../logger';

export type MarketRegime = 'STABLE_TREND' | 'RANGE_BOUND' | 'HIGH_VOLATILITY' | 'LIQUIDITY_HUNT';

interface IntelligenceData {
  sentiment: number; // -1 (Extreme Bearish) to 1 (Extreme Bullish)
  regime: MarketRegime;
  volatilityScore: number; // 0-100
  liquidityScore: number; // 0-100 (100 = deep books, low spread)
  lastUpdate: number;
}

export class IntelligenceService {
  private static instance: IntelligenceService;
  private data: Map<string, IntelligenceData> = new Map();

  private constructor() {}

  public static getInstance(): IntelligenceService {
    if (!IntelligenceService.instance) {
      IntelligenceService.instance = new IntelligenceService();
    }
    return IntelligenceService.instance;
  }

  public async analyzeSymbol(symbol: string, lastPrice: number, spread: number): Promise<IntelligenceData> {
    const existing = this.data.get(symbol);
    
    // Simulate complex reasoning logic (DeepSeek/Gemini simulation)
    const sentiment = existing ? existing.sentiment : (Math.random() * 2 - 1);
    const volatility = Math.min(100, Math.max(10, (spread / lastPrice) * 10000));
    
    let regime: MarketRegime = 'STABLE_TREND';
    if (volatility > 60) regime = 'HIGH_VOLATILITY';
    else if (volatility < 20) regime = 'RANGE_BOUND';
    
    const intelligence: IntelligenceData = {
      sentiment,
      regime,
      volatilityScore: volatility,
      liquidityScore: Math.max(0, 100 - volatility),
      lastUpdate: Date.now()
    };

    this.data.set(symbol, intelligence);
    return intelligence;
  }

  public setSentiment(symbol: string, score: number) {
    const current = this.data.get(symbol) || { sentiment: 0, regime: 'STABLE_TREND', volatilityScore: 0, liquidityScore: 100, lastUpdate: Date.now() };
    this.data.set(symbol, { ...current, sentiment: Math.max(-1, Math.min(1, score)), lastUpdate: Date.now() });
    Logger.info(`[INTELLIGENCE] Manual Sentiment Override for ${symbol}: ${score}`);
  }

  public getIntelligence(symbol: string): IntelligenceData | undefined {
    return this.data.get(symbol);
  }

  /**
   * Recommends a dynamic offset based on Intelligence Data
   * @param baseOffset The user-defined base offset (e.g., 5 USDT)
   * @param intelligence The current intelligence state
   * @param botSide "buy" or "sell" (Account A side)
   */
  public recommendOffset(baseOffset: number, intelligence: IntelligenceData, botSide: string): number {
    let offset = baseOffset;

    // 1. Volatility Adjustment
    if (intelligence.regime === 'HIGH_VOLATILITY') {
      offset *= 1.5; // Widen buffer during turbulence to avoid noise triggers
    }

    // 2. Sentiment Adjustment
    // If we are LONG (buy) and sentiment is BEARISH (-1), we tighten the shield trigger
    if (botSide === 'buy' && intelligence.sentiment < -0.3) {
      offset *= 0.7; // Tighten trigger (move closer to entry) to trigger insurance faster
    } else if (botSide === 'sell' && intelligence.sentiment > 0.3) {
      offset *= 0.7; // Tighten trigger for Shorts if sentiment is Bullish
    }

    return parseFloat(offset.toFixed(2));
  }
}
