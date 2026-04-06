import { useState, useEffect, useMemo, useRef } from 'react';
import { useTickerStream, useTradesStream, useKlinesStream } from './useBinanceStreams';
import { analyzeMarketStructure } from '../utils/marketStructure';
import { calculateTacticalConfluence, TacticalStrike } from '../utils/tacticalConfluence';

export interface AgentThought {
  id: string; // Institutional Unique Identifier
  agent: 'Risk Sentinel' | 'Apex Aggressor' | 'Market Neutral' | 'System';
  text: string;
  timestamp: number;
}

export function useAIAgent(symbol: string, interval: string = '1h') {
  const ticker = useTickerStream(symbol);
  const trades = useTradesStream(symbol);
  const lastKline = useKlinesStream(symbol, interval);
  
  const [marketData, setMarketData] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<TacticalStrike | null>(null);
  const [pendingAnalysis, setPendingAnalysis] = useState<TacticalStrike | null>(null);
  const analysisRef = useRef<TacticalStrike | null>(null);
  const [thoughts, setThoughts] = useState<AgentThought[]>([]);
  const [lastProcessedTime, setLastProcessedTime] = useState(0);

  // Buffer market data for analysis with ASC sorting enforcement
  useEffect(() => {
    if (!lastKline) return;
    setMarketData(prev => {
      const now = Number(lastKline.time);
      // 1. Filter out existing candle with the same time + Sort
      const sorted = [...prev.filter(p => Number(p.time) < now), { ...lastKline, time: now }]
        .sort((a, b) => Number(a.time) - Number(b.time));
      
      // 2. Clear duplicates (t[i] > t[i-1])
      const unique: any[] = [];
      for (const item of sorted) {
        const t = Number(item.time);
        if (unique.length === 0 || t > Number(unique[unique.length - 1].time)) {
          unique.push({ ...item, time: t });
        }
      }

      // 3. Keep buffer size manageable (Institutional standard: 100 periods)
      return unique.length > 100 ? unique.slice(unique.length - 100) : unique;
    });
  }, [lastKline]);

  // Periodic Analysis (Institutional Heartbeat)
  useEffect(() => {
    // 1. Guard: Ensure sufficient data for engine
    if (marketData.length < 20 || !ticker) return;
    
    const now = Date.now();
    
    // 2. Performance Guard: Throttle analysis (15s heartbeat + move sensitivity)
    const prevProb = analysisRef.current?.probability || 0;
    const currentPrice = parseFloat(ticker.lastPrice);
    const priceMove = prevProb > 0 ? Math.abs(currentPrice - prevProb) / prevProb : 1;
    
    if (now - lastProcessedTime < 15000 && priceMove < 0.001) return;

    try {
      // 3. Core Engine Execution
      // Explicitly sort again just before engine call to satisfy lightweight-charts requirements inside the engine
      const sortedBuffer = [...marketData].sort((a, b) => a.time - b.time);
      const structure = analyzeMarketStructure(sortedBuffer);
      const strike = calculateTacticalConfluence(structure, [], currentPrice, now);
      
      // 4. Update Pending state
      setPendingAnalysis(strike);
      setLastProcessedTime(now);

      // 5. Intelligence Layer: Generate Agent Thoughts
      if (strike.reasoning.length > 0) {
        const newThoughts: AgentThought[] = [];
        const usedReasoning = new Set<string>();

        const momentumReasoning = strike.reasoning.find(r => r.includes('Trend') || r.includes('BoS') || r.includes('Synergy'));
        if (momentumReasoning && !usedReasoning.has(momentumReasoning)) {
          newThoughts.push({
            id: `apex-${now}-${Math.random().toString(36).substr(2, 5)}`,
            agent: 'Apex Aggressor',
            text: momentumReasoning,
            timestamp: now
          });
          usedReasoning.add(momentumReasoning);
        }

        const riskReasoning = strike.reasoning.find(r => r.includes('Circuit') || r.includes('Warning') || r.includes('Level') || r.includes('Defense'));
        if (riskReasoning && !usedReasoning.has(riskReasoning)) {
          newThoughts.push({
            id: `risk-${now}-${Math.random().toString(36).substr(2, 5)}`,
            agent: 'Risk Sentinel',
            text: riskReasoning,
            timestamp: now + 500
          });
          usedReasoning.add(riskReasoning);
        }

        const neutralReasoning = strike.reasoning.find(r => r.includes('Imbalance') || r.includes('Void') || r.includes('Hub'));
        if (neutralReasoning && !usedReasoning.has(neutralReasoning)) {
          newThoughts.push({
            id: `neutral-${now}-${Math.random().toString(36).substr(2, 5)}`,
            agent: 'Market Neutral',
            text: neutralReasoning,
            timestamp: now + 1000
          });
          usedReasoning.add(neutralReasoning);
        }

        if (newThoughts.length > 0) {
          setThoughts(prev => [...prev, ...newThoughts].slice(-20));
        }
      }
    } catch (err) {
      console.error("[useAIAgent] Analysis engine failure:", err);
      // Fallback to ErrorBoundary handling via component-level throw if it's terminal
    }
  }, [marketData, ticker, lastProcessedTime]);

  // Throttled Analysis Sync with Cleanup (Final UI Stability Layer)
  useEffect(() => {
    if (!pendingAnalysis) return;

    const id = setTimeout(() => {
      setAnalysis(prev => {
        // Targeted Guard: Avoid redraws if semantic signal hasn't shifted
        if (prev && 
            prev.probability === pendingAnalysis.probability && 
            prev.signal === pendingAnalysis.signal) {
          return prev;
        }
        return pendingAnalysis;
      });
      analysisRef.current = pendingAnalysis;
    }, 300);

    return () => clearTimeout(id);
  }, [pendingAnalysis]);

  return {
    analysis,
    thoughts,
    ticker,
    trades,
    isReady: marketData.length >= 20 && !!analysis
  };
}
