import { GoogleGenerativeAI } from '@google/generative-ai';
import { Logger } from '../../logger';
import { AgenticSearchService } from './agenticSearchService';

export type MarketRegime = 'STABLE_TREND' | 'RANGE_BOUND' | 'HIGH_VOLATILITY' | 'LIQUIDITY_HUNT';

interface IntelligenceData {
  sentiment: number; 
  sentimentConfidence: number; // 0.0 to 1.0 (Phase 11)
  reasoningSnippet?: string; // Phase 11
  regime: MarketRegime;
  volatilityScore: number; 
  liquidityScore: number; 
  lastUpdate: number;
  lastNewsUpdate?: number; // Phase 11
  atr?: number;
}

export class IntelligenceService {
  private static instance: IntelligenceService;
  private data: Map<string, IntelligenceData> = new Map();
  private genAI: GoogleGenerativeAI | null = null;
  private model: any | null = null;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.setGeminiKey(apiKey);
    }
  }

  public setGeminiKey(key: string) {
    try {
      this.genAI = new GoogleGenerativeAI(key);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" }, { apiVersion: 'v1' });
      Logger.info('[INTELLIGENCE] Gemini Reasoning Kernel Initialized (v1).');
    } catch (e) {
      Logger.error('[INTELLIGENCE] Gemini Initialization Failed:', e);
    }
  }

  public static getInstance(): IntelligenceService {
    if (!IntelligenceService.instance) {
      IntelligenceService.instance = new IntelligenceService();
    }
    return IntelligenceService.instance;
  }

  public async applyAgenticConsensus(symbol: string, news: string) {
    if (!this.model) {
      Logger.warn('[INTELLIGENCE] Gemini Mode Unavailable. Falling back to Phase 9 math.');
      return;
    }

    try {
      const prompt = AgenticSearchService.createSentimentPrompt(symbol, news);
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Attempt to parse JSON safely
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}') + 1;
      const jsonStr = text.substring(jsonStart, jsonEnd);
      
      const analysis = JSON.parse(jsonStr);
      
      const current = this.data.get(symbol) || { 
        sentiment: 0, 
        sentimentConfidence: 0, 
        regime: 'STABLE_TREND' as MarketRegime, 
        volatilityScore: 0, 
        liquidityScore: 100, 
        lastUpdate: Date.now() 
      };

      this.data.set(symbol, {
        ...current,
        sentiment: analysis.sentiment,
        sentimentConfidence: analysis.confidence,
        reasoningSnippet: analysis.reasoningSnippet,
        lastNewsUpdate: Date.now()
      });

      Logger.info(`[INTELLIGENCE] Bot Pilot Consensus for ${symbol}: ${analysis.sentiment} (${(analysis.confidence * 100).toFixed(0)}% Conf)`);
      if (analysis.isHighRisk) {
        Logger.warn(`[INTELLIGENCE] AI WARNING: HIGH RISK DETECTED FOR ${symbol}!`);
      }
    } catch (error) {
      Logger.error('[INTELLIGENCE] Agentic Consensus Error:', error);
    }
  }

  public async analyzeSymbol(symbol: string, lastPrice: number, spread: number): Promise<IntelligenceData> {
    const existing = this.data.get(symbol);
    
    const sentiment = existing ? existing.sentiment : 0;
    const confidence = existing ? existing.sentimentConfidence : 0;
    const volatility = Math.min(100, Math.max(10, (spread / lastPrice) * 10000));
    
    let regime: MarketRegime = 'STABLE_TREND';
    if (volatility > 60) regime = 'HIGH_VOLATILITY';
    else if (volatility < 20) regime = 'RANGE_BOUND';
    
    const intelligence: IntelligenceData = {
      sentiment,
      sentimentConfidence: confidence,
      reasoningSnippet: existing?.reasoningSnippet,
      regime,
      volatilityScore: volatility,
      liquidityScore: Math.max(0, 100 - volatility),
      lastUpdate: Date.now(),
      lastNewsUpdate: existing?.lastNewsUpdate,
      atr: existing?.atr
    };

    this.data.set(symbol, intelligence);
    return intelligence;
  }

  public setSentiment(symbol: string, score: number) {
    const current = this.data.get(symbol) || { sentiment: 0, sentimentConfidence: 0, regime: 'STABLE_TREND' as MarketRegime, volatilityScore: 0, liquidityScore: 100, lastUpdate: Date.now() };
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
      offset *= 1.5; 
    }

    // 2. Agentic Sentiment Modulation (Phase 11)
    // Only apply if confidence is high (>= 0.7)
    if (intelligence.sentimentConfidence >= 0.7) {
      // If we are LONG (buy) and sentiment is BEARISH (-1), we tighten the shield trigger
      if (botSide === 'buy' && intelligence.sentiment < -0.3) {
        offset *= 0.7; // Tighten trigger (move closer to entry)
      } else if (botSide === 'sell' && intelligence.sentiment > 0.3) {
        offset *= 0.7; // Tighten trigger for Shorts if sentiment is Bullish
      }
    }

    // 3. ATR Sanity Check (Flash Crash Override)
    // If ATR is surging while Sentiment is bullish, we force tighter offsets regardless of AI bias
    if (intelligence.atr && intelligence.atr > (baseOffset * 2)) {
      Logger.warn('[INTELLIGENCE] ATR Surge Detected! Overriding AI bias for safety.');
      offset *= 0.5; // Force tight protection
    }

    return parseFloat(offset.toFixed(2));
  }

  /**
   * Centralizes the trigger price calculation for Account B
   * @param entryA Account A entry price
   * @param baseOffset The baseline 5 USDT offset or dynamic variant
   * @param sideA Direction of Account A ('buy' = Long, 'sell' = Short)
   */
  public calculateSymmetricalOffset(entryA: number, baseOffset: number, sideA: 'buy' | 'sell'): number {
    // Bullish: Hedge is below EntryA (Sell-Stop)
    // Bearish: Hedge is above EntryA (Buy-Stop)
    return sideA === 'buy' ? entryA - baseOffset : entryA + baseOffset;
  }

  public getFrictionOffset(sideA: 'buy' | 'sell', symbol: string, k: number = 1.0): number {
    return this.getDynamicFriction(symbol, k) * (sideA === 'buy' ? 1 : -1);
  }

  /**
   * Returns a dynamic offset based on the current ATR and user multiplier.
   * Standardizes Phase 9 "Dynamic Friction" architecture.
   */
  public getDynamicFriction(symbol: string, k: number = 1.0): number {
    const intel = this.data.get(symbol);
    if (intel && intel.atr) {
      return intel.atr * k;
    }
    return 2.0; // Default hard fallback
  }

  /**
   * Calculates ATR(14) from OHLCV data
   */
  public updateATR(symbol: string, ohlcv: number[][]) {
    if (ohlcv.length < 15) return;
    
    let trSum = 0;
    for (let i = 1; i < ohlcv.length; i++) {
        const [,, high, low, close] = ohlcv[i];
        const prevClose = ohlcv[i-1][4];
        const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        trSum += tr;
    }
    const atr = trSum / (ohlcv.length - 1);
    const current = this.data.get(symbol) || { sentiment: 0, sentimentConfidence: 0, regime: 'STABLE_TREND' as MarketRegime, volatilityScore: 0, liquidityScore: 100, lastUpdate: Date.now() };
    this.data.set(symbol, { ...current, atr, lastUpdate: Date.now() });
    Logger.info(`[INTELLIGENCE] ATR Updated for ${symbol}: ${atr.toFixed(2)}`);
  }

  /**
   * Calculates the target hedge exposure based on the current price state.
   * Mission: Always Protected.
   * Standardizes the Phase 9 State-Based Exposure Model.
   */
  public calculateRequiredHedge(markPrice: number, entryA: number, entryB: number, qtyA: number, sideA: 'buy' | 'sell', slA: number): number {
    const isBuy = sideA === 'buy';
    const triggerCrossed = isBuy ? markPrice <= entryB : markPrice >= entryB;
    
    if (!triggerCrossed) return 0;
    
    // Phase 9: Dynamic Hedge Scaling
    // If we are between EntryB and SL_A, we want to maintain the hedge.
    // In advanced mode, we scale from 0.5 to 1.0 or just 1.0 for institutional safety.
    const distanceToStop = Math.abs(entryA - slA);
    const currentDistance = Math.abs(entryA - markPrice);
    
    // If price is 50% towards SL, we must have at least 50% hedge.
    // But for institutional standard, we aim for full Delta Neutrality immediately upon trigger.
    return qtyA; 
  }
}
