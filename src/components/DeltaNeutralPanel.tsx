import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Cpu, TrendingUp, XCircle } from 'lucide-react';

import { useVoltronMath } from '../hooks/useVoltronMath';
import { RecoveryPanel } from './CommandCenter/RecoveryPanel';
import { ReAnchorPanel } from './CommandCenter/ReAnchorPanel';
import { BearishBotPanel } from './CommandCenter/BearishBotPanel';

interface BotState {
  isActive: boolean; symbol: string; qty: number; 
  masterEntryPrice: number; slaveEntryPrice: number;
  livePnL?: number; phase?: 'IDLE' | 'ARMED' | 'SCHEDULED' | 'HEDGED' | 'NAKED_LONG' | 'NAKED_SHORT' | 'PARTIAL_EXIT' | 'RECOVERY_MODE' | 'ASYMMETRIC_BREAK' | 'CLOSED';
  scheduledTime?: number;
  recoveryTarget?: number;
  recoveryDeadline?: number;
  reAnchorCount?: number;
}

interface DeltaNeutralPanelProps { 
  symbol: string; 
  currentPrice?: number; 
  lastClosedCandle?: { price: number, time: number } | null;
}

export const DeltaNeutralPanel: React.FC<DeltaNeutralPanelProps> = ({ symbol, currentPrice = 0, lastClosedCandle }) => {
  // ── Session Controls ───────────────────────────────────
  const [qty, setQty] = useState<string>('0.001');
  const [entryMode, setEntryMode] = useState<'INSTANT' | 'SCHEDULED'>('INSTANT');
  const [sessionTarget, setSessionTarget] = useState<'LONDON' | 'NEW_YORK' | 'ASIA'>('LONDON');
  const [scheduleTimeStr, setScheduleTimeStr] = useState<string>('');
  
  // ── Hub Indicators ─────────────────────────────────────
  const [usePreviousDayAvg] = useState(false);
  const [customAnchorPrice, setCustomAnchorPrice] = useState<number>(currentPrice || 0);

  // ── Voltron Mathematics Custom Hook ────────────────────
  const {
    riskAppetite, setRiskAppetite, isShimmering,
    bullishSL, setBullishSL, bullishTP, setBullishTP,
    bearishSL, setBearishSL, bearishTP, setBearishTP
  } = useVoltronMath(currentPrice, customAnchorPrice, usePreviousDayAvg);

  // ── System API State ───────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BotState>({
    isActive: false, symbol: '', qty: 0,
    masterEntryPrice: 0, slaveEntryPrice: 0, livePnL: 0, phase: 'IDLE'
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

  // MASTER BOT: Candle Sync (WebSocket Listener)
  useEffect(() => {
    if (lastClosedCandle && !usePreviousDayAvg && !status.isActive) {
      setCustomAnchorPrice(lastClosedCandle.price);
      toast.success(`Candle Closed! Master Hub synchronized Anchor to $${lastClosedCandle.price.toLocaleString()}`, { id: 'candle-sync-toast', duration: 3000 });
    }
  }, [lastClosedCandle, usePreviousDayAvg, status.isActive]);

  // Initial Sync
  useEffect(() => {
    if (customAnchorPrice === 0 && currentPrice > 0) {
      setCustomAnchorPrice(currentPrice);
    }
  }, [currentPrice]);

  const activeAnchor = usePreviousDayAvg ? "1D AVG" : customAnchorPrice;

  const handleStart = async () => {
    setLoading(true);
    let toastId;
    try {
      toastId = toast.loading('Initiating Voltron Master Protocol...');
      
      const payload = {
        symbol, qty, entryMode, scheduleTimeStr, sessionTarget,
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
    <div className="h-full flex flex-col sm:flex-row gap-4 p-4 items-start justify-center bg-transparent transition-colors duration-500 overflow-y-auto custom-scrollbar">
      
      {/* ── THE MASTER BOT WIDGET ── */}
      <div className="flex-1 shrink-0 glass-panel border border-[var(--holo-cyan)]/20 rounded-2xl p-5 w-full min-w-[300px] max-w-[360px] flex flex-col text-white shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden group hover:border-[var(--holo-cyan)]/40 transition-colors">
        
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-[var(--holo-cyan)]/10 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-[var(--holo-cyan)]/20 transition-colors" />

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[var(--holo-cyan)]/20 to-transparent border border-[var(--holo-cyan)]/30 flex items-center justify-center shadow-[0_4px_20px_var(--holo-cyan-glow)] shrink-0">
            <Cpu className="w-5 h-5 text-[var(--holo-cyan)] drop-shadow-[0_0_8px_var(--holo-cyan)]" />
          </div>
          <div>
            <h2 className="text-sm font-black tracking-widest text-[#eaecef] uppercase">Master Bot</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] font-mono text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10 px-1.5 py-0.5 rounded border border-[var(--holo-cyan)]/20">
                {symbol}
              </span>
              <span className={`text-[10px] font-bold uppercase flex items-center gap-1 ${status.isActive ? 'text-[var(--holo-cyan)]' : 'text-gray-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${status.isActive ? 'bg-[var(--holo-cyan)] animate-pulse shadow-[0_0_5px_var(--holo-cyan)]' : 'bg-gray-600'}`} />
                {status.isActive ? status.phase : 'STANDBY'}
              </span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <div className="flex flex-col gap-4 relative z-10">
          
          {/* 1. Anchor / Entry Price */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Anchor Price (Auto-Detect Sync)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-mono text-sm">$</span>
              <input 
                type="number"
                value={customAnchorPrice}
                onChange={(e) => setCustomAnchorPrice(Number(e.target.value))}
                className="w-full bg-black/40 border border-white/5 text-white font-mono font-bold text-sm rounded-xl pl-6 pr-3 py-2.5 outline-none focus:border-[var(--holo-cyan)]/50 transition-colors shadow-inner"
              />
            </div>
            <div className="flex items-center justify-between text-[9px] text-[var(--holo-cyan)]/60 font-medium tracking-widest uppercase">
              <span>Live: ${currentPrice.toFixed(2)}</span>
              {lastClosedCandle && <span>Prev Candle: ${lastClosedCandle.price.toFixed(2)}</span>}
            </div>
          </div>

          {/* 2. Volume / Qty */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Position Volume</label>
            <div className="flex gap-2">
              <input 
                type="number"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                className="flex-1 bg-black/40 border border-white/5 text-white font-mono font-bold text-sm rounded-xl px-3 py-2.5 outline-none focus:border-[var(--holo-cyan)]/50 transition-colors shadow-inner text-center"
              />
              {['0.001', '0.01'].map(size => (
                <button 
                  key={size} onClick={() => setQty(size)}
                  className={`px-3 rounded-xl border font-mono text-[10px] font-bold transition-colors ${qty === size ? 'bg-[var(--holo-cyan)]/15 border-[var(--holo-cyan)]/40 text-[var(--holo-cyan)] shadow-[0_0_10px_var(--holo-cyan-glow)]' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* 3. Execution Type & Timing */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Execution Mode</label>
              <div className="flex gap-1 bg-black/40 rounded-lg p-0.5 border border-white/5">
                <button onClick={() => setEntryMode('INSTANT')} className={`px-2 py-1 text-[9px] font-bold uppercase rounded-md transition-colors ${entryMode === 'INSTANT' ? 'bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)] shadow-sm' : 'text-gray-500 hover:text-white'}`}>Instant</button>
                <button onClick={() => setEntryMode('SCHEDULED')} className={`px-2 py-1 text-[9px] font-bold uppercase rounded-md transition-colors ${entryMode === 'SCHEDULED' ? 'bg-[var(--holo-gold)]/20 text-[var(--holo-gold)] shadow-sm' : 'text-gray-500 hover:text-white'}`}>Schedule</button>
              </div>
            </div>
            
            {entryMode === 'SCHEDULED' && (
              <div className="fade-in animate-in slide-in-from-top-2 flex flex-col gap-2 mt-2">
                <div className="flex gap-1">
                  {['LONDON', 'NEW_YORK', 'ASIA'].map(session => (
                    <button 
                      key={session} onClick={() => setSessionTarget(session as any)}
                      className={`flex-1 py-1.5 text-[9px] font-bold uppercase rounded-lg border transition-colors ${sessionTarget === session ? 'bg-[var(--holo-gold)]/15 border-[var(--holo-gold)]/30 text-[var(--holo-gold)]' : 'bg-white/5 border-transparent text-gray-400 hover:bg-white/10'}`}
                    >
                      {session.replace('_', ' ')}
                    </button>
                  ))}
                </div>
                <input 
                  type="datetime-local" 
                  value={scheduleTimeStr}
                  onChange={(e) => setScheduleTimeStr(e.target.value)}
                  className="w-full bg-black/40 border border-white/5 text-white/90 rounded-lg px-3 py-2 text-xs font-mono outline-none focus:border-[var(--holo-gold)]/50"
                />
              </div>
            )}
          </div>

          {/* Active Status Panels */}
          {status.phase === 'RECOVERY_MODE' && (
            <div className="mt-2">
              <RecoveryPanel recoveryTarget={status.recoveryTarget} recoveryDeadline={status.recoveryDeadline} />
            </div>
          )}
          {status.phase === 'PARTIAL_EXIT' && (
            <div className="mt-2">
              <ReAnchorPanel currentPrice={currentPrice} reAnchorCount={status.reAnchorCount || 0} onStop={handleStop} />
            </div>
          )}

        </div>

        {/* Footer Action */}
        <div className="mt-6 relative z-10 pt-4 border-t border-white/5">
          {status.isActive ? (
            <button onClick={handleStop} disabled={loading} className="w-full py-3.5 bg-[var(--holo-magenta)]/10 hover:bg-[var(--holo-magenta)]/20 text-[var(--holo-magenta)] border border-[var(--holo-magenta)]/30 rounded-xl font-black uppercase tracking-[0.2em] text-[11px] transition-all flex justify-center items-center gap-2 group shadow-[0_0_15px_var(--holo-magenta-glow)] hover:shadow-[0_0_25px_var(--holo-magenta-glow)]">
              <XCircle className="w-4 h-4 group-hover:scale-110 transition-transform" /> SEVER NEURAL LINK
            </button>
          ) : (
            <button onClick={handleStart} disabled={loading || !symbol} className="w-full py-3.5 bg-gradient-to-r from-[var(--holo-cyan)] to-[var(--holo-cyan)]/80 hover:brightness-110 text-black border border-[var(--holo-cyan)]/30 rounded-xl font-black uppercase tracking-[0.2em] text-[11px] shadow-[0_0_20px_var(--holo-cyan-glow)] hover:shadow-[0_0_30px_var(--holo-cyan-glow)] transition-all flex justify-center items-center gap-2 group overflow-hidden relative">
              <div className="absolute inset-0 bg-white/20 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 pointer-events-none" />
              <Cpu className="w-4 h-4 group-hover:rotate-180 transition-transform duration-700 text-black" /> 
              {entryMode === 'SCHEDULED' ? 'SCHEDULE VOLTRON' : 'DEPLOY VOLTRON'}
            </button>
          )}
        </div>
        
      </div>
      
      {/* ── THE BEARISH BOT WIDGET ── */}
      <BearishBotPanel masterEntryPrice={customAnchorPrice} />
    </div>
  );
};
