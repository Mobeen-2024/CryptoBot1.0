import React, { useState, useEffect } from 'react';
import { Activity, Radio, Cpu, BarChart2, ShieldAlert } from 'lucide-react';

interface CoinInfoProps {
  symbol: string;
}

interface TickerData {
  c: string; // Last price
  P: string; // Price change percent
  h: string; // High price
  l: string; // Low price
  v: string; // Base volume
  q: string; // Quote volume
}

export const CoinInfo: React.FC<CoinInfoProps> = ({ symbol }) => {
  const [data, setData] = useState<TickerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@ticker`);
    
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.e === '24hrTicker') {
        setData(parsed);
        setLoading(false);
      }
    };

    return () => {
      ws.close();
    };
  }, [symbol]);

  const formatVol = (val: string) => {
    const v = parseFloat(val);
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return v.toFixed(2);
  };

  const isUp = data ? parseFloat(data.P) >= 0 : true;
  const base = symbol.replace('USDT', '');

  // Calculate position in 24h range
  const high = data ? parseFloat(data.h) : 0;
  const low = data ? parseFloat(data.l) : 0;
  const current = data ? parseFloat(data.c) : 0;
  const range = high - low;
  const pos = range === 0 ? 0.5 : (current - low) / range;

  return (
    <div className="glass-panel backdrop-blur-2xl p-4 rounded-xl border border-[var(--holo-cyan)]/20 shadow-[0_0_30px_rgba(0,0,0,0.6)] relative overflow-hidden group">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--holo-cyan-glow)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/30 to-transparent shadow-[0_0_10px_var(--holo-cyan)]" />

      <div className="flex items-center justify-between mb-4 relative z-10 border-b border-white/5 pb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Cpu className="w-5 h-5 text-[var(--holo-cyan)]" />
            <div className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-black ${loading ? 'bg-[var(--holo-gold)] animate-pulse' : 'bg-[var(--holo-cyan)] shadow-[0_0_8px_var(--holo-cyan)]'}`} />
          </div>
          <div>
            <h2 className="text-[12px] font-black text-white uppercase tracking-[0.2em] drop-shadow-[0_0_5px_var(--holo-cyan-glow)]">Asset Telemetry</h2>
            <div className="text-[9px] font-mono text-[var(--holo-cyan)]/60 tracking-widest mt-0.5">NODE // {base}</div>
          </div>
        </div>
        <div className="p-1.5 bg-black/50 rounded border border-white/10 hidden sm:block">
           <Radio className={`w-4 h-4 ${loading ? 'text-gray-600' : 'text-[var(--holo-cyan)] animate-pulse drop-shadow-[0_0_5px_var(--holo-cyan)]'}`} />
        </div>
      </div>

      {loading || !data ? (
        <div className="h-24 flex flex-col items-center justify-center relative z-10">
          <Activity className="w-6 h-6 text-[var(--holo-cyan)]/50 animate-bounce mb-2" />
          <span className="text-[10px] font-mono text-[var(--holo-cyan)]/50 uppercase tracking-[0.2em] font-bold">Establishing Uplink...</span>
        </div>
      ) : (
        <div className="relative z-10 space-y-4">
          
          {/* Main Price & Change */}
          <div className="flex justify-between items-end">
            <div>
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Live Valuation</div>
              <div className={`text-2xl font-black font-mono tracking-tight drop-shadow-[0_0_10px_currentColor] ${isUp ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]'}`}>
                {parseFloat(data.c).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: parseFloat(data.c) < 1 ? 6 : 2 })}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">24H Delta</div>
              <div className={`text-sm font-black font-mono tracking-widest bg-black/40 px-2 py-1 rounded border ${isUp ? 'text-[var(--holo-cyan)] border-[var(--holo-cyan)]/30' : 'text-[var(--holo-magenta)] border-[var(--holo-magenta)]/30'}`}>
                {isUp ? '+' : ''}{parseFloat(data.P).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* Range Visualizer */}
          <div className="bg-black/50 rounded-lg p-3 border border-white/5 relative overflow-hidden group-hover:border-[var(--holo-cyan)]/20 transition-colors">
             <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.02)_50%,transparent_75%)] bg-[length:10px_10px] pointer-events-none" />
             <div className="flex justify-between text-[9px] font-mono text-gray-400 font-bold tracking-widest mb-2 relative z-10">
               <span>L: {parseFloat(data.l).toLocaleString(undefined, { maximumFractionDigits: parseFloat(data.l) < 1 ? 4 : 2 })}</span>
               <span className="text-[var(--holo-cyan)] uppercase text-[8px]">Scan Range</span>
               <span>H: {parseFloat(data.h).toLocaleString(undefined, { maximumFractionDigits: parseFloat(data.h) < 1 ? 4 : 2 })}</span>
             </div>
             <div className="h-1.5 w-full bg-[#0b0e11] rounded-full overflow-hidden relative z-10 shadow-inner">
               <div className="absolute top-0 bottom-0 left-0 bg-[var(--holo-cyan)]/20" style={{ width: '100%' }} />
               <div className={`absolute top-0 bottom-0 shadow-[0_0_10px_currentColor] ${isUp ? 'bg-[var(--holo-cyan)]' : 'bg-[var(--holo-magenta)]'}`} 
                    style={{ left: 0, right: `${100 - (pos * 100)}%` }} />
               <div className="absolute top-0 bottom-0 w-1 bg-white shadow-[0_0_5px_white]" style={{ left: `${Math.min(99, Math.max(0, pos * 100))}%` }} />
             </div>
          </div>

          {/* Volume Grid */}
          <div className="grid grid-cols-2 gap-3">
             <div className="bg-white/5 rounded border border-white/5 p-2 px-3">
               <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest. mb-0.5 flex items-center gap-1"><BarChart2 className="w-3 h-3 text-[var(--holo-cyan)]" /> 24H_VOL_BASE</div>
               <div className="text-[11px] font-black font-mono text-white tracking-widest">{formatVol(data.v)} <span className="text-gray-600 font-normal">{base}</span></div>
             </div>
             <div className="bg-white/5 rounded border border-white/5 p-2 px-3">
               <div className="text-[9px] font-bold text-gray-500 uppercase tracking-widest. mb-0.5 flex items-center gap-1"><ShieldAlert className="w-3 h-3 text-[var(--holo-gold)]" /> 24H_VOL_QUOTE</div>
               <div className="text-[11px] font-black font-mono text-[var(--holo-gold)] tracking-widest">{formatVol(data.q)} <span className="text-gray-600 font-normal">USDT</span></div>
             </div>
          </div>

        </div>
      )}
    </div>
  );
};
