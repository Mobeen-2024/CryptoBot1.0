import React, { useState } from 'react';
import { Anchor, RefreshCw, XCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReAnchorPanelProps {
  currentPrice: number;
  reAnchorCount: number;
  onStop: () => void;
}

export const ReAnchorPanel: React.FC<ReAnchorPanelProps> = ({ currentPrice, reAnchorCount, onStop }) => {
  const [anchorPrice, setAnchorPrice] = useState<string>(currentPrice.toString());
  const maxCycles = 4;
  const isMaxed = reAnchorCount >= maxCycles;

  const handleReAnchor = async () => {
    if (isMaxed) return;
    const toastId = toast.loading('Re-Anchoring System...');
    try {
      const res = await fetch('/api/bot/reanchor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anchorPrice: Number(anchorPrice) })
      });
      if (!res.ok) throw new Error('Re-Anchor failed');
      toast.success('System Re-Anchored', { id: toastId });
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 bg-[var(--holo-cyan)]/10 border border-[var(--holo-cyan)]/30 rounded-xl mb-4 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-1 h-full bg-[var(--holo-cyan)] shadow-[0_0_15px_#6366f1]" />
      
      <div className="flex items-center justify-between">
        <h3 className="text-[var(--holo-cyan)] font-black uppercase text-xs tracking-widest flex items-center gap-2">
          <Anchor className="w-4 h-4" />
          Partial Exit: Take Profit Hit
        </h3>
        <div className={`flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded border ${isMaxed ? 'text-[var(--holo-magenta)] bg-[var(--holo-magenta)]/10 border-[var(--holo-magenta)]/20' : 'text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10 border-[var(--holo-cyan)]/20'}`}>
          <RefreshCw className={`w-3.5 h-3.5 ${isMaxed ? '' : 'animate-spin-slow'}`} />
          Cycle {reAnchorCount}/{maxCycles}
        </div>
      </div>

      {isMaxed ? (
        <div className="text-sm text-[var(--holo-magenta)] font-medium flex items-center gap-2 bg-[var(--holo-magenta)]/5 p-2 rounded border border-[var(--holo-magenta)]/10">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Maximum re-anchor limit reached. The neural cycle must be terminated.
        </div>
      ) : (
        <div className="text-sm text-[#eaecef] opacity-80 font-medium">
          A Take Profit target was successfully extracted. You may sever the link, or specify a new anchor to restart the Voltron cycle.
        </div>
      )}

      {!isMaxed && (
        <div className="flex items-center gap-2 mt-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5e6673] font-mono text-xs">$</span>
            <input 
              type="number" 
              value={anchorPrice}
              onChange={(e) => setAnchorPrice(e.target.value)}
              className="w-full bg-black/40 border border-[#2b3139] text-[#eaecef] font-mono font-bold text-sm rounded-lg pl-6 pr-3 py-2 outline-none focus:border-[var(--holo-cyan)]/50 transition-colors"
            />
          </div>
          <button 
            onClick={() => setAnchorPrice(currentPrice.toString())}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-xs font-bold text-[#eaecef] rounded-lg border border-transparent transition-colors"
          >
            SET CTM
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mt-2">
        <button 
          onClick={onStop}
          className="flex items-center justify-center gap-2 py-2.5 bg-[var(--holo-magenta)]/10 hover:bg-[var(--holo-magenta)]/20 text-[var(--holo-magenta)] text-[10px] font-black tracking-widest uppercase rounded-lg border border-[var(--holo-magenta)]/30 hover:border-[var(--holo-magenta)]/50 transition-all"
        >
          <XCircle className="w-4 h-4" /> Sever Link
        </button>
        {!isMaxed && (
          <button 
            onClick={handleReAnchor}
            className="flex items-center justify-center gap-2 py-2.5 bg-[var(--holo-cyan)] hover:bg-[var(--holo-cyan)] text-white text-[10px] font-black tracking-widest uppercase rounded-lg border border-[var(--holo-cyan)]/30 shadow-[0_0_15px_rgba(99,102,241,0.3)] transition-all"
          >
            <Anchor className="w-4 h-4" /> Re-Anchor
          </button>
        )}
      </div>
    </div>
  );
};
