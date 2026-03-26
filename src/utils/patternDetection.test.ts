import { describe, it, expect } from 'vitest';
import { isBullishEngulfing } from './patternDetection';

describe('isBullishEngulfing', () => {
  it('should identify a true bullish engulfing pattern', () => {
    const prev = { open: 100, close: 90, high: 105, low: 85 }; // Bearish
    const curr = { open: 89, close: 101, high: 106, low: 84 }; // Bullish, engulfs body
    expect(isBullishEngulfing(prev, curr)).toBe(true);
  });

  it('should identify an engulfing pattern with equal boundaries', () => {
    const prev = { open: 100, close: 90 };
    const curr = { open: 90, close: 100 };
    expect(isBullishEngulfing(prev, curr)).toBe(true);
  });

  it('should not identify if previous is bullish', () => {
    const prev = { open: 90, close: 100 };
    const curr = { open: 89, close: 101 };
    expect(isBullishEngulfing(prev, curr)).toBe(false);
  });

  it('should not identify if current is bearish', () => {
    const prev = { open: 100, close: 90 };
    const curr = { open: 95, close: 85 };
    expect(isBullishEngulfing(prev, curr)).toBe(false);
  });

  it('should not identify if current does not engulf bottom', () => {
    const prev = { open: 100, close: 80 };
    const curr = { open: 85, close: 105 };
    expect(isBullishEngulfing(prev, curr)).toBe(false);
  });

  it('should not identify if current does not engulf top', () => {
    const prev = { open: 100, close: 80 };
    const curr = { open: 75, close: 95 };
    expect(isBullishEngulfing(prev, curr)).toBe(false);
  });
});
