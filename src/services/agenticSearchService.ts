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
   * Sanitizes and prepares news headlines for Gemini.
   * Removes ads, repetitive disclaimers, and noise.
   */
  public static sanitizeNews(headlines: NewsHeadline[]): string {
    if (!headlines || headlines.length === 0) return "No recent news found.";

    return headlines
      .slice(0, 10) // Limit to top 10 for token efficiency
      .map((h, i) => {
        // Sanitize snippet by removing common ad patterns or noise
        const cleanSnippet = h.snippet
          .replace(/Advertisement|Sponsored|Click here|Read more/gi, '')
          .substring(0, 300); // 300 char limit per snippet
          
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
