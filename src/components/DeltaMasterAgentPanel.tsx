import React, { useState, useEffect, useRef, useMemo } from 'react';
import toast from 'react-hot-toast';
import { Shield, Zap, TrendingUp, TrendingDown, Activity, StopCircle, Play, ShieldCheck, Wind, TerminalSquare, AlertTriangle, Crosshair, BarChart2, Lock } from 'lucide-react';
import { cn } from '../utils/cn';

interface DeltaEvent {
  id: string;
  type: string;
  message: string;
  timestamp: number;
  metadata?: any;
}

interface DeltaMasterState {
  isActive: boolean;
  phase: string;
  pnlA: number;
  pnlB: number;
  netPnl: number;
  lastPrice: number;
  entryA: number;
  entryB: number;
  symbol: string;
  liqPriceA: number;
  hedgeRatio: number;
  availableMarginB: number;
  dmsStatus: string;
  tpTiers: { price: number; qty: number; status: 'waiting' | 'filled'; tier: number }[];
  slOrder: { id: string; price: number; qty: number; status: 'open' | 'filled' | 'closed'; isBreakEven: boolean } | null;
  botState: string;
  marginStats?: {
    accountA: { balance: number; used: number; free: number; pnlPct: number };
    accountB: { balance: number; used: number; free: number; pnlPct: number };
  };
  distanceToHedge?: number;
  events: DeltaEvent[];
  hedgeStrategy?: 'OFF' | 'MIRROR' | 'DELAYED' | 'GRID_HEDGE' | 'DYNAMIC';
  gridLayers?: number;
  gridGapPct?: number;
  intelligence?: {
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
    atr?: number;
    dynamicFriction?: number;
    executionAdvisory?: {
      friction: number;
      offset: number;
      reason: string;
    };
  };
  hedgeScore?: number;
  scoreComponents?: {
    distance: number;
    volatility: number;
    drawdown: number;
    ai: number;
  };
  hedgeCycleLocked?: boolean;
  hedgeCooldownUntil?: number;
}

const MicroSparkline = React.memo(({ data, color }: { data: number[], color: string }) => {
  if (data.length < 2) return <div className="h-4 w-full bg-white/5 animate-pulse rounded-sm" />;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const height = 16;
  const width = 80;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="drop-shadow-[0_0_3px_rgba(0,229,255,0.5)]"
        style={{ filter: `drop-shadow(0 0 2px ${color}80)` }}
      />
    </svg>
  );
});

const RiskMeterCircular = React.memo(({ risk, margin, volatility }: { risk: number; margin: number; volatility: string }) => {
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (risk / 100) * circumference;
  
  const color = risk > 70 ? '#f43f5e' : risk > 40 ? '#f59e0b' : '#10b981';

  return (
    <div className="flex flex-col items-center gap-3 p-4 bg-black/40 rounded-2xl border border-white/5 backdrop-blur-md">
      <div className="relative flex items-center justify-center">
        <svg className="w-20 h-20 -rotate-90">
          <circle cx="40" cy="40" r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
          <circle 
            cx="40" cy="40" r={radius} fill="none" 
            stroke={color} strokeWidth="6" 
            strokeDasharray={circumference} 
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="circular-progress-arc"
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-sm font-black font-mono tracking-tighter" style={{ color }}>{risk.toFixed(0)}%</span>
          <span className="text-[6px] font-black uppercase text-white/30 tracking-widest">Risk</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 w-full">
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-black uppercase text-white/20 tracking-widest">Margin</span>
          <span className="text-[10px] font-bold font-mono text-white/80">{margin}%</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-[7px] font-black uppercase text-white/20 tracking-widest">Volatility</span>
          <span className="text-[10px] font-bold font-mono text-white/80 uppercase">{volatility}</span>
        </div>
      </div>
    </div>
  );
});

const AIKernelStatus = React.memo(({ intel, isActive }: { intel?: DeltaMasterState['intelligence']; isActive: boolean }) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-black/40 rounded-xl border border-white/5">
      <div className="flex items-center justify-between border-b border-white/5 pb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Intelligence Stack</span>
        <Activity className="w-3 h-3 text-[var(--holo-cyan)] animate-pulse" />
      </div>
      <div className="flex flex-col gap-1.5">
        {[
          { name: 'Research', model: 'gemini-3.1-flash-lite', status: intel?.regime ? 'ACTIVE' : 'STANDBY' },
          { name: 'Execution', model: 'gemma-3-27b', status: intel?.executionAdvisory ? 'OPTIMIZING' : 'STANDBY' },
          { name: 'Live', model: 'gemini-3-flash-live', status: isActive ? 'ACTIVE' : 'STANDBY' }
        ].map(kernel => (
          <div key={kernel.name} className="flex items-center justify-between text-[9px]">
            <div className="flex items-center gap-2">
              <div className={cn("w-1.5 h-1.5 rounded-full", kernel.status === 'STANDBY' ? "bg-white/10" : "bg-emerald-500 shadow-[0_0_5px_#10b981] animate-pulse")} />
              <span className="font-black uppercase tracking-tight text-white/70">{kernel.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-white/30 text-[8px]">{kernel.model}</span>
              <span className={cn("font-black uppercase", kernel.status === 'STANDBY' ? "text-white/20" : "text-emerald-400")}>{kernel.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

const ConsensusDot = ({ active, state, label }: { active: boolean; state: 'success' | 'warning' | 'danger'; label: string }) => {
  const colors = {
    success: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    warning: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
    danger: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'
  };

  return (
    <div className={cn(
      "w-3 h-3 rounded-full flex items-center justify-center text-[6px] font-black transition-all duration-500",
      active ? colors[state] : "bg-white/5 text-white/10 grayscale border border-white/5",
      active && state === 'danger' && "animate-pulse"
    )}>
      {active && label}
    </div>
  );
};

const ScorePillar = ({ label, val, weight, color }: { label: string; val: number; weight: number; color: string }) => {
  const colorMap: any = {
    cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
  };

  return (
    <div className={cn("flex flex-col items-center gap-1 p-1.5 rounded-lg border", colorMap[color])}>
      <span className="text-[7px] font-black uppercase tracking-tighter opacity-70">{label} ({(weight*100).toFixed(0)}%)</span>
      <div className="text-[10px] font-bold font-mono leading-none">{val.toFixed(0)}</div>
      <div className="w-full h-1 bg-black/40 rounded-full mt-0.5 overflow-hidden">
        <div className="h-full bg-current opacity-40 rounded-full shadow-[0_0_5px_currentColor]" style={{ width: `${val}%` }} />
      </div>
    </div>
  );
};

const ShieldScoreHUD = ({ score, Distance, Volatility, Risk, AI, isLocked, cooldown, onReset }: { score: number; Distance: number; Volatility: number; Risk: number; AI: number; isLocked?: boolean; cooldown?: number; onReset: () => void }) => {
  const getLevelColor = (s: number) => {
    if (isLocked) return 'text-rose-600';
    if (s > 70) return 'text-rose-400';
    if (s >= 50) return 'text-amber-400';
    return 'text-emerald-400';
  };

  const now = Date.now();
  const cooldownRemaining = cooldown && cooldown > now ? Math.ceil((cooldown - now) / 1000) : 0;

  return (
    <div className={cn("glass-panel p-3 border-white/10 bg-black/60 rounded-xl relative overflow-hidden group shadow-2xl", isLocked && "border-rose-500/30")}>
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-2">
          <Shield className={cn("w-3.5 h-3.5", isLocked ? "text-rose-600" : (score > 70 ? "text-rose-500 animate-pulse border-rose-500" : "text-[var(--holo-cyan)]"))} />
          <span className="text-[10px] font-black uppercase tracking-widest text-[#848e9c]">
            {isLocked ? "SHIELD_LOCKED_CYCLE_X" : "Shield Score Matrix"}
          </span>
        </div>
        <div className={cn("text-lg font-black font-mono tracking-tighter drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]", getLevelColor(score))}>
          {isLocked ? "LOCKED" : score.toFixed(1)}<span className="text-[10px] ml-0.5 opacity-50 font-normal">/100</span>
        </div>
      </div>
      
      {cooldownRemaining > 0 && (
        <div className="absolute top-0 left-0 w-full h-0.5 bg-rose-500/20 overflow-hidden">
          <div className="h-full bg-rose-500 animate-[shimmer_2s_infinite]" style={{ width: `${(cooldownRemaining/5)*100}%` }} />
        </div>
      )}

      <div className="h-1.5 w-full bg-white/5 rounded-full mb-4 overflow-hidden border border-white/5 p-[1px]">
        <div 
          className={cn("h-full rounded-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(255,255,255,0.2)]", 
            isLocked ? "bg-rose-900" : (
            score > 70 ? "bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]" : 
            score >= 50 ? "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]" : "bg-emerald-500"))}
          style={{ width: `${isLocked ? 100 : score}%` }}
        />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <ScorePillar label="Dist" val={Distance} weight={0.4} color="cyan" />
        <ScorePillar label="Vol" val={Volatility} weight={0.3} color="purple" />
        <ScorePillar label="Risk" val={Risk} weight={0.2} color="amber" />
        <ScorePillar label="AI" val={AI} weight={0.1} color="blue" />
      </div>

      {(isLocked || cooldownRemaining > 0) && (
        <button 
          onClick={onReset}
          className="w-full py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 rounded font-black text-[9px] text-rose-400 uppercase tracking-widest transition-all active:scale-95"
        >
          {cooldownRemaining > 0 ? `COOLDOWN (${cooldownRemaining}s) - FORCE RESET` : "RESET SHIELD LOCK"}
        </button>
      )}
    </div>
  );
};

const MicroPnLSplitView = React.memo(({ pnlA, pnlB, netPnl, statsA, statsB, sideA }: { pnlA: number; pnlB: number; netPnl: number; statsA?: any; statsB?: any; sideA: string }) => {
  return (
    <div className="flex flex-col gap-2 p-3 bg-black/40 rounded-xl border border-white/5 backdrop-blur-md">
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-black text-white/30 tracking-widest uppercase">Primary [A]</span>
            <span className={cn("text-[9px] font-bold font-mono px-1 rounded", pnlA >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-rose-500 bg-rose-500/10")}>
              {statsA?.pnlPct >= 0 ? '+' : ''}{statsA?.pnlPct.toFixed(2)}%
            </span>
          </div>
          <div className={cn("text-lg font-black font-mono tracking-tighter tabular-nums", pnlA >= 0 ? "text-[var(--holo-cyan)]" : "text-rose-500")}>
            <span className="pnl-ticker-up">{pnlA >= 0 ? '+' : ''}{pnlA.toFixed(2)}</span>
            <span className="text-[10px] ml-1 opacity-40">USDT</span>
          </div>
        </div>
        <div className="flex flex-col gap-1 border-l border-white/10 pl-4">
          <div className="flex justify-between items-center">
            <span className="text-[8px] font-black text-white/30 tracking-widest uppercase">Hedge [B]</span>
            <span className={cn("text-[9px] font-bold font-mono px-1 rounded", pnlB >= 0 ? "text-emerald-400 bg-emerald-400/10" : "text-rose-500 bg-rose-500/10")}>
              {statsB?.pnlPct >= 0 ? '+' : ''}{statsB?.pnlPct.toFixed(2)}%
            </span>
          </div>
          <div className={cn("text-lg font-black font-mono tracking-tighter tabular-nums", pnlB >= 0 ? "text-[var(--holo-gold)]" : "text-rose-500", !pnlB && "text-white/10")}>
            <span className="pnl-ticker-down">{pnlB >= 0 ? '+' : ''}{pnlB.toFixed(2)}</span>
            <span className="text-[10px] ml-1 opacity-40">USDT</span>
          </div>
        </div>
      </div>
      <div className={cn(
        "relative h-1 w-full bg-white/5 rounded-full overflow-hidden mt-1",
        netPnl >= 0 ? "shadow-[0_0_10px_rgba(16,185,129,0.1)]" : "shadow-[0_0_10px_rgba(244,63,94,0.1)]"
      )}>
        <div 
          className={cn("h-full transition-all duration-1000", netPnl >= 0 ? "bg-emerald-500" : "bg-rose-500")}
          style={{ width: `${Math.min(100, (Math.abs(netPnl) / 100) * 100)}%`, marginLeft: netPnl >= 0 ? '0' : 'auto' }}
        />
      </div>
      <div className="flex justify-between items-center">
        <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Net Realized Exposure</span>
        <span className={cn("text-xs font-black font-mono", netPnl >= 0 ? "text-emerald-400" : "text-rose-500")}>
          {netPnl >= 0 ? '+' : ''}{netPnl.toFixed(2)} USDT
        </span>
      </div>
    </div>
  );
});

const PriceRail2 = React.memo(({ state, sideA }: { state: DeltaMasterState, sideA: string }) => {
  const [delayedPrice, setDelayedPrice] = useState(state.lastPrice);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setDelayedPrice(state.lastPrice);
    }, 150);
    return () => clearTimeout(timer);
  }, [state.lastPrice]);

  if (!state.isActive || !state.entryA) return (
     <div className="h-full flex flex-col items-center justify-center text-[10px] uppercase font-black tracking-widest text-[#5e6673] gap-4">
       <div className="w-16 h-1 w-full bg-white/5 rounded-full overflow-hidden">
         <div className="h-full bg-[var(--holo-cyan)]/20 animate-[loading_2s_infinite]" />
       </div>
       Awaiting Deployment Matrix
     </div>
  );

  const sl = state.slOrder?.price || 0;
  const tpTiers = state.tpTiers || [];
  const isBuy = sideA === 'buy';
  
  const maxTP = Math.max(...tpTiers.map(t => t.price), state.entryA);
  const minBound = Math.min(sl, state.lastPrice, state.entryA, state.entryB || state.entryA);
  const maxBound = Math.max(maxTP, state.lastPrice, state.entryA, state.entryB || state.entryA);
  const padding = (maxBound - minBound) * 0.15;
  const topPrice = maxBound + padding;
  const bottomPrice = minBound - padding;

  const getPos = (price: number) => {
    const pct = ((price - bottomPrice) / (topPrice - bottomPrice)) * 100;
    return 100 - Math.max(0, Math.min(100, pct));
  };

  const pricePos = getPos(state.lastPrice);
  const delayedPos = getPos(delayedPrice);
  const entryPos = getPos(state.entryA);
  const slPos = getPos(sl);
  const hedgePos = getPos(state.entryB);
  
  const isHedgeArmed = state.botState === 'HEDGE_PENDING';
  const isHedgeActive = state.botState === 'HEDGE_ACTIVE';
  const riskColor = (state.hedgeScore || 0) > 70 ? 'var(--holo-magenta)' : 
                    (state.hedgeScore || 0) > 50 ? 'var(--holo-gold)' : 
                    'var(--holo-cyan)';

  return (
    <div className="relative w-full h-full flex items-center justify-center py-8">
      {/* ─── PRICE RAIL 2.0 ─── */}
      <div className="relative w-2 h-full bg-white/5 rounded-full mx-auto">
        
        {/* Zones */}
        <div className="absolute w-full bg-emerald-500/10 rail-glow-safe rounded-full transition-all duration-500" 
             style={{ top: isBuy ? `${getPos(maxTP)}%` : `${entryPos}%`, height: `${Math.abs(getPos(maxTP) - entryPos)}%` }} />

        <div className={cn("absolute w-full bg-rose-500/10 rounded-full transition-all duration-500", (state.hedgeScore || 0) > 80 && "danger-zone-pulse")} 
             style={{ top: isBuy ? `${entryPos}%` : `${slPos}%`, height: `${Math.abs(entryPos - slPos)}%` }} />

        {state.entryB > 0 && (
          <div className={cn("absolute w-full rounded-full transition-all duration-500", isHedgeArmed && "zone-shimmer-armed bg-amber-500/20")} 
               style={{ top: `${hedgePos}%`, height: `2px`, boxShadow: isHedgeArmed ? '0 0 15px var(--holo-gold)' : 'none' }} />
        )}

        {/* Markers */}
        {tpTiers.map((tp, i) => (
          <div key={i} className="absolute left-1/2 -translate-x-1/2 w-6 h-[1px] bg-emerald-500/40" style={{ top: `${getPos(tp.price)}%` }}>
            <span className="absolute left-8 -translate-y-1/2 text-[8px] font-black text-emerald-500/80 whitespace-nowrap">TP Tier {tp.tier}</span>
          </div>
        ))}

        <div className="absolute left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-fuchsia-500 bg-black z-10 shadow-[0_0_15px_rgba(217,70,239,0.5)]" style={{ top: `${entryPos}%` }}>
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-fuchsia-400 animate-pulse" />
           <span className="absolute right-8 top-1/2 -translate-y-1/2 text-[9px] font-black text-fuchsia-400 tracking-widest">ENTRY</span>
        </div>

        <div className="absolute left-1/2 -translate-x-1/2 w-6 h-1 bg-rose-600 shadow-[0_0_10px_#f43f5e] z-10" style={{ top: `${slPos}%` }}>
           <span className="absolute left-8 top-1/2 -translate-y-1/2 text-[9px] font-black text-rose-500 tracking-tighter">LIQ_SHUTDOWN</span>
        </div>

        {/* MAGNETIC PRICE BEACON */}
        <div className="absolute left-1/2 -translate-x-1/2 z-20 price-beacon-magnetic" style={{ top: `${pricePos}%` }}>
          <div className={cn("w-4 h-4 rotate-45 border-2 bg-black transition-colors duration-300", isHedgeActive ? "border-[var(--holo-gold)]" : "border-[var(--holo-cyan)]")} 
               style={{ boxShadow: `0 0 15px ${isHedgeActive ? 'var(--holo-gold)' : 'var(--holo-cyan)'}` }} />
          
          <div className="absolute top-0 left-0 w-4 h-4 rotate-45 border border-white/10 opacity-30 scale-90"
               style={{ transform: `translate(-50%, -50%) translateY(${(delayedPos - pricePos) * 2}px)`, transition: 'transform 0.1s linear' }} />

          {/* Hedge Overlay */}
          {(state.hedgeScore || 0) > 30 && (
            <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-1 pointer-events-none animate-in fade-in slide-in-from-left-2 duration-500">
               <div className="flex items-center gap-3 px-3 py-1.5 bg-black/90 border border-white/10 rounded-lg backdrop-blur-xl shadow-2xl">
                  <div className="flex flex-col">
                    <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Hedge Risk</span>
                    <span className={cn("text-[10px] font-black font-mono", (state.hedgeScore || 0) > 70 ? "text-rose-500" : "text-[var(--holo-gold)]")}>
                      {state.hedgeScore?.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-px h-6 bg-white/10" />
                  <div className="flex flex-col">
                     <span className="text-[7px] font-black text-white/40 uppercase tracking-widest">Status</span>
                     <span className="text-[8px] font-black text-white uppercase italic">{state.botState.replace('_', ' ')}</span>
                  </div>
               </div>
               <svg className="absolute -left-[38px] -top-[14px] w-14 h-14 -rotate-90">
                  <circle cx="28" cy="28" r="12" fill="none" stroke="white" strokeWidth="1" className="opacity-5" />
                  <circle cx="28" cy="28" r="12" fill="none" stroke={riskColor} strokeWidth="2" 
                          strokeDasharray={75.4} strokeDashoffset={75.4 - (75.4 * (state.hedgeScore || 0) / 100)}
                          className="transition-all duration-1000" />
               </svg>
            </div>
          )}
        </div>
      </div>

      <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-8 items-end pointer-events-none">
         <div className="flex flex-col items-end">
            <span className="text-[8px] font-black text-white/20 uppercase tracking-widest">Mark Price</span>
            <span className="text-base font-mono font-bold text-white tracking-tighter">${state.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
         </div>
         {isHedgeArmed && (
           <div className="flex flex-col items-end animate-pulse">
              <span className="text-[8px] font-black text-[var(--holo-gold)] uppercase tracking-widest">Shield Trigger</span>
              <span className="text-sm font-mono font-bold text-[var(--holo-gold)]">${state.entryB?.toLocaleString()}</span>
           </div>
         )}
      </div>
    </div>
  );
});

const TradeIdentityStrip = React.memo(({ symbol, sideA, botState, isActive, hedgeScore, intelligence }: { symbol: string; sideA: string; botState: string; isActive: boolean; hedgeScore: number; intelligence?: any }) => {
  const badge = useMemo(() => {
    if (!isActive) return { color: 'text-gray-500 bg-gray-500/10 border-gray-500/20', text: 'OFFLINE', icon: <StopCircle className="w-3 h-3" /> };
    switch(botState) {
      case 'PRIMARY_ACTIVE': return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', text: 'PRIMARY ACTIVE', icon: <Zap className="w-3 h-3 text-emerald-400" /> };
      case 'HEDGE_PENDING': return { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30 animate-pulse', text: 'HEDGE PENDING', icon: <Activity className="w-3 h-3 text-amber-400" /> };
      case 'HEDGE_ACTIVE': return { color: 'text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10 border-[var(--holo-cyan)]/30', text: 'HEDGE ACTIVE', icon: <ShieldCheck className="w-3 h-3" /> };
      case 'EMERGENCY': return { color: 'text-rose-500 bg-rose-600/20 border-rose-500/50 animate-bounce', text: 'EMERGENCY', icon: <AlertTriangle className="w-3 h-3" /> };
      default: return { color: 'text-[#848e9c] bg-white/5 border-white/10', text: 'IDLE', icon: <Wind className="w-3 h-3" /> };
    }
  }, [botState, isActive]);

  return (
    <div className={cn(
      "flex items-center justify-between px-6 py-3 bg-black/60 border border-white/5 rounded-2xl backdrop-blur-2xl shadow-2xl relative overflow-hidden h-[80px]",
      isActive && "animate-active-trade-gradient"
    )}>
      <div className="flex items-center gap-6">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black tracking-tighter leading-none flex items-center gap-3">
            <span className="text-white/40 font-mono text-base">{symbol}</span>
            <span className={cn("px-3 py-1 rounded-md italic shadow-lg border", sideA === 'buy' ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/5" : "text-rose-500 border-rose-500/30 bg-rose-500/5")}>
              {sideA === 'buy' ? 'LONG' : 'SHORT'}
            </span>
          </h1>
          <div className="flex items-center gap-2 mt-2 opacity-40">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[9px] font-black tracking-widest font-mono">NEURAL_LINK: ACTIVE</span>
          </div>
        </div>
      </div>

      <div className="absolute left-1/2 -translate-x-1/2">
         <div className={cn("px-8 py-2.5 rounded-full border-2 text-xs font-black tracking-widest uppercase flex items-center gap-4 transition-all duration-500 shadow-xl", badge.color)}>
           {badge.icon} {badge.text}
           {isActive && <div className="w-2 h-2 rounded-full bg-current animate-ping" />}
         </div>
      </div>

      <div className="flex items-center gap-8">
        <div className="flex flex-col items-end gap-1.5">
           <span className="text-[9px] font-black text-white/20 tracking-widest uppercase">AI Consensus</span>
           <div className="flex gap-2">
              <ConsensusDot active={!!intelligence?.regime} state={intelligence?.regime === 'TREND' ? 'success' : intelligence?.regime === 'RANGE' ? 'warning' : 'danger'} label="R" />
              <ConsensusDot active={!!intelligence?.executionAdvisory} state={(intelligence?.executionAdvisory?.friction || 0) < 1 ? 'success' : 'warning'} label="E" />
              <ConsensusDot active={isActive} state={(hedgeScore || 0) < 30 ? 'success' : (hedgeScore || 0) < 70 ? 'warning' : 'danger'} label="S" />
           </div>
        </div>
        <div className="w-12 h-12 border border-white/10 rounded-xl flex items-center justify-center bg-white/5 group transition-all hover:bg-white/10">
           <Shield className={cn("w-6 h-6", isActive ? "text-[var(--holo-cyan)] animate-pulse" : "text-white/10")} />
        </div>
      </div>
    </div>
  );
});

const SmartActionButton = React.memo(({ botState, isActive, loading, onStart, onStop }: { botState: string; isActive: boolean; loading: boolean; onStart: () => void; onStop: () => void }) => {
  const config = useMemo(() => {
    if (!isActive) return { text: 'ACTIVATE TRADE', color: 'bg-[var(--holo-cyan)] text-black', icon: <Play className="w-5 h-5 fill-black" />, action: onStart };
    switch(botState) {
      case 'PRIMARY_ACTIVE': return { text: 'ACTIVATE SHIELD', color: 'bg-amber-500 text-black shadow-[0_0_20px_rgba(245,158,11,0.4)]', icon: <Shield className="w-5 h-5 fill-black" />, action: () => {} };
      case 'HEDGE_ACTIVE': return { text: 'CLOSE PARTIAL', color: 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]', icon: <TrendingDown className="w-5 h-5" />, action: () => {} };
      case 'EMERGENCY': return { text: 'PANIC CLOSE', color: 'bg-rose-600 text-white animate-pulse shadow-[0_0_30px_rgba(225,29,72,0.8)]', icon: <AlertTriangle className="w-5 h-5" />, action: onStop };
      default: return { text: 'TERMINATE UNIT', color: 'bg-rose-500 text-white', icon: <StopCircle className="w-5 h-5" />, action: onStop };
    }
  }, [botState, isActive, onStart, onStop]);

  return (
    <button 
      onClick={config.action} 
      disabled={loading}
      className={cn(
        "w-full py-4 rounded-2xl font-black uppercase tracking-[0.3em] text-xs transition-all duration-500 flex items-center justify-center gap-3 hover:brightness-110 active:scale-95 shadow-2xl",
        config.color,
        loading && "opacity-50 cursor-not-allowed"
      )}
    >
      {config.icon} {config.text}
    </button>
  );
});

const ModeSwitch = React.memo(({ value, onChange }: { value: string; onChange: (v: any) => void }) => {
  const modes = [
    { id: 'MIRROR', label: 'MIRROR', tip: 'Instant clone of primary' },
    { id: 'DELAYED', label: 'DELAYED', tip: 'ATR-gated, safer entry' },
    { id: 'GRID_HEDGE', label: 'GRID', tip: 'Multi-layer grid layers' },
    { id: 'DYNAMIC', label: 'DYNAMIC', tip: 'AI/ATR adaptive sizing' }
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[9px] font-black text-white/20 uppercase tracking-widest ml-1">Strategy Mode</span>
      <div className="flex p-1 bg-white/5 rounded-xl border border-white/5 gap-1">
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => onChange(mode.id)}
            className={cn(
              "flex-1 py-2 rounded-lg text-[10px] font-black transition-all relative group",
              value === mode.id ? "bg-[var(--holo-cyan)] text-black shadow-lg" : "text-white/40 hover:text-white hover:bg-white/5"
            )}
          >
            {mode.label}
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 mode-tooltip rounded text-[8px] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
              {mode.tip}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
});

const SafetyToggles = React.memo(() => {
  const [states, setStates] = useState({ ab: true, ai: false, lock: false });
  
  const toggles = [
    { id: 'ab', label: 'Auto-Breakeven', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
    { id: 'ai', label: 'Live AI Approval', icon: <Zap className="w-3.5 h-3.5" /> },
    { id: 'lock', label: 'Hedge Lock', icon: <Lock className="w-3.5 h-3.5" /> }
  ];

  return (
    <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
      {toggles.map(t => (
        <label key={t.id} className="flex items-center justify-between cursor-pointer group">
          <div className="flex items-center gap-3">
             <div className="text-white/30 group-hover:text-[var(--holo-cyan)] transition-colors">{t.icon}</div>
             <span className="text-[10px] font-black uppercase tracking-tight text-white/60">{t.label}</span>
          </div>
          <div 
            onClick={() => setStates(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
            className={cn("w-10 h-5 rounded-full transition-all relative flex items-center px-1 border", (states as any)[t.id] ? "bg-emerald-500/20 border-emerald-500/50" : "bg-white/5 border-white/10")}
          >
            <div className={cn("w-3 h-3 rounded-full transition-all", (states as any)[t.id] ? "bg-emerald-400 translate-x-5 shadow-[0_0_8px_#34d399]" : "bg-white/20")} />
          </div>
        </label>
      ))}
    </div>
  );
});

const EventFeedMini = React.memo(({ events, onExpand }: { events: DeltaEvent[]; onExpand: () => void }) => {
  return (
    <div className="flex flex-col gap-2 cursor-pointer" onClick={onExpand}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[9px] font-black text-white/20 uppercase tracking-widest">Live Telemetry</span>
        <TerminalSquare className="w-3 h-3 text-white/20" />
      </div>
      <div className="flex flex-col gap-1.5 p-3 bg-black/60 rounded-xl border border-white/5 font-mono text-[9px] min-h-[70px]">
        {events.slice(-3).reverse().map(ev => {
          const time = new Date(ev.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });
          let color = 'text-white/60';
          if (ev.type.toLowerCase().includes('error')) color = 'text-rose-500';
          else if (ev.type.toLowerCase().includes('hedge')) color = 'text-[var(--holo-gold)]';
          else if (ev.type.toLowerCase().includes('tp')) color = 'text-emerald-400';
          
          return (
            <div key={ev.id} className="flex gap-2 items-start overflow-hidden">
               <span className="text-white/20 shrink-0">[{time}]</span>
               <span className={cn(color, "font-bold truncate")}>{ev.message}</span>
            </div>
          );
        })}
        {events.length === 0 && <div className="text-white/10 italic">Awaiting streams...</div>}
      </div>
    </div>
  );
});

export const DeltaMasterAgentPanel = React.memo(({ symbol }: { symbol: string }) => {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<DeltaMasterState>({
    isActive: false, phase: 'IDLE', pnlA: 0, pnlB: 0, netPnl: 0,
    lastPrice: 0, entryA: 0, entryB: 0, symbol: '', liqPriceA: 0,
    hedgeRatio: 1.0, availableMarginB: 0, dmsStatus: 'inactive',
    tpTiers: [], slOrder: null, events: [],
    marginStats: {
      accountA: { balance: 1000, used: 0, free: 1000, pnlPct: 0 },
      accountB: { balance: 1000, used: 0, free: 1000, pnlPct: 0 }
    }
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [pnlHistoryA, setPnlHistoryA] = useState<number[]>([]);
  const [pnlHistoryB, setPnlHistoryB] = useState<number[]>([]);
  const [stateFlash, setStateFlash] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  const prevBotState = useRef(state.botState);
  
  useEffect(() => {
    if (state.isActive && state.botState !== prevBotState.current) {
      setStateFlash(true);
      setTimeout(() => setStateFlash(false), 400);
      prevBotState.current = state.botState;
    }
  }, [state.botState, state.isActive]);

  const [qtyA, setQtyA] = useState('0.1');
  const [entryPrice, setEntryPrice] = useState('');
  const [entryOffset, setEntryOffset] = useState('5');
  const [slPercent, setSlPercent] = useState('1.0');
  const [tpTiers, setTpTiers] = useState('2,3,4,5');
  const [sideA, setSideA] = useState<'buy' | 'sell'>('buy');
  const [hedgeStrategy, setHedgeStrategy] = useState<'OFF' | 'MIRROR' | 'DELAYED' | 'GRID_HEDGE' | 'DYNAMIC'>('MIRROR');
  const [gridLayers, setGridLayers] = useState('3');
  const [gridGapPct, setGridGapPct] = useState('0.5');
  const [maxDrawdown, setMaxDrawdown] = useState('3.0');
  const [logFilter, setLogFilter] = useState<'ALL' | 'TRADE' | 'HEDGE' | 'ERROR'>('ALL');

  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let lastUpdate = 0;
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/delta-master/status?symbol=${encodeURIComponent(symbol)}`);
        if (res.ok) setState(await res.json());
      } catch {}
    };
    fetchStatus();

    if ((window as any).socket) {
      const socket = (window as any).socket;
      const handleStatusUpdate = (data: any) => {
        const now = Date.now();
        if (now - lastUpdate > 500 || data.isActive !== state.isActive || (data.events?.length !== state.events?.length)) {
          setState(data);
          if (data.isActive) {
            setPnlHistoryA(prev => [...prev, data.pnlA].slice(-30));
            setPnlHistoryB(prev => [...prev, data.pnlB].slice(-30));
          }
          lastUpdate = now;
        }
        setWsConnected(true);
      };
      socket.on('connect', () => { setWsConnected(true); fetchStatus(); });
      socket.on('disconnect', () => setWsConnected(false));
      socket.on('delta_master_status_' + symbol, handleStatusUpdate);
      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('delta_master_status_' + symbol, handleStatusUpdate);
      };
    }
  }, [symbol]);

  useEffect(() => {
    if (showTerminal) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.events, showTerminal]);

  const handleStart = async () => {
    setLoading(true);
    const tId = toast.loading('Initializing Mission...');
    try {
      const parsedEntry = entryPrice ? Number(entryPrice) : undefined;
      const res = await fetch('/api/delta-master/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol, qtyA: Number(qtyA), sideA, entryPrice: parsedEntry,
          entryOffset: Number(entryOffset), slPercent: Number(slPercent),
          tpTiersArray: tpTiers.split(',').map(Number), hedgeStrategy,
          gridLayers: Number(gridLayers), gridGapPct: Number(gridGapPct),
          maxDrawdownPct: Number(maxDrawdown), leverA: 10, leverB: 20
        })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Deployment failed');
      toast.success('Agent Deployed!', { id: tId });
    } catch (err: any) {
      toast.error(`Deployment Failed: ${err.message}`, { id: tId });
    } finally { setLoading(false); }
  };

  const handleStop = async () => {
    setLoading(true);
    const tId = toast.loading('Terminating Agent...');
    try {
      const res = await fetch('/api/delta-master/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Termination failed');
      toast.success('Agent Terminated', { id: tId });
    } catch (err: any) {
      toast.error(err.message, { id: tId });
    } finally { setLoading(false); }
  };

  const handleResetShield = async () => {
    try {
      const resp = await fetch(`/api/delta-master/reset-lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.status) {
          setState(data.status);
          toast.success('Shield Lock Reset Successful');
        }
      }
    } catch (err: any) {
      console.error('Failed to reset shield lock:', err);
      toast.error('Failed to reset shield lock');
    }
  };

  const calculateRiskValue = () => {
    if (!state.isActive || !state.marginStats) return 0;
    const used = (state.marginStats.accountA.used || 0) + (state.marginStats.accountB.used || 0);
    const balance = (state.marginStats.accountA.balance || 0) + (state.marginStats.accountB.balance || 0);
    const marginRisk = (used / (balance || 1)) * 100;
    const loss = Math.max(0, -state.pnlA) + Math.max(0, -state.pnlB);
    const pnlRisk = (loss / (balance || 1)) * 100;
    const volFactor = (state.intelligence?.volatilityScore || 0) / 10;
    const regimeRisk = state.intelligence?.regime === 'VOLATILE' ? 20 : 0;
    return Math.min(100, marginRisk + pnlRisk + volFactor + regimeRisk);
  };

  const riskValue = calculateRiskValue();
  const marginUsage = state.marginStats ? ((state.marginStats.accountA.used + state.marginStats.accountB.used) / (state.marginStats.accountA.balance + state.marginStats.accountB.balance) * 100) : 0;

  return (
    <div className={cn(
      "h-full flex flex-col p-3 bg-[#0B0F14] text-white overflow-hidden gap-3 relative",
      riskValue > 80 && "risk-high-shake"
    )}>
      {/* Risk Vignette */}
      {riskValue > 80 && <div className="absolute inset-0 risk-vignette-overlay z-40 pointer-events-none" />}

      {/* Layer 1: Header (80px) */}
      <TradeIdentityStrip 
        symbol={symbol} sideA={sideA} botState={state.botState} 
        isActive={state.isActive} hedgeScore={state.hedgeScore || 0}
        intelligence={state.intelligence}
      />

      {/* Layer 2: Core Visual Engine (360px) */}
      <div className="flex-none h-[360px] flex gap-3 min-h-0">
        <div className="flex-1 bg-black/40 rounded-3xl border border-white/5 relative overflow-hidden flex flex-col pt-8">
           <PriceRail2 state={state} sideA={sideA} />
        </div>
        <div className="w-[200px] flex flex-col justify-end">
           <MicroPnLSplitView 
             pnlA={state.pnlA} pnlB={state.pnlB} netPnl={state.netPnl}
             statsA={state.marginStats?.accountA} statsB={state.marginStats?.accountB}
             sideA={sideA}
           />
        </div>
      </div>

      {/* Layer 3: Control + Telemetry (247px) */}
      <div className="flex-1 grid grid-cols-2 gap-4 h-[247px]">
        {/* Left: Controls */}
        <div className="flex flex-col gap-4">
           <SmartActionButton 
             botState={state.botState} isActive={state.isActive} 
             loading={loading} onStart={handleStart} onStop={handleStop}
           />
           <ModeSwitch value={hedgeStrategy} onChange={setHedgeStrategy} />
           <SafetyToggles />
        </div>

        {/* Right: Telemetry Stack */}
        <div className="grid grid-cols-2 gap-4">
           <div className="flex flex-col gap-4">
              <RiskMeterCircular 
                risk={riskValue} 
                margin={Number(marginUsage.toFixed(1))}
                volatility={state.intelligence?.regime || 'NORMAL'}
              />
              <AIKernelStatus intel={state.intelligence} isActive={state.isActive} />
           </div>
           <div className="flex flex-col gap-4">
              <EventFeedMini events={state.events || []} onExpand={() => setShowTerminal(true)} />
              
              {/* Shield HUD Collapsible (Brief version) */}
              <div 
                onClick={state.hedgeCycleLocked ? handleResetShield : undefined}
                className={cn(
                  "mt-auto p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between transition-all",
                  state.hedgeCycleLocked ? "cursor-pointer hover:bg-rose-500/10 border-rose-500/30" : ""
                )}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className={cn("w-4 h-4", state.hedgeCycleLocked ? "text-rose-500 animate-pulse" : "text-emerald-400")} />
                  <span className="text-[10px] font-black text-white/40 uppercase">
                    {state.hedgeCycleLocked ? "RESET LOCK" : "Shield Matrix"}
                  </span>
                </div>
                <span className={cn("text-xs font-mono font-bold", state.hedgeCycleLocked ? "text-rose-500" : "text-emerald-400")}>
                  {state.hedgeCycleLocked ? "LOCKED" : (state.hedgeScore || 0).toFixed(1)}
                </span>
              </div>
           </div>
        </div>
      </div>

      {/* Full Terminal Overlay */}
      {showTerminal && (
        <div className="absolute inset-0 bg-black/95 z-50 flex flex-col animate-in slide-in-from-bottom duration-500">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <span className="font-black text-xs tracking-widest uppercase">System Telemetry Log</span>
            <button onClick={() => setShowTerminal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <StopCircle className="w-5 h-5 text-rose-500 rotate-90" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 font-mono text-[11px] tactical-scrollbar">
             {[...state.events].reverse().map(ev => {
               const time = new Date(ev.timestamp).toLocaleTimeString();
               return (
                 <div key={ev.id} className="mb-2 opacity-80 hover:opacity-100 transition-opacity">
                    <span className="text-white/20 mr-4">[{time}]</span>
                    <span className="text-[var(--holo-cyan)] mr-4">[{ev.type}]</span>
                    <span>{ev.message}</span>
                 </div>
               );
             })}
             <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
});
