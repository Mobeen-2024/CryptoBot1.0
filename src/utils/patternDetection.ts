export interface EngulfingResult {
  isBullish: boolean;
  isBearish: boolean;
  hasHighVolume: boolean;
  isExpansion: boolean;
}

/**
 * Institutional Engulfing Logic (AI-ALPHA)
 * Operates on the data array to allow for rolling averages (Volume/Momentum)
 */
/**
 * Institutional Engulfing Logic (AI-ALPHA 2050)
 * Operates on the data array to allow for rolling averages (Volume/Momentum)
 * Includes Synthetic Volume Delta Emulation
 */
export function analyzeEngulfing(data: any[], i: number): EngulfingResult {
  if (!data || i < 10 || i >= data.length) {
    return { isBullish: false, isBearish: false, hasHighVolume: false, isExpansion: false };
  }

  const curr = data[i];
  const prev = data[i - 1];

  const currIsUp = curr.close > curr.open;
  const currIsDown = curr.close < curr.open;

  const currBodySize = Math.abs(curr.close - curr.open);
  
  // 1. Institutional Momentum Check (Expansion vs 10-candle mean)
  const avgBodySize = data.slice(i - 10, i).reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / 10;
  // AI-ALPHA 2050 Requirement: 1.618 (Golden Ratio) expansion or absolute dominance
  const isExpansion = currBodySize > (avgBodySize * 1.618);

  // 2. Volume Check (Confirmation vs 5-candle mean) with Synthetic Fallback
  const avgVolume5 = data.slice(i - 5, i).reduce((sum, c) => sum + (c.volume || 0), 0) / 5;
  
  // AI-ALPHA 2050 Perfection: Synthetic Volume Proxy (SVP)
  // If volume is 0 or missing, we infer "Relative Institutional Effort" from Range/ATR
  let volumeEffort = curr.volume || 0;
  if (volumeEffort === 0 || avgVolume5 === 0) {
    const currRange = curr.high - curr.low;
    const prevRanges = data.slice(i - 10, i).map(d => d.high - d.low);
    const avgRange = prevRanges.reduce((a, b) => a + b, 0) / 10;
    // Proxy: If range expanded > 2x average, we treat it as High Volume effort
    volumeEffort = (currRange / (avgRange || 1)) * 100; 
    const avgProxyVolume = 100; // Normalized baseline
    var hasHighVolume = volumeEffort > (avgProxyVolume * 1.5);
  } else {
    var hasHighVolume = curr.volume > (avgVolume5 * 1.5);
  }

  // 3. Synthetic Volume Delta Emulation (SVD)
  // Logic: Ratioing the distance of Close from Low vs High from Close
  // Also factoring in Body vs Wick ratio
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const totalRange = curr.high - curr.low || 0.000001;
  
  // deltaScore: -1 (Total Sell Dominance) to +1 (Total Buy Dominance)
  const bodyEngagement = currBodySize / totalRange;
  const deltaScore = currIsUp ? 
    (bodyEngagement + (lowerWick / totalRange)) : 
    -(bodyEngagement + (upperWick / totalRange));

  // 4. Liquidity Sweep & Domination (Outside Bar Reversal)
  // AI-ALPHA 2050 requires strict delta dominance (>0.75 or <-0.75)
  const bullishEngulf = currIsUp && 
                        curr.low <= prev.low && 
                        curr.close >= prev.high && 
                        isExpansion && hasHighVolume && deltaScore > 0.75;

  const bearishEngulf = currIsDown && 
                        curr.high >= prev.high && 
                        curr.close <= prev.low && 
                        isExpansion && hasHighVolume && deltaScore < -0.75;

  return {
    isBullish: bullishEngulf,
    isBearish: bearishEngulf,
    hasHighVolume,
    isExpansion
  };
}

// Legacy support (updated to use the first valid data points it can find)
export function isBullishEngulfing(prev: any, curr: any): boolean {
  // Warn: Technical limitation of legacy signature. Truly accurate analysis requires full context.
  return analyzeEngulfing([prev, curr], 1).isBullish;
}
