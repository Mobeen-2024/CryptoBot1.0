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

export const BinanceMasterAgentPanel: React.FC<{ symbol: string }> = ({ symbol }) => {
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
    netExposureDelta: 0,
    intelligence: undefined
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
  const [showPilotSetup, setShowPilotSetup] = useState(false);
  const [isPilotArmed, setIsPilotArmed] = useState(false);

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
          tpTiers
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
          <div className="p-1.5 bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-lg">
            <Cpu className="w-4 h-4 text-fuchsia-400" />
          </div>
          <div>
            <h1 className="text-sm font-black uppercase tracking-tighter italic leading-none">Binance Master <span className="text-fuchsia-400">Phase 12</span></h1>
            <p className="text-[7px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-0.5">Agentic Exposure Orchestration</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            {!isPilotArmed ? (
              <button 
                onClick={() => setShowPilotSetup(true)} 
                className="p-1.5 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-lg hover:bg-fuchsia-500/40 transition-all text-fuchsia-400"
                title="Arm Bot Pilot"
              >
                 <Zap className="w-3 h-3" />
              </button>
            ) : (
              <div className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
              </div>
            )}
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
        <div className="glass-panel border-fuchsia-500/20 p-2 rounded-xl col-span-1">
          <div className="flex justify-between items-center mb-1">
             <span className="text-[7px] font-black uppercase tracking-widest text-gray-500">Spot Alpha (A)</span>
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

        {/* Net Exposure HUD */}
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
             <span className="text-[7px] font-black uppercase tracking-widest text-gray-500">Insurance (B)</span>
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

               <div className="flex flex-col gap-1 col-span-1">
                  <label className="text-[7px] font-black uppercase text-fuchsia-400 ml-1">Side (A)</label>
                  <div className="flex gap-1 bg-black/60 p-1 rounded border border-white/10 h-full">
                     <button onClick={() => setSideA('buy')} className={cn("flex-1 text-[7px] font-black rounded transition-all", sideA === 'buy' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/20" : "text-gray-500")}>LONG</button>
                     <button onClick={() => setSideA('sell')} className={cn("flex-1 text-[7px] font-black rounded transition-all", sideA === 'sell' ? "bg-rose-500/20 text-rose-400 border border-rose-500/20" : "text-gray-500")}>SHORT</button>
                  </div>
               </div>
            </div>
           
            <button onClick={handleStart} disabled={loading} className="w-full py-2 bg-fuchsia-600 text-black font-black uppercase tracking-widest text-[9px] rounded hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2">
               <Play className="w-3.5 h-3.5 fill-black" />
               Deploy Agentic HMAC
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
};
