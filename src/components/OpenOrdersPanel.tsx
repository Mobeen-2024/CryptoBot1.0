import React, { useState, useEffect } from 'react';

interface OpenOrder {
  id: string;
  symbol: string;
  side: string;
  type: string;
  price?: number;
  limitPrice?: number;
  stopPrice?: number;
  quantity?: number;
  status?: string;
  timestamp?: number;
}

export const OpenOrdersPanel: React.FC<{ symbol?: string }> = ({ symbol }) => {
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/backend/openOrders');
      const data = await res.json();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, []);

  const filtered = symbol ? orders.filter(o => o.symbol?.replace('/', '') === symbol) : orders;

  const cancelOrder = async (id: string) => {
    try {
      await fetch(`/api/backend/cancelOrder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      setOrders(prev => prev.filter(o => o.id !== id));
    } catch (e) {
      console.error('Failed to cancel order', e);
    }
  };

  const getDisplayPrice = (o: OpenOrder) => o.limitPrice || o.price || o.stopPrice || 0;
  const getTypeBadge = (type: string) => {
    const t = type?.toUpperCase().replace('_', ' ');
    return t;
  };

  return (
    <div className="flex flex-col h-full bg-[#0b0e11] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 bg-[#0d1117] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)] animate-pulse" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-white">Open Orders</span>
          {filtered.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-[9px] font-bold text-purple-400">{filtered.length}</span>
          )}
        </div>
        <button onClick={fetchOrders} className="p-1.5 rounded-lg bg-[#1a1d24] border border-white/5 text-gray-500 hover:text-purple-400 hover:border-purple-500/30 transition-all">
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        </button>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-6 px-4 py-1.5 text-[9px] uppercase tracking-widest text-gray-600 font-bold border-b border-white/5 shrink-0">
        <span>Pair</span>
        <span>Type</span>
        <span>Side</span>
        <span className="text-right">Price</span>
        <span className="text-right hidden sm:block">Qty</span>
        <span className="text-right">Action</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="flex items-center justify-center h-full gap-2">
            <div className="w-5 h-5 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            <span className="text-[10px] text-gray-600 font-mono">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2">
            <svg className="w-10 h-10 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/></svg>
            <span className="text-[10px] text-gray-600">No open orders</span>
          </div>
        ) : (
          filtered.map((order) => {
            const isBuy = order.side?.toUpperCase() === 'BUY';
            const price = getDisplayPrice(order);
            return (
              <div key={order.id} className="grid grid-cols-6 items-center px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all group">
                <span className="text-[11px] font-mono font-bold text-gray-200">{order.symbol?.replace('/', '') || '—'}</span>
                <span className="text-[9px] font-mono font-bold text-gray-500 uppercase">{getTypeBadge(order.type)}</span>
                <span className={`text-[10px] font-bold uppercase ${isBuy ? 'text-emerald-400' : 'text-rose-400'}`}>{order.side?.toUpperCase()}</span>
                <span className="text-[11px] font-mono text-gray-300 text-right">
                  {price > 0 ? price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—'}
                </span>
                <span className="text-[11px] font-mono text-gray-400 text-right hidden sm:block">
                  {order.quantity?.toFixed(4) || '—'}
                </span>
                <div className="flex justify-end">
                  <button
                    onClick={() => cancelOrder(order.id)}
                    className="text-[9px] font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 hover:border-rose-500/50 transition-all opacity-0 group-hover:opacity-100"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
