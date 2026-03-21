import React, { useState, useEffect, useMemo } from 'react';
import { 
  Database, Download, FileText, Calendar, Hash, RefreshCw, 
  Search, ShieldAlert, Activity, BarChart3, Clock, CheckCircle2 
} from 'lucide-react';

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
  const [accountFilter, setAccountFilter] = useState<'ALL' | 'MASTER' | 'SUB-ACCOUNT'>('ALL');
  const [isExporting, setIsExporting] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const [showWipeConfirm, setShowWipeConfirm] = useState(false);

  useEffect(() => {
    const fetchTrades = async () => {
      try {
        const res = await fetch('/api/backend/trades');
        if (res.ok) {
          const data = await res.json();
          // Backend returns ASC, let's reverse to DESC for exactly what humans want to read
          setTrades((data || []).reverse());
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

  const fetchTradesManual = async () => {
    try {
      const res = await fetch('/api/backend/trades');
      if (res.ok) {
        const data = await res.json();
        setTrades((data || []).reverse());
      }
    } catch (err) {
      console.error('Failed to fetch trade data:', err);
    }
  };

  const filteredTrades = useMemo(() => {
    return trades.filter(t => {
      const matchesSearch = !searchQuery || 
        t.symbol.toLowerCase().includes(searchQuery.toLowerCase()) || 
        t.side.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.slave_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesAccount = 
        accountFilter === 'ALL' ? true :
        accountFilter === 'MASTER' ? t.slave_id === 'master' : 
        t.slave_id !== 'master';

      return matchesSearch && matchesAccount;
    });
  }, [trades, searchQuery, accountFilter]);

  // Derived Metrics
  const totalVolume = useMemo(() => {
    return filteredTrades.reduce((sum, t) => sum + (parseFloat(t.quantity) * parseFloat(t.price)), 0);
  }, [filteredTrades]);

  const exportCSV = async () => {
    if (filteredTrades.length === 0) return;
    setIsExporting(true);
    
    // Simulate complex export processing for UI feedback
    await new Promise(r => setTimeout(r, 600));

    const headers = 'Account ID,Trade ID,Symbol,Side,Quantity,Price,Value (USDT),Timestamp\n';
    const rows = filteredTrades.map(t =>
      `${t.slave_id},${t.master_trade_id},${t.symbol},${t.side.toUpperCase()},${t.quantity},${t.price},${(parseFloat(t.quantity)*parseFloat(t.price)).toFixed(2)},${new Date(t.timestamp).toISOString()}`
    ).join('\n');
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexus_trades_${accountFilter}_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setIsExporting(false);
  };

  const wipeDatabase = async () => {
    setIsWiping(true);
    try {
      const res = await fetch('/api/backend/trades', { method: 'DELETE' });
      if (res.ok) {
        await fetchTradesManual();
        setShowWipeConfirm(false);
      }
    } catch (err) {
      console.error('Failed to wipe database:', err);
    } finally {
      setIsWiping(false);
    }
  };

  const dateRange = trades.length > 0
    ? `${new Date(trades[trades.length - 1].timestamp).toLocaleDateString()} — ${new Date(trades[0].timestamp).toLocaleDateString()}`
    : 'Awaiting Genesis Block...';

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0A0D14] text-[#E0E7FF] font-sans selection:bg-[#34D399]/30">
      
      {/* ─── HEADER COMMAND CENTER ───────────────────────────────────────── */}
      <div className="shrink-0 p-4 border-b border-[#1E293B] bg-gradient-to-r from-[#0F172A] to-[#0A0D14] relative overflow-hidden">
        {/* Abstract Tech Background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#34D399]/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#3B82F6]/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
          
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-[#3B82F6]/10 border border-[#3B82F6]/20 rounded-lg shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                <Database className="w-5 h-5 text-[#60A5FA]" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-[0.2em] text-[#F8FAFC] uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">Global Trade Ledger</h1>
                <div className="flex items-center gap-2 text-[10px] text-[#94A3B8] font-mono mt-0.5">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {dateRange}</span>
                  <span className="hidden sm:inline opacity-30">|</span>
                  <span className="flex items-center gap-1 text-[#34D399] drop-shadow-[0_0_5px_rgba(52,211,153,0.5)]"><Activity className="w-3 h-3 animate-pulse" /> NETWORK SECURE</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-stretch gap-3 self-stretch md:self-auto">
            {/* Quick Metrics */}
            <div className="hidden sm:flex flex-col justify-center px-4 py-1.5 bg-[#1E293B]/40 border border-[#334155]/50 rounded-xl backdrop-blur-md">
               <span className="text-[9px] uppercase tracking-widest text-[#64748B] font-bold">Total Volume</span>
               <span className="text-xs font-mono font-bold text-[#FCD535]">${totalVolume.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="hidden sm:flex flex-col justify-center px-4 py-1.5 bg-[#1E293B]/40 border border-[#334155]/50 rounded-xl backdrop-blur-md">
               <span className="text-[9px] uppercase tracking-widest text-[#64748B] font-bold">Executions</span>
               <span className="text-xs font-mono font-bold text-[#60A5FA] flex items-center gap-1 border-b border-transparent leading-none">
                 <Hash className="w-3 h-3" />{filteredTrades.length}
               </span>
            </div>
            
            {/* Wipe Database Button */}
            {showWipeConfirm ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowWipeConfirm(false)}
                  className="px-3 py-2 bg-[#1E293B] hover:bg-[#334155] border border-[#475569] text-[#94A3B8] rounded-xl text-[10px] font-bold uppercase transition-all"
                >
                  CANCEL
                </button>
                <button
                  onClick={wipeDatabase}
                  disabled={isWiping}
                  className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-400 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all"
                >
                  {isWiping ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                  {isWiping ? 'WIPING...' : 'CONFIRM NUKE'}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowWipeConfirm(true)}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-transparent hover:bg-red-500/10 border border-red-500/30 text-red-500/70 hover:text-red-400 rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all group"
              >
                <Database className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">FORMAT DB</span>
              </button>
            )}

            {/* Download Button */}
            <button 
              onClick={exportCSV} 
              disabled={filteredTrades.length === 0 || isExporting}
              className="flex items-center justify-center gap-2 px-5 py-2 bg-[#3B82F6]/10 hover:bg-[#3B82F6]/20 border border-[#3B82F6]/30 text-[#60A5FA] rounded-xl text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-30 disabled:hover:bg-[#3B82F6]/10 relative overflow-hidden group"
            >
              {/* Button shine effect */}
              <div className="absolute inset-0 -translate-x-full transition-transform group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent skew-x-12" />
              {isExporting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />}
              {isExporting ? 'EXPORTING...' : 'EXPORT CSV'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── FILTERS & SUB-NAVIGATION ────────────────────────────────────── */}
      <div className="shrink-0 p-3 bg-[#0F172A]/80 border-b border-[#1E293B] flex flex-col sm:flex-row gap-3 items-center justify-between backdrop-blur-sm z-20">
        
        {/* Segmented Account Control */}
        <div className="flex bg-[#0A0D14] p-1 rounded-lg border border-[#334155]/40 w-full sm:w-auto overflow-x-auto custom-scrollbar">
          {(['ALL', 'MASTER', 'SUB-ACCOUNT'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setAccountFilter(mode)}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                accountFilter === mode 
                  ? 'bg-[#1E293B] text-[#F8FAFC] shadow-[0_2px_8px_rgba(0,0,0,0.4)] border border-[#475569]/50' 
                  : 'text-[#64748B] hover:text-[#94A3B8] hover:bg-[#1E293B]/50 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-center gap-1.5">
                {mode === 'MASTER' && <div className={`w-1.5 h-1.5 rounded-full ${accountFilter === mode ? 'bg-[#34D399] shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-transparent'}`} />}
                {mode === 'SUB-ACCOUNT' && <div className={`w-1.5 h-1.5 rounded-full ${accountFilter === mode ? 'bg-[#3B82F6] shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-transparent'}`} />}
                {mode}
              </div>
            </button>
          ))}
        </div>

        {/* Global Search */}
        <div className="relative w-full sm:w-64 group">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-3.5 w-3.5 text-[#64748B] group-focus-within:text-[#3B82F6] transition-colors" />
          </div>
          <input
            type="text"
            className="block w-full pl-9 pr-3 py-1.5 bg-[#0A0D14] border border-[#334155]/40 rounded-lg text-[11px] font-mono text-[#E0E7FF] placeholder-[#475569] focus:outline-none focus:border-[#3B82F6]/50 focus:ring-1 focus:ring-[#3B82F6]/50 transition-all shadow-inner"
            placeholder="Search symbol, side, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* ─── FUTURISTIC DATA GRID ───────────────────────────────────────── */}
      <div className="flex-1 overflow-auto custom-scrollbar relative bg-[#0B0E14] z-10">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#64748B] gap-4">
             <div className="w-12 h-12 relative animate-spin">
                <div className="absolute inset-0 border-t-2 border-b-2 border-[#3B82F6] rounded-full opacity-70"></div>
                <div className="absolute inset-2 border-l-2 border-r-2 border-[#34D399] rounded-full opacity-50"></div>
             </div>
             <span className="text-[10px] uppercase tracking-[0.3em] font-bold animate-pulse">Decrypting Ledger...</span>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-[#64748B] gap-4">
             <ShieldAlert className="w-12 h-12 opacity-20" />
             <span className="text-xs font-mono uppercase tracking-widest">
               {searchQuery ? '0 matches found within nexus criteria' : 'No telemetric trade signatures detected'}
             </span>
          </div>
        ) : (
          <div className="min-w-[800px]">
            {/* Grid Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 sticky top-0 bg-[#0F172A]/95 backdrop-blur-md border-b border-[#1E293B] z-20 text-[9px] font-bold uppercase tracking-[0.2em] text-[#64748B]">
              <div className="col-span-2 flex items-center gap-1.5"><Clock className="w-3 h-3" /> Timestamp</div>
              <div className="col-span-2">Account</div>
              <div className="col-span-2">Asset Pair</div>
              <div className="col-span-1 text-center">Protocol</div>
              <div className="col-span-2 text-right">Volume (Base)</div>
              <div className="col-span-1 text-right">Execution Price</div>
              <div className="col-span-2 text-right flex justify-end items-center gap-1"><BarChart3 className="w-3 h-3" /> Settled Value</div>
            </div>

            {/* Grid Body */}
            <div className="flex flex-col">
              {filteredTrades.map((t, idx) => {
                const isBuy = t.side.toUpperCase() === 'BUY';
                const isMaster = t.slave_id === 'master';
                const dateObj = new Date(t.timestamp);
                const val = parseFloat(t.quantity) * parseFloat(t.price);

                return (
                  <div 
                    key={`${t.master_trade_id}-${t.slave_id}-${idx}`} 
                    className="grid grid-cols-12 gap-4 px-6 py-3.5 border-b border-[#1E293B]/50 hover:bg-[#1E293B]/30 transition-all items-center group relative cursor-crosshair"
                    style={{ animation: `fadeIn 0.3s ease-out ${Math.min(idx * 0.02, 1)}s both` }}
                  >
                    {/* Hover Glow Accent */}
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#3B82F6] opacity-0 group-hover:opacity-100 transition-opacity" />

                    {/* Timestamp */}
                    <div className="col-span-2 flex flex-col">
                      <span className="text-[11px] text-[#CBD5E1] font-mono">{dateObj.toLocaleDateString()}</span>
                      <span className="text-[9px] text-[#64748B] font-mono">{dateObj.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit', fractionalSecondDigits: 3 })}</span>
                    </div>

                    {/* Account Badge */}
                    <div className="col-span-2">
                       <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] text-[9px] font-bold uppercase tracking-widest border ${
                         isMaster 
                          ? 'bg-[#34D399]/10 text-[#34D399] border-[#34D399]/20' 
                          : 'bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20'
                       }`}>
                         {isMaster ? <CheckCircle2 className="w-2.5 h-2.5" /> : <RefreshCw className="w-2.5 h-2.5" />}
                         {isMaster ? 'Master' : `Sub · ${t.slave_id.replace('slave_', '')}`}
                       </span>
                    </div>

                    {/* Symbol */}
                    <div className="col-span-2 text-[#F8FAFC] font-bold text-xs tracking-wide">
                      {t.symbol}
                    </div>

                    {/* Protocol (Side) */}
                    <div className="col-span-1 flex justify-center">
                       <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-widest shadow-sm ${
                         isBuy ? 'bg-[#00E5FF]/10 text-[#00E5FF] shadow-[0_0_8px_rgba(0,229,255,0.2)]' : 'bg-[#FF3366]/10 text-[#FF3366] shadow-[0_0_8px_rgba(255,51,102,0.2)]'
                       }`}>
                         {isBuy ? 'LONG' : 'SHRT'}
                       </span>
                    </div>

                    {/* Volume */}
                    <div className="col-span-2 text-right font-mono text-[11px] text-[#E2E8F0]">
                      {parseFloat(t.quantity).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </div>

                    {/* Price */}
                    <div className="col-span-1 text-right font-mono text-[11px] text-[#FCD535]">
                      ${parseFloat(t.price).toLocaleString()}
                    </div>

                    {/* Settled Value */}
                    <div className="col-span-2 text-right flex flex-col items-end">
                      <span className="font-mono font-bold text-[12px] text-[#F8FAFC]">
                        ${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      <span className="text-[8px] text-[#64748B] tracking-widest font-bold">USDT EQUIV</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* End of results spacer */}
            <div className="py-6 flex items-center justify-center opacity-30">
               <div className="w-1 h-1 rounded-full bg-[#E0E7FF] mx-1" />
               <div className="w-1 h-1 rounded-full bg-[#E0E7FF] mx-1" />
               <div className="w-1 h-1 rounded-full bg-[#E0E7FF] mx-1" />
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
};
