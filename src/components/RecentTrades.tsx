import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';

interface TradeRecord {
  id?: number;
  master_trade_id?: string;
  side: string;
  symbol: string;
  price: number | string;
  quantity: number | string;
  timestamp: number;
  type?: string;
  fee?: number;
}

// RecentTrades is now the full Trade History panel
// It ignores `trades` prop and self-fetches the full history from the backend
export const RecentTrades: React.FC<{ trades?: any[] }> = () => {
  const [history, setHistory] = useState<TradeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [searchSymbol, setSearchSymbol] = useState('');

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/backend/trades');
      const data = await res.json();
      if (Array.isArray(data)) {
        setHistory(data.sort((a: TradeRecord, b: TradeRecord) => b.timestamp - a.timestamp));
      }
    } catch (e) {
      console.error('Failed to fetch trade history', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filtered = history.filter((t) => {
    const sideMatch = filter === 'ALL' || t.side?.toUpperCase() === filter;
    const symbolMatch = !searchSymbol || t.symbol?.toUpperCase().includes(searchSymbol.toUpperCase());
    return sideMatch && symbolMatch;
  });

  const totalBuys = history.filter(t => t.side?.toUpperCase() === 'BUY').length;
  const totalSells = history.filter(t => t.side?.toUpperCase() === 'SELL').length;

  return (
    <div className="flex flex-col h-full glass-panel overflow-hidden">

      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-black/40 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)] animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-white">Trade History</span>
          </div>
          <div className="flex items-center gap-2 text-[9px] font-mono">
            <span className="px-1.5 py-0.5 rounded bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/20">{totalBuys} BUY</span>
            <span className="px-1.5 py-0.5 rounded bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] border border-[var(--holo-magenta)]/20">{totalSells} SELL</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input
              type="text"
              placeholder="Symbol..."
              value={searchSymbol}
              onChange={e => setSearchSymbol(e.target.value)}
              className="bg-white/5 border border-white/5 text-white text-[10px] font-mono pl-6 pr-3 py-1 rounded-lg w-24 focus:outline-none focus:border-cyan-500/50 placeholder-gray-600"
            />
          </div>

          {/* Filter pills */}
          <div className="flex bg-white/5 border border-white/5 rounded-lg p-0.5">
            {(['ALL', 'BUY', 'SELL'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-0.5 text-[9px] font-bold rounded-md transition-all ${
                  filter === f
                    ? f === 'BUY' ? 'bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)]' : f === 'SELL' ? 'bg-[var(--holo-magenta)]/20 text-[var(--holo-magenta)]' : 'bg-white/10 text-white'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {f}
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button onClick={fetchHistory} className="p-1.5 rounded-lg bg-white/5 border border-white/5 text-gray-500 hover:text-cyan-400 hover:border-cyan-500/30 transition-all">
            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
        </div>
      </div>

      {/* ── Column Headers ── */}
      <div className="grid grid-cols-6 px-4 py-1.5 text-[9px] uppercase tracking-widest text-gray-600 font-bold border-b border-white/5 shrink-0">
        <span>Side</span>
        <span>Pair</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
        <span className="text-right">Time</span>
      </div>

      {/* ── Trade Rows ── */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
            <span className="text-[11px] text-gray-600 font-mono">Loading history…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <svg className="w-12 h-12 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 17H5a2 2 0 0 0-2 2v2h18v-2a2 2 0 0 0-2-2h-4"/><path d="M12 3v14"/><path d="M8 7l4-4 4 4"/></svg>
            <span className="text-[11px] text-gray-600">No trades found</span>
          </div>
        ) : (
          filtered.map((trade, i) => {
            const isBuy = trade.side?.toUpperCase() === 'BUY';
            const price = parseFloat(String(trade.price));
            const qty = parseFloat(String(trade.quantity));
            const total = price * qty;
            const date = new Date(trade.timestamp);

            return (
              <div
                key={trade.id ?? trade.master_trade_id ?? i}
                className="grid grid-cols-6 items-center px-4 py-2 border-b border-white/[0.03] hover:bg-white/[0.02] group transition-all cursor-default"
              >
                {/* Side badge */}
                <div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                    isBuy
                      ? 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/20'
                      : 'bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] border border-[var(--holo-magenta)]/20'
                  }`}>
                    {isBuy ? (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
                    ) : (
                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
                    )}
                    {trade.side?.toUpperCase()}
                  </span>
                </div>

                {/* Pair */}
                <span className="text-[11px] font-mono font-bold text-gray-300 group-hover:text-white transition-colors">
                  {trade.symbol?.replace('/', '') || '—'}
                </span>

                {/* Price */}
                <span className={`text-[11px] font-mono text-right font-semibold ${isBuy ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]'}`}>
                  {isNaN(price) ? '—' : price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>

                {/* Amount */}
                <span className="text-[11px] font-mono text-gray-300 text-right">
                  {isNaN(qty) ? '—' : qty.toFixed(4)}
                </span>

                {/* Total */}
                <span className="text-[11px] font-mono text-white text-right font-semibold">
                  {isNaN(total) ? '—' : `$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>

                {/* Time */}
                <div className="text-right">
                  <span className="text-[10px] font-mono text-gray-500 group-hover:text-gray-400 transition-colors">
                    {isNaN(date.getTime()) ? '—' : format(date, 'HH:mm:ss')}
                  </span>
                  <div className="text-[9px] font-mono text-gray-700">
                    {isNaN(date.getTime()) ? '' : format(date, 'MMM dd')}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Footer Summary ── */}
      {filtered.length > 0 && (
        <div className="px-4 py-2 border-t border-white/5 bg-black/40 shrink-0 flex items-center justify-between">
          <span className="text-[9px] text-gray-600 font-mono">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</span>
          <span className="text-[9px] text-gray-600 font-mono">
            Total Volume: <span className="text-gray-400 font-bold">
              ${filtered.reduce((acc, t) => acc + (parseFloat(String(t.price)) * parseFloat(String(t.quantity)) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </span>
        </div>
      )}
    </div>
  );
};
