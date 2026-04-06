import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntelligenceService } from './intelligenceService';

// Mock GoogleGenerativeAI
const mockGetGenerativeModel = vi.fn().mockImplementation((config) => ({
  generateContent: vi.fn().mockResolvedValue({
    response: {
      text: () => config.model === 'gemini-3-flash-live' 
        ? JSON.stringify({ engage: true, reason: 'Test Reason' })
        : JSON.stringify({ sentiment: 0.5, confidence: 0.9, reasoningSnippet: 'Test' })
    }
  }),
  model: config.model
}));

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: mockGetGenerativeModel
  }))
}));

// Mock Logger
vi.mock('../../logger', () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('IntelligenceService', () => {
  let service: IntelligenceService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = IntelligenceService.getInstance();
    // Clear data between tests (since it's a singleton)
    (service as any).data = new Map();
  });

  describe('setGeminiKey', () => {
    it('should initialize three distinct kernels', () => {
      mockGetGenerativeModel.mockClear();
      service.setGeminiKey('test-key');
      expect(mockGetGenerativeModel).toHaveBeenCalledTimes(3);
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-3.1-flash-lite' }, { apiVersion: 'v1' });
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemma-3-27b' }, { apiVersion: 'v1' });
      expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-3-flash-live' }, { apiVersion: 'v1' });
    });
  });

  describe('applyHedgeConsensus', () => {
    it('should return true when live kernel approves hedge', async () => {
      service.setGeminiKey('test-key');
      const result = await service.applyHedgeConsensus('BTC/USDT', 50000, 49950);
      expect(result).toBe(true);
    });
  });


  describe('updateATR', () => {
    it('should correctly calculate ATR from OHLCV data', () => {
      // 15 candles: [time, open, high, low, close, volume]
      // tr = max(high-low, high-prevClose, low-prevClose)
      // tr = (105-95) = 10 for each (simpified)
      const ohlcv: number[][] = Array(15).fill(0).map((_, i) => [
        i, 100, 105, 95, 100, 1000
      ]);
      
      service.updateATR('BTC/USDT', ohlcv);
      const intel = service.getIntelligence('BTC/USDT');
      expect(intel?.atr).toBe(10);
    });

    it('should not update ATR if data is insufficient (< 15)', () => {
      const ohlcv: number[][] = Array(10).fill([0, 100, 105, 95, 100, 1000]);
      service.updateATR('BTC/USDT', ohlcv);
      const intel = service.getIntelligence('BTC/USDT');
      expect(intel?.atr).toBeUndefined();
    });
  });

  describe('recommendOffset', () => {
    const symbol = 'BTC/USDT';

    it('should increase offset by 1.5x in HIGH_VOLATILITY regime', () => {
      const intel = {
        sentiment: 0,
        sentimentConfidence: 0.5,
        regime: 'HIGH_VOLATILITY' as any,
        volatilityScore: 80,
        liquidityScore: 20,
        lastUpdate: Date.now()
      };
      
      const offset = service.recommendOffset(10, intel, 'buy');
      expect(offset).toBe(15);
    });

    it('should tighten offset if sentiment is opposite to position with high confidence', () => {
      const intel = {
        sentiment: -0.8, // Bearish
        sentimentConfidence: 0.8, // High confidence
        regime: 'STABLE_TREND' as any,
        volatilityScore: 30,
        liquidityScore: 70,
        lastUpdate: Date.now()
      };
      
      // LONG position (buy) with Bearish sentiment -> Tighten trigger
      const offset = service.recommendOffset(10, intel, 'buy');
      expect(offset).toBe(7); // 10 * 0.7
    });

    it('should trigger ATR surge override for safety', () => {
      const intel = {
        sentiment: 1.0, // Bullish bias
        sentimentConfidence: 0.9,
        atr: 25, // ATR is > 2x baseOffset (25 > 20)
        regime: 'STABLE_TREND' as any,
        volatilityScore: 30,
        lastUpdate: Date.now(),
        liquidityScore: 70
      };
      
      const offset = service.recommendOffset(10, intel, 'buy');
      expect(offset).toBe(5); // 10 * 0.5 (surge override)
    });
  });

  describe('getFrictionOffset', () => {
    it('should return dynamic friction based on ATR', () => {
      const ohlcv = Array(15).fill(0).map((_, i) => [i, 100, 110, 90, 100, 1000]); // 20 point TR
      service.updateATR('BTC/USDT', ohlcv);
      
      const frictionBuy = service.getFrictionOffset('buy', 'BTC/USDT', 1.0);
      expect(frictionBuy).toBe(20);
      
      const frictionSell = service.getFrictionOffset('sell', 'BTC/USDT', 1.0);
      expect(frictionSell).toBe(-20);
    });

    it('should return default friction if ATR is missing', () => {
      const friction = service.getFrictionOffset('buy', 'UNKNOWN', 1.0);
      expect(friction).toBe(2);
    });
  });

  describe('calculateRequiredHedge', () => {
    const entryA = 50000;
    const entryB = 49950; // 50 USDT offset for LONG
    const qtyA = 1.0;
    const slA = 49500; // Sample SL

    it('should return 0 if trigger price not reached (LONG case)', () => {
      const hedge = service.calculateRequiredHedge(49960, entryA, entryB, qtyA, 'buy', slA);
      expect(hedge).toBe(0);
    });

    it('should return qtyA if trigger price is hit (LONG case)', () => {
      const hedge = service.calculateRequiredHedge(49950, entryA, entryB, qtyA, 'buy', slA);
      expect(hedge).toBe(qtyA);
    });

    it('should return qtyA if trigger price is hit (SHORT case)', () => {
      const entryBShort = 50050; // 50 USDT offset for SHORT
      const slAShort = 50500;
      const hedge = service.calculateRequiredHedge(50051, entryA, entryBShort, qtyA, 'sell', slAShort);
      expect(hedge).toBe(qtyA);
    });
  });
});
