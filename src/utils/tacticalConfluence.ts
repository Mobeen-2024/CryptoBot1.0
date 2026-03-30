import { MarketStructureAnalysis, Imbalance, StructuralLevel, OrderBlock } from './marketStructure';
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
  const { currentTrend, levels, imbalances, grabs, atr, isNewsProtection, orderBlocks } = analysis;
  
  let score = 0;
  const reasoning: string[] = [];
  let synergyMultiplier = 1.0;
  
  // --- 1. Bias Assessment & Trend Enforcement (2100 MASTER) ---
  const bullishPatterns = patterns.filter(p => p.sentiment === 'bullish');
  const bearishPatterns = patterns.filter(p => p.sentiment === 'bearish');
  const bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = bullishPatterns.length > bearishPatterns.length ? 'BULLISH' : (bearishPatterns.length > bullishPatterns.length ? 'BEARISH' : 'NEUTRAL');

  // Trend Alignment (25 Base Points)
  const isTrendAligned = (currentTrend === 'BULLISH' && bias === 'BULLISH') ||
                         (currentTrend === 'BEARISH' && bias === 'BEARISH');
                     
  if (isTrendAligned) {
    score += 25;
    reasoning.push(`Matrix Alignment: Macro Trend Confirmed`);
  }

  // --- 2. Alpha Pattern Quality (25 Base Points) ---
  if (isTrendAligned && (bullishPatterns.length > 0 || bearishPatterns.length > 0)) {
    score += 25;
    reasoning.push('Alpha Pattern: 2100 Institutional Footprint');
  }

  // --- 3. Institutional Defense & Levels (15 Points) ---
  const nearbyLevel = levels.find(l => {
    const upper = Math.max(l.priceWick, l.priceBody);
    const lower = Math.min(l.priceWick, l.priceBody);
    const buffer = atr * 0.2;
    return latestPrice >= (lower - buffer) && latestPrice <= (upper + buffer);
  });

  if (nearbyLevel) {
    score += 15;
    reasoning.push(`Defense Node: Liquidity [${nearbyLevel.type.toUpperCase()}]`);
    synergyMultiplier += 0.3; // 2100 Synergy
  }

  // --- 4. Institutional Imbalance Magnetism (15 Points) ---
  const activeFVG = imbalances.find(f => {
    const dist = Math.min(Math.abs(latestPrice - f.top), Math.abs(latestPrice - f.bottom));
    return dist < (atr * 0.4);
  });

  if (activeFVG) {
    score += 15;
    reasoning.push(`Void Magnet: Active Imbalance Filled`);
    synergyMultiplier += 0.35; // 2100 Synergy
  }

  // --- 5. Order Block Magnetism (2100 Master Addition) (20 Points) ---
  const activeOB = orderBlocks?.find(ob => {
    const buffer = atr * 0.15;
    return latestPrice >= (ob.bottom - buffer) && latestPrice <= (ob.top + buffer);
  });

  if (activeOB) {
    score += 20;
    reasoning.push(`Order Block: Institutional Origin Mitigated`);
    synergyMultiplier += 0.65; // Massive synergy for true OB mitigation
  }

  // --- 6. 2100 Quantum Multiplier Application ---
  if (synergyMultiplier > 1.0 && score > 0) {
    reasoning.push(`Quantum Confluence: Synergy Multiplier [${synergyMultiplier.toFixed(2)}x]`);
    score *= synergyMultiplier;
  }

  // --- 7. PERFECTION UPGRADE: Multiplicative Penalty Matrix ---
  // If the trade is counter-trend, we divide the score brutally (0.1x)
  if (!isTrendAligned && bias !== 'NEUTRAL') {
    score *= 0.1;
    reasoning.push('⚠️ TACTICAL WARNING: Counter-Trend Exposure Filtered');
  }

  // --- 8. MASTER UPGRADE: Session Killzone Weighting ---
  const date = new Date(typeof currentTime === 'string' ? currentTime : (Number(currentTime) * 1000));
  const hour = date.getUTCHours();
  
  // London/NY: 13:00 - 21:00 UTC (The Big Money Hub)
  const isKillzone = hour >= 13 && hour <= 21;
  const isDeadZone = hour >= 22 || hour <= 4; // Asian Low Vol
  
  if (isKillzone) {
    score *= 1.35; 
    reasoning.push('Hub Volume: Alpha Boost Applied');
  } else if (isDeadZone) {
    score *= 0.65;
    reasoning.push('Low-LQD Core: Fractional Scaling Active');
  }

  // --- 9. 2100 MASTER Circuit Breaker: News/Volatility Shutdown ---
  if (isNewsProtection) {
    if (!activeOB) { // OBs can act as shields to absorb liquidity spikes
      score *= 0.1; // Hard Nuke
      reasoning.push('🛑 OVERRIDE: Circuit Breaker Activated (Volatility Spike)');
    } else {
      reasoning.push('🛡️ OB SHIELD: Volatility Absorbed by Order Block');
      score *= 0.85; // Slight reduction but protected by OB
    }
  }

  let signal: 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL' = 'NEUTRAL';
  score = Math.min(100, Math.round(score));

  // High Probability Execution logic
  if (score >= 88) { // Strictly requires Master 2100 quality
    signal = bias === 'BULLISH' ? 'STRONG_BUY' : 'STRONG_SELL';
  }

  return {
    probability: score,
    signal,
    reasoning,
    bias: bias
  };
}
