import React, { useState, useEffect } from 'react';
import { Database, Download, Trash2, AlertTriangle, CheckCircle, RefreshCw, Server, HardDrive, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

export const DatabasePanel: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isPruning, setIsPruning] = useState(false);
  const [healthScore, setHealthScore] = useState(99);
  const [dbSize, setDbSize] = useState(14.2);

  // Animate mock DB size and health slightly
  useEffect(() => {
    const i = setInterval(() => {
      setHealthScore(prev => prev > 95 ? prev - (Math.random() * 0.5) : 99);
      setDbSize(prev => prev + (Math.random() * 0.05));
    }, 3000);
    return () => clearInterval(i);
  }, []);

  const handleExportCSV = async () => {
    setIsExporting(true);
    const downloadToast = toast.loading('Compiling telemetry to CSV...', {
      style: { background: '#0a0d14', color: '#00f0ff', border: '1px solid rgba(0,240,255,0.2)' }
    });

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      const csvContent = "data:text/csv;charset=utf-8,ID,Symbol,Side,Amount,Price,Timestamp\nORD-391X,BTCUSDT,BUY,0.15,64500.20,2026-03-07T12:00:00Z\n";
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `sys_telemetry_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Extraction complete', { id: downloadToast, iconTheme: { primary: '#00f0ff', secondary: '#0a0d14' } });
    } catch (error) {
      toast.error('Extraction failed', { id: downloadToast });
    } finally {
      setIsExporting(false);
    }
  };

  const handlePruneLogs = async () => {
    const confirm = window.confirm("AUTHORIZATION REQUIRED: Permanently delete telemetry > 30 days old?");
    if (confirm) {
      setIsPruning(true);
      const pruneToast = toast.loading('Purging stale sectors...', {
        style: { background: '#0a0d14', color: '#ff073a', border: '1px solid rgba(255,7,58,0.2)' }
      });

      try {
        await new Promise(resolve => setTimeout(resolve, 2000));
        setDbSize(8.4); // Mock reduction
        toast.success('Sectors purged. System optimized.', {
          id: pruneToast,
          iconTheme: { primary: '#39ff14', secondary: '#0a0d14' },
        });
      } catch (error) {
        toast.error('Purge failed', { id: pruneToast });
      } finally {
        setIsPruning(false);
      }
    }
  };

  return (
    <div className="h-full flex flex-col pt-4 px-4 overflow-y-auto custom-scrollbar relative">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-full h-[300px] bg-gradient-to-b from-[#00f0ff]/5 to-transparent pointer-events-none" />
      <div className="absolute top-[10%] inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.02)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-4 mb-6 relative z-10 w-max">
        <div className="relative">
          <div className="p-3 bg-black border border-[#00f0ff]/30 rounded-xl inner-glow">
            <Database className="w-6 h-6 text-[#00f0ff]" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-[#39ff14] rounded-full border-2 border-[#05070a] animate-pulse" />
        </div>
        <div>
          <h2 className="text-white font-black text-lg tracking-[0.2em] uppercase">Storage Core</h2>
          <p className="text-[#00f0ff]/60 text-[10px] font-mono tracking-widest mt-1">VOLATILE // SQLITE_V3 // LOCAL_NODE</p>
        </div>
      </div>

      {/* Top Diagnostics Row */}
      <div className="grid grid-cols-3 gap-3 mb-6 relative z-10 max-w-4xl">
        <DiagnosticCard icon={Server} label="Status" value="ONLINE" color="#39ff14" />
        <DiagnosticCard icon={HardDrive} label="Allocated Array" value={`${dbSize.toFixed(2)} MB`} color="#00f0ff" />
        <DiagnosticCard icon={ShieldCheck} label="Integrity Score" value={`${healthScore.toFixed(1)}%`} color={healthScore > 98 ? '#39ff14' : '#fcd535'} />
      </div>

      {/* Action Modules */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl relative z-10">
        
        {/* Export Module */}
        <div className="bg-black/40 backdrop-blur-md border border-[#00f0ff]/20 hover:border-[#00f0ff]/50 rounded-xl p-5 transition-all group relative overflow-hidden flex flex-col h-full shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#00f0ff]/10 blur-3xl rounded-full" />
          
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1 group-hover:text-[#00f0ff] transition-colors">Data Extraction</h3>
              <p className="text-[#00f0ff]/50 text-[10px] font-mono">SYS_TICK_LOG &rarr; CSV_FORMAT</p>
            </div>
            <div className="p-2 bg-[#00f0ff]/10 rounded border border-[#00f0ff]/20 text-[#00f0ff]">
              <Download className="w-4 h-4" />
            </div>
          </div>
          
          <p className="text-gray-400 text-[11px] leading-relaxed mb-6 flex-1 relative z-10">
            Compile the entire multi-node execution registry from the localized SQLite array into a portable comma-separated telemetric format. Valid for external algorithmic auditing.
          </p>
          
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="w-full py-2.5 bg-[#00f0ff]/10 hover:bg-[#00f0ff]/20 text-[#00f0ff] border border-[#00f0ff]/30 hover:border-[#00f0ff] rounded box-glow text-[11px] font-bold tracking-[0.2em] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative z-10"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'COMPILING. . .' : 'EXECUTE EXTRACTION'}
          </button>
        </div>

        {/* Prune Module */}
        <div className="bg-black/40 backdrop-blur-md border border-[#ff073a]/20 hover:border-[#ff073a]/50 rounded-xl p-5 transition-all group relative overflow-hidden flex flex-col h-full shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#ff073a]/10 blur-3xl rounded-full" />
          
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div>
              <h3 className="text-white font-bold text-sm uppercase tracking-widest mb-1 group-hover:text-[#ff073a] transition-colors">Sector Purge</h3>
              <p className="text-[#ff073a]/50 text-[10px] font-mono">DELETE_OLD_TICKS (&gt;30D)</p>
            </div>
            <div className="p-2 bg-[#ff073a]/10 rounded border border-[#ff073a]/20 text-[#ff073a]">
              <Trash2 className="w-4 h-4" />
            </div>
          </div>
          
          <p className="text-gray-400 text-[11px] leading-relaxed mb-4 flex-1 relative z-10">
            Mitigate unbounded array inflation. Permanently evaporate telemetric logs older than 30 cycles to maintain optimal I/O throughput.
          </p>

          <div className="flex items-center gap-2 mb-4 p-2 bg-[#ff073a]/10 rounded border border-[#ff073a]/30 text-[9px] text-[#ff073a] font-mono relative z-10 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Warning: Irreversible phase deletion.
          </div>
          
          <button
            onClick={handlePruneLogs}
            disabled={isPruning}
            className="w-full py-2.5 bg-[#ff073a]/10 hover:bg-[#ff073a]/20 text-[#ff073a] border border-[#ff073a]/30 hover:border-[#ff073a] rounded box-glow-red text-[11px] font-bold tracking-[0.2em] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 relative z-10"
          >
            {isPruning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isPruning ? 'PURGING SECTORS. . .' : 'INITIATE PURGE'}
          </button>
        </div>

      </div>

      <div className="mt-8 pt-6 border-t border-white/[0.05] flex items-center gap-2 text-[9px] text-gray-500 font-mono tracking-widest max-w-4xl relative z-10">
        <span className="w-1.5 h-1.5 rounded-full bg-[#39ff14] animate-pulse" />
        PATH: /SYS_ROOT/TRADES.DB // I/O: UNRESTRICTED
      </div>

    </div>
  );
};

// Sub-component for diagnostics
function DiagnosticCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-white/[0.02] border border-white/[0.05] rounded-lg p-3 flex items-center gap-3 relative overflow-hidden">
      <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white/[0.02] to-transparent pointer-events-none" />
      <div className="w-8 h-8 rounded bg-black border border-white/10 flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <div className="text-[8px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-0.5">{label}</div>
        <div className="text-[12px] font-mono font-bold" style={{ color }}>{value}</div>
      </div>
    </div>
  );
}

