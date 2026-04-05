import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Shield, Zap, TrendingUp, TrendingDown, Activity, AlertCircle, StopCircle, Play, Cpu, Gauge, Wind, AlertTriangle, ShieldCheck } from 'lucide-react';
import { cn } from '../utils/cn';
import { PerformanceHUD } from './PerformanceHUD';
import StressTestSuite from './StressTestSuite';
import BotPilotSetup from './BotPilotSetup';

interface BinanceMasterState {
  isActive: boolean;
  phase: string;
  pnlA: number;
  pnlB: number;
  netPnl: number;
  lastPrice: number;
  entryA: number;
  entryB: number;
  symbol: string;
  availableMarginB: number;
  hmacStatus: string;
  tpTiers: { price: number; qty: number; status: 'waiting' | 'filled'; tier: number }[];
  slOrder: { id: string; price: number; qty: number; status: 'open' | 'filled' | 'closed'; isBreakEven: boolean } | null;
  hedgeStatus: 'inactive' | 'pending' | 'active';
  hedgeQty: number;
  netExposureDelta: number;
  accumulatedFees?: number;
  marginStats?: {
    accountA: { balance: number; used: number; free: number; pnlPct: number };
    accountB: { balance: number; used: number; free: number; pnlPct: number };
  };
  intelligence?: {
    sentiment: number;
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
    atr?: number;
    dynamicFriction?: number;
    reasoningSnippet?: string;
  };
  telemetry?: {
    avgLatency: number;
    executionSpeed: number;
    heartbeat: number;
  };
  hedgeStrategy?: 'OFF' | 'MIRROR' | 'DELAYED' | 'GRID_HEDGE' | 'DYNAMIC';
  gridLayers?: number;
  gridGapPct?: number;
  distanceToHedge?: number;
}

const PnLSparkline = React.memo(({ data, color }: { data: number[]; color: string }) => {
  if (data.length < 2) return <div className="h-4 w-12 bg-white/5 rounded-sm animate-pulse" />;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((d, i) => `${(i / (data.length - 1)) * 50},${15 - ((d - min) / range) * 15}`).join(' ');
  
  return (
    <svg width="50" height="15" className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
});

const RiskMeter = React.memo(({ risk }: { risk: number }) => {
  const bars = 10;
  const activeBars = Math.ceil((Math.min(100, risk) / 100) * bars);
  const barString = '█'.repeat(activeBars) + '░'.repeat(bars - activeBars);
  let color = 'text-emerald-400';
  let label = '🟢 SAFE';
  if (risk > 60) { color = 'text-rose-500 animate-pulse'; label = '🔴 HIGH'; }
  else if (risk > 30) { color = 'text-[var(--holo-gold)]'; label = '🟡 MODERATE'; }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <span className="text-[6px] font-black uppercase text-gray-500 tracking-widest">{label}</span>
      <div className={cn("font-mono text-[9px] tracking-tighter flex items-center gap-1.5", color)}>
        <span className="opacity-30">[{barString}]</span>
        <span className="font-black">{risk.toFixed(0)}%</span>
      </div>
    </div>
  );
});

const VisualHUD = React.memo(({ state, sideA, gridLayers, gridGapPct }: { state: BinanceMasterState, sideA: string, gridLayers: string, gridGapPct: string }) => {
  if (!state.isActive) return null;
  const isBuy = sideA === 'buy';
  const range = (state.slOrder?.price || 0) - state.entryA || 1000;
  const start = state.entryA - range * 0.2;
  const end = (state.slOrder?.price || 0) + range * 0.2;
  const scale = (p: number) => ((p - start) / (end - start)) * 100;

  return (
    <div className="glass-panel p-3 rounded-xl border-white/5 bg-black/40 mb-3 relative overflow-hidden h-24">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[7px] font-black uppercase tracking-[0.2em] text-gray-500">Tactical Rail · Binance</span>
        <div className="flex gap-4">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-fuchsia-500" />
            <span className="text-[6px] font-black text-gray-400 uppercase">Primary</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            <span className="text-[6px] font-black text-gray-400 uppercase">Hedge</span>
          </div>
        </div>
      </div>

      <div className="relative w-full h-1.5 bg-white/5 rounded-full mt-4">
        {/* Rail Track */}
        <div className="absolute w-full h-full border-y border-white/5 opacity-20" />
        
        {/* SL Marker */}
        {state.slOrder && (
          <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-4 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)] z-20" style={{ left: `${scale(state.slOrder.price)}%` }}>
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[6px] font-bold text-rose-500">SL</span>
          </div>
        )}

        {/* TP Markers */}
        {state.tpTiers.map((tp, i) => (
          <div key={i} className={cn("absolute top-1/2 -translate-y-1/2 w-0.5 h-3 z-10", tp.status === 'filled' ? "bg-emerald-500" : "bg-emerald-500/30 font-black")} style={{ left: `${scale(tp.price)}%` }}>
            <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[5px] text-emerald-500">TP{tp.tier}</span>
          </div>
        ))}

        {/* Entry A */}
        <div className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-fuchsia-500 shadow-[0_0_10px_rgba(217,70,239,0.5)] z-30" style={{ left: `${scale(state.entryA)}%` }}>
           <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[6px] font-black text-fuchsia-400">ENTRY</span>
        </div>

        {/* Hedge Marker(s) */}
        {state.hedgeStrategy === 'GRID_HEDGE' ? (
          Array.from({ length: Number(gridLayers) }).map((_, i) => {
             const gap = Number(gridGapPct) || 0.5;
             const offset = i * (state.entryA * (gap / 100));
             const price = isBuy ? state.entryB - offset : state.entryB + offset; // Simplified projection
             return (
               <div key={i} className="absolute top-1/2 -translate-y-1/2 w-0.5 h-2.5 bg-amber-500/50 border border-amber-500/30 z-20" style={{ left: `${scale(price)}%` }} />
             );
          })
        ) : (
          <div className="absolute top-1/2 -translate-y-1/2 w-1 h-3 bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] z-30" style={{ left: `${scale(state.entryB)}%` }}>
             <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[6px] font-black text-amber-500">HEDGE</span>
          </div>
        )}

        {/* Current Price */}
        <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white shadow-[0_0_15px_white] z-40 transition-all duration-300 ring-2 ring-white/20" style={{ left: `${scale(state.lastPrice)}%` }}>
          <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-white text-black px-1 rounded text-[7px] font-black tabular-nums">
            ${state.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 1 })}
          </div>
        </div>
      </div>
    </div>
  );
});

export const BinanceMasterAgentPanel = React.memo(({ symbol }: { symbol: string }) => {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<BinanceMasterState>({
    isActive: false,
    phase: 'IDLE',
    pnlA: 0,
    pnlB: 0,
    netPnl: 0,
    lastPrice: 0,
    entryA: 0,
    entryB: 0,
    symbol: '',
    availableMarginB: 0,
    hmacStatus: 'inactive',
    tpTiers: [],
    slOrder: null,
    hedgeStatus: 'inactive',
    hedgeQty: 0,
    netExposureDelta: 0
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [latency, setLatency] = useState(0);

  const [qtyA, setQtyA] = useState('0.1');
  const [qtyB, setQtyB] = useState('0.1');
  const [entryOffset, setEntryOffset] = useState(100);
  const [sideA, setSideA] = useState<'buy' | 'sell'>('buy');
  const [atrMultiplier, setAtrMultiplier] = useState(1.0);
  const [slPercent, setSlPercent] = useState('1.0');
  const [tpTiers, setTpTiers] = useState('2,3,4,5');
  const [hedgeStrategy, setHedgeStrategy] = useState<'OFF' | 'MIRROR' | 'DELAYED' | 'GRID_HEDGE' | 'DYNAMIC'>('MIRROR');
  const [gridLayers, setGridLayers] = useState('3');
  const [gridGapPct, setGridGapPct] = useState('0.5');
  const [pnlHistoryA, setPnlHistoryA] = useState<number[]>([]);
  const [pnlHistoryB, setPnlHistoryB] = useState<number[]>([]);
  const [showPilotSetup, setShowPilotSetup] = useState(false);
  const [isPilotArmed, setIsPilotArmed] = useState(false);

  useEffect(() => {
    setPnlHistoryA(prev => [...prev.slice(-29), state.pnlA]);
    setPnlHistoryB(prev => [...prev.slice(-29), state.pnlB]);
  }, [state.pnlA, state.pnlB]);

  const calculateRisk = () => {
    if (!state.isActive || !state.marginStats) return 0;
    const used = (state.marginStats.accountA.used || 0) + (state.marginStats.accountB.used || 0);
    const balance = (state.marginStats.accountA.balance || 0) + (state.marginStats.accountB.balance || 0);
    const marginRisk = (used / (balance || 1)) * 100;
    const loss = Math.max(0, -state.pnlA) + Math.max(0, -state.pnlB);
    const pnlRisk = (loss / (balance || 1)) * 100;
    const volFactor = (state.intelligence?.volatilityScore || 0) / 10;
    return Math.min(100, marginRisk + pnlRisk + volFactor);
  };

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(`/api/binance-master/status?symbol=${encodeURIComponent(symbol)}`);
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch {}
    };
    
    fetchStatus();

    if ((window as any).socket) {
      const socket = (window as any).socket;
      const handleStatusUpdate = (data: BinanceMasterState) => {
        setState(data);
        setWsConnected(true);
      };
      socket.on('connect', () => {
        setWsConnected(true);
        fetchStatus();
      });
      socket.on('disconnect', () => setWsConnected(false));
      socket.on('binance_master_status_' + symbol, handleStatusUpdate);
      
      const interval = setInterval(() => {
        if (socket.connected) {
          const start = Date.now();
          socket.emit('ping_telemetry', () => setLatency(Date.now() - start));
        }
      }, 5000);

      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('binance_master_status', handleStatusUpdate);
        clearInterval(interval);
      };
    }
  }, []);


  const handleStart = async () => {
    setLoading(true);
    const tId = toast.loading('Deploying Phase 9 Binance Architecture...');
    try {
      const res = await fetch('/api/binance-master/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol, 
          qtyA: Number(qtyA), 
          qtyB: Number(qtyB), 
          sideA, 
          entryOffset: Number(entryOffset), 
          protectionRatio: 1.0, 
          atrMultiplier,
          slPercent: Number(slPercent),
          tpTiers,
          hedgeStrategy,
          gridLayers: Number(gridLayers),
          gridGapPct: Number(gridGapPct)
        })
      });
      if (!res.ok) throw new Error('Deployment failed');
      toast.success('Binance Master Deployed!', { id: tId });
    } catch (err: any) {
      toast.error(err.message, { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await fetch('/api/binance-master/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      toast.success('Agent Terminated');
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-3 text-white overflow-y-auto custom-scrollbar bg-slate-950/40">
      
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-lg">
            <Cpu className="w-4 h-4 text-fuchsia-400" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter italic leading-none">Binance Master <span className="text-fuchsia-400">Phase 12</span></h1>
            <p className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-0.5">Agentic Exposure Orchestration</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <RiskMeter risk={calculateRisk()} />
           <div className={cn(
              "px-3 py-1 rounded-lg border text-[9px] font-black tracking-widest bg-black/40",
              wsConnected ? "border-emerald-500/20 text-emerald-400" : "border-rose-500/20 text-rose-400 animate-pulse"
           )}>
              {wsConnected ? `SYNCED · ${latency}ms` : 'OFFLINE'}
           </div>
        </div>
      </div>

      <PerformanceHUD 
        telemetry={state.telemetry}
        netExposureDelta={state.netExposureDelta}
        accumulatedFees={state.accumulatedFees}
        atr={state.intelligence?.atr}
        dynamicFriction={state.intelligence?.dynamicFriction}
      />

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="glass-panel border-fuchsia-500/20 p-2 rounded-xl col-span-1">
          <div className="flex justify-between items-center mb-1">
             <div className="flex flex-col">
                <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">Spot Alpha (A)</span>
                <PnLSparkline data={pnlHistoryA} color="#f472b6" />
             </div>
             <span className="text-[6px] font-bold text-fuchsia-400 px-1 bg-fuchsia-500/10 rounded">LIVE</span>
          </div>
          <span className={cn("text-lg font-black font-mono tracking-tighter", state.pnlA >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {state.pnlA.toFixed(2)}
          </span>
          <div className="mt-1 flex gap-2">
             <div className="bg-black/20 px-1.5 py-0.5 rounded border border-white/5 flex flex-col items-center">
                <span className="text-[5px] text-gray-500 uppercase font-black block">Entry</span>
                <span className="text-[8px] font-mono font-bold text-white">${state.entryA.toLocaleString()}</span>
             </div>
             <div className="bg-black/20 px-1.5 py-0.5 rounded border border-white/5 flex flex-col items-center">
                <span className="text-[5px] text-gray-500 uppercase font-black block">HMAC</span>
                <span className="text-[8px] font-black text-fuchsia-400 uppercase tracking-widest">{state.hmacStatus}</span>
             </div>
          </div>
        </div>

        <div className="glass-panel border-white/10 p-2 rounded-xl bg-white/5 flex flex-col items-center justify-center relative overflow-hidden col-span-1">
           <span className="text-[7px] font-black uppercase tracking-[0.1em] text-fuchsia-400 mb-1 z-10">Exposure Delta</span>
           
           <div className="relative w-full h-4 flex items-center justify-center z-10 mb-1">
              <div className="absolute w-full h-0.5 bg-white/5 rounded-full" />
              <div 
                className={cn(
                  "absolute h-1 rounded-full transition-all duration-500",
                  Math.abs(state.netExposureDelta) < 0.01 ? "bg-emerald-500 w-1 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-fuchsia-500"
                )}
                style={{ 
                  left: '50%',
                  width: `${Math.min(45, Math.abs(state.netExposureDelta) * 50)}%`,
                  transform: state.netExposureDelta >= 0 ? 'translateX(0)' : 'translateX(-100%)'
                }}
              />
           </div>
           
           <div className="flex items-center gap-1 z-10">
              <span className="text-sm font-black font-mono tracking-tighter">
                {state.netExposureDelta.toFixed(3)}
              </span>
           </div>
        </div>

        {/* Account B PnL */}
        <div className="glass-panel border-amber-500/20 p-2 rounded-xl relative overflow-hidden col-span-1">
          <div className="flex justify-between items-center mb-1">
             <div className="flex flex-col">
                <span className="text-[7px] font-black uppercase tracking-widest text-gray-400">Insurance (B)</span>
                <PnLSparkline data={pnlHistoryB} color="#fbbf24" />
             </div>
             <div className={cn(
               "px-1 py-0.5 rounded text-[5px] font-black uppercase",
               state.hedgeStatus === 'active' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
             )}>
               {state.hedgeStatus}
             </div>
          </div>
          <span className={cn("text-lg font-black font-mono tracking-tighter", state.pnlB >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {state.pnlB.toFixed(2)}
          </span>
          <div className="mt-1 flex gap-2">
             <div className="bg-black/20 px-1.5 py-0.5 rounded border border-white/5 flex flex-col items-center">
                <span className="text-[5px] text-gray-500 uppercase font-black block">Trigger</span>
                <span className="text-[8px] font-mono font-bold text-white">${state.entryB.toLocaleString()}</span>
             </div>
             <div className="bg-black/20 px-1.5 py-0.5 rounded border border-white/5 flex flex-col items-center">
                <span className="text-[5px] text-gray-500 uppercase font-black block">Margin</span>
                <span className="text-[8px] font-mono font-bold text-amber-400">${state.availableMarginB.toFixed(0)}</span>
             </div>
          </div>
        </div>
      </div>

      <VisualHUD state={state} sideA={sideA} gridLayers={gridLayers} gridGapPct={gridGapPct} />

      <div className="grid grid-cols-4 gap-2 mb-3">
         {/* Volatility & ATR HUD */}
         <div className="glass-panel p-2 rounded-xl border-white/5 bg-black/20 space-y-1 col-span-2 flex flex-col justify-center">
            <div className="flex items-center justify-between mb-1">
               <div className="flex items-center gap-1.5">
                  <Wind className="w-3 h-3 text-fuchsia-400" />
                  <span className="text-[7px] font-black uppercase tracking-widest">Volatility HUD</span>
               </div>
               <span className="text-[7px] font-black text-fuchsia-400 uppercase">{state.intelligence?.regime || 'SCAN'}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
               <div className="bg-white/5 p-1 rounded-lg border border-white/5 flex justify-between items-center px-2">
                  <span className="text-[6px] text-gray-500 uppercase font-black">ATR</span>
                  <span className="text-[10px] font-black font-mono text-white">{state.intelligence?.atr?.toFixed(2) || '0.00'}</span>
               </div>
               <div className="bg-fuchsia-500/10 p-1 rounded-lg border border-fuchsia-500/20 flex justify-between items-center px-2">
                  <span className="text-[6px] text-fuchsia-400 uppercase font-black">FRIC</span>
                  <span className="text-[10px] font-black font-mono text-fuchsia-400">±{state.intelligence?.dynamicFriction?.toFixed(2) || '2.00'}</span>
               </div>
            </div>
         </div>

         {/* Reasoning HUD (Bot Pilot) */}
         <div className="glass-panel p-2 rounded-xl border-indigo-500/20 bg-indigo-500/5 col-span-2 relative overflow-hidden">
            <div className="flex items-center gap-1.5 mb-1">
               <Cpu className="w-3 h-3 text-indigo-400" />
               <span className="text-[7px] font-black uppercase text-indigo-400 tracking-widest">Bot Pilot Reasoning</span>
            </div>
            <p className="text-[8px] leading-tight text-gray-300 italic line-clamp-2">
               {state.intelligence?.reasoningSnippet || "Awaiting seasonal sentiment consensus..."}
            </p>
         </div>
      </div>

      {/* Control Panel: Phase 12 High Density Command */}
      {!state.isActive ? (
         <div className="glass-panel p-3 rounded-xl border-white/10 space-y-3 bg-black/40">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">Pair</label>
                  <div className="bg-black/60 border border-white/10 rounded px-2 py-1.5 font-mono text-[9px] text-fuchsia-300">{symbol}</div>
               </div>
               
               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">Qty (A)</label>
                  <input 
                    type="text" 
                    value={qtyA} 
                    onChange={(e) => setQtyA(e.target.value)} 
                    className="bg-black/60 border border-white/10 focus:border-fuchsia-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none" 
                  />
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">Offset</label>
                  <input 
                    type="text" 
                    value={entryOffset} 
                    onChange={(e) => setEntryOffset(Number(e.target.value))} 
                    className="bg-black/60 border border-white/10 focus:border-fuchsia-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none" 
                  />
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">ATR K-Mult</label>
                  <input 
                    type="text" 
                    value={atrMultiplier} 
                    onChange={(e) => setAtrMultiplier(Number(e.target.value))} 
                    className="bg-black/60 border border-white/10 focus:border-fuchsia-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none" 
                  />
               </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">SL %</label>
                  <input 
                    type="text" 
                    value={slPercent} 
                    onChange={(e) => setSlPercent(e.target.value)} 
                    className="bg-black/60 border border-white/10 focus:border-fuchsia-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none text-rose-400" 
                  />
               </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">TP Tiers</label>
                  <input 
                    type="text" 
                    value={tpTiers} 
                    onChange={(e) => setTpTiers(e.target.value)} 
                    className="bg-black/60 border border-white/10 focus:border-fuchsia-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none text-emerald-400" 
                  />
               </div>
               <div className="flex flex-col gap-1">
                   <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">Strategy</label>
                   <select value={hedgeStrategy} onChange={(e: any) => setHedgeStrategy(e.target.value)} className="bg-black/60 border border-white/10 rounded px-2 py-1.5 font-mono text-[9px] text-[var(--holo-gold)] outline-none appearance-none">
                      <option value="MIRROR">MIRROR</option>
                      <option value="DELAYED">DELAYED</option>
                      <option value="GRID_HEDGE">GRID</option>
                      <option value="DYNAMIC">DYNAMIC</option>
                   </select>
                </div>

                {hedgeStrategy === 'GRID_HEDGE' && (
                  <>
                     <div className="flex flex-col gap-1">
                        <label className="text-[7px] font-black uppercase text-[var(--holo-gold)] ml-1">Grid Lyrs</label>
                        <input type="number" value={gridLayers} onChange={(e) => setGridLayers(e.target.value)} className="bg-black/60 border border-white/10 rounded px-2 py-1.5 font-mono text-[9px] text-[var(--holo-gold)] outline-none" />
                     </div>
                     <div className="flex flex-col gap-1">
                        <label className="text-[7px] font-black uppercase text-[var(--holo-gold)] ml-1">Gap (%)</label>
                        <input type="number" step="0.1" value={gridGapPct} onChange={(e) => setGridGapPct(e.target.value)} className="bg-black/60 border border-white/10 rounded px-2 py-1.5 font-mono text-[9px] text-[var(--holo-gold)] outline-none" />
                     </div>
                  </>
                )}

               <div className="flex flex-col gap-1 col-span-1">
                  <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">Side (A)</label>
                  <div className="flex gap-1 bg-black/60 p-1 rounded border border-white/10 h-full">
                     <button onClick={() => setSideA('buy')} className={cn("flex-1 text-[7px] font-black rounded transition-all", sideA === 'buy' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "text-gray-500")}>LONG</button>
                     <button onClick={() => setSideA('sell')} className={cn("flex-1 text-[7px] font-black rounded transition-all", sideA === 'sell' ? "bg-rose-500/20 text-rose-400 border border-rose-500/20" : "text-gray-500")}>SHORT</button>
                  </div>
               </div>
            </div>
           
            <button onClick={handleStart} disabled={loading} className="w-full py-3 bg-[var(--holo-cyan)] text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-lg hover:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all flex items-center justify-center gap-2">
               <Play className="w-4 h-4 fill-black" />
               Deploy Strategy Engine
            </button>
         </div>
      ) : (
         <div className="grid grid-cols-4 gap-2">
            <div className="glass-panel p-2 rounded-xl border-white/10 col-span-2">
               <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-[7px] font-black uppercase text-fuchsia-400">Exits Monitoring</span>
               </div>
               <div className="grid grid-cols-4 gap-2">
                  {state.tpTiers.map((tier, i) => (
                     <div key={i} className={cn("p-1.5 rounded-lg border text-center", tier.status === 'filled' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-black/20 border-white/5 opacity-60")}>
                        <span className="text-[6px] font-black text-gray-500 uppercase block">T{tier.tier}</span>
                        <span className="text-[9px] font-mono font-black">${tier.price.toLocaleString()}</span>
                     </div>
                  ))}
               </div>
            </div>

            <div className="col-span-1">
               <StressTestSuite 
                 symbol={symbol} 
               />
            </div>

            <button onClick={handleStop} className="bg-rose-500 text-black font-black uppercase text-[8px] rounded-xl hover:brightness-110 active:scale-95 transition-all flex flex-col items-center justify-center gap-1">
               <StopCircle className="w-4 h-4" />
               TERMINATE
            </button>
         </div>
      )}

      {showPilotSetup && (
        <BotPilotSetup 
          onArmed={() => setIsPilotArmed(true)} 
          onClose={() => setShowPilotSetup(false)} 
        />
      )}
    </div>
  );
});
