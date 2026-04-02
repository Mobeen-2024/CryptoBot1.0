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
  tpTiers: { price: number; qty: number; status: 'waiting' | 'filled'; tier: number }[];
  slOrder: { id: string; price: number; qty: number; status: 'open' | 'filled' | 'closed'; isBreakEven: boolean } | null;
  hedgeStatus: 'inactive' | 'pending' | 'active';
  hedgeQty: number;
  intelligence?: {
    sentiment: number;
    regime: string;
    volatilityScore: number;
    liquidityScore: number;
  }
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
    intelligence: undefined
  });

  // WebSocket Health State
  const [wsConnected, setWsConnected] = useState(false);
  const [lastSync, setLastSync] = useState<number>(Date.now());
  const [latency, setLatency] = useState(0);

  // Config State
  const [qtyA, setQtyA] = useState('0.1');
  const [qtyB, setQtyB] = useState('0.1');
  const [entryOffset, setEntryOffset] = useState(100);
  const [sideA, setSideA] = useState<'buy' | 'sell'>('buy');

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/binance-master/status');
        if (res.ok) {
          const data = await res.json();
          setState(data);
          setLastSync(Date.now());
        }
      } catch {}
    };
    
    fetchStatus();

    if ((window as any).socket) {
      const socket = (window as any).socket;
      
      const handleStatusUpdate = (data: BinanceMasterState) => {
        setState(data);
        setLastSync(Date.now());
        setWsConnected(true);
      };

      socket.on('connect', () => {
        setWsConnected(true);
        fetchStatus(); // Auto-resync on reconnection
      });

      socket.on('disconnect', () => setWsConnected(false));
      socket.on('connect_error', () => setWsConnected(false));
      socket.on('binance_master_status', handleStatusUpdate);
      
      // Ping mechanism for latency
      const interval = setInterval(() => {
        if (socket.connected) {
          const start = Date.now();
          socket.emit('ping_telemetry', () => {
            setLatency(Date.now() - start);
          });
        }
      }, 5000);

      return () => {
        socket.off('connect');
        socket.off('disconnect');
        socket.off('connect_error');
        socket.off('binance_master_status', handleStatusUpdate);
        clearInterval(interval);
      };
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
          <div className="flex items-center gap-2 bg-black/40 px-3 py-1.5 rounded-2xl border border-white/5 backdrop-blur-md">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full transition-all duration-300",
              wsConnected ? "bg-emerald-400 shadow-[0_0_8px_#10b981]" : "bg-rose-500 shadow-[0_0_8px_#f43f5e]"
            )} />
            <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">
              {wsConnected ? `SYNCED: ${latency}ms` : 'LINK SEVERED'}
            </span>
          </div>

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
             <span className="text-[10px] font-bold text-gray-500 uppercase">Hedge Shield PnL</span>
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
                <span className="text-sm font-mono font-bold text-white">{state.hedgeQty || qtyB} <span className="text-[10px] text-amber-400">{symbol}</span></span>
             </div>
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
           
           {/* Managed Exit HUD */}
           <div className="glass-panel border-fuchsia-500/30 bg-fuchsia-500/5 p-6 rounded-[2rem] mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                 <Shield className="w-24 h-24 text-fuchsia-400" />
              </div>
              
              <div className="flex items-center justify-between mb-6">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-400 mb-1">Binance Exit Engine</span>
                    <h3 className="text-lg font-black uppercase tracking-tighter">HMAC Capital Extraction</h3>
                 </div>
                 <div className="flex gap-2">
                    <div className={cn(
                      "px-3 py-1 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-2",
                      state.hedgeStatus === 'active' ? "bg-amber-500/10 border-amber-500/30 text-amber-400" : 
                      state.hedgeStatus === 'pending' ? "bg-blue-500/10 border-blue-500/30 text-blue-400 animate-pulse" : 
                      "bg-gray-500/10 border-gray-500/20 text-gray-500"
                    )}>
                       SHIELD: {state.hedgeStatus.toUpperCase()}
                    </div>
                    {state.slOrder && (
                      <div className={cn(
                        "px-3 py-1 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-2",
                        state.slOrder.isBreakEven ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                      )}>
                         SL: {state.slOrder.isBreakEven ? 'B/E' : 'PROT'} (${state.slOrder.price.toLocaleString()})
                      </div>
                    )}
                 </div>
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
                         <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Tier {tierNum} (25%)</span>
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

              {state.phase === 'PRINCIPAL_RECOVERY' && (
                 <div className="mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                       <Zap className="w-4 h-4 text-red-400 animate-pulse" />
                       <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Shield-Only Mode Active</span>
                    </div>
                    <span className="text-[9px] font-medium text-gray-400 italic">Capturing Spot Alpha Momentum</span>
                 </div>
              )}
           </div>

           {/* Agentic Reasoning / Bot Pilot HUD (Fuchsia) */}
           {state.intelligence && (
             <div className="glass-panel border-fuchsia-500/30 bg-fuchsia-500/5 p-6 rounded-[2rem] mb-6 relative overflow-hidden animate-in fade-in slide-in-from-right-4 duration-700">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-fuchsia-400 mb-1">Bot Pilot Intelligence</span>
                      <h3 className="text-lg font-black uppercase tracking-tighter text-white">HMAC Reasoning Suite</h3>
                   </div>
                   <div className={cn(
                      "px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest flex items-center gap-2",
                      state.intelligence.regime === 'STABLE_TREND' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" :
                      state.intelligence.regime === 'HIGH_VOLATILITY' ? "bg-rose-500/10 border-rose-500/30 text-rose-400 animate-pulse" :
                      "bg-amber-500/10 border-amber-500/30 text-amber-400"
                   )}>
                      Regime: {state.intelligence.regime}
                   </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
                   {/* Sentiment Meter */}
                   <div className="space-y-3">
                      <div className="flex justify-between items-center px-1">
                         <span className="text-[10px] font-black uppercase tracking-widest text-[#848e9c]">Market Sentiment</span>
                         <span className={cn(
                           "text-[10px] font-mono font-bold",
                           state.intelligence.sentiment >= 0 ? "text-emerald-400" : "text-rose-400"
                         )}>
                            {(state.intelligence.sentiment * 100).toFixed(1)}% {state.intelligence.sentiment >= 0 ? 'BULLISH' : 'BEARISH'}
                         </span>
                      </div>
                      <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden flex">
                         <div 
                           className="h-full bg-rose-500 transition-all duration-1000" 
                           style={{ width: `${Math.max(0, -state.intelligence.sentiment * 50 + 50)}%` }} 
                         />
                         <div 
                           className="h-full bg-emerald-500 transition-all duration-1000" 
                           style={{ width: `${Math.max(0, state.intelligence.sentiment * 50 + 50)}%` }} 
                         />
                      </div>
                   </div>

                   {/* Vol_Liq Stats */}
                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex flex-col gap-1 text-center">
                         <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Volatility</span>
                         <span className={cn(
                           "text-xl font-black font-mono tracking-tighter",
                           state.intelligence.volatilityScore > 70 ? "text-rose-400" : "text-white"
                         )}>
                            {state.intelligence.volatilityScore.toFixed(1)}
                         </span>
                      </div>
                      <div className="bg-black/20 p-4 rounded-2xl border border-white/5 flex flex-col gap-1 text-center">
                         <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">Liquidity Score</span>
                         <span className="text-xl font-black font-mono tracking-tighter text-emerald-400">
                            {state.intelligence.liquidityScore.toFixed(0)}
                         </span>
                      </div>
                   </div>
                </div>

                <div className="p-4 bg-fuchsia-500/10 border border-fuchsia-500/20 rounded-2xl">
                   <p className="text-[10px] text-fuchsia-300/80 italic font-medium leading-relaxed">
                      "HMAC Pilot adjusting Entry Offset autonomously to compensate for {state.intelligence.regime.toLowerCase()} and {state.intelligence.sentiment >= 0 ? 'Bullish' : 'Bearish'} sentiment bias. Spot Shield recalibrated for Anti-Fragility."
                   </p>
                </div>
             </div>
           )}

           <button 
             onClick={handleStop}
             disabled={loading}
             className="w-full py-5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-black uppercase tracking-[0.4em] text-sm rounded-[2rem] shadow-[0_0_40px_rgba(244,63,94,0.1)] transition-all flex items-center justify-center gap-3 group"
           >
              <StopCircle className="w-6 h-6 group-hover:rotate-90 transition-transform duration-500" />
              Sever HMAC Chain
           </button>
           
           <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { label: 'Latency', value: '28ms', color: 'text-emerald-400' },
                { label: 'HMAC Sync', value: 'SHA256', color: 'text-fuchsia-400' },
                { label: 'Shield Type', value: 'Recursive', color: 'text-amber-400' },
              ].map((stat, i) => (
                <div key={i} className="bg-white/5 border border-white/5 p-4 rounded-3xl flex flex-col items-center gap-1">
                   <span className="text-[8px] font-black uppercase tracking-widest text-[#848e9c]">{stat.label}</span>
                   <span className={cn("text-xs font-black uppercase tracking-tighter", stat.color)}>{stat.value}</span>
                </div>
              ))}
           </div>
        </div>
      )}

    </div>
  );
};
