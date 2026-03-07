import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { BrainCircuit, Loader2, Activity } from 'lucide-react';

interface AIAgentPanelProps {
  marketData: any[];
  symbol: string;
}

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ marketData, symbol }) => {
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [confidence, setConfidence] = useState<number>(0);

  const analyzeMarket = async () => {
    setLoading(true);
    setAnalysis('');
    setConfidence(0);
    try {
      const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
      
      const recentData = marketData.slice(-50).map(d => ({
        time: new Date(d.time * 1000).toISOString(),
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close,
      }));

      const prompt = `You are an expert cryptocurrency trader and technical analyst. 
      Analyze the following recent 50 candlestick data points for ${symbol}.
      Provide a concise summary of the current trend, key support/resistance levels, and a trading recommendation (BUY, SELL, or HOLD) with reasoning.
      Also, provide a confidence score between 0 and 100 on the last line in the format "CONFIDENCE: 85".
      Format your response in Markdown.
      
      Data:
      ${JSON.stringify(recentData, null, 2)}`;

      const response = await ai.models.generateContentStream({
        model: "gemini-3.1-pro-preview",
        contents: prompt,
      });

      let fullText = '';
      for await (const chunk of response) {
        const c = chunk as any;
        if (c.text) {
          fullText += c.text;
          
          // Extract confidence if present
          const confidenceMatch = fullText.match(/CONFIDENCE:\s*(\d+)/i);
          if (confidenceMatch) {
            setConfidence(parseInt(confidenceMatch[1], 10));
            // Remove confidence from displayed text
            setAnalysis(fullText.replace(/CONFIDENCE:\s*\d+/i, '').trim());
          } else {
            setAnalysis(fullText);
          }
        }
      }
    } catch (error: any) {
      console.error('AI Analysis Error:', error);
      if (error.message?.includes('429') || error.status === 'RESOURCE_EXHAUSTED') {
        setAnalysis('Analysis unavailable due to API rate limits. Please try again later.');
      } else {
        setAnalysis('Failed to generate analysis. Please check your API key and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/5 backdrop-blur-md p-3 rounded-md border border-white/10 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BrainCircuit className="text-indigo-400 w-4 h-4" />
          <h2 className="text-sm font-semibold text-white tracking-wider uppercase">Streaming Insight</h2>
        </div>
        <div className="flex items-center gap-3">
          {confidence > 0 && (
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-gray-400">CONFIDENCE</span>
              <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={`h-full ${confidence > 70 ? 'bg-emerald-500' : confidence > 40 ? 'bg-yellow-500' : 'bg-rose-500'}`} 
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-white">{confidence}%</span>
            </div>
          )}
          <button
            onClick={analyzeMarket}
            disabled={loading || marketData.length === 0}
            className="bg-white/10 hover:bg-white/20 text-white px-3 py-1 rounded text-xs font-mono transition-colors disabled:opacity-50 flex items-center gap-2 border border-white/10"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'ANALYZE'}
          </button>
        </div>
      </div>

      <div className="flex-1 bg-black/40 border border-white/5 rounded p-3 overflow-y-auto font-mono text-xs">
        {analysis ? (
          <div className="prose prose-invert prose-sm max-w-none">
            {analysis.split('\n').map((line, i) => (
              <p key={i} className="mb-1 text-gray-300 leading-relaxed">{line}</p>
            ))}
            {loading && <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-1 align-middle" />}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-600">
            <Activity className="w-8 h-8 mb-2 opacity-20" />
            <p>Awaiting market data analysis...</p>
          </div>
        )}
      </div>
    </div>
  );
};
