import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Shield, Zap, TrendingUp, TrendingDown, Activity, AlertCircle, StopCircle, Play, ShieldCheck } from 'lucide-react';
import { cn } from '../utils/cn';

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
  intelligence?: {
    sentiment: number;
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
  };
  rateLimit?: {
    accountA: { limit: number; remaining: number; reset: number };
    accountB: { limit: number; remaining: number; reset: number };
  };
  marginHealth?: {
    freeMargin: number;
    threshold: number;
    lastTransfer?: number;
  }
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
    intelligence: undefined
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [latency, setLatency] = useState(0);

  const [qtyA, setQtyA] = useState('0.1');
  const [qtyB, setQtyB] = useState('0.1');
  const [leverA, setLeverA] = useState(10);
  const [leverB, setLeverB] = useState(20);
  const [entryOffset, setEntryOffset] = useState(5);
  const [sideA, setSideA] = useState<'buy' | 'sell'>('buy');

  useEffect(() => {
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
        setState(data);
        setWsConnected(true);
      };
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
    const tId = toast.loading('Deploying Phase 7 Architecture...');
    try {
      const res = await fetch('/api/delta-master/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, qtyA: Number(qtyA), qtyB: Number(qtyB), sideA, leverA, leverB, entryOffset: Number(entryOffset), protectionRatio: 1.0 })
      });
      if (!res.ok) throw new Error('Deployment failed');
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

  return (
    <div className="w-full h-full flex flex-col p-6 text-white overflow-y-auto custom-scrollbar">
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl">
            <Shield className="w-8 h-8 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter italic">Delta Master <span className="text-indigo-400">2026</span></h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Symmetrical Sourcing & Recursive Consistency</p>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/5 animate-pulse">
              <div className="w-1 h-1 bg-indigo-500 rounded-full" />
              <span className="text-[8px] font-black uppercase tracking-widest text-indigo-400">RPC FEED ACTIVE</span>
           </div>
           {state.rateLimit && (
              <div className="hidden md:flex items-center gap-4 px-4 py-1.5 bg-black/20 rounded-full border border-white/5">
                 <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-gray-500 tracking-widest text-center">API A</span>
                    <span className={cn("text-[9px] font-mono font-bold", state.rateLimit.accountA.remaining < 20 ? "text-rose-400" : "text-indigo-400")}>
                       {state.rateLimit.accountA.remaining} RMS
                    </span>
                 </div>
                 <div className="w-px h-6 bg-white/10" />
                 <div className="flex flex-col">
                    <span className="text-[7px] font-black uppercase text-gray-500 tracking-widest text-center">API B</span>
                    <span className={cn("text-[9px] font-mono font-bold", state.rateLimit.accountB.remaining < 20 ? "text-rose-400" : "text-fuchsia-400")}>
                       {state.rateLimit.accountB.remaining} RMS
                    </span>
                 </div>
              </div>
           )}
           <div className={cn(
              "px-5 py-2 rounded-full border text-[11px] font-black tracking-widest flex items-center gap-3",
              wsConnected ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse"
           )}>
              <Activity className="w-3.5 h-3.5" />
              {wsConnected ? `SYNCED: ${latency}ms` : 'LINK SEVERED'}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        {/* Account A PnL */}
        <div className="glass-panel border-indigo-500/20 p-5 rounded-3xl">
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Account A (Principal)</span>
          <span className={cn("text-4xl font-black font-mono tracking-tighter", state.pnlA >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {state.pnlA.toFixed(2)} <span className="text-sm font-bold text-gray-500">USDT</span>
          </span>
          <div className="mt-4 grid grid-cols-2 gap-4">
             <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Entry</span>
                <span className="text-sm font-mono font-bold text-white">${state.entryA.toLocaleString()}</span>
             </div>
             <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Status</span>
                <span className="text-sm font-black text-indigo-400 uppercase">{state.phase}</span>
             </div>
          </div>
        </div>

        {/* Account B PnL */}
        <div className="glass-panel border-amber-500/20 p-5 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex justify-between items-start mb-2">
             <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block">Account B (Insurance)</span>
             {state.isActive && (
               <div className={cn(
                 "px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-widest",
                 state.entryB < state.entryA ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-blue-500/10 border-blue-500/30 text-blue-400"
               )}>
                 {state.entryB < state.entryA ? 'LONG PROTECTION (SELL-STOP)' : 'SHORT PROTECTION (BUY-STOP)'}
               </div>
             )}
          </div>
          <span className={cn("text-4xl font-black font-mono tracking-tighter", state.pnlB >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {state.pnlB.toFixed(2)} <span className="text-sm font-bold text-gray-500">USDT</span>
          </span>
          <div className="mt-4 grid grid-cols-2 gap-4">
             <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Trigger</span>
                <span className="text-sm font-mono font-bold text-white">${state.entryB.toLocaleString()}</span>
             </div>
             <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Available Margin</span>
                <span className="text-sm font-mono font-bold text-white">${state.availableMarginB.toFixed(2)}</span>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
         {/* Margin Guard HUD */}
         <div className="glass-panel p-6 rounded-[2rem] border-white/5 bg-indigo-500/5 flex flex-col justify-center relative overflow-hidden">
            <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-10">
               <ShieldCheck className="w-20 h-20 text-indigo-400" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Margin Guard Protocol</span>
            <div className="flex items-center gap-4">
               <div className={cn("px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest", state.availableMarginB > 50 ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse")}>
                  {state.availableMarginB > 50 ? 'HEALTHY' : 'REBALANCING'}
               </div>
               {state.marginHealth?.lastTransfer && (
                 <span className="text-[10px] font-mono text-gray-500">Last Refill: {new Date(state.marginHealth.lastTransfer).toLocaleTimeString()}</span>
               )}
            </div>
         </div>

         {/* Net Portfolio HUD */}
         <div className="glass-panel p-6 rounded-[2rem] border-indigo-500/30 bg-indigo-500/10 flex flex-col justify-center text-center">
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-1">Net Performance</span>
            <span className={cn("text-5xl font-black font-mono tracking-tighter", state.netPnl >= 0 ? "text-white" : "text-rose-400")}>
               {state.netPnl >= 0 ? '+' : ''}{state.netPnl.toFixed(2)}
            </span>
         </div>
      </div>

      {/* Control Panel */}
      {!state.isActive ? (
        <div className="glass-panel p-8 rounded-[2.5rem] border-white/10 space-y-6">
           <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Symbol</label>
                 <input readOnly value={symbol} className="bg-black/40 border border-white/5 rounded-xl px-4 py-2 font-mono text-sm text-gray-400 outline-none" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Qty (A)</label>
                 <input type="number" value={qtyA} onChange={(e) => setQtyA(e.target.value)} className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 font-mono text-sm outline-none focus:border-indigo-500/50" />
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Side (A)</label>
                 <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/10">
                    <button onClick={() => setSideA('buy')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg", sideA === 'buy' ? "bg-emerald-500/20 text-emerald-400" : "text-gray-500")}>BUY</button>
                    <button onClick={() => setSideA('sell')} className={cn("flex-1 py-1 text-[10px] font-black rounded-lg", sideA === 'sell' ? "bg-rose-500/20 text-rose-400" : "text-gray-500")}>SELL</button>
                 </div>
              </div>
              <div className="flex flex-col gap-2">
                 <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Offset</label>
                 <input type="number" value={entryOffset} onChange={(e) => setEntryOffset(Number(e.target.value))} className="bg-black/40 border border-white/10 rounded-xl px-4 py-2 font-mono text-sm outline-none" />
              </div>
           </div>
           
           <button onClick={handleStart} disabled={loading} className="w-full py-5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-black font-black uppercase tracking-[0.4em] text-xs rounded-2xl shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3">
              <Play className="w-5 h-5 fill-black" />
              Deploy 2026 Insurance Architecture
           </button>
        </div>
      ) : (
        <div className="space-y-6">
           {/* Managed Exits HUD */}
           <div className="glass-panel p-6 rounded-[2rem] border-white/5 space-y-6">
              <div className="flex justify-between items-center">
                 <span className="text-xs font-black uppercase tracking-widest text-indigo-400">Atomic Managed Exits</span>
                 <div className="flex gap-3">
                    <div className={cn("px-3 py-1 rounded-lg border text-[9px] font-black uppercase", state.hedgeStatus === 'active' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : "bg-gray-500/10 border-gray-500/20 text-gray-500")}>
                       SHIELD: {state.hedgeStatus.toUpperCase()}
                    </div>
                 </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {state.tpTiers.map((tier, i) => (
                    <div key={i} className={cn("p-4 rounded-2xl border transition-all", tier.status === 'filled' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-black/20 border-white/5 opacity-60")}>
                       <span className="text-[9px] font-black text-gray-500 uppercase block mb-1">Tier {tier.tier}</span>
                       <span className="text-sm font-mono font-black">${tier.price.toLocaleString()}</span>
                    </div>
                 ))}
              </div>
           </div>

           <button onClick={handleStop} disabled={loading} className="w-full py-5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-black uppercase tracking-[0.4em] text-xs rounded-[2rem] transition-all flex items-center justify-center gap-3">
              <StopCircle className="w-6 h-6" />
              Sever Agentic Link
           </button>
        </div>
      )}

    </div>
  );
};
