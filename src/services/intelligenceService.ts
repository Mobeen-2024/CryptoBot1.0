import { GoogleGenerativeAI } from '@google/generative-ai';
import { Logger } from '../../logger.js';
import { AdvisorySignal } from './decisionEngine.js';

export type MarketRegime = 'TREND' | 'RANGE' | 'VOLATILE';

interface IntelligenceData {
  regime: MarketRegime;
  volatilityScore: number; 
  liquidityScore: number; 
  lastUpdate: number;
  lastNewsUpdate?: number;
  atr?: number;
  executionAdvisory?: {
    friction: number;
    offset: number;
    reason: string;
  };
}

export class IntelligenceService {
  private static instance: IntelligenceService;
  private data: Map<string, IntelligenceData> = new Map();
  private genAI: GoogleGenerativeAI | null = null;
  private researchKernel: any | null = null;
  private executionKernel: any | null = null;
  private liveKernel: any | null = null;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.setGeminiKey(apiKey);
    }
  }

  public setGeminiKey(key: string) {
    try {
      this.genAI = new GoogleGenerativeAI(key);
      this.researchKernel = this.genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite" }, { apiVersion: 'v1' });
      this.executionKernel = this.genAI.getGenerativeModel({ model: "gemma-3-27b" }, { apiVersion: 'v1' });
      this.liveKernel = this.genAI.getGenerativeModel({ model: "gemini-3-flash-live" }, { apiVersion: 'v1' });
      Logger.info('[INTELLIGENCE] Multi-Kernel Matrix Initialized (Gemini 3.1 FL / Gemma 3 27B / Gemini 3 Flash Live).');
    } catch (e) {
      Logger.error('[INTELLIGENCE] Multi-Kernel Initialization Failed:', e);
    }
  }

  public static getInstance(): IntelligenceService {
    if (!IntelligenceService.instance) {
      IntelligenceService.instance = new IntelligenceService();
    }
    return IntelligenceService.instance;
  }

  /**
   * RESEARCH KERNEL: Strictly defines Market Regime.
   */
  public async detectMarketRegime(symbol: string, news: string) {
    if (!this.researchKernel) return;

    try {
      const prompt = `MARKET REGIME ANALYSIS:
      Pair: ${symbol}
      Recent Intel: ${news}
      Identify regime: TREND | RANGE | VOLATILE.
      Return JSON: { "regime": "TREND" | "RANGE" | "VOLATILE", "confidence": number, "reason": string }`;

      const result = await this.researchKernel.generateContent(prompt);
      const text = (await result.response).text();
      const analysis = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
      
      const current = this.data.get(symbol) || this.getDefaultData();
      this.data.set(symbol, { ...current, regime: analysis.regime, lastNewsUpdate: Date.now() });
      Logger.info(`[RESEARCH_ADVISORY] Market State: ${analysis.regime}`);
    } catch (e) {
      Logger.error('[INTELLIGENCE] Research Error:', e);
    }
  }

  /**
   * EXECUTION KERNEL: Calculates ATR friction and Entry offsets.
   */
  public async calculateExecutionAdvisory(symbol: string, price: number, spread: number, atr: number) {
    if (!this.executionKernel) return;

    try {
      const prompt = `EXECUTION OPTIMIZATION (GEMMA 3):
      Symbol: ${symbol} Price: ${price} Spread: ${spread} ATR: ${atr}
      Calculate optimal: "friction" (shield buffer) and "offset" (entry distance).
      Return JSON: { "friction": number, "offset": number, "reason": string }`;

      const result = await this.executionKernel.generateContent(prompt);
      const text = (await result.response).text();
      const advisory = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
      
      const current = this.data.get(symbol) || this.getDefaultData();
      this.data.set(symbol, { ...current, executionAdvisory: advisory, lastUpdate: Date.now() });
      Logger.info(`[EXECUTION_ADVISORY] Friction: ${advisory.friction}, Offset: ${advisory.offset}`);
    } catch (e) {
      Logger.error('[INTELLIGENCE] Execution Error:', e);
    }
  }

  public getIntelligence(symbol: string): IntelligenceData | undefined {
    return this.data.get(symbol);
  }

  public calculateSymmetricalOffset(entryA: number, baseOffset: number, sideA: 'buy' | 'sell'): number {
    return sideA === 'buy' ? entryA - baseOffset : entryA + baseOffset;
  }

  public calculateRequiredHedge(markPrice: number, entryA: number, entryB: number, qtyA: number, sideA: 'buy' | 'sell'): number {
    const isBuy = sideA === 'buy';
    const triggerCrossed = isBuy ? markPrice <= entryB : markPrice >= entryB;
    return triggerCrossed ? qtyA : 0;
  }

  /**
   * LIVE KERNEL: Sub-second safety gate.
   */
  public async applyHedgeConsensus(symbol: string, hedgePrice: number, currentPrice: number): Promise<boolean> {
    if (!this.liveKernel) return true;

    try {
      const prompt = `LIVE SHIELD GATE: Symbol: ${symbol} Hedge: ${hedgePrice} Mark: ${currentPrice} 
      Is it safe to hedge NOW? Return JSON: { "safe": boolean, "reason": string }`;

      const result = await this.liveKernel.generateContent(prompt);
      const text = (await result.response).text();
      const decision = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));

      Logger.info(`[LIVE_GATE] ${decision.safe ? 'GRANTED' : 'DENIED'} - ${decision.reason}`);
      return decision.safe;
    } catch (e) {
      return true;
    }
  }

  public async applyAgenticConsensus(symbol: string, news: string) {
    Logger.info(`[INTELLIGENCE] Applying Agentic Consensus for ${symbol}...`);
    // Pass it to the research kernel to update the regime
    await this.detectMarketRegime(symbol, news);
  }

  public updateATR(symbol: string, ohlcv: any[]) {
    // This is a mock/helper for simulation to force ATR changes
    // In production, fetchATR calculates it from real candles
    const current = this.data.get(symbol) || this.getDefaultData();
    // Simulate ATR calculation (e.g., avg range of last few candles)
    const ranges = ohlcv.slice(-14).map(c => c[2] - c[3]);
    const avgRange = ranges.reduce((a, b) => a + b, 0) / (ranges.length || 1);
    this.data.set(symbol, { ...current, atr: avgRange, lastUpdate: Date.now() });
    Logger.info(`[INTELLIGENCE] ATR for ${symbol} synthetically updated to ${avgRange.toFixed(2)}`);
  }

  public setSentiment(symbol: string, score: number) {
    const data = this.data.get(symbol) || this.getDefaultData();
    // Normalize sentiment into regime or volatility adjustment
    if (score > 0.5) data.regime = 'TREND';
    else if (score < -0.5) data.regime = 'VOLATILE';
    else data.regime = 'RANGE';
    
    this.data.set(symbol, data);
    Logger.info(`[INTELLIGENCE] Sentiment for ${symbol} overridden to ${score} (${data.regime})`);
  }

  public async analyzeSymbol(symbol: string, lastPrice: number, spread: number): Promise<IntelligenceData> {
    const volatility = Math.min(100, Math.max(10, (spread / lastPrice) * 10000));
    let regime: MarketRegime = 'TREND';
    if (volatility > 60) regime = 'VOLATILE';
    else if (volatility < 20) regime = 'RANGE';
    
    const existing = this.data.get(symbol) || this.getDefaultData();
    const current: IntelligenceData = { 
      ...existing, 
      regime, 
      volatilityScore: volatility, 
      liquidityScore: 100 - volatility, 
      lastUpdate: Date.now() 
    };
    this.data.set(symbol, current);
    return current;
  }

  public recommendOffset(baseOffset: number, intel: IntelligenceData): number {
    let offset = baseOffset;
    if (intel.executionAdvisory) offset = intel.executionAdvisory.offset;
    else if (intel.regime === 'VOLATILE') offset *= 1.5;
    return parseFloat(offset.toFixed(2));
  }

  public getFrictionOffset(sideA: 'buy' | 'sell', symbol: string, k: number = 1.0): number {
    const intel = this.data.get(symbol);
    const friction = (intel?.executionAdvisory?.friction || (intel?.atr || 2.0)) * k;
    return friction * (sideA === 'buy' ? 1 : -1);
  }

  public async fetchATR(service: any, symbol: string) {
    if (service?.fetchOHLCV) {
      const ohlcv = await service.fetchOHLCV(symbol, '1m', undefined, 20);
      if (ohlcv?.length > 15) {
        let trSum = 0;
        for (let i = 1; i < ohlcv.length; i++) {
          const tr = Math.max(ohlcv[i][2] - ohlcv[i][3], Math.abs(ohlcv[i][2] - ohlcv[i-1][4]), Math.abs(ohlcv[i][3] - ohlcv[i-1][4]));
          trSum += tr;
        }
        const current = this.data.get(symbol) || this.getDefaultData();
        this.data.set(symbol, { ...current, atr: trSum / (ohlcv.length - 1), lastUpdate: Date.now() });
      }
    }
  }

  public getAdvisorySignal(symbol: string): AdvisorySignal | undefined {
    const intel = this.data.get(symbol);
    if (!intel) return undefined;
    return {
      source: 'RESEARCH_REGIME',
      bias: 'NEUTRAL',
      confidence: 0.8,
      reason: `Market State: ${intel.regime}`
    };
  }

  private getDefaultData(): IntelligenceData {
    return { regime: 'RANGE', volatilityScore: 0, liquidityScore: 100, lastUpdate: Date.now() };
  }
}
