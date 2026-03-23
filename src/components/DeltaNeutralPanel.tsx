import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Cpu, TrendingUp, XCircle } from 'lucide-react';

import { useVoltronMath } from '../hooks/useVoltronMath';
import { CommandHeader } from './CommandCenter/CommandHeader';
import { SessionControls } from './CommandCenter/SessionControls';
import { RiskSlider } from './CommandCenter/RiskSlider';
import { ExecutionHand } from './CommandCenter/ExecutionHand';

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
    <div className="h-full flex flex-col bg-[#0A0D14] transition-colors duration-500">
      <CommandHeader 
        status={status} 
        usePreviousDayAvg={usePreviousDayAvg} 
        currentPrice={currentPrice} 
        customAnchorPrice={customAnchorPrice} 
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <SessionControls 
          symbol={symbol} qty={qty} setQty={setQty}
          entryMode={entryMode} setEntryMode={setEntryMode}
          sessionTarget={sessionTarget} setSessionTarget={setSessionTarget}
          scheduleTimeStr={scheduleTimeStr} setScheduleTimeStr={setScheduleTimeStr}
        />

        <RiskSlider 
          riskAppetite={riskAppetite} 
          setRiskAppetite={setRiskAppetite} 
          isShimmering={isShimmering} 
        />

        <ExecutionHand 
          title="Bullish Execution Hand" icon={TrendingUp} colorTheme="emerald"
          slLabel="Stop Loss" slValue={bullishSL} setSL={setBullishSL}
          tpLabel="Take Profit" tpValue={bullishTP} setTP={setBullishTP}
          activeAnchor={Number(activeAnchor)}
        />

        <ExecutionHand 
          title="Bearish Execution Hand" icon={TrendingUp} colorTheme="rose" isReversed
          slLabel="Stop Loss" slValue={bearishSL} setSL={setBearishSL}
          tpLabel="Target Anchor TP" tpValue={bearishTP} setTP={setBearishTP}
          activeAnchor={Number(activeAnchor)}
        />
      </div>

      {/* ── Footer Link Dispatcher ── */}
      <div className="shrink-0 p-5 border-t border-white/5 bg-black/60 backdrop-blur-md z-10 shadow-[0_-15px_40px_rgba(0,0,0,0.6)]">
        {status.isActive ? (
          <button onClick={handleStop} disabled={loading} className="w-full py-4.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 hover:border-red-500/60 rounded-2xl font-black uppercase tracking-[0.25em] transition-all flex justify-center items-center gap-3 group drop-shadow-[0_0_15px_rgba(239,68,68,0.2)]">
            <XCircle className="w-5 h-5 group-hover:scale-110 transition-transform text-red-400" /> SEVER NEURAL LINK
          </button>
        ) : (
          <button onClick={handleStart} disabled={loading || !symbol} className="w-full py-4.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white border border-indigo-400/30 rounded-2xl font-black uppercase tracking-[0.25em] shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all flex justify-center items-center gap-3 group relative overflow-hidden disabled:opacity-50">
            <div className="absolute inset-0 bg-white/10 translate-y-[-100%] group-hover:translate-y-[100%] transition-transform duration-700 pointer-events-none" />
            <Cpu className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700 text-indigo-200" /> 
            {entryMode === 'SCHEDULED' ? 'SCHEDULE VOLTRON' : 'ENGAGE VOLTRON HUB'}
          </button>
        )}
      </div>
    </div>
  );
};
