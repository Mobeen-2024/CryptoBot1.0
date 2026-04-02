import { describe, it, expect, vi, beforeEach } from "vitest";
import { analyzeTradeAction } from "./aiAnalyzer.ts";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Logger } from "./logger"; // Adjust path if necessary

// 1. Mock the Logger to prevent our test from spamming the console
vi.mock("./logger", () => ({
  Logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// 2. Mock the @google/generative-ai SDK
vi.mock("@google/generative-ai", () => {
  const generateContentMock = vi.fn();
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: generateContentMock,
      }),
    })),
    __generateContentMock: generateContentMock,
  };
});

describe("analyzeTradeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return a mocked AI analysis on success", async () => {
    // Arrange: Set up our mock to return a specific response
    const { __generateContentMock } = (await import("@google/generative-ai")) as any;
    __generateContentMock.mockResolvedValueOnce({
      response: {
        text: () => "Mocked AI analysis: High risk trade.",
      },
    });

    // Act
    const result = await analyzeTradeAction("BTC/USDT", "buy", 1.5, 45000);

    // Assert
    expect(__generateContentMock).toHaveBeenCalledTimes(1);
    expect(result).toBe("Mocked AI analysis: High risk trade.");
    expect(Logger.info).toHaveBeenCalledWith(
      expect.stringContaining("AI Trade Analysis"),
    );
  });

  it("should return null and log an error if the API call fails", async () => {
    // Arrange: Simulate an API failure (e.g., network error or quota exceeded)
    const { __generateContentMock } = (await import("@google/generative-ai")) as any;
    __generateContentMock.mockRejectedValueOnce(
      new Error("API Quota Exceeded"),
    );

    // Act
    const result = await analyzeTradeAction("ETH/USDT", "sell", 10, 3000);

    // Assert
    expect(__generateContentMock).toHaveBeenCalledTimes(1);
    expect(result).toBeNull();
    expect(Logger.error).toHaveBeenCalledWith(
      "Failed to generate AI trade analysis:",
      expect.any(Error),
    );
  });
});
