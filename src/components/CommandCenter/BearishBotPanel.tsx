import React, { useState, useEffect } from 'react';
import { TrendingDown, Calculator } from 'lucide-react';

interface BearishBotPanelProps {
  masterEntryPrice: number; // Anchor Price from Master
}

export const BearishBotPanel: React.FC<BearishBotPanelProps> = ({ masterEntryPrice }) => {
  const [averagePrice, setAveragePrice] = useState<number>(0);
  
  // Math: 
  // Half = (Average + Entry) / 2
  // Diff = abs(Half - Entry)
  // SL = Entry + 2 * Diff
  // TP = Average
  
  const halfPrice = (Number(averagePrice) + Number(masterEntryPrice)) / 2;
  const diff = Math.abs(halfPrice - Number(masterEntryPrice));
  const suggestedSL = Number(masterEntryPrice) + (2 * diff);
  const suggestedTP = Number(averagePrice);

  return (
    <div className="flex-1 shrink-0 glass-panel backdrop-blur-xl border border-white/5 rounded-2xl p-5 w-full min-w-[300px] max-w-[360px] flex flex-col text-white shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[var(--holo-magenta)]/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--holo-magenta)]/20 to-orange-500/20 border border-white/10 flex items-center justify-center shadow-[0_4px_20px_rgba(244,63,94,0.15)] shrink-0">
          <TrendingDown className="w-5 h-5 text-[var(--holo-magenta)]" />
        </div>
        <div>
          <h2 className="text-sm font-black tracking-widest text-[#eaecef] uppercase">Bearish Bot</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] font-bold uppercase text-gray-500 flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--holo-magenta)] animate-pulse" />
              Sell High ➔ Buy Low
            </span>
          </div>
        </div>
      </div>

      {/* Form Body */}
      <div className="flex flex-col gap-4 relative z-10">
        
        {/* 1. Master Entry Field (Read Only or Sync) */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Master Entry Price</label>
          <div className="relative border border-white/5 rounded-xl bg-black/40 px-3 py-2.5 shadow-inner">
            <span className="text-gray-500 font-mono text-sm mr-2">$</span>
            <span className="font-mono font-bold text-sm text-[var(--holo-cyan)]">{masterEntryPrice.toFixed(4)}</span>
          </div>
        </div>

        {/* 2. Average Price Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Average Price (TP Target)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
            <input 
              type="number"
              value={averagePrice || ''}
              onChange={(e) => setAveragePrice(Number(e.target.value))}
              placeholder="0.00"
              className="w-full bg-black/60 border border-white/10 text-white font-mono font-bold text-sm rounded-xl pl-6 pr-3 py-2.5 outline-none focus:border-[var(--holo-magenta)]/50 transition-colors shadow-inner"
            />
          </div>
        </div>

        {/* 3. Mathematical Output Box */}
        <div className="mt-2 bg-[var(--holo-magenta)]/5 border border-[var(--holo-magenta)]/20 rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--holo-magenta)] mb-1">
            <Calculator className="w-3.5 h-3.5" /> Voltron Math
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">Half Price</span>
            <span className="font-mono text-gray-300">${halfPrice.toFixed(4)}</span>
          </div>
          
          <div className="flex justify-between items-center text-xs">
            <span className="text-gray-500 font-medium">Difference (x2)</span>
            <span className="font-mono text-gray-300">${(diff * 2).toFixed(4)}</span>
          </div>

          <div className="h-px w-full bg-white/10 my-1" />

          <div className="flex justify-between items-center text-sm font-bold">
            <span className="text-[var(--holo-magenta)]">Calculated SL</span>
            <span className="font-mono text-[var(--holo-magenta)]">${suggestedSL.toFixed(4)}</span>
          </div>
          <div className="flex justify-between items-center text-sm font-bold">
            <span className="text-[var(--holo-cyan)]">Calculated TP</span>
            <span className="font-mono text-[var(--holo-cyan)]">${suggestedTP.toFixed(4)}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
