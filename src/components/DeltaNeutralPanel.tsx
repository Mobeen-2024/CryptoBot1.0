import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { 
  Activity, ShieldCheck, Crosshair, Zap, Cpu, Terminal,
  Network, AlertTriangle, TrendingUp, Infinity, RotateCw,
  Clock, Sliders, Target, CheckCircle, XCircle, Radio, Clock9, Scale, Database
} from 'lucide-react';
import { SmartInput } from './SmartInput';

interface BotState {
  isActive: boolean; symbol: string; qty: number; 
  masterEntryPrice: number; slaveEntryPrice: number;
  livePnL?: number; phase?: 'IDLE' | 'SCHEDULED' | 'HEDGED' | 'NAKED_LONG' | 'NAKED_SHORT' | 'ASYMMETRIC_BREAK' | 'CLOSED';
  scheduledTime?: number;
}

interface DeltaNeutralPanelProps { 
  symbol: string; 
  currentPrice?: number; 
  lastClosedCandle?: { price: number, time: number } | null;
}

export const DeltaNeutralPanel: React.FC<DeltaNeutralPanelProps> = ({ symbol, currentPrice = 0, lastClosedCandle }) => {
  // ── Core Params ────────────────────────────────────────
  const [qty, setQty] = useState<string>('0.001');

  // ── Phase 1: Scheduled Entry ───────────────────────────
  const [entryMode, setEntryMode] = useState<'INSTANT' | 'SCHEDULED'>('INSTANT');
  const [sessionTarget, setSessionTarget] = useState<'LONDON' | 'NEW_YORK' | 'ASIA'>('LONDON');
  const [scheduleTimeStr, setScheduleTimeStr] = useState<string>('');
  
  // ── Phase 1: Asymmetric Guards ─────────────────────────
  const [usePreviousDayAvg, setUsePreviousDayAvg] = useState(false); // Default to Custom Anchor for Master Hub Candle Sync
  const [customAnchorPrice, setCustomAnchorPrice] = useState<number>(currentPrice || 0);

  // ── Smart Execution Bounds ─────────────────────────────
  // We use SmartInput for these boundaries, defaulting offset logic directly in state
  const [bullishSL, setBullishSL] = useState<number>(0);
  const [bullishTP, setBullishTP] = useState<number>(0);
  
  const [bearishSL, setBearishSL] = useState<number>(0);
  const [bearishTP, setBearishTP] = useState<number>(0);

  // ── System State ───────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [riskAppetite, setRiskAppetite] = useState<number>(50);
  const [isShimmering, setIsShimmering] = useState(false);
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

  // MASTER BOT: Candle Detection Sync
  useEffect(() => {
    if (lastClosedCandle && !usePreviousDayAvg && !status.isActive) {
      setCustomAnchorPrice(lastClosedCandle.price);
      toast.success(`Candle Closed! Master Hub synchronized Anchor to $${lastClosedCandle.price.toLocaleString()}`, { id: 'candle-sync-toast', duration: 3000 });
    }
  }, [lastClosedCandle, usePreviousDayAvg, status.isActive]);

  // Update Custom Anchor automatically if standard mode is selected and price ticks initially
  useEffect(() => {
    if (customAnchorPrice === 0 && currentPrice > 0) {
      setCustomAnchorPrice(currentPrice);
    }
  }, [currentPrice]);

  // Semantic Refactoring (Risk Intuition Mathematical Engine)
  useEffect(() => {
    // Cannot simulate math if relying on the Node.js backend to fetch the 1D Avg 
    if (usePreviousDayAvg || customAnchorPrice === 0 || currentPrice === 0) return;
    
    // Trigger visual shimmer effect
    setIsShimmering(true);
    const timer = setTimeout(() => setIsShimmering(false), 800);

    const anchor = customAnchorPrice;
    const distance = Math.abs(currentPrice - anchor);
    if (distance === 0) return;

    // Scale from 0.02x (1%) to 2.0x (100%), where 50% = 1.0x standard logic
    const riskMult = riskAppetite / 50;
    
    // Bullish Vector (Long)
    const bullOffset = distance * 0.5 * riskMult;
    const newBullishSL = currentPrice - bullOffset;
    const newBullishTP = currentPrice + (bullOffset * 3 * riskMult);
    
    // Bearish Vector (Short)
    const bearOffset = distance * 2 * riskMult;
    const newBearishSL = currentPrice + bearOffset;
    const newBearishTP = anchor; // Target always snaps back to average anchor

    setBullishSL(parseFloat(newBullishSL.toFixed(4)));
    setBullishTP(parseFloat(newBullishTP.toFixed(4)));
    setBearishSL(parseFloat(newBearishSL.toFixed(4)));
    setBearishTP(parseFloat(newBearishTP.toFixed(4)));

    return () => clearTimeout(timer);
  }, [riskAppetite]); 

  const activeAnchor = usePreviousDayAvg ? "1D AVG" : customAnchorPrice;

  const handleStart = async () => {
    setLoading(true);
    let toastId;
    try {
      toastId = toast.loading('Initiating Voltron Master Protocol...');
      
      const payload = {
        symbol, qty, 
        entryMode, scheduleTimeStr, sessionTarget,
        usePreviousDayAvg, customAnchorPrice,
        bullishSL, bullishTP, bearishSL, bearishTP
      };

      const res = await fetch('/api/bot/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setStatus(prev => ({ ...prev, isActive: true, phase: entryMode === 'SCHEDULED' ? 'SCHEDULED' : 'HEDGED' }));
      toast.success(entryMode === 'SCHEDULED' ? 'Voltron Session Scheduled' : 'Voltron Execution Hands Deployed!', { id: toastId });
    } catch (err: any) {
      toast.error(`Start failed: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    let toastId;
    try {
      toastId = toast.loading('Severing Master Neural Link...');
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to stop sequence');
      setStatus(prev => ({ ...prev, isActive: false, phase: 'CLOSED' }));
      toast.success('Voltron sequence terminated', { id: toastId });
    } catch (err: any) {
      toast.error(`Abort failed: ${err.message}`, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`h-full flex flex-col transition-colors duration-500`}>
      
      {/* ── Voltron Command Center Header ── */}
      <div className="shrink-0 p-4 border-b border-indigo-500/20 bg-[#0A0D14] flex flex-col gap-1 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="h-10 w-10 rounded bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.2)] flex-shrink-0">
            <Cpu className="w-6 h-6 text-indigo-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-[13px] sm:text-[14px] font-black tracking-[0.1em] sm:tracking-[0.2em] text-indigo-100 uppercase drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]">
               Command Center (Master Bot)
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={`flex justify-center items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                status.isActive 
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' 
                  : 'bg-[#1E293B] text-[#64748B] border-[#334155]'
              }`}>
                {status.isActive ? <Activity className="w-2.5 h-2.5 animate-pulse" /> : <Network className="w-2.5 h-2.5" />}
                Sys state: {status.isActive ? status.phase : 'Standby'}
              </span>
              
              {/* Candle Synchronization Indicator */}
              <span className={`flex justify-center items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest border shadow-[0_0_10px_rgba(0,0,0,0.5)] ${
                !usePreviousDayAvg && !status.isActive 
                  ? 'bg-[#FCD535]/10 text-[#FCD535] border-[#FCD535]/30' 
                  : 'bg-[#1E293B] text-[#64748B] border-[#334155]'
              }`}>
                <Radio className={`w-2.5 h-2.5 ${!usePreviousDayAvg && !status.isActive ? "animate-pulse" : ""}`} />
                Candle Sync: {!usePreviousDayAvg && !status.isActive ? 'Active' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        
        {/* ── Top Level: Global Session Controls ── */}
        <div className="p-4 space-y-4 bg-gradient-to-b from-[#0A0D14] to-[#0A0D14]/80">
          <div className="flex justify-between items-center bg-[#0F172A] border border-[#1E293B] rounded-xl p-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              <Database className="w-4 h-4 text-indigo-400" /> Position Size Per Leg
            </div>
            <div className="flex items-center bg-[#0A0D14] border border-[#1E293B] rounded-md px-2 py-1">
              <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className="w-[80px] bg-transparent text-right font-mono text-[13px] text-white focus:outline-none" />
              <span className="text-gray-500 font-bold ml-2 text-[10px] uppercase">{symbol.split('/')[0]}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setEntryMode('INSTANT')} className={`py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border ${entryMode === 'INSTANT' ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-[#0F172A] border-[#1E293B] text-[#64748B]'}`}>
               Instant
            </button>
            <button onClick={() => setEntryMode('SCHEDULED')} className={`py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg transition-all border ${entryMode === 'SCHEDULED' ? 'bg-[#FCD535]/10 border-[#FCD535]/50 text-[#FCD535] shadow-[0_0_15px_rgba(252,213,53,0.2)]' : 'bg-[#0F172A] border-[#1E293B] text-[#64748B]'}`}>
               Scheduled
            </button>
          </div>

          {entryMode === 'SCHEDULED' && (
            <div className="bg-[#0F172A] border border-[#1E293B] rounded-xl p-3 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="flex gap-2">
                {['LONDON', 'NEW_YORK', 'ASIA'].map(session => (
                   <button key={session} onClick={() => setSessionTarget(session as any)} className={`flex-1 py-1.5 text-[9px] font-bold uppercase tracking-widest rounded border transition-all ${sessionTarget === session ? 'bg-amber-500/20 text-amber-500 border-amber-500/50' : 'bg-black/20 text-gray-500 border-[#1E293B]'}`}>
                     {session.replace('_', ' ')}
                   </button>
                ))}
              </div>
              <input 
                type="datetime-local" 
                value={scheduleTimeStr}
                onChange={(e) => setScheduleTimeStr(e.target.value)}
                className="w-full bg-[#0A0D14] border border-[#1E293B] text-white rounded p-2 focus:border-indigo-500 focus:outline-none transition-colors font-mono text-xs"
              />
            </div>
          )}

          {/* ── Semantic Refactoring: Risk Intuition Slider ── */}
          <div className={`mt-2 bg-[#0F172A] border border-[#1E293B] rounded-xl p-3 transition-all duration-700 ${isShimmering ? 'shadow-[0_0_20px_rgba(16,185,129,0.3)] border-emerald-500/50 scale-[1.01]' : ''}`}>
             <div className="flex justify-between items-center mb-2">
               <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5 list-none">
                 <Zap className="w-3.5 h-3.5" /> Risk Intuition (Auto-Scaling)
               </span>
               <span className={`text-[10px] font-mono font-bold transition-colors ${riskAppetite > 75 ? 'text-rose-400' : riskAppetite < 25 ? 'text-cyan-400' : 'text-gray-400'}`}>{riskAppetite}%</span>
             </div>
             <input type="range" min="1" max="100" value={riskAppetite} onChange={(e) => setRiskAppetite(Number(e.target.value))} className="w-full h-1.5 bg-[#1E293B] rounded-lg appearance-none cursor-pointer hover:bg-[#334155] transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-500/50" />
          </div>

        </div>

        {/* ── Upper Split: Bullish Execution Hand ── */}
        <div className="border-t border-emerald-500/20 bg-emerald-500/5 p-4 space-y-4">
           <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-400 flex items-center gap-2 drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]">
             <TrendingUp className="w-4 h-4" /> Bullish Execution Hand
           </h3>
           <div className="grid gap-3">
             <SmartInput 
                label="Stop Loss" 
                value={bullishSL} 
                onChange={(v) => setBullishSL(v)} 
                basePrice={Number(activeAnchor)} 
                colorTheme="emerald" 
                suffix="USDT" 
             />
             <SmartInput 
                label="Take Profit" 
                value={bullishTP} 
                onChange={(v) => setBullishTP(v)} 
                basePrice={bullishSL > 0 ? Number(activeAnchor) : undefined} 
                colorTheme="emerald" 
                suffix="USDT" 
             />
           </div>
        </div>

        {/* ── Lower Split: Bearish Execution Hand ── */}
        <div className="border-t border-rose-500/20 bg-rose-500/5 p-4 space-y-4">
           <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-rose-400 flex items-center gap-2 drop-shadow-[0_0_5px_rgba(244,63,94,0.5)]">
             <TrendingUp className="w-4 h-4 rotate-180" /> Bearish Execution Hand
           </h3>
           <div className="grid gap-3">
             <SmartInput 
                label="Stop Loss" 
                value={bearishSL} 
                onChange={(v) => setBearishSL(v)} 
                basePrice={Number(activeAnchor)} 
                colorTheme="rose" 
                suffix="USDT" 
             />
             <SmartInput 
                label="Target Anchor TP" 
                value={bearishTP} 
                onChange={(v) => setBearishTP(v)} 
                basePrice={Number(activeAnchor)} 
                colorTheme="rose" 
                suffix="USDT" 
             />
           </div>
        </div>

      </div>

      {/* ── Footer ── */}
      <div className="shrink-0 p-4 border-t border-[#1E293B] bg-[#0A0D14] z-10 shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
        {status.isActive ? (
          <button onClick={handleStop} disabled={loading} className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/50 rounded-xl font-black uppercase tracking-[0.2em] transition-all flex justify-center items-center gap-2 group hover:shadow-[0_0_20px_rgba(239,68,68,0.3)]">
            <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform" /> SEVER NEURAL LINK
          </button>
        ) : (
          <button onClick={handleStart} disabled={loading || !symbol} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:opacity-90 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-[0_0_20px_rgba(99,102,241,0.5)] transition-all flex justify-center items-center gap-2 group relative overflow-hidden disabled:opacity-50">
            <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 pointer-events-none" />
            <Cpu className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" /> 
            {entryMode === 'SCHEDULED' ? 'SCHEDULE VOLTRON' : 'ENGAGE VOLTRON HUB'}
          </button>
        )}
      </div>

    </div>
  );
};
