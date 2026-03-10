import React, { useState, useEffect } from 'react';

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
    <svg className={`w-2.5 h-2.5 inline-block ml-0.5 transition-colors ${sortBy === col ? 'text-cyan-400' : 'text-gray-700'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      {sortDir === -1 || sortBy !== col ? <polyline points="6 9 12 15 18 9" /> : <polyline points="18 15 12 9 6 15" />}
    </svg>
  );

  return (
    <div className="flex flex-col h-full bg-[#0b0e11] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-[#0d1117] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">Market Watchlist</span>
        </div>
        <span className="text-[9px] font-mono text-gray-600">{items.size}/{WATCH_SYMBOLS.length} LIVE</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-5 px-4 py-1.5 text-[9px] uppercase tracking-widest text-gray-600 font-bold border-b border-white/5 shrink-0">
        <button onClick={() => toggleSort('symbol')} className="text-left hover:text-gray-400 transition-colors">Pair <SortIcon col="symbol" /></button>
        <span className="text-right">Price</span>
        <button onClick={() => toggleSort('change')} className="text-right hover:text-gray-400 transition-colors">24h% <SortIcon col="change" /></button>
        <span className="text-right hidden sm:block">High</span>
        <button onClick={() => toggleSort('volume')} className="text-right hover:text-gray-400 transition-colors">Volume <SortIcon col="volume" /></button>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {WATCH_SYMBOLS.filter(s => !items.has(s)).map(s => (
          <div key={s} className="grid grid-cols-5 items-center px-4 py-2 border-b border-white/[0.03]">
            <span className="text-[11px] font-mono text-gray-600">{s.replace('USDT', '')}/USDT</span>
            <span className="text-right text-[11px] font-mono text-gray-700">—</span>
            <span className="text-right text-[11px] text-gray-700">—</span>
            <span className="text-right text-[11px] text-gray-700 hidden sm:block">—</span>
            <span className="text-right text-[11px] text-gray-700">—</span>
          </div>
        ))}
        {sorted.map(item => {
          const isActive = activeSymbol === item.symbol;
          const isUp = item.change24h >= 0;
          const base = item.symbol.replace('USDT', '');
          return (
            <div
              key={item.symbol}
              onClick={() => onSelectSymbol?.(item.symbol)}
              className={`grid grid-cols-5 items-center px-4 py-2 border-b border-white/[0.03] cursor-pointer transition-all hover:bg-white/[0.03] ${isActive ? 'bg-cyan-500/5 border-l-2 border-l-cyan-500' : ''}`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[8px] font-black bg-white/5 text-gray-300`}>{base.slice(0,2)}</div>
                <div>
                  <div className="text-[11px] font-mono font-bold text-white">{base}<span className="text-gray-600 font-normal">/USDT</span></div>
                </div>
              </div>
              <span className={`text-[11px] font-mono font-semibold text-right ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {item.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: item.price < 1 ? 6 : 2 })}
              </span>
              <span className={`text-[11px] font-mono text-right font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isUp ? '+' : ''}{item.change24h.toFixed(2)}%
              </span>
              <span className="text-[11px] font-mono text-gray-400 text-right hidden sm:block">
                {item.high.toLocaleString(undefined, { maximumFractionDigits: item.high < 1 ? 4 : 2 })}
              </span>
              <span className="text-[11px] font-mono text-gray-400 text-right">
                ${item.volume >= 1e9 ? `${(item.volume / 1e9).toFixed(2)}B` : item.volume >= 1e6 ? `${(item.volume / 1e6).toFixed(1)}M` : `${(item.volume / 1e3).toFixed(0)}K`}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
