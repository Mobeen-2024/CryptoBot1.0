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

// --- Context Helpers ---
const isUptrend = (data: Candle[], i: number, lookback = 3) => {
  if (i < lookback || i >= data.length) return false;
  let higherCloses = 0;
  for (let j = i - lookback + 1; j <= i; j++) {
    if (data[j].close > data[j - 1].close) higherCloses++;
  }
  return higherCloses >= 2;
};

const isDowntrend = (data: Candle[], i: number, lookback = 3) => {
  if (i < lookback || i >= data.length) return false;
  let lowerCloses = 0;
  for (let j = i - lookback + 1; j <= i; j++) {
    if (data[j].close < data[j - 1].close) lowerCloses++;
  }
  return lowerCloses >= 2;
};

export function detectPatterns(data: Candle[], i: number): Pattern[] {
  if (i < 2) return [];

  const curr = data[i];
  const prev = data[i - 1];
  const prev2 = data[i - 2];

  const patterns: Pattern[] = [];

  // --- Metrics ---
  const bodySize = Math.abs(curr.close - curr.open);
  const totalRange = curr.high - curr.low;
  const upperWick = curr.high - Math.max(curr.open, curr.close);
  const lowerWick = Math.min(curr.open, curr.close) - curr.low;
  const isUp = curr.close > curr.open;
  const isDown = curr.close < curr.open;
  const bodyMid = (curr.open + curr.close) / 2;

  const prevBodySize = Math.abs(prev.close - prev.open);
  const prevTotalRange = prev.high - prev.low;
  const prevIsUp = prev.close > prev.open;
  const prevIsDown = prev.close < prev.open;
  const prevBodyMid = (prev.open + prev.close) / 2;
  const prevBT = Math.max(prev.open, prev.close); // prev body top
  const prevBB = Math.min(prev.open, prev.close); // prev body bottom

  const prev2IsDown = prev2.close < prev2.open;
  const prev2IsUp = prev2.close > prev2.open;

  // --- 1. Marubozu (Power Pattern) ---
  const isMarubozu = totalRange > 0 && (bodySize / totalRange) >= 0.95;
  if (isMarubozu) {
    patterns.push({
      type: isUp ? 'BULLISH_MARUBOZU' : 'BEARISH_MARUBOZU',
      label: 'Marubozu',
      color: isUp ? '#00FF9D' : '#FF007F',
      sentiment: isUp ? 'bullish' : 'bearish',
      description: `Marubozu: Strong ${isUp ? 'buying' : 'selling'} pressure with almost no wicks.`
    });
  }

  // --- 2. Pin Bars & Reversals (Hammer, Hanging Man, Shooting Star, Inverted Hammer) ---
  const isPinBarShape = lowerWick >= (bodySize * 2) && upperWick <= (bodySize * 0.5) && totalRange > 0;
  const isInvPinBarShape = upperWick >= (bodySize * 2) && lowerWick <= (bodySize * 0.5) && totalRange > 0;

  if (isPinBarShape && isDowntrend(data, i)) {
    patterns.push({ type: 'HAMMER', label: 'Hammer', color: '#00FF9D', sentiment: 'bullish', description: 'Hammer: Potential bullish reversal after a downtrend.' });
  } else if (isPinBarShape && isUptrend(data, i)) {
    patterns.push({ type: 'HANGING_MAN', label: 'Hang Man', color: '#FF007F', sentiment: 'bearish', description: 'Hanging Man: Bearish reversal sign at the top of an uptrend.' });
  }

  if (isInvPinBarShape && isUptrend(data, i)) {
    patterns.push({ type: 'SHOOTING_STAR', label: 'Shoot Star', color: '#FF007F', sentiment: 'bearish', description: 'Shooting Star: Bearish reversal after an uptrend.' });
  } else if (isInvPinBarShape && isDowntrend(data, i)) {
    patterns.push({ type: 'INVERTED_HAMMER', label: 'Inv Hammer', color: '#00FF9D', sentiment: 'bullish', description: 'Inverted Hammer: Potential bullish reversal at support.' });
  }

  // --- 3. Doji Variants ---
  const isDoji = totalRange > 0 && bodySize <= (totalRange * 0.1);
  const isDragonfly = isDoji && lowerWick > (totalRange * 0.6) && upperWick < (totalRange * 0.1);
  const isGravestone = isDoji && upperWick > (totalRange * 0.6) && lowerWick < (totalRange * 0.1);

  if (isDragonfly) {
    patterns.push({ type: 'DRAGONFLY_DOJI', label: 'Dragonfly', color: '#00E5FF', sentiment: 'bullish', description: 'Dragonfly Doji: Rejection of lower prices.' });
  } else if (isGravestone) {
    patterns.push({ type: 'GRAVESTONE_DOJI', label: 'Gravestone', color: '#FF007F', sentiment: 'bearish', description: 'Gravestone Doji: Rejection of higher prices.' });
  } else if (isDoji) {
    patterns.push({ type: 'DOJI', label: 'Doji', color: '#848e9c', sentiment: 'neutral', description: 'Doji: Market indecision.' });
  }

  // --- 4. Engulfing Bars (Trend-Aware) ---
  const isBullEngulf = isDowntrend(data, i) && prevIsDown && isUp && curr.open <= prev.close && curr.close >= prev.open && bodySize > prevBodySize;
  const isBearEngulf = isUptrend(data, i) && prevIsUp && isDown && curr.open >= prev.close && curr.close <= prev.open && bodySize > prevBodySize;

  if (isBullEngulf) {
    patterns.push({ type: 'BULLISH_ENGULFING', label: 'Engulfing', color: '#00FF9D', sentiment: 'bullish', description: 'Bullish Engulfing: Buyers completely overwhelmed sellers.' });
  } else if (isBearEngulf) {
    patterns.push({ type: 'BEARISH_ENGULFING', label: 'Engulfing', color: '#FF007F', sentiment: 'bearish', description: 'Bearish Engulfing: Sellers completely overwhelmed buyers.' });
  }

  // --- 5. Piercing Line & Dark Cloud Cover ---
  const isPiercingLine = isDowntrend(data, i) && prevIsDown && isUp && curr.open < prev.low && curr.close > prevBodyMid;
  const isDarkCloud = isUptrend(data, i) && prevIsUp && isDown && curr.open > prev.high && curr.close < prevBodyMid;

  if (isPiercingLine) {
    patterns.push({ type: 'PIERCING_LINE', label: 'Piercing', color: '#00FF9D', sentiment: 'bullish', description: 'Piercing Line: Closes deep into previous red body.' });
  }
  if (isDarkCloud) {
    patterns.push({ type: 'DARK_CLOUD', label: 'Dark Cloud', color: '#FF007F', sentiment: 'bearish', description: 'Dark Cloud Cover: Closes deep into previous green body.' });
  }

  // --- 6. Harami (Body-in-Body) ---
  const isHarami = Math.max(curr.open, curr.close) < prevBT && Math.min(curr.open, curr.close) > prevBB;
  if (isHarami) {
    const isBullHarami = isDowntrend(data, i) && prevIsDown && isUp;
    const isBearHarami = isUptrend(data, i) && prevIsUp && isDown;
    if (isBullHarami) {
      patterns.push({ type: 'BULL_HARAMI', label: 'Harami', color: '#AA00FF', sentiment: 'bullish', description: 'Bullish Harami: Momentum stalled after downtrend.' });
    } else if (isBearHarami) {
      patterns.push({ type: 'BEAR_HARAMI', label: 'Harami', color: '#AA00FF', sentiment: 'bearish', description: 'Bearish Harami: Momentum stalled after uptrend.' });
    } else {
       patterns.push({ type: 'HARAMI', label: 'Inside Bar', color: '#848e9c', sentiment: 'neutral', description: 'Harami: Volatility contraction.' });
    }
  }

  // --- 7. Morning & Evening Stars ---
  const isMorningStar = isDowntrend(data, i) && prev2IsDown && prevBodySize < (prevTotalRange * 0.4) && isUp && curr.close > (prev2.open + prev2.close) / 2;
  const isEveningStar = isUptrend(data, i) && prev2IsUp && prevBodySize < (prevTotalRange * 0.4) && isDown && curr.close < (prev2.open + prev2.close) / 2;

  if (isMorningStar) {
    patterns.push({ type: 'MORNING_STAR', label: 'M. Star', color: '#2962FF', sentiment: 'bullish', description: 'Morning Star: Three-candle bullish reversal.' });
  } else if (isEveningStar) {
    patterns.push({ type: 'EVENING_STAR', label: 'E. Star', color: '#FF6D00', sentiment: 'bearish', description: 'Evening Star: Three-candle bearish reversal.' });
  }

  // --- 8. Three Soldiers / Crows ---
  if (i >= 3) {
    const isThreeWhiteSoldiers = isUp && (data[i-1].close > data[i-1].open) && (data[i-2].close > data[i-2].open) &&
                               curr.close > data[i-1].close && data[i-1].close > data[i-2].close;
    
    const isThreeBlackCrows = isDown && (data[i-1].close < data[i-1].open) && (data[i-2].close < data[i-2].open) &&
                             curr.close < data[i-1].close && data[i-1].close < data[i-2].close;

    if (isThreeWhiteSoldiers && isDowntrend(data, i-2)) {
      patterns.push({ type: 'THREE_SOLDIERS', label: 'Soldiers', color: '#00E676', sentiment: 'bullish', description: 'Three White Soldiers: Strong trend reversal.' });
    }
    if (isThreeBlackCrows && isUptrend(data, i-2)) {
      patterns.push({ type: 'THREE_CROWS', label: 'Crows', color: '#D50000', sentiment: 'bearish', description: 'Three Black Crows: Strong trend reversal.' });
    }
  }

  // --- 9. Tweezers ---
  const isTweezerHigh = Math.abs(curr.high - prev.high) < (totalRange * 0.05);
  const isTweezerLow = Math.abs(curr.low - prev.low) < (totalRange * 0.05);

  if (isTweezerHigh && isUptrend(data, i)) {
    patterns.push({ type: 'TWEEZER_TOP', label: 'Tw. Top', color: '#880E4F', sentiment: 'bearish', description: 'Tweezer Top at resistance.' });
  }
  if (isTweezerLow && isDowntrend(data, i)) {
    patterns.push({ type: 'TWEEZER_BOTTOM', label: 'Tw. Bottom', color: '#00BFA5', sentiment: 'bullish', description: 'Tweezer Bottom at support.' });
  }

  return patterns;
}
