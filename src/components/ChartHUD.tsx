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
  // --- 2050 Engine Addition ---
  strikeProbability?: number;
  reasoning?: string[];
  signal?: 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL';
  isNewsProtection?: boolean;
  session?: string;
}

export const ChartHUD: React.FC<ChartHUDProps> = ({ 
  symbol, 
  trend, 
  lastAction, 
  nearestShield, 
  nearestMagnet,
  isConfluence,
  strikeProbability = 0,
  reasoning = [],
  signal = 'NEUTRAL',
  isNewsProtection = false,
  session = 'SCANNING'
}) => {
  const isBullish = trend === 'BULLISH';
  const isStrong = signal !== 'NEUTRAL';
  
  return (
    <div className="absolute top-3 left-3 z-[105] flex flex-col gap-1.5 pointer-events-auto select-none group/hud">
      {/* 💎 AI-ALPHA TACTICAL PILL (MINIMALIST) 💎 */}
      <div className={cn(
        "backdrop-blur-xl bg-black/40 border border-white/10 p-2 rounded-xl shadow-2xl transition-all duration-300 ring-1 ring-white/5",
        isBullish ? "shadow-emerald-500/10 hover:border-emerald-500/40" : "shadow-rose-500/10 hover:border-rose-500/40",
        isStrong && "ring-cyan-500/20 animate-pulse border-cyan-400/40 shadow-cyan-500/20"
      )}>
        <div className="flex items-center gap-2.5">
          <div className="relative">
             <div className={cn(
               "w-2 h-2 rounded-full animate-pulse",
               isBullish ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-400 shadow-[0_0_8px_#f43f5e]",
               isStrong && "bg-cyan-400 shadow-[0_0_10px_#22d3ee]"
             )} />
             {isStrong && (
               <div className="absolute inset-0 rounded-full animate-ping bg-cyan-400/40" />
             )}
          </div>
          <div className="flex flex-col">
            <h3 className="text-white/30 font-black tracking-[0.15em] text-[7px] uppercase leading-none mb-0.5">AI-ALPHA 2050</h3>
            <div className="flex items-center gap-1.5">
              <span className={cn("text-[10px] font-black italic tracking-tighter uppercase", isBullish ? "text-emerald-400" : "text-rose-400")}>
                 {trend}
              </span>
              <span className="text-[8px] text-white/50 font-mono tracking-wider uppercase">
                {symbol}
              </span>
            </div>
          </div>
          {/* Action indicator in pill */}
          {lastAction !== 'NONE' && (
            <div className="ml-1 pl-1.5 border-l border-white/10 flex flex-col items-center">
               <span className="text-[6px] text-white/20 font-bold uppercase leading-none mb-0.5">State</span>
               <span className="text-[8px] font-black italic text-amber-400 leading-none">{lastAction}</span>
            </div>
          )}
          {/* Strike Probability Mini-Pill */}
          {strikeProbability > 0 && (
            <div className="ml-1 pl-1.5 border-l border-white/10 flex flex-col items-end">
               <span className="text-[6px] text-white/20 font-bold uppercase leading-none mb-0.5">Strike</span>
               <span className={cn(
                 "text-[8px] font-black italic leading-none",
                 strikeProbability >= 85 ? "text-cyan-400" : "text-white/80"
               )}>{strikeProbability}%</span>
            </div>
          )}
          {/* Session Badge */}
          <div className="ml-1 pl-1.5 border-l border-white/10 flex flex-col items-start min-w-[35px]">
             <span className="text-[6px] text-white/20 font-bold uppercase leading-none mb-0.5">Session</span>
             <span className="text-[7px] font-black text-white/60 uppercase tracking-tighter">{session}</span>
          </div>
        </div>
      </div>

      {/* 🕵️ ADVANCED RADAR (Revealed on Hover) 🕵️ */}
      <div className="max-h-0 opacity-0 scale-95 overflow-hidden transition-all duration-[500ms] group-hover/hud:max-h-[400px] group-hover/hud:opacity-100 group-hover/hud:scale-100 flex flex-col gap-1.5">
        <div className="backdrop-blur-xl bg-black/60 border border-white/10 p-3 rounded-xl shadow-2xl flex flex-col gap-2.5 min-w-[210px]">
          <div className="flex items-center justify-between">
            <p className="text-[8px] text-white/40 font-black uppercase tracking-[0.15em]">Institutional Matrix</p>
            {isStrong && (
               <div className="px-1 py-0.5 rounded bg-cyan-500/20 border border-cyan-400/30">
                 <span className="text-[6px] font-black text-cyan-400 uppercase tracking-widest">Alpha trigger</span>
               </div>
            )}
          </div>
          
          {/* Tactical Reasoning Chips */}
          <div className="flex flex-wrap gap-1">
            {reasoning.map((r, i) => (
              <div key={i} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/5 flex items-center gap-1">
                <div className="w-[3px] h-[3px] rounded-full bg-white/20" />
                <span className="text-[7px] text-white/50 font-medium uppercase tracking-wider">{r}</span>
              </div>
            ))}
            {reasoning.length === 0 && <span className="text-[7px] text-white/20 uppercase tracking-widest">Scanning Market Voids...</span>}
          </div>

          <div className="grid grid-cols-2 gap-1.5 mt-0.5">
            {/* Nearest Shield */}
            <div className="flex flex-col gap-1 bg-white/[0.03] p-2 rounded-lg border border-white/5 group-hover:border-emerald-500/20 transition-colors">
              <div className="flex items-center gap-1.5 text-emerald-400">
                <Shield className="w-2.5 h-2.5" />
                <span className="text-[7px] font-black uppercase tracking-tight">Shield</span>
              </div>
              <span className="font-mono text-[9px] text-emerald-300/80 font-bold tracking-tight">
                {nearestShield ? `$${nearestShield.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : 'OFF-GRID'}
              </span>
            </div>

            {/* LQD Magnet */}
            <div className="flex flex-col gap-1 bg-white/[0.03] p-2 rounded-lg border border-white/5 group-hover:border-rose-500/20 transition-colors">
              <div className="flex items-center gap-1.5 text-rose-400">
                <Target className="w-2.5 h-2.5" />
                <span className="text-[7px] font-black uppercase tracking-tight">Magnet</span>
              </div>
              <span className="font-mono text-[9px] text-rose-300/70 font-bold tracking-tight">
                {nearestMagnet ? `$${nearestMagnet.price.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : 'OFF-GRID'}
              </span>
            </div>
          </div>
        </div>

        {/* --- Confluence Alert / News Protection --- */}
        {isNewsProtection ? (
          <div className="animate-pulse backdrop-blur-xl bg-amber-500/20 border border-amber-400/40 py-2 px-4 rounded-full flex items-center justify-center gap-1.5 border-dashed">
            <Shield className="w-3 h-3 text-amber-400" />
            <span className="text-[8px] font-black text-amber-200 tracking-widest uppercase italic">News Protection Active</span>
          </div>
        ) : isStrong ? (
          <div className="animate-pulse backdrop-blur-xl bg-cyan-500/20 border border-cyan-400/50 py-2 px-4 rounded-full flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.15)]">
            <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400" />
            <span className="text-[9px] font-black text-cyan-100 tracking-widest uppercase">Strike: {signal}</span>
          </div>
        ) : isConfluence && (
          <div className="animate-pulse backdrop-blur-xl bg-white/5 border border-white/5 py-2 px-4 rounded-full flex items-center justify-center gap-2">
            <Activity className="w-3 h-3 text-white/30" />
            <span className="text-[8px] font-black text-white/30 tracking-widest uppercase italic">Seeking Alpha...</span>
          </div>
        )}
      </div>
    </div>
  );
};
