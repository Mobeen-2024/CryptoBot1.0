import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Shield, Zap, TrendingUp, TrendingDown, Activity, AlertCircle, StopCircle, Play, ShieldCheck, Gauge, Wind, AlertTriangle } from 'lucide-react';
import { cn } from '../utils/cn';
import { PerformanceHUD } from './PerformanceHUD';
import StressTestSuite from './StressTestSuite';
import BotPilotSetup from './BotPilotSetup';

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
  hedgeStatus: 'inactive' | 'pending' | 'active';
  hedgeQty: number;
  netExposureDelta: number;
  accumulatedFees?: number; // Phase 9
  intelligence?: {
    sentiment: number;
    sentimentConfidence?: number;
    reasoningSnippet?: string;
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
    atr?: number;
    dynamicFriction?: number;
    lastNewsUpdate?: number;
  };
  rateLimit?: {
    accountA: { limit: number; remaining: number; reset: number };
    accountB: { limit: number; remaining: number; reset: number };
  };
  marginHealth?: {
    freeMargin: number;
    threshold: number;
    lastTransfer?: number;
  };
  telemetry?: {
    avgLatency: number;
    lastSlippage?: number;
    executionSpeed: number;
    heartbeat: number;
    latencyBreakdown?: { // Phase 9
      exchangeFetch: number;
      logicProcessing: number;
      orderExecution: number;
    };
  };
}

export const DeltaMasterAgentPanel: React.FC<{ symbol: string }> = ({ symbol }) => {
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<DeltaMasterState>({
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
    dmsStatus: 'inactive',
    tpTiers: [],
    slOrder: null,
    hedgeStatus: 'inactive',
    hedgeQty: 0,
    netExposureDelta: 0,
    intelligence: undefined
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [latency, setLatency] = useState(0);

  const [qtyA, setQtyA] = useState('0.1');
  const [leverA, setLeverA] = useState(10);
  const [leverB, setLeverB] = useState(20);
  const [entryOffset, setEntryOffset] = useState('5');
  const [slPercent, setSlPercent] = useState('1.0');
  const [tpTiers, setTpTiers] = useState('4');
  const [sideA, setSideA] = useState<'buy' | 'sell'>('buy');
  const [atrMultiplier, setAtrMultiplier] = useState('1.0');
  const [showPilotSetup, setShowPilotSetup] = useState(false);
  const [isPilotArmed, setIsPilotArmed] = useState(false);

  useEffect(() => {
    let lastUpdate = 0;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/delta-master/status');
        if (res.ok) {
          const data = await res.json();
          setState(data);
        }
      } catch {}
    };
    
    fetchStatus();

    if ((window as any).socket) {
      const socket = (window as any).socket;
      const handleStatusUpdate = (data: DeltaMasterState) => {
        const now = Date.now();
        if (now - lastUpdate > 500 || data.isActive !== state.isActive) {
          setState(data);
          lastUpdate = now;
        }
        setWsConnected(true);
      };
      // ... socket setup code remains ...
      socket.on('connect', () => {
        setWsConnected(true);
        fetchStatus();
      });
      socket.on('disconnect', () => setWsConnected(false));
      socket.on('delta_master_status', handleStatusUpdate);
      
      const interval = setInterval(() => {
        if (socket.connected) {
          const start = Date.now();
          socket.emit('ping_telemetry', () => setLatency(Date.now() - start));
        }
      }, 5000);

      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('delta_master_status', handleStatusUpdate);
        clearInterval(interval);
      };
    }
  }, []);

  const handleStart = async () => {
    setLoading(true);
    const tId = toast.loading('Deploying Phase 9 Architecture...');
    try {
      const res = await fetch('/api/delta-master/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          symbol, 
          qtyA: Number(qtyA), 
          sideA, 
          leverA, 
          leverB, 
          entryOffset: Number(entryOffset), 
          protectionRatio: 1.0, 
          atrMultiplier: Number(atrMultiplier),
          slPercent: Number(slPercent),
          tpTiers: tpTiers
        })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Deployment failed');
      }
      toast.success('Delta Master Deployed!', { id: tId });
    } catch (err: any) {
      toast.error(err.message, { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      await fetch('/api/delta-master/stop', { method: 'POST' });
      toast.success('Agent Terminated');
    } catch {} finally {
      setLoading(false);
    }
  };


  const runSimulation = async (scenario: string) => {
    toast.promise(
      fetch('/api/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, symbol })
      }),
      {
        loading: `Running ${scenario}...`,
        success: `${scenario} Initiated.`,
        error: 'Simulation failed.'
      }
    );
  };

  return (
    <div className="w-full h-full flex flex-col p-3 text-white overflow-y-auto custom-scrollbar bg-slate-950/40">
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/20 border border-indigo-500/30 rounded-lg">
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter italic leading-none">Delta Master <span className="text-indigo-400">Phase 12</span></h1>
            <p className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-0.5">Recursive Hedge Architecture</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {!isPilotArmed ? (
              <button 
                onClick={() => setShowPilotSetup(true)} 
                className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg hover:bg-indigo-500/20 transition-all text-indigo-400"
                title="Arm Bot Pilot"
              >
                 <Zap className="w-3 h-3" />
              </button>
            ) : (
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
              </div>
            )}
            <button 
              onClick={() => window.location.reload()} 
              className="p-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all text-gray-500 hover:text-white"
              title="Hard Refresh"
            >
               <Activity className="w-3 h-3" />
            </button>
           <div className={cn(
              "px-3 py-1 rounded-full border text-[9px] font-black tracking-widest flex items-center gap-2",
              wsConnected ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse"
           )}>
              <div className="flex flex-col items-end">
                 <div className="flex items-center gap-1.5">
                    <Activity className="w-3 h-3" />
                    {wsConnected ? `SYNCED: ${latency}ms` : 'OFFLINE'}
                 </div>
              </div>
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
        {/* Account A PnL */}
        <div className="glass-panel border-indigo-500/20 p-2 rounded-xl col-span-1">
          <div className="flex justify-between items-center mb-1">
             <span className="text-[7px] font-black uppercase tracking-widest text-gray-500">Principal (A)</span>
             <span className="text-[6px] font-bold text-indigo-400 px-1 bg-indigo-500/10 rounded">LIVE</span>
          </div>
          <span className={cn("text-lg font-black font-mono tracking-tighter", state.pnlA >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {state.pnlA.toFixed(2)}
          </span>
          <div className="mt-1 flex gap-2">
             <div className="bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                <span className="text-[6px] text-gray-500 uppercase font-black block">Ent</span>
                <span className="text-[9px] font-mono font-bold text-white">${state.entryA.toLocaleString()}</span>
             </div>
             <div className="bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                <span className="text-[6px] text-gray-500 uppercase font-black block">Phase</span>
                <span className="text-[9px] font-black text-indigo-400 uppercase">{state.phase}</span>
             </div>
          </div>
        </div>

        {/* Net Exposure HUD */}
        <div className="glass-panel border-white/10 p-2 rounded-xl bg-white/5 flex flex-col items-center justify-center relative overflow-hidden">
           <span className="text-[7px] font-black uppercase tracking-[0.1em] text-indigo-400 mb-1 z-10">Exposure Delta</span>
           
           <div className="relative w-full h-4 flex items-center justify-center z-10 mb-1">
              <div className="absolute w-full h-0.5 bg-white/5 rounded-full" />
              <div 
                className={cn(
                  "absolute h-1 rounded-full transition-all duration-500",
                  Math.abs(state.netExposureDelta) < 0.01 ? "bg-emerald-500 w-1 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-indigo-500"
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
        <div className="glass-panel border-amber-500/20 p-2 rounded-xl relative col-span-1">
          <div className="flex justify-between items-center mb-1">
             <span className="text-[7px] font-black uppercase tracking-widest text-gray-500">Insurance (B)</span>
             <div className={cn(
               "px-1 py-0.5 rounded text-[6px] font-black uppercase",
               state.hedgeStatus === 'active' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
             )}>
               {state.hedgeStatus}
             </div>
          </div>
          <span className={cn("text-lg font-black font-mono tracking-tighter", state.pnlB >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {state.pnlB.toFixed(2)}
          </span>
          <div className="mt-1 flex gap-2">
             <div className="bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                <span className="text-[6px] text-gray-500 uppercase font-black block">Ent</span>
                <span className="text-[9px] font-mono font-bold text-white">${state.entryB.toLocaleString()}</span>
             </div>
             <div className="bg-black/20 px-1.5 py-0.5 rounded border border-white/5">
                <span className="text-[6px] text-gray-500 uppercase font-black block">Mgn</span>
                <span className="text-[9px] font-mono font-bold text-amber-400">${state.availableMarginB.toFixed(0)}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
         {/* Volatility & ATR HUD */}
         <div className="glass-panel p-4 rounded-2xl border-white/5 bg-black/20 space-y-3">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Volatility HUD</span>
               </div>
               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{state.intelligence?.regime || 'SCANNING...'}</span>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
               <div className="bg-white/5 p-2 rounded-xl border border-white/5 text-center">
                  <span className="text-[8px] text-gray-500 uppercase font-black block mb-0.5 tracking-tightest">ATR (14)</span>
                  <div className="text-sm font-black font-mono text-white">
                     {state.intelligence?.atr?.toFixed(1) || '0.0'}
                  </div>
               </div>
               <div className="bg-indigo-500/10 p-2 rounded-xl border border-indigo-500/20 text-center">
                  <span className="text-[8px] text-indigo-400 uppercase font-black block mb-0.5 tracking-tightest">Bot Bias</span>
                  <div className="text-sm font-black font-mono text-white">
                     {state.intelligence?.sentiment?.toFixed(1) || '0.0'}
                  </div>
               </div>
            </div>
         </div>
 
         {/* Phase 11: Reasoning HUD */}
         <div className="glass-panel p-4 rounded-2xl border-indigo-500/30 bg-black/40 space-y-3">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-400" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Reasoning Snippet</span>
               </div>
            </div>
            <div className="bg-black/60 rounded-xl border border-white/10 p-3 h-16 overflow-y-auto custom-scrollbar font-mono text-[8px] leading-relaxed">
               <span className="text-gray-400 italic">
                 {state.intelligence?.reasoningSnippet || '> Waiting for ingestion...'}
               </span>
            </div>
         </div>
 
         {/* Net Performance HUD */}
         <div className="glass-panel p-4 rounded-2xl border-emerald-500/30 bg-emerald-500/10 flex flex-col justify-center text-center col-span-2 py-3">
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-emerald-400">Net PnL</span>
            <span className={cn("text-3xl font-black font-mono tracking-tighter", state.netPnl >= 0 ? "text-white" : "text-rose-400")}>
               {state.netPnl >= 0 ? '+' : ''}{state.netPnl.toFixed(2)}
            </span>
         </div>
      </div>

      {/* Control Panel: Phase 12 High Density Command */}
      {!state.isActive ? (
         <div className="glass-panel p-3 rounded-xl border-white/10 space-y-3 bg-black/40">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-indigo-400 ml-1">Pair</label>
                  <div className="bg-black/60 border border-white/10 rounded px-2 py-1.5 font-mono text-[9px] text-indigo-300">{symbol}</div>
               </div>
               
               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-indigo-400 ml-1">Qty (A)</label>
                  <input 
                    type="text" 
                    value={qtyA} 
                    onChange={(e) => setQtyA(e.target.value)} 
                    className="bg-black/60 border border-white/10 focus:border-indigo-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none" 
                  />
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-rose-400 ml-1">Stop Loss (%)</label>
                  <input 
                    type="text" 
                    value={slPercent} 
                    onChange={(e) => setSlPercent(e.target.value)} 
                    className="bg-black/60 border border-rose-500/20 focus:border-rose-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none" 
                  />
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-emerald-400 ml-1">TP Tiers (%)</label>
                  <input 
                    type="text" 
                    value={tpTiers} 
                    onChange={(e) => setTpTiers(e.target.value)} 
                    placeholder="2,3,4,5"
                    className="bg-black/60 border border-emerald-500/20 focus:border-emerald-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none" 
                  />
               </div>

               <div className="flex flex-col gap-1">
                  <label className="text-[7px] font-black uppercase text-indigo-400 ml-1">Hedge Offset</label>
                  <input 
                    type="text" 
                    value={entryOffset} 
                    onChange={(e) => setEntryOffset(e.target.value)} 
                    className="bg-black/60 border border-white/10 focus:border-indigo-500/50 rounded px-2 py-1.5 font-mono text-[9px] outline-none" 
                  />
               </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
               <div className="flex gap-1 bg-black/60 p-1 rounded border border-white/10 h-8">
                  <button onClick={() => setSideA('buy')} className={cn("flex-1 text-[7px] font-black rounded transition-all", sideA === 'buy' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "text-gray-500")}>LONG (A)</button>
                  <button onClick={() => setSideA('sell')} className={cn("flex-1 text-[7px] font-black rounded transition-all", sideA === 'sell' ? "bg-rose-500/20 text-rose-400 border border-rose-500/20" : "text-gray-500")}>SHORT (A)</button>
               </div>
               
               <button onClick={handleStart} disabled={loading} className="py-2 bg-indigo-600 text-black font-black uppercase tracking-widest text-[9px] rounded hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">
                  <Play className="w-3.5 h-3.5 fill-black" />
                  Deploy Agent
               </button>
            </div>
         </div>
      ) : (
          <div className="grid grid-cols-4 gap-2">
            <div className="glass-panel p-2 rounded-xl border-white/10 col-span-2">
               <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-[7px] font-black uppercase text-indigo-400">Exits Monitoring</span>
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
};
