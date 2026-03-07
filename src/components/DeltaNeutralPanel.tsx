import React, { useState, useEffect } from 'react';
import { Play, Square, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
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
    isActive: false,
    symbol: '',
    qty: 0,
    stopLossUSDT: 1,
    masterEntryPrice: 0,
    slaveEntryPrice: 0,
    longStopTriggered: false,
    shortStopTriggered: false,
    cycles: 0
  });

  useEffect(() => {
    // Fetch initial status
    fetch('/api/bot/status')
      .then(res => res.json())
      .then(data => setStatus(data))
      .catch(err => console.error("Failed to fetch bot status", err));

    // Connect to WebSocket namespace for real-time trigger updates
    const socket = io();

    socket.on('delta_neutral_status', (data: BotState) => {
      setStatus(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          qty,
          stopLossUSDT: stopLoss
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success('Delta-Neutral Hedge Initiated');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success('Hedge Terminated. Remember to close any open positions manually.', {
         duration: 5000
      });
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-[#1e2329] border border-[#2b3139] rounded-lg p-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#2b3139]">
        <Activity className={`w-5 h-5 ${status.isActive ? 'text-emerald-500 animate-pulse' : 'text-gray-500'}`} />
        <h2 className="text-white font-bold tracking-wider">BIDIRECTIONAL DELTA-NEUTRAL BOT</h2>
      </div>

      <div className="flex-1 w-full overflow-y-auto pr-1">
        {/* Run Controls */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Contract Quantity</label>
            <input 
              type="number"
              value={qty}
              onChange={e => setQty(e.target.value)}
              disabled={status.isActive}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-1.5 text-white text-xs outline-none focus:border-indigo-500 disabled:opacity-50"
              step="0.001"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-500 uppercase font-bold mb-1">Stop-Loss (USDT)</label>
            <input 
              type="number"
              value={stopLoss}
              onChange={e => setStopLoss(e.target.value)}
              disabled={status.isActive}
              className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-1.5 text-white text-xs outline-none focus:border-indigo-500 disabled:opacity-50"
              step="0.5"
            />
          </div>
        </div>

        {/* Action Button */}
        <div className="mb-6">
          {!status.isActive ? (
            <button 
              onClick={handleStart}
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              INITIATE ALGORITHMIC HEDGE
            </button>
          ) : (
            <button 
              onClick={handleStop}
              disabled={loading}
              className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
               {loading ? <Activity className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
               ABORT EXECUTION
            </button>
          )}
        </div>

        {/* Live Status Board */}
        <div className="bg-[#0b0e11] rounded-lg border border-[#2b3139] p-3 text-xs font-mono relative overflow-hidden">
           {status.isActive && (
             <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-emerald-500 to-indigo-500 animate-pulse" />
           )}
           
           <div className="flex items-center justify-between mb-3">
             <span className="text-gray-500 uppercase font-bold tracking-widest text-[9px]">Engine Status</span>
             <span className={`px-2 py-0.5 rounded font-bold ${status.isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-gray-500'}`}>
               {status.isActive ? `ACTIVE - LOOP ${status.cycles}` : 'OFFLINE'}
             </span>
           </div>

           <div className="space-y-2 text-[11px]">
             <div className="flex justify-between items-center">
               <span className="text-gray-400">Master Long (A)</span>
               <div className="text-right">
                 <span className={status.longStopTriggered ? 'text-rose-500 font-bold' : 'text-emerald-400'}>
                    {status.masterEntryPrice > 0 ? status.masterEntryPrice : '---'}
                 </span>
                 {status.longStopTriggered && <span className="text-[10px] text-gray-500 ml-2">(STOPPED)</span>}
               </div>
             </div>
             <div className="flex justify-between items-center">
               <span className="text-gray-400">Slave Short (B)</span>
               <div className="text-right">
                 <span className={status.shortStopTriggered ? 'text-emerald-500 font-bold' : 'text-rose-400'}>
                    {status.slaveEntryPrice > 0 ? status.slaveEntryPrice : '---'}
                 </span>
                 {status.shortStopTriggered && <span className="text-[10px] text-gray-500 ml-2">(STOPPED)</span>}
               </div>
             </div>
           </div>

           {status.isActive && (
             <div className="mt-4 pt-3 border-t border-white/5 flex items-start gap-2 text-gray-400 text-[10px]">
               <ShieldCheck className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5" />
               <p>Bot is actively monitoring strict {status.stopLossUSDT} USDT boundaries. Simultaneous internal cross-referencing enabled.</p>
             </div>
           )}
           {!status.isActive && status.cycles > 0 && (
             <div className="mt-4 pt-3 border-t border-white/5 flex items-start gap-2 text-amber-500/80 text-[10px]">
               <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
               <p>System halted. Please review your Binance terminal to manually close any surviving directional positions (if desired).</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
