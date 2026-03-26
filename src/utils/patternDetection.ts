export function isBullishEngulfing(prev: any, curr: any): boolean {
  if (!prev || !curr) return false;

  const isPrevBearish = prev.close < prev.open;
  const isCurrBullish = curr.close > curr.open;

  const engulfsBottom = curr.open <= prev.close;
  const engulfsTop = curr.close >= prev.open;

  return isPrevBearish && isCurrBullish && engulfsBottom && engulfsTop;
}
