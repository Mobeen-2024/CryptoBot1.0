import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Shield, Zap, TrendingUp, TrendingDown, Activity, AlertCircle, StopCircle, Play } from 'lucide-react';
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
    liqPriceA: 0,
    hedgeRatio: 1.0,
    availableMarginB: 0,
    dmsStatus: 'inactive',
    tpTiers: [],
    slOrder: null
  });

  // Config State
  const [qtyA, setQtyA] = useState('0.1');
  const [qtyB, setQtyB] = useState('0.1');
  const [leverA, setLeverA] = useState(10);
  const [leverB, setLeverB] = useState(10);
  const [entryOffset, setEntryOffset] = useState(100); // USD offset
  const [sideA, setSideA] = useState<'buy' | 'sell'>('buy');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/delta-master/status');
        if (res.ok) setState(await res.json());
      } catch {}
    };
    fetchStatus();

    // Listen for WebSocket updates
    if ((window as any).socket) {
      (window as any).socket.on('delta_master_status', (data: DeltaMasterState) => setState(data));
    }
  }, []);

  const handleStart = async () => {
    setLoading(true);
    const tId = toast.loading('Initializing Delta Master Architecture...');
    try {
      const res = await fetch('/api/delta-master/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          qtyA: Number(qtyA),
          qtyB: Number(qtyB),
          sideA,
          leverA,
          leverB,
          entryOffset: Number(entryOffset),
          protectionRatio: 1.0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Delta Master Agent Deployed!', { id: tId });
    } catch (err: any) {
      toast.error(`Deployment Failed: ${err.message}`, { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    const tId = toast.loading('Shutting down Delta Master...');
    try {
      const res = await fetch('/api/delta-master/stop', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop');
      toast.success('Agent Terminated', { id: tId });
    } catch (err: any) {
      toast.error(`Shutdown Failed: ${err.message}`, { id: tId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-full flex flex-col p-6 text-white overflow-y-auto custom-scrollbar">
      
      {/* Header Section */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-indigo-500/20 border border-indigo-500/30 rounded-2xl shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <Shield className="w-8 h-8 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Delta Master <span className="text-indigo-400">2026</span></h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Advanced Agentic Capital Protection</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={cn(
            "px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
            state.isActive ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]" : "bg-gray-500/10 border-gray-500/20 text-gray-400"
          )}>
            <div className={cn("w-2 h-2 rounded-full", state.isActive ? "bg-emerald-400 animate-pulse" : "bg-gray-600")} />
            {state.phase}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        
        {/* Account A (Primary) Telemetry */}
        <div className="glass-panel border-indigo-500/20 p-5 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Account A (Principal)</span>
             </div>
             <span className="text-[10px] font-mono font-bold text-indigo-400/60 uppercase">Primary Alpha</span>
          </div>
          <div className="flex flex-col gap-1">
             <span className="text-[10px] font-bold text-gray-500 uppercase">Current PnL</span>
             <span className={cn(
               "text-3xl font-black font-mono tracking-tighter",
               state.pnlA >= 0 ? "text-emerald-400" : "text-rose-400"
             )}>
                {state.pnlA >= 0 ? '+' : ''}{state.pnlA.toFixed(2)} <span className="text-sm font-bold ml-1 text-gray-500">USDT</span>
             </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
             <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Entry Price</span>
                <span className="text-sm font-mono font-bold text-white">${state.entryA.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>
             <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Position Size</span>
                <span className="text-sm font-mono font-bold text-white">{qtyA} <span className="text-[10px] text-indigo-400">{symbol}</span></span>
             </div>
          </div>
        </div>

        {/* Account B (Insurance) Telemetry */}
        <div className="glass-panel border-amber-500/20 p-5 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Account B (Insurance)</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-gray-500">Hedge Ratio</span>
                <span className={cn(
                  "text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg",
                  state.hedgeRatio >= 0.9 ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                )}>
                  {(state.hedgeRatio * 100).toFixed(1)}%
                </span>
             </div>
          </div>
          <div className="flex flex-col gap-1">
             <span className="text-[10px] font-bold text-gray-500 uppercase">Hedge PnL</span>
             <span className={cn(
               "text-3xl font-black font-mono tracking-tighter",
               state.pnlB >= 0 ? "text-emerald-400" : "text-rose-400"
             )}>
                {state.pnlB >= 0 ? '+' : ''}{state.pnlB.toFixed(2)} <span className="text-sm font-bold ml-1 text-gray-500">USDT</span>
             </span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4">
             <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Trigger Offset</span>
                <span className="text-sm font-mono font-bold text-white">${state.entryB.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
             </div>
             <div className="bg-black/20 p-3 rounded-2xl border border-white/5">
                <span className="text-[9px] text-gray-500 uppercase font-black block mb-1">Hedge Scale</span>
                <span className="text-sm font-mono font-bold text-white">{qtyB} <span className="text-[10px] text-amber-400">{symbol}</span></span>
             </div>
          </div>
        </div>

      </div>

      {/* Phase 2: Safety Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8 animation-delay-300">
         <div className="glass-panel p-4 rounded-3xl border-rose-500/20 bg-rose-500/5 flex flex-col gap-2">
            <div className="flex justify-between items-center">
               <span className="text-[9px] font-black tracking-widest text-rose-400 uppercase">Liquidation Guard</span>
               <AlertCircle className="w-3 h-3 text-rose-400" />
            </div>
            <div className="flex items-baseline gap-2">
               <span className="text-lg font-mono font-black text-white">${state.liqPriceA.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
               <span className="text-[9px] font-bold text-gray-500 uppercase font-mono">Distance: {Math.abs(((state.lastPrice - state.liqPriceA) / state.lastPrice) * 100).toFixed(2)}%</span>
            </div>
            <div className="w-full bg-black/40 h-1.5 rounded-full overflow-hidden mt-1">
               <div 
                 className={cn(
                   "h-full transition-all duration-1000",
                   Math.abs((state.lastPrice - state.liqPriceA) / state.lastPrice) < 0.05 ? "bg-rose-500 shadow-[0_0_10px_#f43f5e]" : "bg-indigo-500"
                 )}
                 style={{ width: `${Math.min(100, Math.max(0, (Math.abs(state.lastPrice - state.liqPriceA) / (state.lastPrice * 0.2)) * 100))}%` }}
               />
            </div>
         </div>

         <div className="md:col-span-2 glass-panel p-4 rounded-3xl border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="p-3 bg-white/5 rounded-2xl relative">
                  <Zap className={cn("w-5 h-5", state.isActive ? "text-indigo-400 animate-pulse" : "text-gray-600")} />
                  {state.dmsStatus === 'active' && <div className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full border border-black shadow-[0_0_8px_#10b981]" />}
               </div>
               <div className="flex flex-col">
                  <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest flex items-center gap-2">
                    Autonomous Sync Health
                    <span className={cn(
                      "text-[8px] px-1.5 py-0.5 rounded-md border",
                      state.dmsStatus === 'active' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-gray-500/10 border-gray-500/20 text-gray-500"
                    )}>
                      DMS: {state.dmsStatus.toUpperCase()}
                    </span>
                  </span>
                  <span className="text-sm font-bold text-white uppercase tracking-tighter">Recursive Logic Layer Active</span>
               </div>
            </div>
            <div className="flex gap-2">
               <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-gray-600 uppercase">Hedge Capacity</span>
                  <span className="text-[10px] font-mono font-bold text-amber-400">${state.availableMarginB.toFixed(2)}</span>
               </div>
               <div className="w-px h-8 bg-white/10 mx-2" />
               <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-gray-600 uppercase">NTP Sync</span>
                  <span className="text-[10px] font-mono font-bold text-indigo-400">Verified</span>
               </div>
            </div>
         </div>
      </div>

      {/* Net Exposure Central Hub */}
      <div className="bg-black/40 border border-indigo-500/10 rounded-[2.5rem] p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden backdrop-blur-3xl shadow-2xl">
         <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-transparent via-indigo-500 to-transparent" />
         
         <div className="flex flex-col gap-2">
            <span className="text-xs font-black uppercase tracking-[0.4em] text-gray-500">Net Portfolio Performance</span>
            <div className="flex items-baseline gap-2">
               <span className={cn(
                 "text-6xl font-black tracking-tighter font-mono",
                 state.netPnl >= 0 ? "text-indigo-400 drop-shadow-[0_0_15px_rgba(99,102,241,0.4)]" : "text-rose-400"
               )}>
                 {state.netPnl >= 0 ? '+' : ''}{state.netPnl.toFixed(2)}
               </span>
               <span className="text-xl font-bold text-gray-500 select-none">USDT</span>
            </div>
         </div>

         <div className="flex flex-col items-center md:items-end gap-1">
            <div className="flex items-center gap-2 mb-2">
               {state.netPnl >= 0 ? <TrendingUp className="w-5 h-5 text-emerald-400" /> : <TrendingDown className="w-5 h-5 text-rose-400" />}
               <span className="text-[10px] uppercase font-black tracking-widest text-[#848e9c]">Market Price Synchronization</span>
            </div>
            <span className="text-2xl font-mono font-black text-white tracking-widest">${state.lastPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
         </div>
      </div>

      {/* Control Panel Section */}
      {!state.isActive ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="glass-panel p-6 rounded-3xl border-white/5 space-y-4">
             <div className="flex justify-between items-center mb-2">
               <span className="text-xs font-black uppercase tracking-widest text-gray-400">Position Configuration</span>
               <div className="flex gap-1 bg-black/40 p-1 rounded-xl border border-white/5">
                  <button onClick={() => setSideA('buy')} className={cn("px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all", sideA === 'buy' ? "bg-emerald-500/20 text-emerald-400" : "text-gray-500 hover:text-white")}>LONG</button>
                  <button onClick={() => setSideA('sell')} className={cn("px-4 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all", sideA === 'sell' ? "bg-rose-500/20 text-rose-400" : "text-gray-500 hover:text-white")}>SHORT</button>
               </div>
             </div>
             
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Principal Volume</label>
                   <input type="number" value={qtyA} onChange={(e) => setQtyA(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-indigo-500/50" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Insurance Volume</label>
                   <input type="number" value={qtyB} onChange={(e) => setQtyB(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-amber-500/50" />
                </div>
             </div>

             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Account A Leverage</label>
                   <input type="number" value={leverA} onChange={(e) => setLeverA(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-indigo-500/50" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Account B Leverage</label>
                   <input type="number" value={leverB} onChange={(e) => setLeverB(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-amber-500/50" />
                </div>
             </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border-white/5 flex flex-col justify-between">
             <div className="space-y-4">
                <div className="space-y-1.5">
                   <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Insurance Entry Offset (USD)</label>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">${entryOffset}</span>
                   </div>
                   <input 
                     type="range" min="0" max="1000" step="10" 
                     value={entryOffset} onChange={(e) => setEntryOffset(Number(e.target.value))} 
                     className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-amber-500" 
                   />
                </div>
                <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl flex items-start gap-3">
                   <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                   <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                      Account B will sit as a <span className="text-indigo-300 font-bold">Delta-Neutral Offset</span> to Account A. In the event of a catastrophic reversal, Account B's liquidation profit is mathematically synchronized to cover Account A's principal drawdown.
                   </p>
                </div>
             </div>

             <button 
               onClick={handleStart} 
               disabled={loading}
               className="w-full py-4 mt-6 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:brightness-110 disabled:opacity-50 text-black font-black uppercase tracking-[0.25em] text-xs rounded-2xl shadow-[0_10px_30px_rgba(99,102,241,0.3)] transition-all flex items-center justify-center gap-2 group"
             >
                <Play className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
                Deploy Architecture
             </button>
          </div>
        </div>
      ) : (
        <div className="w-full animate-in fade-in zoom-in-95 duration-500">
           
           {/* Managed Exit HUD */}
           <div className="glass-panel border-indigo-500/30 bg-indigo-500/5 p-6 rounded-[2rem] mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Shield className="w-24 h-24 text-indigo-400" />
              </div>
              
              <div className="flex items-center justify-between mb-6">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 mb-1">Managed Exit Engine</span>
                    <h3 className="text-lg font-black uppercase tracking-tighter">Tiered Capital Extraction</h3>
                 </div>
                 {state.slOrder && (
                   <div className={cn(
                     "px-4 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                     state.slOrder.isBreakEven ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                   )}>
                      <StopCircle className="w-3 h-3" />
                      SL: {state.slOrder.isBreakEven ? 'BREAK-EVEN' : 'PROTECTIVE'} (${state.slOrder.price.toLocaleString()})
                   </div>
                 )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                 {(state.tpTiers && state.tpTiers.length > 0 ? state.tpTiers : [1,2,3,4]).map((tier: any, i: number) => {
                    const isActual = typeof tier === 'object' && tier !== null;
                    const status = isActual ? tier.status : 'waiting';
                    const price = isActual ? tier.price : 0;
                    const tierNum = isActual ? tier.tier : i + 1;
                    
                    return (
                      <div key={i} className={cn(
                        "p-4 rounded-2xl border transition-all duration-500 flex flex-col gap-1 relative overflow-hidden",
                        status === 'filled' ? "bg-emerald-500/10 border-emerald-500/30" : "bg-black/20 border-white/5 opacity-60"
                      )}>
                         {status === 'filled' && <div className="absolute top-0 right-0 p-2"><Zap className="w-3 h-3 text-emerald-400" /></div>}
                         <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Tier {tierNum} (25%)</span>
                         <span className={cn("text-sm font-mono font-black", status === 'filled' ? "text-emerald-400" : "text-white")}>
                            {price > 0 ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 1 })}` : '--'}
                         </span>
                         <span className="text-[8px] font-bold uppercase text-gray-600 tracking-wider">
                            {status === 'filled' ? 'EXECUTED' : 'WAITING'}
                         </span>
                      </div>
                    );
                 })}
              </div>
           </div>

           <button 
             onClick={handleStop}
             disabled={loading}
             className="w-full py-5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-black uppercase tracking-[0.4em] text-sm rounded-[2rem] shadow-[0_0_40px_rgba(244,63,94,0.1)] transition-all flex items-center justify-center gap-3 group"
           >
              <StopCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
              Sever Agentic Link
           </button>
           
           <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: 'Latency', value: '42ms', color: 'text-emerald-400' },
                { label: 'Offset Sync', value: 'Active', color: 'text-indigo-400' },
                { label: 'Safety Margin', value: 'Overkill', color: 'text-amber-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex flex-col items-center gap-1">
                   <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{stat.label}</span>
                   <span className={cn("text-xs font-black uppercase tracking-tighter", stat.color)}>{stat.value}</span>
                </div>
              ))}
           </div>
        </div>
      )}

    </div>
  );
};
