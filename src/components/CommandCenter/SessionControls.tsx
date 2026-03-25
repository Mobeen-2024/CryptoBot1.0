import React from 'react';
import { Database } from 'lucide-react';

interface SessionControlsProps {
  symbol: string;
  qty: string;
  setQty: (qty: string) => void;
  entryMode: 'INSTANT' | 'SCHEDULED';
  setEntryMode: (mode: 'INSTANT' | 'SCHEDULED') => void;
  sessionTarget: 'LONDON' | 'NEW_YORK' | 'ASIA';
  setSessionTarget: (session: 'LONDON' | 'NEW_YORK' | 'ASIA') => void;
  scheduleTimeStr: string;
  setScheduleTimeStr: (time: string) => void;
}

export const SessionControls: React.FC<SessionControlsProps> = ({
  symbol, qty, setQty, entryMode, setEntryMode, sessionTarget, setSessionTarget, scheduleTimeStr, setScheduleTimeStr
}) => {
  return (
    <div className="p-5 space-y-5 bg-black/20">
      
      {/* ── Position Size Control ── */}
      <div className="flex flex-col bg-white/[0.02] border border-white/5 rounded-2xl p-4 gap-4 shadow-sm backdrop-blur-md">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">
            <Database className="w-4 h-4 text-[var(--holo-cyan)] opacity-80" /> Volume Array
          </div>
          <div className="flex items-center bg-black/40 border border-white/5 rounded-lg px-3 py-1.5 transition-colors focus-within:border-[var(--holo-cyan)]/50 shadow-inner">
            <input 
              type="number" 
              value={qty} 
              onChange={(e) => setQty(e.target.value)} 
              className="w-[90px] bg-transparent text-right font-mono text-[14px] font-medium text-white focus:outline-none" 
            />
            <span className="text-[var(--holo-cyan)]/50 font-bold ml-2 text-[10px] uppercase tracking-wider">{symbol.split('/')[0]}</span>
          </div>
        </div>
        
        {/* Macro Position Chips */}
        <div className="flex gap-2.5">
            {['0.001', '0.01', '0.05', '0.1'].map(size => (
              <button 
                key={size} 
                onClick={() => setQty(size)} 
                className={`flex-1 py-1.5 text-[11px] font-mono font-bold rounded-lg transition-all duration-300 ${
                  qty === size 
                    ? 'bg-[var(--holo-cyan)]/15 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/40 shadow-[0_0_15px_rgba(99,102,241,0.15)] scale-[1.02]' 
                    : 'bg-white/5 hover:bg-white/10 border border-white/5 text-gray-400 hover:text-[var(--holo-cyan)]'
                }`}
              >
                {size}
              </button>
            ))}
        </div>
      </div>

      {/* ── Entry Dispatch Mode ── */}
      <div className="grid grid-cols-2 gap-3">
        <button 
          onClick={() => setEntryMode('INSTANT')} 
          className={`py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all duration-300 border ${
            entryMode === 'INSTANT' 
              ? 'bg-[var(--holo-cyan)]/15 border-[var(--holo-cyan)]/40 text-[var(--holo-cyan)] shadow-[0_4px_20px_rgba(99,102,241,0.15)] scale-[1.02]' 
              : 'bg-white/[0.02] hover:bg-white/5 border-white/5 text-gray-400'
          }`}
        >
            Instant
        </button>
        <button 
          onClick={() => setEntryMode('SCHEDULED')} 
          className={`py-2.5 text-[11px] font-bold uppercase tracking-widest rounded-xl transition-all duration-300 border ${
            entryMode === 'SCHEDULED' 
              ? 'bg-[#FCD535]/15 border-[#FCD535]/40 text-[#FCD535] shadow-[0_4px_20px_rgba(252,213,53,0.15)] scale-[1.02]' 
              : 'bg-white/[0.02] hover:bg-white/5 border-white/5 text-gray-400'
          }`}
        >
            Scheduled
        </button>
      </div>

      {/* ── Scheduling Target Panel ── */}
      {entryMode === 'SCHEDULED' && (
        <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 flex flex-col gap-4 animate-in fade-in slide-in-from-top-4 shadow-sm backdrop-blur-md">
          <div className="flex gap-2.5">
            {['LONDON', 'NEW_YORK', 'ASIA'].map(session => (
                <button 
                  key={session} 
                  onClick={() => setSessionTarget(session as any)} 
                  className={`flex-1 py-2 text-[10px] font-bold uppercase tracking-widest rounded-lg border transition-all duration-300 ${
                    sessionTarget === session 
                      ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
                      : 'bg-black/20 text-gray-500 border-transparent hover:bg-white/5'
                  }`}
                >
                  {session.replace('_', ' ')}
                </button>
            ))}
          </div>
          <div className="relative">
            <input 
              type="datetime-local" 
              value={scheduleTimeStr}
              onChange={(e) => setScheduleTimeStr(e.target.value)}
              className="w-full bg-black/40 border border-white/5 text-white/90 rounded-lg p-3 pt-3.5 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 focus:outline-none transition-all duration-300 font-mono text-sm shadow-inner"
            />
          </div>
        </div>
      )}
    </div>
  );
};
