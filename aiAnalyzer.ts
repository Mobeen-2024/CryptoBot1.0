import { GoogleGenerativeAI } from "@google/generative-ai";
import { Logger } from "./logger";
import dotenv from "dotenv";

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

/**
 * Generates a trade analysis using Gemini AI.
 * 
 * @param symbol The trading pair (e.g., BTC/USDT).
 * @param side The trade direction ('buy' or 'sell').
 * @param amount The amount to trade.
 * @param price The entry/execution price.
 * @returns A string with the AI analysis, or null if it fails.
 */
export async function analyzeTradeAction(
  symbol: string,
  side: "buy" | "sell",
  amount: number,
  price: number
): Promise<string | null> {
  if (!API_KEY) {
    Logger.error("GEMINI_API_KEY is not set in environment variables.");
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `Analyze this trade action for institutional-grade risk management:
    Symbol: ${symbol}
    Action: ${side.toUpperCase()}
    Amount: ${amount}
    Price: ${price}
    
    Provide a concise assessment of the trade risk and potential outcome.`;

    Logger.info(`Requesting AI Trade Analysis for ${symbol} (${side}) at ${price}...`);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    Logger.info("AI Trade Analysis received successfully.");
    return text || null;
  } catch (error) {
    Logger.error("Failed to generate AI trade analysis:", error);
    return null;
  }
}
