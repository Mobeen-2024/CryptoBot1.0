import React, { useState } from 'react';
import { Database, Download, Trash2, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export const DatabasePanel: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [isPruning, setIsPruning] = useState(false);

  // Mock function to simulate downloading SQLite trades as CSV
  const handleExportCSV = async () => {
    setIsExporting(true);
    const downloadToast = toast.loading('Compiling trades to CSV...');

    try {
      // Simulate API call to fetch full DB logs
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock CSV content generation
      const csvContent = "data:text/csv;charset=utf-8,ID,Symbol,Side,Amount,Price,Timestamp\n" +
        "ORD-391X,BTCUSDT,BUY,0.15,64500.20,2026-03-07T12:00:00Z\n" +
        "ORD-927A,ETHUSDT,SELL,2.5,3400.10,2026-03-06T15:30:22Z\n";
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `cryptobot_trades_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast.success('Database exported successfully', { id: downloadToast });
    } catch (error) {
      toast.error('Failed to export database', { id: downloadToast });
    } finally {
      setIsExporting(false);
    }
  };

  // Mock function to simulate deleting logs older than 30 days
  const handlePruneLogs = async () => {
    const confirm = window.confirm(
      "WARNING: This will permanently delete all trade logs older than 30 days from the SQLite database.\n\nAre you sure you want to proceed?"
    );

    if (confirm) {
      setIsPruning(true);
      const pruneToast = toast.loading('Pruning old database records...');

      try {
        // Simulate API call to DELETE FROM trades WHERE timestamp < date('now', '-30 days')
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        toast.success('Successfully pruned 142 old records.', {
          id: pruneToast,
          duration: 4000,
          iconTheme: {
            primary: '#10b981',
            secondary: '#fff',
          },
        });
      } catch (error) {
        toast.error('Failed to prune database', { id: pruneToast });
      } finally {
        setIsPruning(false);
      }
    }
  };

  return (
    <div className="h-full flex flex-col pt-4 px-4 overflow-y-auto custom-scrollbar">
      
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-500/20 rounded-md border border-indigo-500/30">
          <Database className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h2 className="text-white font-bold text-base tracking-tight">Database Management</h2>
          <p className="text-gray-400 text-xs mt-0.5">Manage local SQLite trade logs and perform routine maintenance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
        
        {/* Export Card */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5 hover:bg-white/10 transition-colors flex flex-col">
          <div className="flex items-center gap-3 mb-3">
            <Download className="w-5 h-5 text-emerald-400" />
            <h3 className="text-white font-bold text-sm">Export to CSV</h3>
          </div>
          <p className="text-gray-400 text-xs mb-5 flex-1 leading-relaxed">
            Download the entire Master and Slave trade history from the SQLite database into a spreadsheet-readable CSV format for external analysis or accounting.
          </p>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={isExporting}
            className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-md text-xs font-bold tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Generating CSV...' : 'Download Full Registry'}
          </button>
        </div>

        {/* Pruning Card */}
        <div className="bg-white/5 border border-rose-500/20 rounded-xl p-5 hover:bg-[#1a1515] transition-colors flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 blur-3xl rounded-full"></div>
          
          <div className="flex items-center gap-3 mb-3 relative z-10">
            <Trash2 className="w-5 h-5 text-rose-400" />
            <h3 className="text-white font-bold text-sm">Prune Old Logs</h3>
          </div>
          <p className="text-gray-400 text-xs mb-5 flex-1 leading-relaxed relative z-10">
            Prevent unbounded SQLite database growth by permanently deleting all trade execution records older than <span className="text-white font-bold">30 days</span>. Highly recommended to run monthly to retain API performance.
          </p>
          
          <div className="flex items-center gap-2 mb-4 p-2 bg-amber-500/10 rounded border border-amber-500/20 text-[10px] text-amber-500 font-mono relative z-10">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            Warning: This action cannot be reversed. Export data first if needed.
          </div>

          <button
            type="button"
            onClick={handlePruneLogs}
            disabled={isPruning}
            className="w-full py-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-md text-xs font-bold tracking-wider transition-colors disabled:opacity-50 flex items-center justify-center gap-2 relative z-10"
          >
            {isPruning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {isPruning ? 'Deleting Records...' : 'Clear Data > 30 Days'}
          </button>
        </div>

      </div>

      <div className="mt-8 pt-6 border-t border-white/5 flex items-center gap-2 text-[10px] text-gray-500 font-mono">
        <CheckCircle className="w-3 h-3 text-emerald-500" />
        SQLite Connection: Standard Disk / trades.db
      </div>

    </div>
  );
};
