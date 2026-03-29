import { describe, it, expect } from 'vitest';
import { detectPatterns, Candle } from './candlestickPatterns';

describe('detectPatterns', () => {
  const createMockData = (closes: number[]): Candle[] => {
    return closes.map((c, i) => ({
      time: i,
      open: closes[i-1] || c,
      close: c,
      high: Math.max(c, closes[i-1] || c) + 1,
      low: Math.min(c, closes[i-1] || c) - 1,
      volume: 100
    }));
  };

  it('should identify a Hammer at the bottom of a downtrend', () => {
    const data: Candle[] = [
      { time: 1, open: 100, close: 90, high: 101, low: 89, volume: 100 },
      { time: 2, open: 90, close: 80, high: 91, low: 79, volume: 100 },
      { time: 3, open: 80, close: 70, high: 81, low: 69, volume: 100 },
      // Hammer: Long lower wick, small body, after downtrend
      { time: 4, open: 65, close: 66, high: 66.5, low: 60, volume: 100 },
    ];
    const patterns = detectPatterns(data, 3);
    const hammer = patterns.find(p => p.type === 'HAMMER');
    expect(hammer).toBeDefined();
  });

  it('should identify a Hanging Man at the top of an uptrend', () => {
    const data: Candle[] = [
      { time: 1, open: 60, close: 70, high: 71, low: 59, volume: 100 },
      { time: 2, open: 70, close: 80, high: 81, low: 69, volume: 100 },
      { time: 3, open: 80, close: 90, high: 91, low: 79, volume: 100 },
      // Hanging Man: Same shape as hammer but after uptrend
      { time: 4, open: 95, close: 96, high: 96.5, low: 90, volume: 100 },
    ];
    const patterns = detectPatterns(data, 3);
    const hangingMan = patterns.find(p => p.type === 'HANGING_MAN');
    expect(hangingMan).toBeDefined();
  });

  it('should identify Institutional Bullish Engulfing after strict downtrend', () => {
    const data: Candle[] = [
      { time: 1, open: 110, close: 108, high: 111, low: 107, volume: 100 },
      { time: 2, open: 108, close: 106, high: 109, low: 105, volume: 100 },
      { time: 3, open: 106, close: 104, high: 107, low: 103, volume: 100 },
      { time: 4, open: 104, close: 102, high: 105, low: 101, volume: 100 },
      { time: 5, open: 102, close: 100, high: 103, low: 99, volume: 100 },
      { time: 6, open: 100, close: 98, high: 101, low: 97, volume: 100 },
      { time: 7, open: 98, close: 96, high: 99, low: 95, volume: 100 }, // Clear 7-candle downtrend
      { time: 8, open: 96, close: 94, high: 97, low: 93, volume: 100 }, // prevCandle
      // Institutional Bullish Engulfing: Sweeps low (92.5 < 93), Domination (100 > 97), Volume 300
      { time: 9, open: 94.1, close: 100, high: 100.5, low: 92.5, volume: 300 },
    ];
    const patterns = detectPatterns(data, 8);
    const engulf = patterns.find(p => p.type === 'BULLISH_ENGULFING');
    expect(engulf).toBeDefined();
    expect(engulf?.description).toContain('liquidity sweep');
  });

  it('should identify Three White Soldiers', () => {
    const data: Candle[] = [
      { time: 1, open: 60, close: 58, high: 61, low: 57, volume: 100 },
      { time: 2, open: 58, close: 56, high: 59, low: 55, volume: 100 },
      { time: 3, open: 56, close: 54, high: 57, low: 53, volume: 100 }, // Downtrend confirmed
      { time: 4, open: 55, close: 60, high: 61, low: 54, volume: 100 }, // Soldier 1
      { time: 5, open: 59, close: 64, high: 65, low: 58, volume: 100 }, // Soldier 2
      { time: 6, open: 63, close: 68, high: 69, low: 62, volume: 100 }, // Soldier 3
    ];
    const patterns = detectPatterns(data, 5);
    const soldiers = patterns.find(p => p.type === 'THREE_SOLDIERS');
    expect(soldiers).toBeDefined();
  });
});
