import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Radio } from 'lucide-react';

interface WatchlistItem {
  symbol: string;
  price: number;
  change24h: number;
  volume: number;
  high: number;
  low: number;
}

const WATCH_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT'];

export const MarketWatchlist: React.FC<{ onSelectSymbol?: (s: string) => void; activeSymbol?: string }> = ({ onSelectSymbol, activeSymbol }) => {
  const [items, setItems] = useState<Map<string, WatchlistItem>>(new Map());
  const [sortBy, setSortBy] = useState<'symbol' | 'change' | 'volume'>('change');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);

  useEffect(() => {
    const streams = WATCH_SYMBOLS.map(s => `${s.toLowerCase()}@ticker`).join('/');
    const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

    ws.onmessage = (ev) => {
      const { data } = JSON.parse(ev.data);
      if (!data) return;
      setItems(prev => {
        const next = new Map(prev);
        next.set(data.s, {
          symbol: data.s,
          price: parseFloat(data.c),
          change24h: parseFloat(data.P),
          volume: parseFloat(data.v) * parseFloat(data.c),
          high: parseFloat(data.h),
          low: parseFloat(data.l),
        });
        return next;
      });
    };

    return () => ws.close();
  }, []);

  const sorted: WatchlistItem[] = (Array.from(items.values()) as WatchlistItem[]).sort((a: WatchlistItem, b: WatchlistItem) => {
    if (sortBy === 'symbol') return a.symbol.localeCompare(b.symbol) * sortDir;
    if (sortBy === 'change') return (a.change24h - b.change24h) * sortDir;
    return (a.volume - b.volume) * sortDir;
  });

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 1 ? -1 : 1);
    else { setSortBy(col); setSortDir(-1); }
  };

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <svg className={`w-2.5 h-2.5 inline-block ml-0.5 transition-colors ${sortBy === col ? 'text-[var(--holo-cyan)]' : 'text-gray-600'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      {sortDir === -1 || sortBy !== col ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
    </svg>
  );

  return (
    <div className="flex flex-col h-full bg-[#05070a]/90 backdrop-blur-3xl overflow-hidden relative">
      
      {/* Background Cyber-Grid Array */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.02)_1px,transparent_1px)] bg-[size:30px_30px] opacity-30 pointer-events-none" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--holo-cyan)]/5 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#bc13fe]/5 blur-3xl rounded-full pointer-events-none" />

      {/* Cyber Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--holo-cyan)]/10 bg-black/40 shrink-0 relative z-10 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-3">
          <div className="relative">
             <Radio className="w-4 h-4 text-[var(--holo-cyan)] animate-pulse" />
             <div className="absolute inset-0 bg-[var(--holo-cyan)] blur-md opacity-30 animate-pulse" />
          </div>
          <div className="flex flex-col">
            <span className="text-[11px] font-black uppercase tracking-[0.2em] text-white">Global Market Array</span>
            <span className="text-[8px] font-mono text-[var(--holo-cyan)]/60 tracking-widest leading-none">REALTIME_TELEMETRY</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <span className="flex h-2 w-2 relative">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--holo-cyan)] opacity-75"></span>
             <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--holo-cyan)]"></span>
           </span>
           <span className="text-[9px] font-mono font-bold text-[var(--holo-cyan)]/80 tracking-widest">{items.size}/{WATCH_SYMBOLS.length} STREAMING</span>
        </div>
      </div>

      {/* Column Headers */}
      <div className="grid grid-cols-[3fr_2fr_2fr_3fr] gap-2 px-4 py-2 text-[9px] uppercase tracking-[0.2em] text-[var(--holo-cyan)]/50 font-black border-b border-[var(--holo-cyan)]/5 bg-black/20 shrink-0 relative z-10">
        <button onClick={() => toggleSort('symbol')} className="text-left hover:text-[var(--holo-cyan)] transition-colors focus:outline-none">Pair <SortIcon col="symbol" /></button>
        <span className="text-right">Price</span>
        <button onClick={() => toggleSort('change')} className="text-right hover:text-[var(--holo-cyan)] transition-colors flex justify-end focus:outline-none">24h% <SortIcon col="change" /></button>
        <button onClick={() => toggleSort('volume')} className="text-right hover:text-[var(--holo-cyan)] transition-colors hidden sm:block focus:outline-none">Volume <SortIcon col="volume" /></button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 p-2 space-y-1">
        {WATCH_SYMBOLS.filter(s => !items.has(s)).map(s => (
          <div key={s} className="grid grid-cols-[3fr_2fr_2fr_3fr] gap-2 items-center px-3 py-2.5 rounded-lg border border-white/[0.02] bg-white/[0.01]">
            <span className="text-[11px] font-mono text-gray-700 tracking-wider animate-pulse">{s.replace('USDT', '')}/USDT</span>
            <span className="text-right text-[11px] font-mono text-gray-700">—</span>
            <span className="text-right text-[11px] text-gray-700">—</span>
            <span className="text-right text-[11px] text-gray-700 hidden sm:block">—</span>
          </div>
        ))}
        
        {sorted.map(item => {
          const isActive = activeSymbol === item.symbol;
          const isUp = item.change24h >= 0;
          const base = item.symbol.replace('USDT', '');
          
          // Calculate high/low range indicator
          const range = item.high - item.low;
          const currentPos = range === 0 ? 0.5 : (item.price - item.low) / range;
          
          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol?.(item.symbol)}
              className={`group grid grid-cols-[3fr_2fr_2fr_3fr] gap-2 items-center px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-300 relative overflow-hidden ${
                isActive 
                  ? 'bg-[var(--holo-cyan)]/10 border border-[var(--holo-cyan)]/30 shadow-[0_0_20px_rgba(0,240,255,0.1)] scale-[1.02] my-1' 
                  : 'bg-black/40 border border-white/[0.05] hover:bg-white/[0.05] hover:border-white/[0.1]'
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-[var(--holo-cyan)] shadow-[0_0_10px_var(--holo-cyan)]" />
              )}
              {/* Scanline hover effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />

              <div className="flex items-center gap-2.5 relative z-10">
                <div className={`w-7 h-7 rounded bg-black/50 border flex items-center justify-center transition-colors ${isActive ? 'border-[var(--holo-cyan)]/50 fill-[var(--holo-cyan)]' : 'border-white/[0.1]'}`}>
                  {isUp ? <TrendingUp className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-cyan)]'}`} /> : <TrendingDown className={`w-3.5 h-3.5 ${isActive ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]'}`} />}
                </div>
                <div>
                  <div className={`text-[12px] font-black tracking-widest transition-colors ${isActive ? 'text-white' : 'text-gray-300'}`}>
                    {base}<span className={`text-[9px] ${isActive ? 'text-[var(--holo-cyan)]/80' : 'text-gray-600'}`}>/USDT</span>
                  </div>
                  <div className="text-[8px] font-mono text-gray-500 tracking-[0.2em] uppercase hidden sm:block">Volume Tracker</div>
                </div>
              </div>

              <div className="flex flex-col items-end justify-center relative z-10">
                <span className={`text-[12px] font-black font-mono transition-colors ${isUp ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]'} ${isActive ? 'drop-shadow-[0_0_8px_currentColor]' : ''}`}>
                  {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: item.price < 1 ? 6 : 2 })}
                </span>
                {/* Micro range indicator */}
                <div className="w-full max-w-[50px] h-1 bg-black/60 rounded-full mt-1 overflow-hidden relative border border-white/5">
                  <div 
                     className="absolute top-0 bottom-0 bg-white/30 rounded-full transition-all duration-500"
                     style={{ left: `${Math.max(0, currentPos * 100 - 2)}%`, width: '4px' }}
                  />
                  <div 
                     className={`absolute top-0 bottom-0 opacity-50 transition-all duration-500 ${isUp ? 'bg-[var(--holo-cyan)]' : 'bg-[var(--holo-magenta)]'}`}
                     style={{ right: 0, left: `${currentPos * 100}%` }}
                  />
                </div>
              </div>

              <span className={`text-[11px] font-black font-mono text-right flex items-center justify-end gap-1 relative z-10 ${isUp ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]'}`}>
                {isUp ? '+' : ''}{item.change24h.toFixed(2)}%
              </span>

              <div className="text-[11px] font-mono text-[var(--holo-cyan)]/70 font-bold text-right hidden sm:flex flex-col items-end relative z-10">
                 ${item.volume >= 1e9 ? `${(item.volume / 1e9).toFixed(2)}B` : item.volume >= 1e6 ? `${(item.volume / 1e6).toFixed(2)}M` : `${(item.volume / 1e3).toFixed(1)}K`}
                 <span className="text-[8px] text-gray-500 font-sans tracking-widest uppercase">24H VOL</span>
              </div>
              
            </div>
          );
        })}
      </div>
    </div>
  );
};
