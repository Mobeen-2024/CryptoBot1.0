import { Logger } from '../../logger';

export interface NewsHeadline {
  title: string;
  source: string;
  url: string;
  timestamp: string;
  snippet: string;
}

export class AgenticSearchService {
  /**
   * Fetches real-time crypto news.
   * Mocked for Phase 11 implementation, but designed for API integration.
   */
  public static async fetchTopHeadlines(symbol: string): Promise<NewsHeadline[]> {
    Logger.info(`[SEARCH] Scraping institutional news for ${symbol}...`);
    
    // Simulating real-world headlines found in recent search
    return [
      {
        title: "Bitcoin price struggles below $66k as ETF outflows hit $173M",
        source: "CoinTelegraph",
        url: "https://ct.com/news/1",
        timestamp: new Date().toISOString(),
        snippet: "BTC continues to face downward pressure as spot ETF demand shifts from massive inflows to net outflows, signaling cautious institutional sentiment."
      },
      {
        title: "Geopolitical tensions in Middle East trigger risk-off sentiment",
        source: "Bloomberg Crypto",
        url: "https://bloomberg.com/crypto",
        timestamp: new Date().toISOString(),
        snippet: "Escalating conflicts are driving investors out of risk assets. Bitcoin is testing critical support at $64,500 amid a broader market liquidation of $420M."
      },
      {
        title: "Bybit Proof-of-Reserves shows overcollateralized BTC/USDT holdings",
        source: "Investing.com",
        url: "https://investing.com/crypto",
        timestamp: new Date().toISOString(),
        snippet: "Bybit's latest PoR report confirms solvency, providing a small floor of stability despite the prevailing bearish sentiment across retail cohorts."
      }
    ];
  }

  /**
   * Sanitizes and prepares news headlines for Gemini.
   * Removes ads, repetitive disclaimers, and noise.
   */
  public static sanitizeNews(headlines: NewsHeadline[]): string {
    if (!headlines || headlines.length === 0) return "No recent news found.";

    return headlines
      .slice(0, 10)
      .map((h, i) => {
        const cleanSnippet = h.snippet
          .replace(/Advertisement|Sponsored|Click here|Read more/gi, '')
          .substring(0, 300);
          
        return `[${i+1}] SOURCE: ${h.source} | TITLE: ${h.title} | SNIPPET: ${cleanSnippet}`;
      })
      .join('\n---\n');
  }

  /**
   * Constructs the structured prompt for Gemini sentiment analysis.
   */
  public static createSentimentPrompt(symbol: string, sanitizedNews: string): string {
    return `
You are the "Bot Pilot" Reasoning Kernel for an institutional trading agent. 
Your goal is to analyze the following news headlines for ${symbol} and provide a structured JSON response.

CRITICAL RULES:
1. Sentiment Score: Output exactly between -1.0 (extreme bearish/panic) and 1.0 (extreme bullish/hype).
2. Confidence Score: Output between 0.0 and 1.0. If news is ambiguous, use a low confidence.
3. Reasoning: Provide a one-sentence technical justification for the bias.
4. ATR Override Check: If the news mentions a "Flash Crash", "Hack", or "Sudden Liquidity Drain", flag as HIGH_RISK.

HEADLINES TO ANALYZE:
${sanitizedNews}

RESPONSE FORMAT (JSON ONLY):
{
  "sentiment": number,
  "confidence": number,
  "reasoningSnippet": "string",
  "isHighRisk": boolean
}
    `.trim();
  }
}
