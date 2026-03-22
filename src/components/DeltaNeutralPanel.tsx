import React, { useState, useEffect } from 'react';
import { 
  Activity, ShieldCheck, Crosshair, Zap, Cpu, Terminal,
  Network, AlertTriangle, TrendingUp, Infinity, RotateCw,
  Clock, Sliders, Target, CheckCircle, XCircle, Radio, Clock9, Scale
} from 'lucide-react';

interface BotState {
  isActive: boolean; symbol: string; qty: number; 
  masterEntryPrice: number; slaveEntryPrice: number;
  livePnL?: number; phase?: 'IDLE' | 'SCHEDULED' | 'HEDGED' | 'ASYMMETRIC_BREAK' | 'CLOSED';
  scheduledTime?: number;
}

interface DeltaNeutralPanelProps { symbol: string; currentPrice?: number; }

export const DeltaNeutralPanel: React.FC<DeltaNeutralPanelProps> = ({ symbol, currentPrice = 0 }) => {
  // ── Core Params ────────────────────────────────────────
  const [qty, setQty] = useState<string>('0.001');

  // ── Phase 1: Scheduled Entry ───────────────────────────
  const [entryMode, setEntryMode] = useState<'INSTANT' | 'SCHEDULED'>('INSTANT');
  const [scheduleTimeStr, setScheduleTimeStr] = useState<string>(''); // e.g. "14:30" or ISO timestamp
  
  // ── Phase 1: Asymmetric Guards ─────────────────────────
  const [usePreviousDayAvg, setUsePreviousDayAvg] = useState(true);
  const [customAnchorPrice, setCustomAnchorPrice] = useState<string>('');
  const [offsetType, setOffsetType] = useState<'USDT'|'%'>('%');
  const [offsetValue, setOffsetValue] = useState<string>('1.00');

  // ── System State ───────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BotState>({
    isActive: false, symbol: '', qty: 0,
    masterEntryPrice: 0, slaveEntryPrice: 0,
    livePnL: 0, phase: 'IDLE'
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/bot/status');
        if (res.ok) setStatus(await res.json());
      } catch {}
    };
    fetchStatus();
    if ((window as any).socket) {
      (window as any).socket.on('delta_neutral_status', (data: BotState) => setStatus(data));
    }
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, qty, 
          entryMode, scheduleTimeStr,
          usePreviousDayAvg, customAnchorPrice, offsetType, offsetValue
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setStatus(prev => ({ ...prev, isActive: true, phase: entryMode === 'SCHEDULED' ? 'SCHEDULED' : 'HEDGED' }));
    } catch (err: any) {
      alert(`Start failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop');
      setStatus(prev => ({ ...prev, isActive: false, phase: 'CLOSED' }));
    } catch (err: any) {
      alert(`Stop failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getSystemStateColor = () => {
    if (!status.isActive) return 'border-[#1E293B] bg-[#0A0D14]';
    if (status.phase === 'SCHEDULED') return 'border-[#FCD535]/50 bg-[#FCD535]/10';
    if (status.phase === 'HEDGED') return 'border-[#00f0ff]/50 bg-[#00f0ff]/10';
    return 'border-[#E0E7FF] bg-[#E0E7FF]/10';
  };

  return (
    <div className={`h-full flex flex-col transition-colors duration-500 border-l ${getSystemStateColor()}`}>
      
      {/* ── Header ── */}
      <div className="shrink-0 p-4 border-b border-inherit bg-black/20 flex flex-col gap-1 relative overflow-hidden">
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-8 w-8 rounded bg-gradient-to-br from-[#00f0ff]/20 to-[#ff003c]/20 border border-white/10 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.15)] flex-shrink-0">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-[13px] font-bold tracking-[0.2em] text-[#E0E7FF] uppercase">Asymmetric Straddle</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`flex justify-center items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-widest ${
                status.isActive 
                  ? status.phase === 'SCHEDULED' ? 'bg-[#FCD535]/20 text-[#FCD535] border border-[#FCD535]/50 shadow-[0_0_8px_rgba(252,213,53,0.3)]' 
                  : 'bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/50 shadow-[0_0_8px_rgba(0,240,255,0.3)]' 
                  : 'bg-[#1E293B] text-[#64748B] border border-[#334155]'
              }`}>
                {status.isActive ? (status.phase === 'SCHEDULED' ? <Clock9 className="w-2.5 h-2.5 animate-pulse" /> : <Activity className="w-2.5 h-2.5 animate-pulse" />) : <Network className="w-2.5 h-2.5" />}
                Sys state: {status.isActive ? status.phase : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Settings View ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-6">
        
        {/* Phase I: Execution Time */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#FCD535]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-4 flex items-center gap-2 relative z-10">
            <Clock9 className="w-4 h-4 text-[#FCD535]" /> Phase I: Synchronized Entry
          </h3>
          
          <div className="space-y-4 relative z-10">
            <div className="flex gap-2">
              <button onClick={() => setEntryMode('INSTANT')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border ${entryMode === 'INSTANT' ? 'bg-[#3B82F6]/20 border-[#3B82F6] text-[#60A5FA] shadow-[0_0_10px_rgba(59,130,246,0.3)]' : 'bg-transparent border-[#334155] text-[#64748B] hover:border-[#475569]'}`}>
                 Instant Trigger
              </button>
              <button onClick={() => setEntryMode('SCHEDULED')} className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border ${entryMode === 'SCHEDULED' ? 'bg-[#FCD535]/20 border-[#FCD535] text-[#FCD535] shadow-[0_0_10px_rgba(252,213,53,0.3)]' : 'bg-transparent border-[#334155] text-[#64748B] hover:border-[#475569]'}`}>
                 Scheduled Time
              </button>
            </div>

            {entryMode === 'SCHEDULED' && (
              <div className="p-3 bg-black/40 rounded-lg border border-[#334155]">
                <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-2">Execute Exactly At (UTC):</label>
                <input 
                  type="datetime-local" 
                  value={scheduleTimeStr}
                  onChange={(e) => setScheduleTimeStr(e.target.value)}
                  className="w-full bg-[#1E293B] border border-[#334155] text-white rounded p-2 focus:border-[#FCD535] focus:outline-none transition-colors font-mono text-sm"
                />
              </div>
            )}
          </div>
        </div>

        {/* Phase I: Initial Guards */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f0ff]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <h3 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8] mb-4 flex items-center gap-2 relative z-10">
            <ShieldCheck className="w-4 h-4 text-[#00f0ff]" /> Initial Asymmetric Guards
          </h3>
          
          <div className="space-y-4 relative z-10">
            <p className="text-[10px] text-[#64748B] leading-relaxed">
              Upon entry, both the Bullish and Bearish boundaries will anchor to a baseline price. 
              The system will dynamically set hard stop thresholds offset from this anchor.
            </p>

            <label className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-[#334155] hover:border-[#475569] cursor-pointer transition-colors group">
              <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${usePreviousDayAvg ? 'bg-[#00f0ff] border-[#00f0ff]' : 'bg-[#1E293B] border-[#334155]'} border`}>
                {usePreviousDayAvg && <CheckCircle className="w-3 h-3 text-black" />}
              </div>
              <div className="flex flex-col">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${usePreviousDayAvg ? 'text-[#E0E7FF]' : 'text-[#94A3B8]'}`}>Anchor to Previous 1D Avg</span>
                <span className="text-[9px] text-[#64748B] font-mono mt-0.5">Fetches Exact Binance 24h Average to use as baseline.</span>
              </div>
              <input type="checkbox" className="hidden" checked={usePreviousDayAvg} onChange={() => setUsePreviousDayAvg(true)} />
            </label>

            <label className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-[#334155] hover:border-[#475569] cursor-pointer transition-colors group">
              <div className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${!usePreviousDayAvg ? 'bg-[#F23645] border-[#F23645]' : 'bg-[#1E293B] border-[#334155]'} border`}>
                {!usePreviousDayAvg && <CheckCircle className="w-3 h-3 text-white" />}
              </div>
              <div className="flex flex-col">
                <span className={`text-[11px] font-bold uppercase tracking-wide ${!usePreviousDayAvg ? 'text-[#E0E7FF]' : 'text-[#94A3B8]'}`}>Custom Manual Anchor Price</span>
                <span className="text-[9px] text-[#64748B] font-mono mt-0.5">Input a strict market price manually.</span>
              </div>
              <input type="checkbox" className="hidden" checked={!usePreviousDayAvg} onChange={() => setUsePreviousDayAvg(false)} />
            </label>

            {!usePreviousDayAvg && (
              <div className="flex justify-between items-center py-2 border-b border-[#1E293B]">
                <span className="text-[10px] uppercase font-bold text-[#64748B] tracking-widest">Target Anchor</span>
                <div className="flex items-center">
                  <span className="text-gray-500 font-mono text-[11px] mr-2">$</span>
                  <input type="number" value={customAnchorPrice} onChange={(e) => setCustomAnchorPrice(e.target.value)} className="w-[80px] bg-transparent text-right font-mono text-sm text-[#F8FAFC] focus:outline-none" placeholder="0.00" />
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2 border-t border-[#1E293B]">
               <div className="flex-1">
                 <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-2 tracking-widest">SL/TP Offset Gap:</label>
                 <input type="number" value={offsetValue} onChange={(e) => setOffsetValue(e.target.value)} className="w-full bg-[#1E293B] text-white p-2 rounded focus:outline-none font-mono text-sm text-center border border-[#334155]" />
               </div>
               <div className="w-20">
                 <label className="block text-[10px] uppercase font-bold text-[#64748B] mb-2 tracking-widest">Unit</label>
                 <select value={offsetType} onChange={(e) => setOffsetType(e.target.value as any)} className="w-full bg-[#1E293B] text-white p-2 text-sm rounded focus:outline-none border border-[#334155] font-bold appearance-none text-center cursor-pointer">
                   <option value="%">%</option>
                   <option value="USDT">$</option>
                 </select>
               </div>
            </div>

          </div>
        </div>

        {/* Position Sizing */}
        <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-4">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#94A3B8] mb-4">Position Base Configuration</h3>
          <div className="flex justify-between items-center py-3 border-b border-[#1E293B]">
            <span className="text-[10px] uppercase font-bold text-gray-400">Position Size per Leg</span>
            <div className="flex items-center">
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-[100px] bg-transparent text-right font-mono text-sm text-white focus:outline-none" />
              <span className="text-gray-500 font-bold ml-2 text-[10px]">{symbol.split('/')[0]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 p-4 border-t border-[#1E293B] bg-[#0A0D14]">
        {status.isActive ? (
          <button onClick={handleStop} disabled={loading} className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-bold uppercase tracking-[0.2em] transition-all flex justify-center items-center gap-2 group hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <XCircle className="w-4 h-4 group-hover:scale-110 transition-transform" /> {status.phase === 'SCHEDULED' ? 'CANCEL SCHEDULED HEDGE' : 'EMERGENCY ABORT STRADDLE'}
          </button>
        ) : (
          <button onClick={handleStart} disabled={loading || !symbol} className="w-full py-3.5 bg-gradient-to-r from-[#00f0ff] to-[#0080ff] hover:opacity-90 text-black rounded-xl font-bold uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(0,240,255,0.4)] transition-all flex justify-center items-center gap-2 group relative overflow-hidden disabled:opacity-50">
            <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 pointer-events-none" />
            <Target className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" /> 
            {entryMode === 'SCHEDULED' ? 'SCHEDULE ASYMMETRIC HEDGE' : 'DEPLOY ASYMMETRIC HEDGE'}
          </button>
        )}
      </div>

    </div>
  );
};
