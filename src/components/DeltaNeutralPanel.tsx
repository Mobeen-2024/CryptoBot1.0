import React, { useState, useEffect } from 'react';
import { Play, Square, Activity, AlertTriangle, ShieldCheck, Zap, Crosshair, Network, Cpu } from 'lucide-react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

interface BotState {
  isActive: boolean;
  symbol: string;
  qty: number;
  stopLossUSDT: number;
  masterEntryPrice: number;
  slaveEntryPrice: number;
  longStopTriggered: boolean;
  shortStopTriggered: boolean;
  cycles: number;
}

interface DeltaNeutralPanelProps {
  symbol: string;
}

export const DeltaNeutralPanel: React.FC<DeltaNeutralPanelProps> = ({ symbol }) => {
  const [qty, setQty] = useState<string>('0.001');
  const [stopLoss, setStopLoss] = useState<string>('1.00');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BotState>({
    isActive: false, symbol: '', qty: 0, stopLossUSDT: 1,
    masterEntryPrice: 0, slaveEntryPrice: 0,
    longStopTriggered: false, shortStopTriggered: false, cycles: 0
  });

  useEffect(() => {
    fetch('/api/bot/status').then(res => res.json()).then(data => setStatus(data)).catch(err => console.error("API Error", err));
    const socket = io();
    socket.on('delta_neutral_status', (data: BotState) => setStatus(data));
    return () => { socket.disconnect(); };
  }, []);

  const handleStart = async () => {
    setLoading(true);
    const tId = toast.loading('Initializing Engine...', { style: { background: '#0a0d14', color: '#00f0ff', border: '1px solid rgba(0,240,255,0.2)' } });
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, qty, stopLossUSDT: stopLoss })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Delta-Neutral Hedge Active', { id: tId, iconTheme: { primary: '#39ff14', secondary: '#0a0d14' } });
    } catch (error: any) {
      toast.error(error.message, { id: tId });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    const tId = toast.loading('Aborting Protocol...', { style: { background: '#0a0d14', color: '#ff073a', border: '1px solid rgba(255,7,58,0.2)' } });
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Hedge Terminated', { id: tId, iconTheme: { primary: '#ff073a', secondary: '#0a0d14' } });
    } catch (error: any) {
      toast.error(error.message, { id: tId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#05070a] backdrop-blur-3xl border border-white/[0.05] rounded-xl p-4 flex flex-col h-full overflow-hidden relative shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
      
      {/* Heavy Cyber Background */}
      <div className="absolute top-0 right-[-10%] w-[60%] h-[200px] bg-gradient-to-l from-[#39ff14]/5 to-transparent blur-[50px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[200px] bg-gradient-to-r from-[#bc13fe]/5 to-transparent blur-[50px] pointer-events-none" />
      
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 pb-3 border-b border-white/[0.05] relative z-10 shrink-0">
        <div className="relative">
          <div className="p-2.5 bg-black border border-[#39ff14]/30 rounded-lg inner-glow">
            <Network className={`w-5 h-5 ${status.isActive ? 'text-[#39ff14] animate-pulse' : 'text-gray-500'}`} />
          </div>
        </div>
        <div>
          <h2 className="text-white font-black text-[13px] tracking-[0.2em] uppercase flex items-center gap-2">
            Delta-Neutral Core
            {status.isActive && <div className="px-1.5 py-0.5 rounded bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14] text-[8px] tracking-widest animate-pulse">ENGAGED</div>}
          </h2>
          <p className="text-[#39ff14]/60 text-[9px] font-mono tracking-widest mt-0.5">ALGO // BIDIRECTIONAL_STRADDLE_V2</p>
        </div>
      </div>

      <div className="flex-1 w-full overflow-y-auto custom-scrollbar pr-1 relative z-10 flex flex-col">
        
        {/* Input Matrix */}
        <div className="grid grid-cols-2 gap-3 mb-5 shrink-0">
          {/* Qty Input */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 relative group">
            <label className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 group-focus-within:text-[#00f0ff] transition-colors">
              <Zap className="w-3 h-3" /> Contract Phase Size
            </label>
            <div className="relative">
              <input 
                type="number" value={qty} onChange={e => setQty(e.target.value)} disabled={status.isActive}
                className="w-full bg-black border border-white/[0.1] rounded px-3 py-2 text-white font-mono text-[13px] outline-none focus:border-[#00f0ff] focus:shadow-[0_0_15px_rgba(0,240,255,0.2)] disabled:opacity-50 transition-all font-bold"
                step="0.001"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600 pointer-events-none">{symbol.split('/')[0] || 'BASE'}</div>
            </div>
          </div>
          
          {/* Stop Loss Input */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 relative group">
            <label className="flex items-center gap-1.5 text-[9px] text-gray-500 uppercase tracking-widest font-bold mb-2 group-focus-within:text-[#ff073a] transition-colors">
              <Crosshair className="w-3 h-3" /> Micro-Stop Loss
            </label>
            <div className="relative">
              <input 
                type="number" value={stopLoss} onChange={e => setStopLoss(e.target.value)} disabled={status.isActive}
                className="w-full bg-black border border-white/[0.1] rounded px-3 py-2 text-white font-mono text-[13px] outline-none focus:border-[#ff073a] focus:shadow-[0_0_15px_rgba(255,7,58,0.2)] disabled:opacity-50 transition-all font-bold"
                step="0.5"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-600 pointer-events-none">USDT</div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mb-5 shrink-0">
          {!status.isActive ? (
            <button 
              onClick={handleStart} disabled={loading}
              className="w-full h-12 bg-[#39ff14]/10 hover:bg-[#39ff14]/20 text-[#39ff14] border border-[#39ff14]/30 hover:border-[#39ff14] rounded-lg box-glow-green text-[11px] font-black tracking-[0.2em] uppercase transition-all disabled:opacity-50 flex items-center justify-center gap-3 group relative overflow-hidden"
            >
              <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[#39ff14]/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
              {loading ? <Cpu className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 group-hover:scale-110 transition-transform" />}
              Initiate Engine Sequence
            </button>
          ) : (
             <div className="flex gap-2 h-12">
               <div className="flex-1 bg-black rounded-lg border border-[#39ff14]/30 flex items-center justify-center gap-2 overflow-hidden relative">
                  <div className="absolute left-0 w-1 h-full bg-[#39ff14] animate-pulse" />
                  <Activity className="w-4 h-4 text-[#39ff14] animate-pulse" />
                  <span className="text-[#39ff14] text-[10px] font-mono font-bold tracking-widest">EXECUTING CYCLE // {status.cycles}</span>
               </div>
               <button 
                onClick={handleStop} disabled={loading}
                className="w-12 h-12 shrink-0 bg-[#ff073a]/10 hover:bg-[#ff073a]/20 text-[#ff073a] border border-[#ff073a]/30 hover:border-[#ff073a] rounded-lg box-glow-red transition-all disabled:opacity-50 flex items-center justify-center group"
                title="Abort Protocol"
              >
                {loading ? <Cpu className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 group-hover:scale-110 transition-transform" fill="currentColor" />}
              </button>
             </div>
          )}
        </div>

        {/* Engine Diagnostics HUD */}
        <div className="flex-1 bg-black/60 rounded-xl border border-white/[0.05] p-4 text-[11px] font-mono relative overflow-hidden flex flex-col justify-between">
           
           {/* Scanline overlay */}
           <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0)_50%,rgba(0,0,0,0.1)_50%)] bg-[length:100%_4px] pointer-events-none opacity-20" />
           
           <div className="flex items-center justify-between mb-4 relative z-10 border-b border-white/[0.05] pb-2">
             <span className="text-gray-500 font-bold tracking-widest text-[9px] flex items-center gap-2">
                <Cpu className="w-3 h-3" /> NODE LINK: {status.symbol || symbol}
             </span>
             <div className="flex items-center gap-1.5">
                {[1,2,3].map(i => <div key={i} className={`w-1 h-3 rounded-sm ${status.isActive ? 'bg-[#39ff14] animate-pulse' : 'bg-gray-800'}`} style={{animationDelay: `${i*150}ms`}} />)}
             </div>
           </div>

           <div className="space-y-3 relative z-10 flex-1 flex flex-col justify-center">
             
             {/* Master Node */}
             <div className={`p-3 rounded border flex justify-between items-center transition-all ${status.longStopTriggered ? 'bg-[#ff073a]/5 border-[#ff073a]/20' : 'bg-white/[0.02] border-white/[0.05]'}`}>
               <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">Master Node <span className="text-[8px] px-1 bg-white/10 rounded text-white">(LONG)</span></span>
                  {status.longStopTriggered && <span className="text-[9px] text-[#ff073a] font-bold tracking-widest animate-pulse">SL TRIGGERED</span>}
               </div>
               <div className="text-right flex flex-col">
                 <span className={`text-[14px] font-black ${status.longStopTriggered ? 'text-[#ff073a]' : 'text-[#39ff14]'}`}>
                    {status.masterEntryPrice > 0 ? status.masterEntryPrice.toFixed(4) : 'AWAITING'}
                 </span>
               </div>
             </div>
             
             {/* Slave Node */}
             <div className={`p-3 rounded border flex justify-between items-center transition-all ${status.shortStopTriggered ? 'bg-[#ff073a]/5 border-[#ff073a]/20' : 'bg-white/[0.02] border-white/[0.05]'}`}>
               <div className="flex flex-col">
                  <span className="text-gray-400 text-[10px] uppercase tracking-wider mb-1 flex items-center gap-1">Slave Node <span className="text-[8px] px-1 bg-white/10 rounded text-white">(SHORT)</span></span>
                  {status.shortStopTriggered && <span className="text-[9px] text-[#ff073a] font-bold tracking-widest animate-pulse">SL TRIGGERED</span>}
               </div>
               <div className="text-right flex flex-col">
                 <span className={`text-[14px] font-black ${status.shortStopTriggered ? 'text-[#ff073a]' : 'text-[#bc13fe]'}`}>
                    {status.slaveEntryPrice > 0 ? status.slaveEntryPrice.toFixed(4) : 'AWAITING'}
                 </span>
               </div>
             </div>
           </div>

           {/* Footer Alert */}
           <div className="mt-4 pt-3 border-t border-white/[0.05] relative z-10 shrink-0">
             {status.isActive ? (
                <div className="flex items-start gap-2 text-[#a0aab8] text-[9px] leading-relaxed">
                  <ShieldCheck className="w-3 h-3 text-[#39ff14] shrink-0 mt-0.5 animate-pulse" />
                  <p>Quantum-lock established. Dynamic boundaries active at <span className="text-white font-bold">{status.stopLossUSDT} USDT</span> offset. Monitoring high-frequency divergence streams.</p>
                </div>
             ) : status.cycles > 0 ? (
                <div className="flex items-start gap-2 text-[#fcd535] text-[9px] leading-relaxed">
                  <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                  <p>WARNING: Engine offline. Surviving directional matrix nodes remain active in external exchange architecture. Manual termination required.</p>
                </div>
             ) : (
                <div className="flex items-start gap-2 text-gray-600 text-[9px] leading-relaxed font-bold tracking-widest uppercase">
                   <Network className="w-3 h-3 shrink-0 mt-0.5" /> Engine Standing By...
                </div>
             )}
           </div>

        </div>
      </div>
    </div>
  );
}

