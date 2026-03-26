import { describe, it, expect } from "vitest";
import { analyzeTradeAction } from "./aiAnalyzer.ts";
import dotenv from "dotenv";

// Ensure environment variables are loaded
dotenv.config({ quiet: true });

// Only run this test suite if a real Gemini API key is available in the environment.
// Otherwise, it will be skipped automatically.
const hasApiKey = process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'undefined' && process.env.GEMINI_API_KEY !== '';

describe.runIf(hasApiKey)(
  "analyzeTradeAction (Integration)",
  () => {
    // Network calls can take a few seconds, so we increase the timeout to 15 seconds
    it("should hit the real Gemini API and return a trade analysis", async () => {
      // Act
      const result = await analyzeTradeAction("BTC/USDT", "buy", 1.5, 45000);

      // Assert
      // We can't predict the exact text the AI will generate, but we can verify
      // that the API succeeded and returned a non-empty string.
      expect(result).not.toBeNull();
      expect(typeof result).toBe("string");
      expect(result!.length).toBeGreaterThan(10);
    }, 15000);
  },
);
