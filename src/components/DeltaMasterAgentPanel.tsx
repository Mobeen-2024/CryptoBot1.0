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

const RiskMeter = React.memo(({ risk }: { risk: number }) => {
  const bars = 10;
  const activeBars = Math.ceil((Math.min(100, risk) / 100) * bars);
  const barString = '█'.repeat(activeBars) + '░'.repeat(bars - activeBars);
  
  let color = 'text-emerald-400';
  let label = '🟢 SAFE';
  
  if (risk > 90) {
    color = 'text-rose-600 animate-[pulse_0.5s_infinite] font-black scale-110';
    label = '💀 CRITICAL PANIC';
  } else if (risk > 60) {
    color = 'text-rose-500 animate-pulse';
    label = '🔴 HIGH RISK';
  } else if (risk > 30) {
    color = 'text-[var(--holo-gold)]';
    label = '🟡 MODERATE';
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[7px] font-black uppercase tracking-[0.2em] text-[#848e9c]">Risk Matrix - {label}</span>
      <div className={cn("font-mono text-[10px] tracking-tighter flex items-center gap-2", color)}>
        <span className="opacity-40">[{barString}]</span>
        <span className="font-black">{risk.toFixed(0)}%</span>
      </div>
    </div>
  );
});

const IntelligenceMatrix = React.memo(({ intel }: { intel?: DeltaMasterState['intelligence'] }) => {
  if (!intel) return (
    <div className="glass-panel p-3 rounded-xl border border-white/5 bg-black/20 flex items-center justify-center min-h-[80px]">
       <span className="text-[9px] font-black uppercase tracking-[0.2em] text-[#5e6673] animate-pulse">Initializing Neural Link...</span>
    </div>
  );

  return (
    <div className="glass-panel p-3 rounded-xl border border-white/10 bg-black/40 flex flex-col gap-2 shadow-lg">
       <div className="flex items-center gap-2 mb-1 border-b border-white/5 pb-1.5">
          <TerminalSquare className="w-3.5 h-3.5 text-[var(--holo-cyan)]" />
          <span className="text-[10px] font-black uppercase tracking-widest">Intelligence Matrix v3.1</span>
       </div>
       
       <div className="grid grid-cols-3 gap-2">
          {/* Regime */}
          <div className="flex flex-col gap-1 p-2 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-all group">
             <span className="text-[7px] font-black uppercase text-[#848e9c] tracking-widest">Market State</span>
             <span className={cn("text-[10px] font-black uppercase", 
               intel.regime === 'TREND' ? "text-cyan-400" : 
               intel.regime === 'RANGE' ? "text-amber-400" : "text-rose-400")}>
               {intel.regime}
             </span>
             <div className="h-0.5 w-full bg-white/10 mt-1 rounded-full overflow-hidden">
                <div className={cn("h-full transition-all duration-1000", 
                  intel.regime === 'TREND' ? "w-full bg-cyan-400" : 
                  intel.regime === 'RANGE' ? "w-[60%] bg-amber-400" : "w-[30%] bg-rose-400")} />
             </div>
          </div>

          {/* Friction */}
          <div className="flex flex-col gap-1 p-2 bg-white/5 rounded-lg border border-white/5">
             <span className="text-[7px] font-black uppercase text-[#848e9c] tracking-widest">ATR Friction</span>
             <span className="text-[10px] font-black uppercase text-blue-400">
               {intel.executionAdvisory?.friction ? `${intel.executionAdvisory.friction.toFixed(2)}%` : 'CALC...'}
             </span>
             <span className="text-[7px] font-mono text-white/40 truncate">offset: {intel.executionAdvisory?.offset.toFixed(1) || '0'}</span>
          </div>

          {/* Volatility */}
          <div className="flex flex-col gap-1 p-2 bg-white/5 rounded-lg border border-white/5">
             <span className="text-[7px] font-black uppercase text-[#848e9c] tracking-widest">Volatility</span>
             <div className="flex items-center gap-1.5">
                <Activity className="w-2.5 h-2.5 text-fuchsia-400" />
                <span className="text-[10px] font-black uppercase text-white">{intel.volatilityScore?.toFixed(1) || '0'}</span>
             </div>
             <span className="text-[7px] font-mono text-white/40">liq: {intel.liquidityScore?.toFixed(0) || '0'}bps</span>
          </div>
       </div>

       {intel.executionAdvisory?.reason && (
          <div className="mt-1 px-2 py-1.5 bg-blue-500/5 border border-blue-500/10 rounded font-mono text-[8px] text-blue-400/80 leading-tight">
             <span className="font-black text-blue-500 mr-1">EXECUTION_LOG:</span>
             {intel.executionAdvisory.reason}
          </div>
       )}
    </div>
  );
});

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

const VisualHUD = React.memo(({ state, sideA }: { state: DeltaMasterState, sideA: string }) => {
  if (!state.isActive || !state.entryA) return (
     <div className="h-full flex items-center justify-center text-[10px] uppercase font-black tracking-widest text-[#5e6673]">
       Waiting for Deployment
     </div>
  );

  const sl = state.slOrder?.price || 0;
  const tp1 = state.tpTiers[0]?.price || 0;
  const isBuy = sideA === 'buy';
  
  const highBound = isBuy ? Math.max(tp1, state.lastPrice, state.entryA) : Math.max(sl, state.lastPrice, state.entryA);
  const lowBound = isBuy ? Math.min(sl, state.lastPrice, state.entryA) : Math.min(tp1, state.lastPrice, state.entryA);
  const padding = (highBound - lowBound) * 0.2 || 10;
  const max = highBound + padding;
  const min = lowBound - padding;

  const calculatePositionPercentage = (val: number, pMin: number, pMax: number) => {
    if (pMax === pMin) return 50;
    const pct = ((val - pMin) / (pMax - pMin)) * 100;
    return Math.max(0, Math.min(100, pct));
  };

  const currentPct = calculatePositionPercentage(state.lastPrice, min, max);
  const entryPct = calculatePositionPercentage(state.entryA, min, max);
  const slPct = calculatePositionPercentage(sl, min, max);
  const tpPct = calculatePositionPercentage(tp1, min, max);
  const hedgePct = calculatePositionPercentage(state.entryB, min, max);

  return (
    <div className={cn("relative w-full h-full flex flex-col justify-center px-10 py-6 transition-all duration-1000", 
      state.intelligence?.regime === 'RANGE' ? "bg-amber-500/[0.03]" : 
      state.intelligence?.regime === 'VOLATILE' ? "bg-rose-500/[0.03]" : "bg-cyan-500/[0.02]")}>
      
      {/* Regime Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.05] pointer-events-none overflow-hidden">
         {state.intelligence?.regime === 'RANGE' && <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_0%,_#fcd535_100%)] animate-pulse" />}
         {state.intelligence?.regime === 'VOLATILE' && <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,_#f43f5e_0px,_transparent_2px,_transparent_10px)]" />}
      </div>

      {/* Distance Telemetry */}
      {state.botState === 'HEDGE_PENDING' && (
         <div className="absolute top-10 right-10 flex flex-col items-end">
            <span className="text-[10px] font-black text-[var(--holo-gold)] tracking-widest uppercase mb-1">Hedge Distance</span>
            <div className="flex items-center gap-2 bg-[var(--holo-gold)]/10 border border-[var(--holo-gold)]/20 px-2 py-1 rounded">
               <Wind className="w-3 h-3 text-[var(--holo-gold)] animate-pulse" />
               <span className="font-mono text-sm font-bold text-white">-{state.distanceToHedge?.toFixed(2)} USDT</span>
            </div>
         </div>
      )}

      {/* Tactical Rail */}
      <div className="relative h-1.5 bg-white/5 rounded-full w-full">
          {/* Zones */}
          <div className="absolute inset-y-0 bg-emerald-500/10 rounded-l-full" style={{ left: isBuy ? `${entryPct}%` : `${tpPct}%`, right: isBuy ? `${100 - tpPct}%` : `${100 - entryPct}%` }} />
          <div className="absolute inset-y-0 bg-rose-500/10 rounded-r-full" style={{ left: isBuy ? `${slPct}%` : `${entryPct}%`, right: isBuy ? `${100 - entryPct}%` : `${100 - slPct}%` }} />

          {/* Scale Labels */}
          <div className="absolute -top-8 w-full flex justify-between px-2 text-[8px] font-mono text-gray-500 tabular-nums">
             <span>${min.toLocaleString()}</span>
             <span>${max.toLocaleString()}</span>
          </div>

          {/* Markers */}
          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-4 bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)] z-20" style={{ left: `${entryPct}%` }}>
             <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[7px] font-black text-fuchsia-400">ENTRY</span>
          </div>

          {sl > 0 && (
            <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-rose-600 z-10" style={{ left: `${slPct}%` }}>
               <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[7px] font-black text-rose-500">STOP</span>
            </div>
          )}

          {tp1 > 0 && (
            <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-3 bg-emerald-500 z-10" style={{ left: `${tpPct}%` }}>
               <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[7px] font-black text-emerald-400 italic">TP_MAX</span>
            </div>
          )}

          {state.entryB > 0 && (
             <>
               {state.hedgeStrategy === 'GRID_HEDGE' ? (
                  Array.from({ length: state.gridLayers || 3 }).map((_, i) => {
                    const gap = state.gridGapPct || 0.5;
                    const layerOffset = (state.entryB ? Math.abs(state.entryA - state.entryB) : 5) + (state.entryA * (gap * i / 100));
                    const layerPrice = isBuy ? state.entryA - layerOffset : state.entryA + layerOffset;
                    const layerPct = calculatePositionPercentage(layerPrice, min, max);
                    
                    return (
                       <div key={i} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[var(--holo-gold)]/40" style={{ left: `${layerPct}%` }}>
                          {i === 0 && (
                            <div className="absolute -bottom-7 -translate-x-1/2 flex flex-col items-center">
                              <span className="text-[8px] font-black tracking-widest text-[var(--holo-gold)] uppercase">Grid Start</span>
                              <span className="font-mono text-[9px] text-[var(--holo-gold)]">${layerPrice.toFixed(1)}</span>
                            </div>
                          )}
                       </div>
                    );
                  })
               ) : (
                  <div className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] z-20" style={{ left: `${hedgePct}%` }}>
                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[7px] font-black text-amber-500 italic">HEDGE</span>
                  </div>
               )}
             </>
          )}

          {/* Current Price Beacon */}
          <div 
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-[0_0_20px_white] z-30 transition-all duration-300 ease-out"
            style={{ left: `${currentPct}%` }}
          >
             <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white text-black px-2 py-0.5 rounded-md text-[9px] font-black tabular-nums whitespace-nowrap shadow-xl">
               ${state.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}
             </div>
             <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-20" />
          </div>
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
    tpTiers: [], slOrder: null, events: [], intent: 'MONITORING',
    marginStats: {
      accountA: { balance: 1000, used: 0, free: 1000, pnlPct: 0 },
      accountB: { balance: 1000, used: 0, free: 1000, pnlPct: 0 }
    }
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [pnlHistoryA, setPnlHistoryA] = useState<number[]>([]);
  const [pnlHistoryB, setPnlHistoryB] = useState<number[]>([]);
  
  // Configuration State
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
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [state.events]);

  const handleStart = async () => {
    setLoading(true);
    const tId = toast.loading('Initializing Agent...');
    try {
      const parsedEntry = entryPrice ? Number(entryPrice) : undefined;
      const res = await fetch('/api/delta-master/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol, 
          qtyA: Number(qtyA), 
          sideA, 
          entryPrice: parsedEntry,
          entryOffset: Number(entryOffset), 
          slPercent: Number(slPercent),
          tpTiersArray: tpTiers.split(',').map(Number),
          hedgeStrategy,
          gridLayers: Number(gridLayers),
          gridGapPct: Number(gridGapPct),
          maxDrawdownPct: Number(maxDrawdown),
          leverA: 10, leverB: 20
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Deployment failed');
      }
      toast.success('Agent Deployed!', { id: tId });
    } catch (err: any) {
      console.error('Failed to start Delta Master:', err);
      toast.error(`Deployment Failed: ${err.message}`);
    }
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

  const handleStop = async () => {
    setLoading(true);
    const tId = toast.loading('Terminating Agent...');
    try {
      const res = await fetch('/api/delta-master/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Termination failed');
      }
      toast.success('Agent Terminated', { id: tId });
    } catch (err: any) {
      toast.error(err.message, { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const calculateRisk = () => {
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

  const badge = useMemo(() => {
    if (!state.isActive) return { color: 'text-gray-500 bg-gray-500/10 border-gray-500/20', text: 'OFFLINE', icon: <StopCircle className="w-3 h-3" /> };
    
    switch(state.botState) {
      case 'PRIMARY_ACTIVE':
        return { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', text: 'PRIMARY ACTIVE', icon: <Zap className="w-3 h-3 text-emerald-400" /> };
      case 'HEDGE_PENDING':
        return { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30 animate-pulse', text: 'HEDGE PENDING (AUTH)', icon: <Activity className="w-3 h-3 text-amber-400" /> };
      case 'HEDGE_ACTIVE':
        return { color: 'text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10 border-[var(--holo-cyan)]/30 shadow-[0_0_15px_rgba(0,229,255,0.3)]', text: 'HEDGE ACTIVE', icon: <ShieldCheck className="w-3 h-3" /> };
      case 'TP_SCALING':
        return { color: 'text-violet-400 bg-violet-500/10 border-violet-500/30', text: 'TP SCALING', icon: <TrendingUp className="w-3 h-3" /> };
      case 'EMERGENCY':
        const isPanic = (state.hedgeScore || 0) > 90;
        return { 
          color: isPanic ? 'text-white bg-rose-600 border-rose-400 animate-[ping_1.5s_infinite] shadow-[0_0_30px_rgba(225,29,72,0.8)]' : 'text-rose-500 bg-rose-500/20 border-rose-500/50 animate-bounce', 
          text: isPanic ? '🚀 PANIC EXIT ACTIVE' : '🏛️ EMERGENCY EXIT', 
          icon: <AlertTriangle className="w-3 h-3" /> 
        };
      case 'IDLE':
      default:
        if (state.hedgeCycleLocked) {
          return { color: 'text-rose-600 bg-rose-900/20 border-rose-600/30', text: 'CYCLE LOCKED', icon: <Lock className="w-3 h-3" /> };
        }
        return { color: 'text-[#848e9c] bg-white/5 border-white/10', text: 'IDLE/MONITORING', icon: <Wind className="w-3 h-3" /> };
    }
  }, [state.botState, state.isActive, state.hedgeCycleLocked]);

  return (
    <div className="h-full flex flex-col p-2 text-white overflow-hidden bg-[#05070a]/80 backdrop-blur-3xl gap-2 font-sans selection:bg-[var(--holo-cyan)]/20">
      
      {/* ─── HEADER ─── */}
      <div className="flex items-center justify-between shrink-0 glass-panel px-3 py-2 border border-white/5 rounded-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-[var(--holo-cyan)]/10 border border-[var(--holo-cyan)]/20 rounded-lg">
            <Shield className="w-5 h-5 text-[var(--holo-cyan)]" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-sm font-black uppercase tracking-widest leading-none drop-shadow-md">Delta Master AI</h1>
            <span className="text-[9px] font-black text-[#848e9c] uppercase tracking-[0.2em] mt-1">Autonomous Hedge Matrix</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* AI Intelligence Matrix Status */}
          <div className="hidden xl:flex items-center gap-4 border-r border-white/10 pr-4 mr-1">
             <div className="flex flex-col items-end">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-[#848e9c] mb-0.5">Research Kernel</span>
                <div className={cn("flex items-center gap-1.5 px-2 py-0.5 border rounded transition-all duration-500", 
                  state.intelligence?.regime === 'TREND' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" : 
                  state.intelligence?.regime === 'RANGE' ? "bg-amber-500/10 border-amber-500/20 text-amber-400" : 
                  "bg-rose-500/10 border-rose-500/20 text-rose-400")}>
                   <div className={cn("w-1 h-1 rounded-full animate-pulse", 
                     state.intelligence?.regime === 'TREND' ? "bg-cyan-400" : 
                     state.intelligence?.regime === 'RANGE' ? "bg-amber-400" : "bg-rose-400")} />
                   <span className="text-[8px] font-mono font-black uppercase">{state.intelligence?.regime || 'INITIALIZING'} REGIME</span>
                </div>
             </div>

             <div className="flex flex-col items-end">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-[#848e9c] mb-0.5">Execution Kernel</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded">
                   <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                   <span className="text-[8px] font-mono font-bold text-blue-400 uppercase">
                     {state.intelligence?.executionAdvisory?.friction ? `FRICTION: ${state.intelligence.executionAdvisory.friction.toFixed(2)}%` : 'Gemma-3 Calculating'}
                   </span>
                </div>
             </div>

             <div className="flex flex-col items-end">
                <span className="text-[7px] font-black uppercase tracking-[0.2em] text-[#848e9c] mb-0.5">Shield Engine</span>
                <div className={cn("flex items-center gap-1.5 px-2 py-0.5 border rounded animate-in fade-in transition-all", 
                  state.botState === 'HEDGE_ACTIVE' ? "bg-rose-500/20 border-rose-500/40 text-rose-400" : 
                  state.botState === 'HEDGE_PENDING' ? "bg-amber-500/20 border-amber-500/40 text-amber-400" : "bg-white/5 border-white/10 text-white/40")}>
                   <ShieldCheck className={cn("w-3 h-3", state.botState === 'HEDGE_ACTIVE' && "animate-pulse")} />
                   <span className="text-[8px] font-mono font-black uppercase">
                     {state.botState === 'HEDGE_ACTIVE' ? 'Shield Active' : state.botState === 'HEDGE_PENDING' ? 'Authorized' : 'Gated'}
                   </span>
                </div>
             </div>
          </div>

          {/* Risk Matrix HUD */}
          <RiskMeter risk={calculateRisk()} />
          
          {/* Agent State Badge */}
          <div className={cn("px-2.5 py-1 rounded-md border text-[9px] font-black tracking-widest flex items-center gap-1.5 transition-colors duration-500", badge.color)}>
             {badge.icon}
             {badge.text}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-2 min-h-0">
         {/* ─── LEFT: CONTROLS & ACCOUNTS ─── */}
         <div className="w-full lg:w-[400px] flex flex-col gap-2 shrink-0 overflow-y-auto custom-scrollbar pr-1">
            
            {/* Account Panel Matrix */}
            <div className="grid grid-cols-2 gap-2">
               {/* Account A */}
               <div className="glass-panel border-white/10 p-3 rounded-xl flex flex-col relative overflow-hidden bg-black/40 hover:bg-black/60 transition-colors group">
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-[10px] font-black uppercase tracking-widest text-[#848e9c] group-hover:text-white transition-colors">Primary (A)</span>
                     {state.isActive && <div className="w-2 h-2 rounded-full bg-[var(--holo-cyan)] shadow-[0_0_8px_var(--holo-cyan)] animate-pulse" />}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={cn("text-2xl font-black font-mono tracking-tighter drop-shadow-md", state.pnlA >= 0 ? "text-[var(--holo-cyan)]" : "text-rose-500")}>
                        {state.pnlA >= 0 ? '+' : ''}{state.pnlA.toFixed(2)}
                    </span>
                    <span className={cn("text-[10px] font-bold font-mono", state.pnlA >= 0 ? "text-emerald-500/60" : "text-rose-500/60")}>
                       ({state.marginStats?.accountA.pnlPct.toFixed(2)}%)
                    </span>
                  </div>
                  {/* Micro Sparkline A */}
                  <div className="mt-1 h-4 flex items-center">
                    <MicroSparkline data={pnlHistoryA} color={state.pnlA >= 0 ? "#00e5ff" : "#f43f5e"} />
                  </div>
                  <div className="flex flex-col gap-1 mt-2 text-[9px] font-mono tracking-widest text-white/50">
                     <div className="flex justify-between border-b border-white/5 pb-0.5"><span>Balance:</span> <span className="text-white font-bold">${state.marginStats?.accountA.balance.toFixed(0)}</span></div>
                     <div className="flex justify-between border-b border-white/5 pb-0.5"><span>Used Margin:</span> <span className="text-white font-bold">${state.marginStats?.accountA.used.toFixed(1)}</span></div>
                     <div className="flex justify-between border-b border-white/5 pb-0.5"><span>Free Margin:</span> <span className="text-emerald-400 font-bold">${state.marginStats?.accountA.free.toFixed(1)}</span></div>
                     <div className="flex justify-between border-b border-white/5 pb-0.5 mt-1"><span>Active:</span> <span className="text-[var(--holo-cyan)] uppercase font-bold">{state.isActive ? (state.netExposureDelta > 0 ? `LONG ${qtyA}` : `SHORT ${qtyA}`) : 'NONE'}</span></div>
                  </div>
               </div>

               {/* Account B */}
               <div className={cn("glass-panel border-white/10 p-3 rounded-xl flex flex-col relative overflow-hidden transition-colors group", state.intent === 'HEDGING_ACTIVE' ? "bg-rose-500/10 border-rose-500/30 shadow-[inset_0_0_20px_rgba(244,63,94,0.1)]" : "bg-black/40 hover:bg-black/60")}>
                  <div className="flex justify-between items-center mb-2">
                     <span className="text-[10px] font-black uppercase tracking-widest text-[#848e9c] group-hover:text-white transition-colors">Hedge (B)</span>
                     {state.intent === 'HEDGING_ACTIVE' && <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse" />}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <span className={cn("text-2xl font-black font-mono tracking-tighter drop-shadow-md", state.pnlB >= 0 ? "text-[var(--holo-gold)]" : "text-rose-500", !state.pnlB && "text-white/20 blur-[1px]")}>
                        {state.pnlB >= 0 ? '+' : ''}{state.pnlB.toFixed(2)}
                    </span>
                    {state.pnlB !== 0 && (
                       <span className={cn("text-[10px] font-bold font-mono text-white/40")}>
                          ({state.marginStats?.accountB.pnlPct.toFixed(2)}%)
                       </span>
                    )}
                  </div>
                  {/* Micro Sparkline B */}
                  <div className="mt-1 h-4 flex items-center">
                    <MicroSparkline data={pnlHistoryB} color={state.pnlB >= 0 ? "#fcd535" : "#f43f5e"} />
                  </div>
                  <div className="flex flex-col gap-1 mt-2 text-[9px] font-mono tracking-widest text-white/50">
                     <div className="flex justify-between border-b border-white/5 pb-0.5"><span>Balance:</span> <span className="text-white font-bold">${state.marginStats?.accountB.balance.toFixed(0)}</span></div>
                     <div className="flex justify-between border-b border-white/5 pb-0.5"><span>Used Margin:</span> <span className="text-white font-bold">${state.marginStats?.accountB.used.toFixed(1)}</span></div>
                     <div className="flex justify-between border-b border-white/5 pb-0.5"><span>Free Margin:</span> <span className="text-emerald-400 font-bold">${state.marginStats?.accountB.free.toFixed(1)}</span></div>
                     <div className="flex justify-between border-b border-white/5 pb-0.5 mt-1"><span>Status:</span> <span className={cn("uppercase font-bold", state.intent === 'HEDGING_ACTIVE' ? "text-rose-500" : "text-white/40")}>{state.intent}</span></div>
                  </div>
               </div>
            </div>

            {/* Shield Score Matrix HUD */}
            <ShieldScoreHUD 
              score={state.hedgeScore || 0}
              Distance={state.scoreComponents?.distance || 0}
              Volatility={state.scoreComponents?.volatility || 0}
              Risk={state.scoreComponents?.drawdown || 0}
              AI={state.scoreComponents?.ai || 0}
              isLocked={state.hedgeCycleLocked}
              cooldown={state.hedgeCooldownUntil}
              onReset={handleResetShield}
            />

            {/* Intelligence Matrix HUD */}
            <IntelligenceMatrix intel={state.intelligence} />

            {/* Trade Control Panel */}
            <div className="glass-panel p-3 rounded-xl border-white/10 bg-black/40 flex flex-col gap-3 shrink-0">
               <div className="flex items-center gap-2 mb-1">
                  <StopCircle className="w-3.5 h-3.5 text-[var(--holo-cyan)]" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Execution Parameters</span>
               </div>
               
               <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                     <label className="text-[8px] font-black uppercase text-[#848e9c] tracking-widest ml-1">Asset Target</label>
                     <div className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 font-mono text-[10px] uppercase text-white shadow-inner">{symbol}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                     <label className="text-[8px] font-black uppercase text-[#848e9c] tracking-widest ml-1">Entry Price <span className="text-[var(--holo-cyan)] text-[7px] lowercase">(Blank=Mkt)</span></label>
                     <input type="text" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} placeholder="MARKET" className="bg-black/60 border border-white/10 focus:border-[var(--holo-cyan)]/50 rounded-lg px-2 py-1.5 font-mono text-[10px] outline-none transition-colors shadow-inner text-[var(--holo-cyan)] placeholder:text-[var(--holo-cyan)]/30" />
                  </div>
                  
                  <div className="flex flex-col gap-1">
                     <label className="text-[8px] font-black uppercase text-rose-400 tracking-widest ml-1">Stop Loss (%)</label>
                     <input type="number" step="0.1" value={slPercent} onChange={(e) => setSlPercent(e.target.value)} className="bg-rose-500/5 border border-rose-500/20 focus:border-rose-500/50 rounded-lg px-2 py-1.5 font-mono text-[10px] outline-none transition-colors shadow-inner" />
                  </div>
                  <div className="flex flex-col gap-1">
                     <label className="text-[8px] font-black uppercase text-emerald-400 tracking-widest ml-1">TP Tiers (CSV)</label>
                     <input type="text" value={tpTiers} onChange={(e) => setTpTiers(e.target.value)} placeholder="2,3,4,5" className="bg-emerald-500/5 border border-emerald-500/20 focus:border-emerald-500/50 rounded-lg px-2 py-1.5 font-mono text-[10px] outline-none transition-colors shadow-inner" />
                  </div>
               </div>

               <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent my-1" />

               <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                     <label className="text-[8px] font-black uppercase text-[#848e9c] tracking-widest ml-1">Hedge Strategy</label>
                     <select value={hedgeStrategy} onChange={(e: any) => setHedgeStrategy(e.target.value)} className="bg-black/60 border border-white/10 focus:border-[var(--holo-gold)]/50 rounded-lg px-2 py-1.5 font-mono text-[10px] text-[var(--holo-gold)] outline-none transition-colors shadow-inner appearance-none custom-select">
                        <option value="OFF">OFF (Manual)</option>
                        <option value="MIRROR">MIRROR (Instant)</option>
                        <option value="DELAYED">DELAYED (Safer)</option>
                        <option value="GRID_HEDGE">GRID (Advanced)</option>
                        <option value="DYNAMIC">DYNAMIC (AI/ATR)</option>
                     </select>
                  </div>
                  <div className="flex flex-col gap-1">
                     <label className="text-[8px] font-black uppercase text-[var(--holo-magenta)] tracking-widest ml-1">Drawdown Max (%)</label>
                     <input type="number" step="0.5" value={maxDrawdown} onChange={(e) => setMaxDrawdown(e.target.value)} className="bg-[var(--holo-magenta)]/5 border border-[var(--holo-magenta)]/20 focus:border-[var(--holo-magenta)]/50 rounded-lg px-2 py-1.5 font-mono text-[10px] outline-none transition-colors shadow-inner text-[var(--holo-magenta)]" />
                  </div>
               </div>

               {hedgeStrategy === 'GRID_HEDGE' && (
                  <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                     <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase text-[var(--holo-gold)] tracking-widest ml-1">Grid Layers</label>
                        <input type="number" value={gridLayers} onChange={(e) => setGridLayers(e.target.value)} className="bg-[var(--holo-gold)]/5 border border-[var(--holo-gold)]/20 focus:border-[var(--holo-gold)]/50 rounded-lg px-2 py-1.5 font-mono text-[10px] outline-none transition-colors shadow-inner text-[var(--holo-gold)]" />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[8px] font-black uppercase text-[var(--holo-gold)] tracking-widest ml-1">Gap per Layer (%)</label>
                        <input type="number" step="0.1" value={gridGapPct} onChange={(e) => setGridGapPct(e.target.value)} className="bg-[var(--holo-gold)]/5 border border-[var(--holo-gold)]/20 focus:border-[var(--holo-gold)]/50 rounded-lg px-2 py-1.5 font-mono text-[10px] outline-none transition-colors shadow-inner text-[var(--holo-gold)]" />
                     </div>
                  </div>
               )}

               <div className="flex gap-2 mt-2">
                  {!state.isActive ? (
                     <button onClick={handleStart} disabled={loading} className="flex-1 py-3 bg-[var(--holo-cyan)] text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-lg hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <Play className="w-4 h-4 fill-black" /> Open Trade
                     </button>
                  ) : (
                     <button onClick={handleStop} disabled={loading} className="flex-1 py-3 bg-rose-500 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-lg hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                        <StopCircle className="w-4 h-4" /> Close Positions & Exit
                     </button>
                  )}
                  <button className="px-4 py-3 bg-white/5 text-white/50 border border-white/10 font-black uppercase tracking-[0.2em] text-[10px] rounded-lg hover:bg-white/10 hover:text-white transition-all">
                     Reset
                  </button>
               </div>
            </div>
         </div>

         {/* ─── RIGHT: VISUAL & LOGS ─── */}
         <div className="flex-1 flex flex-col gap-2 min-h-[400px]">
            {/* Hybrid Chart Area */}
            <div className="flex-[2] glass-panel rounded-xl border-white/10 bg-black/40 relative overflow-hidden flex flex-col">
               <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                  <BarChart2 className="w-4 h-4 text-[#5e6673]" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-[#848e9c]">Virtual Tactical Matrix</span>
               </div>
               <VisualHUD state={state} sideA={sideA} />
            </div>

            {/* Expandable Logs Terminal */}
            <div className="flex-1 glass-panel rounded-xl border-white/10 bg-[#0b0e11] flex flex-col overflow-hidden shadow-[inset_0_4px_20px_rgba(0,0,0,0.5)]">
               <div className="flex items-center justify-between px-3 py-2 bg-white/5 border-b border-white/5 shrink-0">
                  <div className="flex gap-4 overflow-x-auto no-scrollbar">
                     {['ALL', 'TRADE', 'HEDGE', 'ERROR'].map(f => (
                        <button key={f} onClick={() => setLogFilter(f as any)} className={cn("text-[9px] font-black tracking-widest uppercase transition-colors px-1 pb-1 border-b-2", logFilter === f ? "text-[var(--holo-cyan)] border-[var(--holo-cyan)]" : "text-[#5e6673] border-transparent hover:text-white")}>
                           {f}
                        </button>
                     ))}
                  </div>
                  <span className="text-[8px] font-mono font-bold text-white/20 lowercase hidden sm:block">tail -f /logs</span>
               </div>
               <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col font-mono text-[9px] gap-1.5">
                  {state.events?.length === 0 && (
                     <div className="text-white/20 italic">Awaiting telemetry streams...</div>
                  )}
                  {state.events && [...state.events].reverse().filter(ev => {
                    if (logFilter === 'ALL') return true;
                    if (logFilter === 'ERROR' && (ev.type.toLowerCase().includes('error') || ev.type.toLowerCase().includes('warning') || ev.type.toLowerCase().includes('risk'))) return true;
                    if (logFilter === 'HEDGE' && (ev.type.toLowerCase().includes('hedge') || ev.type.toLowerCase().includes('shield'))) return true;
                    if (logFilter === 'TRADE' && (ev.type.toLowerCase().includes('trade') || ev.type.toLowerCase().includes('hit'))) return true;
                    return false;
                  }).map((ev, i) => {
                     let color = 'text-white/60';
                     if (ev.type.toLowerCase().includes('error') || ev.type.toLowerCase().includes('warning') || ev.type.toLowerCase().includes('risk')) color = 'text-rose-500';
                     else if (ev.type.toLowerCase().includes('hedge') || ev.type.toLowerCase().includes('armed') || ev.type.toLowerCase().includes('live')) color = 'text-[var(--holo-gold)]';
                     else if (ev.type.toLowerCase().includes('opened') || ev.type.toLowerCase().includes('trade') || ev.type.toLowerCase().includes('dhe')) color = 'text-[var(--holo-cyan)] border-l-2 border-[var(--holo-cyan)] pl-2';
                     else if (ev.type.toLowerCase().includes('tp_hit') || ev.type.toLowerCase().includes('target')) color = 'text-emerald-400';
                     
                     const time = new Date(ev.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' });

                     return (
                        <div key={ev.id} className="flex gap-2 items-start leading-relaxed hover:bg-white/5 px-1 py-0.5 rounded transition-colors group">
                           <span className="text-white/30 shrink-0 select-none">[{time}]</span>
                           <span className={cn(color, "font-bold lowercase tracking-wider mt-px shrink-0 select-none")}>_{ev.type}</span>
                           <span className="text-white/80 break-words group-hover:text-white transition-colors">{ev.message}</span>
                        </div>
                     )
                  })}
                  <div ref={logsEndRef} />
               </div>
            </div>
         </div>
      </div>
    </div>
  );
});
