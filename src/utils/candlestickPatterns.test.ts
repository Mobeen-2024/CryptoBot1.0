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

  const createTrendData = (type: 'up' | 'down', length: number, startPrice: number): Candle[] => {
    const candles: Candle[] = [];
    let price = startPrice;
    for (let i = 0; i < length; i++) {
        const open = price;
        const close = type === 'up' ? price + 2 : price - 2;
        const high = Math.max(open, close) + 0.5;
        const low = Math.min(open, close) - 0.5;
        candles.push({ time: i, open, close, high, low, volume: 100 });
        price = close;
    }
    return candles;
  };

  it('should identify a Hammer at the bottom of a downtrend', () => {
    // Need 7+ candles for isDowntrend
    const history = createTrendData('down', 10, 100);
    const last = history[history.length - 1];
    // Hammer: Long lower wick, small body
    const hammerCandle: Candle = { 
        time: 11, 
        open: last.close - 5, 
        close: last.close - 4, 
        high: last.close - 3.5, 
        low: last.close - 10, // 6 point wick vs 1 point body
        volume: 100 
    };
    const data = [...history, hammerCandle];
    const patterns = detectPatterns(data, data.length - 1);
    const hammer = patterns.find(p => p.type === 'HAMMER');
    expect(hammer).toBeDefined();
  });

  it('should identify a Hanging Man at the top of an uptrend', () => {
    const history = createTrendData('up', 10, 50);
    const last = history[history.length - 1];
    // Hanging Man: Same shape as hammer but after uptrend
    const hangingMan: Candle = { 
        time: 11, 
        open: last.close + 5, 
        close: last.close + 6, 
        high: last.close + 6.5, 
        low: last.close, // 5 point wick vs 1 point body
        volume: 100 
    };
    const data = [...history, hangingMan];
    const patterns = detectPatterns(data, data.length - 1);
    const hangingManPattern = patterns.find(p => p.type === 'HANGING_MAN');
    expect(hangingManPattern).toBeDefined();
  });

  it('should identify Institutional Bullish Engulfing after strict downtrend', () => {
    const history = createTrendData('down', 12, 200); // 12 candles to satisfy i >= 10
    const prev = history[history.length - 1];
    // prev: open 178, close 176, high 178.5, low 175.5
    
    // Institutional Bullish Engulfing: Sweeps low, Domination, Expansion, Volume
    const engulfingCandle: Candle = { 
        time: 13, 
        open: 175.8, 
        close: 185, // Direct domination (185 > 178.5)
        high: 185.5, 
        low: 174,   // Sweeps prev.low (174 < 175.5)
        volume: 500 // High volume (> 1.5 * avg)
    };
    const data = [...history, engulfingCandle];
    const patterns = detectPatterns(data, data.length - 1);
    const engulf = patterns.find(p => p.type === 'BULLISH_ENGULFING');
    expect(engulf).toBeDefined();
    expect(engulf?.description).toContain('Institutional');
  });

  it('should identify Three White Soldiers', () => {
    const history = createTrendData('down', 8, 100);
    // 3 Solders
    const s1: Candle = { time: 9, open: 85, close: 90, high: 91, low: 84, volume: 100 };
    const s2: Candle = { time: 10, open: 89, close: 94, high: 95, low: 88, volume: 100 };
    const s3: Candle = { time: 11, open: 93, close: 98, high: 99, low: 92, volume: 100 };
    
    const data = [...history, s1, s2, s3];
    const patterns = detectPatterns(data, data.length - 1);
    const soldiers = patterns.find(p => p.type === 'THREE_SOLDIERS');
    expect(soldiers).toBeDefined();
  });
});
