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
    <div className="absolute top-4 left-4 z-50 flex flex-col gap-3 pointer-events-none select-none">
      {/* --- Macro State Box --- */}
      <div className={cn(
        "backdrop-blur-md bg-slate-900/60 border-l-4 p-4 rounded-r-xl shadow-2xl transition-all duration-500",
        isBullish ? "border-emerald-500 shadow-emerald-500/10" : "border-rose-500 shadow-rose-500/10"
      )}>
        <div className="flex items-center gap-3 mb-2">
          <Activity className={cn("w-5 h-5", isBullish ? "text-emerald-400" : "text-rose-400")} />
          <h3 className="text-slate-100 font-bold tracking-wider text-sm">AI-ALPHA TACTICAL</h3>
          <span className="text-[10px] text-slate-400 font-mono tracking-tighter px-1.5 py-0.5 border border-slate-700 rounded bg-slate-800/50 uppercase">
            {symbol}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Structure</p>
            <p className={cn("text-lg font-black italic tracking-tighter", isBullish ? "text-emerald-400" : "text-rose-400")}>
              {trend}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-0.5">Sequence</p>
            <p className="text-lg font-black italic tracking-tighter text-amber-400">
              {lastAction !== 'NONE' ? lastAction : 'STABLE'}
            </p>
          </div>
        </div>
      </div>

      {/* --- Liquidity Radar --- */}
      <div className="backdrop-blur-md bg-slate-900/40 border border-slate-700/50 p-3 rounded-xl flex flex-col gap-2 min-w-[220px]">
        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] px-1">Institutional Radar</p>
        
        {/* Nearest Shield */}
        <div className="flex items-center justify-between gap-4 bg-slate-800/30 p-2 rounded-lg border border-slate-700/30">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-slate-300 font-medium">Nearest Shield</span>
          </div>
          <span className="font-mono text-[11px] text-emerald-300">
            {nearestShield ? `$${nearestShield.price.toLocaleString()}` : 'SCANNING...'}
          </span>
        </div>

        {/* Nearest Magnet */}
        <div className="flex items-center justify-between gap-4 bg-slate-800/30 p-2 rounded-lg border border-slate-700/30">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-rose-400/80" />
            <span className="text-[11px] text-slate-300 font-medium">LQD Magnet</span>
          </div>
          <span className="font-mono text-[11px] text-rose-300/80">
            {nearestMagnet ? `$${nearestMagnet.price.toLocaleString()}` : 'SCANNING...'}
          </span>
        </div>
      </div>

      {/* --- Confluence Alert --- */}
      {isConfluence && (
        <div className="animate-pulse backdrop-blur-md bg-cyan-500/20 border border-cyan-400/50 px-3 py-1.5 rounded-full flex items-center gap-2">
          <Zap className="w-4 h-4 text-cyan-400 fill-cyan-400" />
          <span className="text-[11px] font-bold text-cyan-100 tracking-wide uppercase">Approaching Golden Zone</span>
        </div>
      )}
    </div>
  );
};
