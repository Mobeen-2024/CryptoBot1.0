import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Shield, Target, Activity, Zap, X, Cpu, Globe, BarChart3, Fingerprint } from 'lucide-react';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const isBullish = trend === 'BULLISH';
  const isStrong = signal !== 'NEUTRAL';
  
  return (
    <>
      {/* 📱 MOBILE DYNAMIC ISLAND 📱 */}
      <div className="md:hidden absolute top-4 left-0 right-0 z-[150] flex justify-center pointer-events-none">
        <button 
          onClick={() => setIsExpanded(true)}
          className={cn(
            "dynamic-island-pill pointer-events-auto h-10 px-4 flex items-center gap-3 shadow-2xl transition-all duration-500",
            isStrong && "ring-1 ring-cyan-500/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          )}
        >
          <div className="relative">
             <div className={cn(
               "w-2 h-2 rounded-full",
               isBullish ? "bg-emerald-400" : "bg-rose-400",
               isStrong && "bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"
             )} />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white/90">
            {isStrong ? `STRK: ${signal}` : `AI: ${trend}`}
          </span>
          <div className="w-[1px] h-3 bg-white/10" />
          <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">{symbol}</span>
        </button>
      </div>

      {/* 🕵️ MOBILE NEURAL RADAR OVERLAY (Full Screen Blur) 🕵️ */}
      {isExpanded && createPortal(
        <div className="md:hidden fixed inset-0 z-[1000] animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-[#050b14]/90 backdrop-blur-2xl" onClick={() => setIsExpanded(false)} />
          <div className="animate-neural-scan" />
          <div className="cyber-scanline" />
          
          <div className="relative h-full flex flex-col p-6 animate-in zoom-in-95 slide-in-from-top-4 duration-500">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <h2 className="text-[10px] font-black tracking-[0.5em] uppercase text-[var(--holo-cyan)]">Neural_Radar // v2.0</h2>
                <p className="text-[8px] font-mono text-white/30 uppercase mt-1">Institutional Data Stream</p>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/40 active:scale-90 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Main Metric Array */}
            <div className="grid grid-cols-2 gap-4 auto-rows-fr flex-1 overflow-y-auto custom-scrollbar pb-24">
              <div className="col-span-2 bg-white/5 border border-white/10 p-5 rounded-3xl flex flex-col items-center justify-center gap-2 relative overflow-hidden group">
                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/30 to-transparent" />
                <span className="text-[8px] font-black uppercase tracking-widest text-white/30 italic">Strike Probability</span>
                <span className={cn(
                  "text-6xl font-black italic tracking-tighter",
                  strikeProbability >= 85 ? "text-cyan-400 shadow-glow" : "text-white/80"
                )}>{strikeProbability}%</span>
                <span className={cn("text-[10px] font-black uppercase tracking-widest mt-2", isBullish ? "text-emerald-400" : "text-rose-400")}>
                  {trend} PROTOCOL ACTIVE
                </span>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col gap-3">
                <Shield className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-[8px] font-black text-white/20 uppercase mb-1">Protection</p>
                  <p className="text-sm font-black text-emerald-300">
                    {nearestShield ? `$${nearestShield.price.toLocaleString()}` : 'OFF-GRID'}
                  </p>
                </div>
              </div>

              <div className="bg-white/5 border border-white/10 p-4 rounded-3xl flex flex-col gap-3">
                <Target className="w-5 h-5 text-rose-400" />
                <div>
                  <p className="text-[8px] font-black text-white/20 uppercase mb-1">Magnet</p>
                  <p className="text-sm font-black text-rose-300">
                    {nearestMagnet ? `$${nearestMagnet.price.toLocaleString()}` : 'OFF-GRID'}
                  </p>
                </div>
              </div>

              <div className="col-span-2 space-y-3">
                <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] font-mono pl-2">Analytical Constraints</p>
                <div className="space-y-2">
                  {reasoning.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 bg-white/5 border border-white/5 p-4 rounded-2xl group active:bg-white/10 transition-colors">
                      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/5 group-hover:border-[var(--holo-cyan)]/30 transition-colors">
                        <Fingerprint className="w-4 h-4 text-white/20 group-hover:text-[var(--holo-cyan)] transition-colors" />
                      </div>
                      <span className="text-[10px] text-white/60 font-medium uppercase tracking-widest leading-tight">{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Status Footer */}
            <div className="absolute bottom-10 left-6 right-6 p-4 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-[var(--holo-cyan)] animate-ping" />
                 <span className="text-[8px] font-mono text-white/40 uppercase tracking-widest">Neural Link Sync: 99.8%</span>
              </div>
              <span className="text-[8px] font-black text-[var(--holo-gold)] tracking-widest uppercase">{session}</span>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 💎 DESKTOP HOLOGRAPHIC HUD 💎 */}
      <div className="hidden md:flex absolute top-4 left-4 z-[105] flex-col gap-2 pointer-events-auto select-none group/hud scale-90 origin-top-left hover:scale-100 transition-transform duration-500">
          {/* Main Pill Row */}
          <div className={cn(
            "backdrop-blur-xl bg-black/40 border border-white/10 p-2.5 rounded-2xl shadow-2xl transition-all duration-500 hover:bg-black/60",
            isStrong && "ring-1 ring-cyan-500/30 border-cyan-400/40 shadow-[0_0_30px_rgba(34,211,238,0.1)]"
          )}>
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-2 mb-1">
                   <div className={cn(
                     "w-1.5 h-1.5 rounded-full",
                     isBullish ? "bg-emerald-400 shadow-[0_0_8px_#34d399]" : "bg-rose-400 shadow-[0_0_8px_#f43f5e]",
                     isStrong && "bg-cyan-400 shadow-[0_0_10px_#22d3ee] animate-pulse"
                   )} />
                   <h3 className="text-white/20 font-black tracking-[0.4em] text-[7px] uppercase leading-none">AI-ALPHA // 2050</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-black italic tracking-tighter uppercase", isBullish ? "text-emerald-400" : "text-rose-400")}>
                     {trend} <span className="text-[8px] text-white/20 ml-1 font-mono">{symbol}</span>
                  </span>
                </div>
              </div>

              {strikeProbability > 0 && (
                <div className="pl-4 border-l border-white/10">
                   <p className="text-[6px] text-white/20 font-black uppercase tracking-widest mb-0.5">Strike</p>
                   <p className={cn("text-sm font-black italic leading-none", strikeProbability >= 85 ? "text-cyan-400" : "text-white/80")}>
                    {strikeProbability}%
                   </p>
                </div>
              )}

              <div className="pl-4 border-l border-white/10 min-w-[50px]">
                 <p className="text-[6px] text-white/20 font-black uppercase tracking-widest mb-0.5">Session</p>
                 <p className="text-[9px] font-black text-white/60 uppercase tracking-tighter">{session}</p>
              </div>
            </div>
          </div>

          {/* Holographic Radar Grid (Desktop Hover) */}
          <div className="max-h-0 opacity-0 scale-95 overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover/hud:max-h-[500px] group-hover/hud:opacity-100 group-hover/hud:scale-100 flex flex-col gap-2">
            <div className="holo-data-grid rounded-2xl overflow-hidden p-[1px]">
              <div className="grid grid-cols-2 gap-[1px]">
                {/* Shield Cell */}
                <div className="holo-data-cell flex flex-col gap-2 group-hover:bg-emerald-500/5 transition-colors">
                   <div className="flex items-center justify-between">
                     <Shield className="w-2.5 h-2.5 text-emerald-400" />
                     <span className="text-[6px] text-white/20 uppercase tracking-widest font-black">Shield Prot.</span>
                   </div>
                   <span className="text-[11px] font-black font-mono text-emerald-300">
                    {nearestShield ? `$${nearestShield.price.toLocaleString()}` : 'OFF-GRID'}
                   </span>
                </div>

                {/* Magnet Cell */}
                <div className="holo-data-cell flex flex-col gap-2 group-hover:bg-rose-500/5 transition-colors">
                   <div className="flex items-center justify-between">
                     <Target className="w-2.5 h-2.5 text-rose-400" />
                     <span className="text-[6px] text-white/20 uppercase tracking-widest font-black">LQD Magnet</span>
                   </div>
                   <span className="text-[11px] font-black font-mono text-rose-300">
                    {nearestMagnet ? `$${nearestMagnet.price.toLocaleString()}` : 'OFF-GRID'}
                   </span>
                </div>

                {/* Reasoning Array */}
                <div className="col-span-2 holo-data-cell min-h-[60px] flex flex-col gap-2">
                  <span className="text-[6px] text-white/20 uppercase tracking-widest font-black">Analytical Logic Matrix</span>
                  <div className="flex flex-wrap gap-1">
                    {reasoning.map((r, i) => (
                      <div key={i} className="px-1.5 py-0.5 rounded-md bg-white/5 border border-white/5 flex items-center gap-1.5 hover:border-[var(--holo-cyan)]/30 transition-all cursor-default group/chip">
                        <div className="w-[3px] h-[3px] rounded-full bg-[var(--holo-cyan)]/40 group-hover/chip:animate-ping" />
                        <span className="text-[7px] text-white/50 font-black uppercase tracking-[0.1em]">{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Alert Stripe */}
            <div className={cn(
              "px-4 py-2 rounded-xl flex items-center justify-center gap-2 border shadow-lg transition-all",
              isNewsProtection ? "bg-amber-500/20 border-amber-400/40 animate-pulse" : 
              isStrong ? "bg-cyan-500/20 border-cyan-400/40 animate-pulse shadow-cyan-500/20" : 
              "bg-white/5 border-white/10"
            )}>
              {isNewsProtection ? <Globe className="w-3 h-3 text-amber-400" /> : <BarChart3 className="w-3 h-3 text-white/40" />}
              <span className="text-[8px] font-black uppercase tracking-[0.3em] text-white/60">
                {isNewsProtection ? "News Protocol Active" : isStrong ? "Institutional Confluence High" : "Scanning Market Voids"}
              </span>
            </div>
          </div>
      </div>
    </>
  );
};
