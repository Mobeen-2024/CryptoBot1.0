import { describe, it, expect } from 'vitest';
import { analyzeEngulfing } from './patternDetection';

describe('analyzeEngulfing (Institutional AI-ALPHA)', () => {
  const mockData = [
    { open: 100, close: 101, high: 102, low: 99, volume: 100 },
    { open: 101, close: 102, high: 103, low: 100, volume: 100 },
    { open: 102, close: 103, high: 104, low: 101, volume: 100 },
    { open: 103, close: 104, high: 105, low: 102, volume: 100 },
    { open: 104, close: 105, high: 106, low: 103, volume: 100 }, // Avg Body: 1
    { open: 106, close: 104, high: 107, low: 103, volume: 100 }, // Prev: Bearish
    // Bullish Engulfing: Sweeps low (102.5 < 103), Closes above high (106.5 > 107), Volume 200 > 130
    { open: 102.6, close: 108, high: 108.5, low: 102.5, volume: 200 }, 
  ];

  it('should identify a true institutional bullish engulfing (Outside Bar Reversal)', () => {
    const result = analyzeEngulfing(mockData, 6);
    expect(result.isBullish).toBe(true);
    expect(result.hasHighVolume).toBe(true);
    expect(result.isExpansion).toBe(true);
  });

  it('should not identify an engulfing without a liquidity sweep', () => {
    const weakData = [...mockData];
    // Current low (103.1) does NOT sweep previous low (103)
    weakData[6] = { ...mockData[6], low: 103.1 };
    const result = analyzeEngulfing(weakData, 6);
    expect(result.isBullish).toBe(false);
  });

  it('should not identify an engulfing without volume confirmation', () => {
    const lowVolData = [...mockData];
    lowVolData[6] = { ...mockData[6], volume: 100 }; // Volume 100 < 130
    const result = analyzeEngulfing(lowVolData, 6);
    expect(result.isBullish).toBe(false);
  });
});
