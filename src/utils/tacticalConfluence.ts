import { MarketStructureAnalysis, Imbalance, StructuralLevel } from './marketStructure';
import { Pattern } from './candlestickPatterns';

export interface TacticalStrike {
  probability: number; // 0-100
  signal: 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL';
  reasoning: string[];
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export function calculateTacticalConfluence(
  analysis: MarketStructureAnalysis,
  patterns: Pattern[],
  latestPrice: number,
  currentTime: number | string // Needed for Session Killzone calculation
): TacticalStrike {
  const { currentTrend, levels, imbalances, grabs, atr } = analysis;
  
  let score = 0;
  const reasoning: string[] = [];
  
  // --- 1. Bias Assessment & Trend Enforcement (PERFECTION FIX) ---
  const bullishPatterns = patterns.filter(p => p.sentiment === 'bullish');
  const bearishPatterns = patterns.filter(p => p.sentiment === 'bearish');
  const bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = bullishPatterns.length > bearishPatterns.length ? 'BULLISH' : (bearishPatterns.length > bullishPatterns.length ? 'BEARISH' : 'NEUTRAL');

  // Trend Alignment (30 Base Points)
  const isTrendAligned = (currentTrend === 'BULLISH' && bias === 'BULLISH') ||
                         (currentTrend === 'BEARISH' && bias === 'BEARISH');
                     
  if (isTrendAligned) {
    score += 30;
    reasoning.push(`Trend Matrix: ${currentTrend} Confirmed`);
  }

  // --- 2. Institutional Defense & Levels (20 Points) ---
  const nearbyLevel = levels.find(l => {
    const upper = Math.max(l.priceWick, l.priceBody);
    const lower = Math.min(l.priceWick, l.priceBody);
    const buffer = atr * 0.2;
    return latestPrice >= (lower - buffer) && latestPrice <= (upper + buffer);
  });

  if (nearbyLevel) {
    score += 20;
    reasoning.push(`Matrix Level: Defense Zone [${nearbyLevel.type.toUpperCase()}]`);
  }

  // --- 3. Institutional Imbalance magnetism (20 Points) ---
  const activeFVG = imbalances.find(f => {
    const dist = Math.min(Math.abs(latestPrice - f.top), Math.abs(latestPrice - f.bottom));
    return dist < (atr * 0.4);
  });

  if (activeFVG) {
    score += 20;
    reasoning.push(`Matrix Void: Imbalance Magnet Detected`);
  }

  // --- 4. Alpha Pattern Quality (30 Points) ---
  if (isTrendAligned && (bullishPatterns.length > 0 || bearishPatterns.length > 0)) {
    score += 30;
    reasoning.push('Alpha Matrix: Institutional Pattern confirmed');
  }

  // --- 5. PERFECTION UPGRADE: Multiplicative Penalty Matrix ---
  // If the trade is counter-trend, we divide the score by 5 (0.2x)
  if (!isTrendAligned && bias !== 'NEUTRAL') {
    score *= 0.2;
    reasoning.push('⚠️ TACTICAL WARNING: Counter-Trend Exposure Filtered');
  }

  // --- 6. PERFECTION UPGRADE: Session Killzone Weighting ---
  const date = new Date(typeof currentTime === 'string' ? currentTime : (Number(currentTime) * 1000));
  const hour = date.getUTCHours();
  
  // London/NY: 13:00 - 21:00 UTC (The Big Money Hub)
  const isKillzone = hour >= 13 && hour <= 21;
  const isDeadZone = hour >= 22 || hour <= 4; // Asian Low Vol
  
  if (isKillzone) {
    score *= 1.25; 
    reasoning.push('Institutional Hub: Session Alpha Boosted');
  } else if (isDeadZone) {
    score *= 0.75;
    reasoning.push('Low-LQD Warning: Asian Session Scaling applied');
  }

  // --- 7. PERFECTION UPGRADE: Volatility Velocity (News Filter) ---
  // Note: volatility protection logic triggered in ChartHUD if probability plummets during spikes
  // Logic already integrated in probability weighting through ATR-normalization in MarketStructure

  let signal: 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL' = 'NEUTRAL';
  score = Math.min(100, Math.round(score));

  if (score >= 85) {
    signal = bias === 'BULLISH' ? 'STRONG_BUY' : 'STRONG_SELL';
  }

  return {
    probability: score,
    signal,
    reasoning,
    bias: currentTrend
  };
}
