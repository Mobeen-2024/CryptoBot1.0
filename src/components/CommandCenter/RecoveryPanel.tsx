import React, { useState, useEffect } from 'react';
import { ShieldAlert, Clock, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface RecoveryPanelProps {
  recoveryTarget?: number;
  recoveryDeadline?: number;
}

export const RecoveryPanel: React.FC<RecoveryPanelProps> = ({ recoveryTarget, recoveryDeadline }) => {
  const [selectedMode, setSelectedMode] = useState<'AUTO' | 'CONFIRM' | 'HOLD'>('AUTO');
  const [deadlineHours, setDeadlineHours] = useState<number>(4);
  const [timeLeft, setTimeLeft] = useState<string>('');

  useEffect(() => {
    if (!recoveryDeadline) return;
    
    const interval = setInterval(() => {
      const diff = recoveryDeadline - Date.now();
      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        clearInterval(interval);
        return;
      }
      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(`${h}h ${m}m ${s}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [recoveryDeadline]);

  const handleUpdateMode = async () => {
    const toastId = toast.loading('Applying Protocol...');
    try {
      const res = await fetch('/api/bot/recovery-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode: selectedMode, 
          deadlineMs: deadlineHours * 60 * 60 * 1000 
        })
      });
      if (!res.ok) throw new Error('Update failed');
      toast.success('Recovery Protocol Overridden', { id: toastId });
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-[#fcd535]/5 border border-[#fcd535]/30 rounded-xl mb-4 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-[#fcd535] shadow-[0_0_15px_#fcd535]" />
      <div className="flex items-center justify-between">
        <h3 className="text-[#fcd535] font-black uppercase text-xs tracking-widest flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 animate-pulse" />
          Recovery Protocol Engaged
        </h3>
        {recoveryDeadline && (
          <div className="flex items-center gap-1.5 text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            {timeLeft}
          </div>
        )}
      </div>

      <div className="text-sm text-[#eaecef] opacity-80 font-medium">
        Survivor leg secured at Breakeven. Awaiting mean-reversion to Target: <strong className="text-white font-mono tracking-wide ml-1">${recoveryTarget?.toFixed(2)}</strong>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-2">
        <button 
          onClick={() => setSelectedMode('AUTO')}
          className={`flex flex-col gap-1 items-center justify-center p-2 rounded-lg border transition-all ${selectedMode === 'AUTO' ? 'bg-[#fcd535]/15 border-[#fcd535]/50 text-[#fcd535] shadow-[inset_0_0_10px_rgba(252,213,53,0.1)]' : 'bg-white/5 border-transparent text-[#5e6673] hover:text-[#eaecef]'}`}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-[9px] font-bold tracking-widest uppercase">Auto-Close</span>
        </button>
        <button 
          onClick={() => setSelectedMode('CONFIRM')}
          className={`flex flex-col gap-1 items-center justify-center p-2 rounded-lg border transition-all ${selectedMode === 'CONFIRM' ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-400 shadow-[inset_0_0_10px_rgba(6,182,212,0.1)]' : 'bg-white/5 border-transparent text-[#5e6673] hover:text-[#eaecef]'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span className="text-[9px] font-bold tracking-widest uppercase">Ask Confirm</span>
        </button>
        <button 
          onClick={() => setSelectedMode('HOLD')}
          className={`flex flex-col gap-1 items-center justify-center p-2 rounded-lg border transition-all ${selectedMode === 'HOLD' ? 'bg-rose-500/15 border-rose-500/50 text-rose-400 shadow-[inset_0_0_10px_rgba(244,63,94,0.1)]' : 'bg-white/5 border-transparent text-[#5e6673] hover:text-[#eaecef]'}`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span className="text-[9px] font-bold tracking-widest uppercase">Hold Position</span>
        </button>
      </div>

      <div className="flex items-center gap-2 mt-1">
        <select 
          value={deadlineHours} 
          onChange={(e) => setDeadlineHours(Number(e.target.value))}
          className="bg-black/40 border border-[#2b3139] text-[#eaecef] text-xs font-bold rounded-lg px-2 py-1.5 outline-none focus:border-[#fcd535]/50"
        >
          <option value={1}>1 Hour TTL</option>
          <option value={4}>4 Hours TTL</option>
          <option value={12}>12 Hours TTL</option>
          <option value={24}>24 Hours TTL</option>
        </select>
        <button 
          onClick={handleUpdateMode}
          className="flex-1 bg-[#2b3139] hover:bg-[#3b4149] text-white text-[10px] font-bold uppercase tracking-widest py-1.5 rounded-lg border border-[#3b4149] transition-colors"
        >
          Override Protocol
        </button>
      </div>
    </div>
  );
};
