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

  const prevIsUp = prev.close > prev.open;
  const prevIsDown = prev.close < prev.open;
  const currIsUp = curr.close > curr.open;
  const currIsDown = curr.close < curr.open;

  const prevBT = Math.max(prev.open, prev.close);
  const prevBB = Math.min(prev.open, prev.close);
  const currBT = Math.max(curr.open, curr.close);
  const currBB = Math.min(curr.open, curr.close);

  const prevBodySize = prevBT - prevBB;
  const currBodySize = currBT - currBB;

  // CTB Rule: Current body MUST fully engulf previous body
  const engulfsBody = currBT >= prevBT && currBB <= prevBB;
  const isExpansion = currBodySize > prevBodySize;

  const bullishEngulf = prevIsDown && currIsUp && engulfsBody;
  const bearishEngulf = prevIsUp && currIsDown && engulfsBody;

  return {
    isBullish: bullishEngulf,
    isBearish: bearishEngulf,
    hasHighVolume: curr.volume > prev.volume,
    isExpansion: isExpansion
  };
}

// Legacy support (to avoid breaking current imports until refactored)
export function isBullishEngulfing(prev: any, curr: any): boolean {
  return analyzeEngulfing(prev, curr).isBullish;
}
