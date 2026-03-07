import React, { useState, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Info, Loader2 } from 'lucide-react';

interface CoinInfoProps {
  symbol: string;
}

export const CoinInfo: React.FC<CoinInfoProps> = ({ symbol }) => {
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInfo = async () => {
      setLoading(true);
      try {
        const ai = new GoogleGenAI({ apiKey: (import.meta as any).env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY });
        const coin = symbol.replace('USDT', '');
        const prompt = `Provide a very brief, 2-sentence description of the cryptocurrency ${coin} (what it is, its main use case or category). Do not include current price.`;
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: prompt,
        });
        
        setInfo(response.text || 'No description available.');
      } catch (e: any) {
        if (e.message?.includes('429') || e.status === 'RESOURCE_EXHAUSTED') {
          setInfo('Description unavailable (Rate Limit Exceeded).');
        } else {
          console.error('Failed to fetch coin info:', e);
          setInfo('Failed to load coin information.');
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchInfo();
  }, [symbol]);

  return (
    <div className="bg-white/5 backdrop-blur-md p-3 rounded-md border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <Info className="w-3 h-3 text-indigo-400" />
        <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Asset Profile: {symbol.replace('USDT', '')}</h2>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
        </div>
      ) : (
        <p className="text-xs text-gray-300 leading-relaxed font-sans">{info}</p>
      )}
    </div>
  );
};
