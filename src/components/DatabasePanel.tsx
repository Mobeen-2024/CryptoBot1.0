import React, { useState, useEffect, useRef } from 'react';
import { Database, Download, FileText, Calendar, Hash, RefreshCw, Search, ChevronDown, ChevronUp } from 'lucide-react';

interface TradeRecord {
  slave_id: string;
  master_trade_id: string;
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  timestamp: number;
}

export const DatabasePanel: React.FC = () => {
  const [trades, setTrades] = useState<TradeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    const fetchTrades = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/backend/trades');
        if (res.ok) {
          const data = await res.json();
          setTrades(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch trade data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTrades();
    const interval = setInterval(fetchTrades, 15000);
    return () => clearInterval(interval);
  }, []);

  const filteredTrades = trades
    .filter(t => !searchQuery || t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || t.side.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);

  const exportCSV = () => {
    if (filteredTrades.length === 0) return;
    const headers = 'ID,Master Trade ID,Symbol,Side,Quantity,Price,Timestamp\n';
    const rows = filteredTrades.map(t =>
      `${t.slave_id},${t.master_trade_id},${t.symbol},${t.side},${t.quantity},${t.price},${new Date(t.timestamp).toISOString()}`
    ).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cryptobot_trades_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const dateRange = trades.length > 0
    ? `${new Date(trades[0].timestamp).toLocaleDateString()} — ${new Date(trades[trades.length - 1].timestamp).toLocaleDateString()}`
    : '—';

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#2b3139] bg-[#181a20] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Database className="w-4 h-4 text-[#fcd535]" />
          <span className="text-[11px] font-bold text-[#eaecef] uppercase tracking-widest">Trade Database</span>
          <span className="text-[10px] font-mono text-[#5e6673] bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-0.5">
            <Hash className="w-3 h-3 inline mr-1" />{trades.length} records
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-[#5e6673] font-mono hidden sm:block">
            <Calendar className="w-3 h-3 inline mr-1" />{dateRange}
          </span>
          <button onClick={exportCSV} disabled={trades.length === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-[#eaecef] bg-[#fcd535]/10 hover:bg-[#fcd535]/20 border border-[#fcd535]/30 rounded-lg transition-all disabled:opacity-30">
            <Download className="w-3 h-3 text-[#fcd535]" />Export CSV
          </button>
        </div>
      </div>

      {/* Search & Sort */}
      <div className="px-4 py-2 border-b border-[#2b3139] bg-[#0f1114] flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-2 flex-1 bg-[#0b0e11] border border-[#2b3139] rounded-lg px-3 py-1.5">
          <Search className="w-3.5 h-3.5 text-[#5e6673]" />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Filter by symbol or side..."
            className="bg-transparent text-[11px] text-[#eaecef] font-mono outline-none flex-1 placeholder-[#3b4149]" />
        </div>
        <button onClick={() => setSortAsc(!sortAsc)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-[#5e6673] hover:text-[#eaecef] bg-[#0b0e11] border border-[#2b3139] rounded-lg transition-colors">
          {sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {sortAsc ? 'Oldest' : 'Newest'}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-full text-[#5e6673] text-xs font-mono gap-2">
            <RefreshCw className="w-4 h-4 animate-spin" /> Loading trades...
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#5e6673] gap-2">
            <FileText className="w-8 h-8 opacity-30" />
            <span className="text-xs font-mono">{searchQuery ? 'No trades match your filter' : 'No trade records found'}</span>
          </div>
        ) : (
          <table className="w-full text-[11px] font-mono">
            <thead className="sticky top-0 bg-[#0f1114] z-10">
              <tr className="text-[9px] text-[#5e6673] uppercase tracking-widest border-b border-[#2b3139]">
                <th className="text-left px-4 py-2">Time</th>
                <th className="text-left px-4 py-2">Symbol</th>
                <th className="text-left px-4 py-2">Side</th>
                <th className="text-right px-4 py-2">Qty</th>
                <th className="text-right px-4 py-2">Price</th>
                <th className="text-right px-4 py-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((t, i) => (
                <tr key={i} className="border-b border-[#1e2329] hover:bg-[#181a20] transition-colors">
                  <td className="px-4 py-2 text-[#848e9c]">{new Date(t.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 text-[#eaecef] font-bold">{t.symbol}</td>
                  <td className="px-4 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${t.side.toUpperCase() === 'BUY' ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'}`}>
                      {t.side.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-[#eaecef]">{parseFloat(t.quantity).toFixed(5)}</td>
                  <td className="px-4 py-2 text-right text-[#fcd535]">${parseFloat(t.price).toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-[#848e9c]">${(parseFloat(t.quantity) * parseFloat(t.price)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
