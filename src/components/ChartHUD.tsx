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
      {/* ─── Macro State Box (The "Tactical Pill") ────────────────── */}
      <div className={cn(
        "backdrop-blur-xl bg-[#0b0f1a]/60 border-l-4 p-2.5 rounded-r-2xl shadow-2xl transition-all duration-500 cursor-pointer group-hover:bg-[#0b0f1a]/80",
        isBullish ? "border-emerald-500 shadow-emerald-500/10" : "border-rose-500 shadow-rose-500/10"
      )}>
        <div className="flex items-center gap-2.5">
          <Activity className={cn("w-3.5 h-3.5", isBullish ? "text-emerald-400" : "text-rose-400")} />
          <div className="flex flex-col">
            <h3 className="text-white/40 font-black tracking-[0.2em] text-[8px] uppercase leading-none mb-1">AI-ALPHA TACTICAL</h3>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-black italic tracking-tighter", isBullish ? "text-emerald-400" : "text-rose-400")}>
                {trend}
              </span>
              <span className="text-[8px] text-white/20 font-mono font-bold uppercase px-1.5 py-0.5 border border-white/5 rounded bg-white/[0.02]">
                {symbol}
              </span>
            </div>
          </div>
        </div>
        
        {/* Sequence label (only visible in pill if active) */}
        {lastAction !== 'NONE' && (
          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between group-hover:hidden transition-opacity duration-300">
            <span className="text-[7px] text-white/20 uppercase font-black tracking-widest">Latest</span>
            <span className="text-[9px] font-black italic text-amber-400/80">{lastAction}</span>
          </div>
        )}
      </div>

      {/* ─── Advanced Insights (Stealth Reveal on Hover) ──────────── */}
      <div className="max-h-0 opacity-0 scale-95 origin-top transition-all duration-500 group-hover:max-h-[500px] group-hover:opacity-100 group-hover:scale-100 flex flex-col gap-2 overflow-hidden pointer-events-auto">
        <div className="backdrop-blur-xl bg-[#0b0f1a]/40 border border-white/5 p-2.5 rounded-2xl flex flex-col gap-2 min-w-[180px] shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <p className="text-[7px] text-white/30 font-black uppercase tracking-[0.3em] px-1 mb-1">Institutional Radar</p>
          
          <div className="flex items-center justify-between gap-4 bg-white/[0.03] p-2 rounded-xl border border-white/5 transition-colors hover:bg-white/[0.05]">
            <div className="flex items-center gap-2 text-emerald-400">
              <Shield className="w-2.5 h-2.5" />
              <span className="text-[9px] font-black uppercase tracking-tighter">Shield</span>
            </div>
            <span className="font-mono text-[10px] text-emerald-300 font-bold">
              {nearestShield ? `$${nearestShield.price.toLocaleString()}` : (nearestShield === null ? 'SCANNING...' : '---')}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 bg-white/[0.03] p-2 rounded-xl border border-white/5 transition-colors hover:bg-white/[0.05]">
            <div className="flex items-center gap-2 text-rose-400/80">
              <Target className="w-2.5 h-2.5" />
              <span className="text-[9px] font-black uppercase tracking-tighter">Magnet</span>
            </div>
            <span className="font-mono text-[10px] text-rose-300/80 font-bold">
              {nearestMagnet ? `$${nearestMagnet.price.toLocaleString()}` : (nearestMagnet === null ? 'SCANNING...' : '---')}
            </span>
          </div>
        </div>

        {/* --- Confluence Alert --- */}
        {isConfluence && (
          <div className="animate-pulse backdrop-blur-md bg-cyan-500/20 border border-cyan-400/50 px-3 py-2 rounded-full flex items-center gap-2 shadow-[0_0_15px_rgba(34,211,238,0.1)]">
            <Zap className="w-3 h-3 text-cyan-400 fill-cyan-400" />
            <span className="text-[9px] font-black text-cyan-100 tracking-widest uppercase">Approaching Golden Zone</span>
          </div>
        )}
      </div>
    </div>
  );
};
