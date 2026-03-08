import React from 'react';
import { Info } from 'lucide-react';

interface CoinInfoProps {
  symbol: string;
}

export const CoinInfo: React.FC<CoinInfoProps> = ({ symbol }) => {
  return (
    <div className="bg-white/5 backdrop-blur-md p-3 rounded-md border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <Info className="w-3 h-3 text-indigo-400" />
        <h2 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Asset Profile: {symbol.replace('USDT', '')}</h2>
      </div>
      <p className="text-xs text-gray-300 leading-relaxed font-sans">
        Quantitative algorithmic metrics, historical volume profiles, and liquidity mapping for {symbol.replace('USDT', '')} are actively bridged to the Master account execution engine.
      </p>
    </div>
  );
};
