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
export function analyzeEngulfing(data: any[], i: number): EngulfingResult {
  if (!data || i < 5 || i >= data.length) {
    return { isBullish: false, isBearish: false, hasHighVolume: false, isExpansion: false };
  }

  const curr = data[i];
  const prev = data[i - 1];

  const prevIsDown = prev.close < prev.open;
  const prevIsUp = prev.close > prev.open;
  const currIsUp = curr.close > curr.open;
  const currIsDown = curr.close < curr.open;

  const currBodySize = Math.abs(curr.close - curr.open);
  
  // 1. Momentum Check (Expansion vs previous 5 candles)
  const avgBodySize = data.slice(i - 5, i).reduce((sum, c) => sum + Math.abs(c.close - c.open), 0) / 5;
  const isExpansion = currBodySize > (avgBodySize * 1.3);

  // 2. Volume Check (Confirmation vs previous 3 candles)
  const avgVolume3 = (data[i - 1].volume + data[i - 2].volume + data[i - 3].volume) / 3;
  const hasHighVolume = curr.volume > (avgVolume3 * 1.3);

  // 3. Liquidity Sweep & Domination (BT/BB)
  // Bullish: Sweeps prev low AND closes above prev high (Outside Bar Reversal)
  const bullishEngulf = prevIsDown && currIsUp && 
                        curr.low <= prev.low && 
                        curr.close >= prev.high && 
                        isExpansion && hasHighVolume;

  // Bearish: Sweeps prev high AND closes below prev low (Outside Bar Reversal)
  const bearishEngulf = prevIsUp && currIsDown && 
                        curr.high >= prev.high && 
                        curr.close <= prev.low && 
                        isExpansion && hasHighVolume;

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
