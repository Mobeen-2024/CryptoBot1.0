export interface EngulfingResult {
  isBullish: boolean;
  isBearish: boolean;
  hasHighVolume: boolean;
  isExpansion: boolean;
}

/**
 * Core Identification Logic (Body-to-Body)
 * BT: Body Top (max Open, Close)
 * BB: Body Bottom (min Open, Close)
 */
export function analyzeEngulfing(prev: any, curr: any): EngulfingResult {
  if (!prev || !curr) {
    return { isBullish: false, isBearish: false, hasHighVolume: false, isExpansion: false };
  }

  const prevBT = Math.max(prev.open, prev.close);
  const prevBB = Math.min(prev.open, prev.close);
  const currBT = Math.max(curr.open, curr.close);
  const currBB = Math.min(curr.open, curr.close);

  const prevBodySize = prevBT - prevBB;
  const currBodySize = currBT - currBB;

  // Rule: BT_t >= BT_t-1 AND BB_t <= BB_t-1
  const engulfsTop = currBT >= prevBT;
  const engulfsBottom = currBB <= prevBB;
  const isExpansion = currBodySize > prevBodySize;

  const isEngulfing = engulfsTop && engulfsBottom && isExpansion;

  return {
    isBullish: isEngulfing && curr.close > curr.open,
    isBearish: isEngulfing && curr.close < curr.open,
    hasHighVolume: curr.volume > prev.volume,
    isExpansion
  };
}

// Legacy support (to avoid breaking current imports until refactored)
export function isBullishEngulfing(prev: any, curr: any): boolean {
  return analyzeEngulfing(prev, curr).isBullish;
}
