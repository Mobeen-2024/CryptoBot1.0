export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Pattern {
  type: string;
  label: string;
  color: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  description: string;
}

export function detectPatterns(data: Candle[], i: number): Pattern[] {
  if (i < 2) return [];

  const curr = data[i];
  const prev = data[i - 1];
  const prev2 = data[i - 2];

  const patterns: Pattern[] = [];

  // --- Shared Logic ---
  const bodySize = Math.abs(curr.close - curr.open);
  const totalRange = curr.high - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const isUp = curr.close > curr.open;
  const isDown = curr.close < curr.open;

  const prevBodySize = Math.abs(prev.close - prev.open);
  const prevTotalRange = prev.high - prev.low;
  const prevIsUp = prev.close > prev.open;
  const prevIsDown = prev.close < prev.open;

  const prev2IsUp = prev2.close > prev2.open;
  const prev2IsDown = prev2.close < prev2.open;

  // --- 1. Doji Variants ---
  const isDoji = totalRange > 0 && bodySize <= (totalRange * 0.1);
  const isDragonfly = isDoji && lowerWick > (totalRange * 0.6) && upperWick < (totalRange * 0.1);
  const isGravestone = isDoji && upperWick > (totalRange * 0.6) && lowerWick < (totalRange * 0.1);

  if (isDragonfly) {
    patterns.push({ type: 'DRAGONFLY_DOJI', label: 'Dragonfly', color: '#00E5FF', sentiment: 'bullish', description: 'Dragonfly Doji: Potential bullish reversal at support.' });
  } else if (isGravestone) {
    patterns.push({ type: 'GRAVESTONE_DOJI', label: 'Gravestone', color: '#FF007F', sentiment: 'bearish', description: 'Gravestone Doji: Potential bearish reversal at resistance.' });
  } else if (isDoji) {
    patterns.push({ type: 'DOJI', label: 'Doji', color: '#848e9c', sentiment: 'neutral', description: 'Doji: Market indecision.' });
  }

  // --- 2. Engulfing Bar ---
  const isBullEngulf = prevIsDown && isUp && curr.open <= prev.close && curr.close >= prev.open && bodySize > prevBodySize;
  const isBearEngulf = prevIsUp && isDown && curr.open >= prev.close && curr.close <= prev.open && bodySize > prevBodySize;

  if (isBullEngulf) {
    patterns.push({ type: 'BULLISH_ENGULFING', label: 'Engulfing', color: '#00FF9D', sentiment: 'bullish', description: 'Bullish Engulfing: Buyers overwhelmed sellers.' });
  }
  if (isBearEngulf) {
    patterns.push({ type: 'BEARISH_ENGULFING', label: 'Engulfing', color: '#FF007F', sentiment: 'bearish', description: 'Bearish Engulfing: Sellers overwhelmed buyers.' });
  }

  // --- 3. Pin Bars (Hammer & Shooting Star) ---
  const isHammer = lowerWick >= (bodySize * 2) && upperWick < (bodySize * 0.5) && totalRange > 0;
  const isShootingStar = upperWick >= (bodySize * 2) && lowerWick < (bodySize * 0.5) && totalRange > 0;

  if (isHammer) {
    patterns.push({ type: 'HAMMER', label: 'Hammer', color: '#00FF9D', sentiment: 'bullish', description: 'Hammer: Potential bullish reversal after a downtrend.' });
  }
  if (isShootingStar) {
    patterns.push({ type: 'SHOOTING_STAR', label: 'Shoot Star', color: '#FF007F', sentiment: 'bearish', description: 'Shooting Star: Potential bearish reversal after an uptrend.' });
  }

  // --- 4. Morning & Evening Stars ---
  // Morning: Large Bear -> Small Body -> Large Bull (closes above 50% of 1st)
  const isMorningStar = prev2IsDown && prevBodySize < (prevTotalRange * 0.3) && isUp && curr.close > (prev2.open + prev2.close) / 2;
  // Evening: Large Bull -> Small Body -> Large Bear (closes below 50% of 1st)
  const isEveningStar = prev2IsUp && prevBodySize < (prevTotalRange * 0.3) && isDown && curr.close < (prev2.open + prev2.close) / 2;

  if (isMorningStar) {
    patterns.push({ type: 'MORNING_STAR', label: 'M. Star', color: '#2962FF', sentiment: 'bullish', description: 'Morning Star: Three-candle bullish reversal pattern.' });
  }
  if (isEveningStar) {
    patterns.push({ type: 'EVENING_STAR', label: 'E. Star', color: '#FF6D00', sentiment: 'bearish', description: 'Evening Star: Three-candle bearish reversal pattern.' });
  }

  // --- 5. Harami (Inside Bar) ---
  const isHarami = curr.high < prev.high && curr.low > prev.low;
  if (isHarami) {
    patterns.push({ type: 'HARAMI', label: 'Harami', color: '#AA00FF', sentiment: 'neutral', description: 'Harami: Inside bar indicating potential volatility contraction or reversal.' });
  }

  // --- 6. Tweezers ---
  const isTweezerTop = prevIsUp && isDown && Math.abs(curr.high - prev.high) < (totalRange * 0.05);
  const isTweezerBottom = prevIsDown && isUp && Math.abs(curr.low - prev.low) < (totalRange * 0.05);

  if (isTweezerTop) {
    patterns.push({ type: 'TWEEZER_TOP', label: 'Tw. Top', color: '#880E4F', sentiment: 'bearish', description: 'Tweezer Top: Two candles with matching highs, signaling resistance.' });
  }
  if (isTweezerBottom) {
    patterns.push({ type: 'TWEEZER_BOTTOM', label: 'Tw. Bottom', color: '#00BFA5', sentiment: 'bullish', description: 'Tweezer Bottom: Two candles with matching lows, signaling support.' });
  }

  return patterns;
}
