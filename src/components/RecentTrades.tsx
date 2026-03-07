import React from 'react';
import { format } from 'date-fns';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

interface Trade {
  id: number;
  price: string;
  quantity: string;
  time: number;
  isBuyerMaker: boolean;
  slippage?: number;
}

interface RecentTradesProps {
  trades: Trade[];
}

export const RecentTrades: React.FC<RecentTradesProps> = ({ trades }) => {
  return (
    <div className="flex flex-col h-full text-[11px] font-mono">
      <div className="flex justify-between text-gray-500 mb-1 px-2 uppercase tracking-wider text-[9px]">
        <span className="w-1/4">Price</span>
        <span className="w-1/4 text-right">Amount</span>
        <span className="w-1/4 text-right">Slippage</span>
        <span className="w-1/4 text-right">Time</span>
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {trades.map((trade) => {
          // Mock slippage for demo if not provided natively by the stream
          const mockSlippage = trade.slippage ?? (Math.random() * 0.05 - 0.01);
          
          return (
            <div 
              key={trade.id} 
              className={`flex justify-between items-center px-2 py-[3px] transition-colors hover:bg-white/5 ${trade.isBuyerMaker ? 'animate-flash-sell' : 'animate-flash-buy'}`}
            >
              <div className="flex items-center gap-1 w-1/4">
                {trade.isBuyerMaker ? 
                  <ArrowDownRight className="w-3 h-3 text-rose-500" /> : 
                  <ArrowUpRight className="w-3 h-3 text-emerald-500" />
                }
                <span className={trade.isBuyerMaker ? 'text-rose-500' : 'text-emerald-500'}>
                  {parseFloat(trade.price).toFixed(2)}
                </span>
              </div>
              <span className="text-gray-300 w-1/4 text-right">{parseFloat(trade.quantity).toFixed(4)}</span>
              <span className={`w-1/4 text-right font-mono ${mockSlippage > 0 ? 'text-rose-400 opacity-90' : 'text-emerald-400 opacity-90'}`}>
                {mockSlippage > 0 ? '+' : ''}{mockSlippage.toFixed(3)}%
              </span>
              <span className="text-gray-500 w-1/4 text-right">{format(trade.time, 'HH:mm:ss')}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
