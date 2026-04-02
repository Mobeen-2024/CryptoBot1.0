import { describe, it, expect } from 'vitest';
import { analyzeEngulfing } from './patternDetection';

describe('analyzeEngulfing (Institutional AI-ALPHA)', () => {
  const mockData = [
    { open: 100, close: 101, high: 102, low: 99, volume: 100 },
    { open: 101, close: 102, high: 103, low: 100, volume: 100 },
    { open: 102, close: 103, high: 104, low: 101, volume: 100 },
    { open: 103, close: 104, high: 105, low: 102, volume: 100 },
    { open: 104, close: 105, high: 106, low: 103, volume: 100 },
    { open: 105, close: 106, high: 107, low: 104, volume: 100 },
    { open: 106, close: 107, high: 108, low: 105, volume: 100 },
    { open: 107, close: 108, high: 109, low: 106, volume: 100 },
    { open: 108, close: 109, high: 110, low: 107, volume: 100 },
    { open: 109, close: 110, high: 111, low: 108, volume: 100 }, // i=9, Avg Body: 1
    { open: 111, close: 109, high: 112, low: 108, volume: 100 }, // i=10 (Prev: Bearish)
    // i=11 (Bullish Engulfing): Sweeps low (107.5 < 108), Closes above high (115 > 112), Vol 200 > 150
    { open: 107.6, close: 115, high: 115.5, low: 107.5, volume: 200 }, 
  ];

  it('should identify a true institutional bullish engulfing (Outside Bar Reversal)', () => {
    const result = analyzeEngulfing(mockData, 11);
    expect(result.isBullish).toBe(true);
    expect(result.hasHighVolume).toBe(true);
    expect(result.isExpansion).toBe(true);
  });

  it('should not identify an engulfing without a liquidity sweep', () => {
    const weakData = [...mockData];
    // Current low (108.1) does NOT sweep previous low (108)
    weakData[11] = { ...mockData[11], low: 108.1 };
    const result = analyzeEngulfing(weakData, 11);
    expect(result.isBullish).toBe(false);
  });

  it('should not identify an engulfing without volume confirmation', () => {
    const lowVolData = [...mockData];
    lowVolData[11] = { ...mockData[11], volume: 100 }; // Volume 100 < 150
    const result = analyzeEngulfing(lowVolData, 11);
    expect(result.isBullish).toBe(false);
  });
});
