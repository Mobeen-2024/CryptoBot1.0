import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Shield, Zap, TrendingUp, TrendingDown, Activity, AlertCircle, StopCircle, Play, Cpu } from 'lucide-react';
import { cn } from '../utils/cn';

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
    hmacStatus: 'inactive'
  });

  // Config State
  const [qtyA, setQtyA] = useState('0.1');
  const [qtyB, setQtyB] = useState('0.1');
  const [entryOffset, setEntryOffset] = useState(100);
  const [sideA, setSideA] = useState<'buy' | 'sell'>('buy');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/binance-master/status');
        if (res.ok) setState(await res.json());
      } catch {}
    };
    fetchStatus();

    if ((window as any).socket) {
      (window as any).socket.on('binance_master_status', (data: BinanceMasterState) => setState(data));
    }
  }, []);

  const handleStart = async () => {
    setLoading(true);
    const tId = toast.loading('Initializing Binance HMAC Signature Chain...');
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
          protectionRatio: 1.0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Binance Master Deployed!', { id: tId });
    } catch (err: any) {
      toast.error(`Deployment Failed: ${err.message}`, { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    const tId = toast.loading('Severing Binance Agentic Link...');
    try {
      const res = await fetch('/api/binance-master/stop', { method: 'POST' });
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
          <div className="p-3 bg-fuchsia-500/20 border border-fuchsia-500/30 rounded-2xl shadow-[0_0_20px_rgba(217,70,239,0.2)]">
            <Cpu className="w-8 h-8 text-fuchsia-400 drop-shadow-[0_0_8px_rgba(217,70,239,0.5)]" />
          </div>
          <div>
            <h1 className="text-2xl font-black uppercase tracking-tighter">Binance Master <span className="text-fuchsia-400">2026</span></h1>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Institutional HMAC Spot Insurance</p>
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
        
        {/* Account A (Spot) Telemetry */}
        <div className="glass-panel border-fuchsia-500/20 p-5 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-fuchsia-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-fuchsia-400" />
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Account A (Spot Alpha)</span>
             </div>
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase text-gray-500">HMAC-SHA256</span>
                <span className={cn(
                  "text-[8px] font-black px-2 py-0.5 rounded border",
                  state.hmacStatus === 'active' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                )}>
                  {state.hmacStatus.toUpperCase()}
                </span>
             </div>
          </div>
          <div className="flex flex-col gap-1">
             <span className="text-[10px] font-bold text-gray-500 uppercase">Spot Unrealized PnL</span>
             <span className={cn(
               "text-3xl font-black font-mono tracking-tighter",
               state.pnlA >= 0 ? "text-emerald-400" : "text-rose-400"
             )}>
                {state.pnlA >= 0 ? '+' : ''}{state.pnlA.toFixed(2)} <span className="text-sm font-bold ml-1 text-gray-500">USDT</span>
             </span>
          </div>
        </div>

        {/* Account B (Spot Hedge) */}
        <div className="glass-panel border-amber-500/20 p-5 rounded-3xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="flex items-center justify-between mb-4">
             <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-black uppercase tracking-widest text-gray-400">Account B (Protection)</span>
             </div>
             <span className="text-[10px] uppercase font-black text-gray-600 tracking-widest">Hedge Layer</span>
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
        </div>

      </div>

      {/* Net Portfolio Summary */}
      <div className="bg-black/40 border border-fuchsia-500/10 rounded-[2.5rem] p-8 mb-8 flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden backdrop-blur-3xl shadow-2xl">
         <div className="flex flex-col gap-2">
            <span className="text-xs font-black uppercase tracking-[0.4em] text-gray-500">Net Portfolio Performance</span>
            <div className="flex items-baseline gap-2">
               <span className={cn(
                 "text-6xl font-black tracking-tighter font-mono",
                 state.netPnl >= 0 ? "text-fuchsia-400 drop-shadow-[0_0_15px_rgba(217,70,239,0.4)]" : "text-rose-400"
               )}>
                 {state.netPnl >= 0 ? '+' : ''}{state.netPnl.toFixed(2)}
               </span>
               <span className="text-xl font-bold text-gray-500">USDT</span>
            </div>
         </div>
         <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2 mb-2">
               <Zap className={cn("w-5 h-5", state.isActive ? "text-emerald-400 animate-pulse" : "text-gray-600")} />
               <span className="text-[10px] uppercase font-black tracking-widest text-gray-500">HMAC-SHA256 SYNC VERIFIED</span>
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
                   <input type="number" value={qtyA} onChange={(e) => setQtyA(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-fuchsia-500/50" />
                </div>
                <div className="space-y-1.5">
                   <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Insurance Volume</label>
                   <input type="number" value={qtyB} onChange={(e) => setQtyB(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm outline-none focus:border-amber-500/50" />
                </div>
             </div>
          </div>

          <div className="glass-panel p-6 rounded-3xl border-white/5 flex flex-col justify-between">
             <div className="space-y-4">
                <div className="space-y-1.5">
                   <div className="flex justify-between items-center px-1">
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Hedge Offset (USD)</label>
                      <span className="text-[10px] font-mono text-amber-400 font-bold">${entryOffset}</span>
                   </div>
                   <input 
                     type="range" min="0" max="1000" step="10" 
                     value={entryOffset} onChange={(e) => setEntryOffset(Number(e.target.value))} 
                     className="w-full h-1.5 bg-black/40 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" 
                   />
                </div>
             </div>

             <button 
               onClick={handleStart} 
               disabled={loading}
               className="w-full py-4 mt-6 bg-gradient-to-r from-fuchsia-600 to-fuchsia-500 hover:brightness-110 disabled:opacity-50 text-black font-black uppercase tracking-[0.25em] text-xs rounded-2xl shadow-[0_10px_30px_rgba(217,70,239,0.3)] transition-all flex items-center justify-center gap-2 group"
             >
                <Play className="w-4 h-4 fill-black group-hover:scale-110 transition-transform" />
                Deploy HMAC Chain
             </button>
          </div>
        </div>
      ) : (
        <div className="w-full animate-in fade-in zoom-in-95 duration-500">
           <button 
             onClick={handleStop}
             disabled={loading}
             className="w-full py-5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-black uppercase tracking-[0.4em] text-sm rounded-[2rem] shadow-[0_0_40px_rgba(244,63,94,0.1)] transition-all flex items-center justify-center gap-3 group"
           >
              <StopCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
              Sever HMAC Chain
           </button>
        </div>
      )}

    </div>
  );
};
