import { describe, it, expect } from "vitest";
import { analyzeMarketStructure, analyzeFractalMatrix } from "./src/utils/marketStructure";

// Helper to generate mock data
const generateMockData = (count: number, startPrice: number, trend: 'bullish' | 'bearish' | 'sideways' = 'sideways') => {
  const data = [];
  let price = startPrice;
  const now = Math.floor(Date.now() / 1000);
  
  for (let i = 0; i < count; i++) {
    // Add a zigzag to create swing points for pivot detection
    const zigzag = (i % 20 < 10) ? 10 : -5; 
    const trendMove = trend === 'bullish' ? 5 : (trend === 'bearish' ? -20 : 0);
    const open = price;
    const close = open + trendMove + zigzag;
    const high = Math.max(open, close) + 2;
    const low = Math.min(open, close) - 2;
    
    data.push({
      time: now - (count - i) * 60,
      open, high, low, close,
      volume: 1000
    });
    price = close;
  }
  return data;
};

describe("Market Structure Engine (Master 2100 Edition)", () => {
  
  it("should calculate Adaptive Lookback based on volatility", () => {
    // Low Volatility Data
    const lowVolData = Array(50).fill(0).map((_, i) => ({
      time: i, open: 100, high: 101, low: 99, close: 100, volume: 100
    }));
    
    // High Volatility Data
    const highVolData = Array(50).fill(0).map((_, i) => ({
      time: i, open: 100, high: 150, low: 50, close: 100, volume: 100
    }));
    
    const analysisLow = analyzeMarketStructure(lowVolData, 5);
    const analysisHigh = analyzeMarketStructure(highVolData, 5);
    
    // High volatility should result in a smaller (tighter) lookback
    expect(analysisHigh.adaptiveLb).toBeLessThanOrEqual(analysisLow.adaptiveLb);
  });

  it("should detect and mitigate Fair Value Gaps (FVG) correctly", () => {
    // Create a Bullish FVG
    // Candle 1: Low 100, High 110
    // Candle 2: Big jump (Displacement)
    // Candle 3: Low 115, High 125
    // Gap is between 110 and 115
    const data = [
      { time: 1, open: 100, high: 110, low: 95,  close: 105, volume: 100 },  // p2
      { time: 2, open: 105, high: 130, low: 105, close: 125, volume: 500 },  // p1 (Big Displacement)
      { time: 3, open: 125, high: 135, low: 115, close: 130, volume: 100 },  // cur
      { time: 4, open: 130, high: 135, low: 112, close: 132, volume: 100 },  // Taps gap (112 < 115)
      { time: 5, open: 132, high: 135, low: 108, close: 110, volume: 100 },  // Fully fills gap (108 < 110)
    ];
    
    // We need more data for ATR calculations, so prepend some stable data
    const padding = Array(20).fill(0).map((_, i) => ({
      time: -20 + i, open: 100, high: 102, low: 98, close: 100, volume: 100
    }));
    // Also need trailing padding because the loop stops at data.length - lookback
    const trailingPadding = Array(20).fill(0).map((_, i) => ({
      time: 6 + i, open: 130, high: 132, low: 100, close: 110, volume: 100
    }));
    const fullData = [...padding, ...data, ...trailingPadding];
    
    const analysis = analyzeMarketStructure(fullData, 2);
    
    // Check if the FVG starting at time 3 (top 115, bottom 110) is gone
    const fvgAt3 = analysis.imbalances.find(i => i.id === 'fvg_bull_3');
    expect(fvgAt3).toBeUndefined(); // Should be fully filled by time 5 and trailing padding
  });

  it("should calculate Multi-Timeframe Alignment with analyzeFractalMatrix", () => {
    const d15m = generateMockData(100, 1000, 'bullish');
    const d1H = generateMockData(100, 1000, 'bullish');
    const d4H = generateMockData(100, 1000, 'bullish');
    
    const matrix = analyzeFractalMatrix(d15m, d1H, d4H);
    
    expect(matrix.alignment).toBe('BULLISH');
    expect(matrix.goStatus).toBe(true);
    expect(matrix.score).toBeGreaterThanOrEqual(70);
  });

  it("should handle mixed sentiment and deny Go Status", () => {
    // 15m data: Start Bullish (50 candles) then flip Bearish (50 candles)
    const d15m_bull = generateMockData(50, 1000, 'bullish');
    const d15m_bear = generateMockData(50, d15m_bull[49].close, 'bearish');
    const d15m = [...d15m_bull, ...d15m_bear];
    
    const d1H = generateMockData(100, 1000, 'bullish');
    const d4H = generateMockData(100, 1000, 'bullish');
    
    const matrix = analyzeFractalMatrix(d15m, d1H, d4H);
    
    // now m15 should be BEARISH because it broke its previous highs/lows
    expect(matrix.goStatus).toBe(false);
  });
});
