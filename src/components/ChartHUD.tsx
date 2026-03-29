import React from 'react';
import { Shield, Target, Activity, Zap } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChartHUDProps {
  symbol: string;
  trend: 'BULLISH' | 'BEARISH';
  lastAction: 'CHoCH' | 'BOS' | 'NONE';
  nearestShield: { type: string, price: number } | null;
  nearestMagnet: { type: string, price: number } | null;
  isConfluence: boolean;
}

export const ChartHUD: React.FC<ChartHUDProps> = ({ 
  symbol, 
  trend, 
  lastAction, 
  nearestShield, 
  nearestMagnet,
  isConfluence 
}) => {
  const isBullish = trend === 'BULLISH';
  
  return (
    <div className="absolute top-4 left-4 z-[105] flex flex-col gap-2 pointer-events-auto select-none group">
      {/* 💎 AI-ALPHA TACTICAL PILL (Minimalist Default) 💎 */}
      <div className={cn(
        "backdrop-blur-xl bg-black/40 border border-white/10 p-3 rounded-2xl shadow-2xl transition-all duration-300 ring-1 ring-white/5",
        isBullish ? "shadow-emerald-500/10 hover:border-emerald-500/40" : "shadow-rose-500/10 hover:border-rose-500/40"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-2 h-2 rounded-full animate-pulse",
            isBullish ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-400 shadow-[0_0_8px_#f43f5e]"
          )} />
          <div className="flex flex-col">
            <h3 className="text-white/40 font-black tracking-[0.2em] text-[8px] uppercase leading-none mb-1">AI-ALPHA TACTICAL</h3>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-black italic tracking-tighter uppercase", isBullish ? "text-emerald-400" : "text-rose-400")}>
                {trend}
              </span>
              <span className="text-[9px] text-white/40 font-mono tracking-widest uppercase">
                {symbol}
              </span>
            </div>
          </div>
          {/* Action indicator in pill */}
          {lastAction !== 'NONE' && (
            <div className="ml-2 pl-2 border-l border-white/10 flex flex-col items-center">
               <span className="text-[7px] text-white/30 font-bold uppercase leading-none mb-1">State</span>
               <span className="text-[9px] font-black italic text-amber-400 leading-none">{lastAction}</span>
            </div>
          )}
        </div>
      </div>

      {/* 🕵️ ADVANCED RADAR (Revealed on Hover) 🕵️ */}
      <div className="max-h-0 opacity-0 scale-95 overflow-hidden transition-all duration-[600ms] group-hover:max-h-64 group-hover:opacity-100 group-hover:scale-100 flex flex-col gap-2">
        <div className="backdrop-blur-xl bg-black/60 border border-white/10 p-4 rounded-2xl shadow-2xl flex flex-col gap-3 min-w-[220px]">
          <p className="text-[9px] text-white/40 font-black uppercase tracking-[0.2em]">Institutional Radar</p>
          
          {/* Nearest Shield */}
          <div className="flex items-center justify-between gap-6 bg-white/5 p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-emerald-400">
              <Shield className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-tight">Shield</span>
            </div>
            <span className="font-mono text-[11px] text-emerald-300 font-bold">
              {nearestShield ? `$${nearestShield.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'OFF-GRID'}
            </span>
          </div>

          {/* LQD Magnet */}
          <div className="flex items-center justify-between gap-6 bg-white/5 p-2.5 rounded-xl border border-white/5">
            <div className="flex items-center gap-2 text-rose-400">
              <Target className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-tight">Magnet</span>
            </div>
            <span className="font-mono text-[11px] text-rose-300/80 font-bold">
              {nearestMagnet ? `$${nearestMagnet.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : 'OFF-GRID'}
            </span>
          </div>
        </div>

        {/* --- Confluence Alert --- */}
        {isConfluence && (
          <div className="animate-pulse backdrop-blur-xl bg-cyan-500/20 border border-cyan-400/50 p-3 rounded-full flex items-center justify-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" />
            <span className="text-[10px] font-black text-cyan-100 tracking-widest uppercase">Approaching Golden Zone</span>
          </div>
        )}
      </div>
    </div>
  );
};
