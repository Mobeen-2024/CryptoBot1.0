import React, { useState, useEffect } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, ArrowRight, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Discrepancy {
  id: string;
  time: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  amount: string;
  price: string;
}

export const SyncTradesModal: React.FC<SyncModalProps> = ({ isOpen, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [discrepancies, setDiscrepancies] = useState<Discrepancy[]>([]);

  // Simulate WebSocket / API Sync process when modal opens
  useEffect(() => {
    if (isOpen) {
      setIsScanning(true);
      setScanComplete(false);
      setDiscrepancies([]);

      // Mock a 2.5 second API reconciliation scan
      const timer = setTimeout(() => {
        setIsScanning(false);
        setScanComplete(true);
        
        // Randomly simulate whether we found missed trades or not
        const hasMissedTrades = Math.random() > 0.4;
        
        if (hasMissedTrades) {
          setDiscrepancies([
            {
              id: 'ORD-8X9Y2M',
              time: new Date(Date.now() - 1000 * 60 * 15).toLocaleTimeString(), // 15 mins ago
              symbol: 'BTCUSDT',
              side: 'BUY',
              amount: '0.05',
              price: '64250.00'
            },
            {
              id: 'ORD-3A1B4C',
              time: new Date(Date.now() - 1000 * 60 * 42).toLocaleTimeString(), // 42 mins ago
              symbol: 'ETHUSDT',
              side: 'SELL',
              amount: '1.2',
              price: '3450.50'
            }
          ]);
        }
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e2329] border border-[#2b3139] shadow-2xl rounded-xl w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-[#2b3139] bg-black/20">
          <div className="flex items-center gap-2">
            <RefreshCw className={`w-5 h-5 text-indigo-400 ${isScanning ? 'animate-spin' : ''}`} />
            <h2 className="text-white font-bold tracking-tight">Trade Reconciliation Sync</h2>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {isScanning ? (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="relative w-16 h-16 mb-6">
                <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Analyzing Trade History...</h3>
              <p className="text-sm text-gray-400 text-center max-w-sm">
                Cross-referencing Master execution logs against Slave account history for the last 60 minutes to detect missed webhook events.
              </p>
            </div>
          ) : scanComplete && discrepancies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                <CheckCircle className="w-8 h-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Accounts Synchronized</h3>
              <p className="text-sm text-gray-400 text-center max-w-sm">
                No missed trades detected. The Slave account is perfectly matched with the Master's execution history.
              </p>
              <button 
                type="button"
                onClick={onClose}
                className="mt-8 px-6 py-2 bg-white/5 hover:bg-white/10 text-white rounded-md text-sm font-semibold transition-colors"
              >
                Close Window
              </button>
            </div>
          ) : (
            <div className="flex flex-col animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg mb-6">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-500 mb-1">Missed Executions Detected</h4>
                  <p className="text-xs text-amber-500/80 leading-relaxed">
                    The copier missed {discrepancies.length} trade{discrepancies.length > 1 ? 's' : ''} during the last network downtime window. Review the discrepancies below to manually reconcile.
                  </p>
                </div>
              </div>

              <div className="border border-[#2b3139] rounded-lg overflow-hidden">
                <div className="grid grid-cols-5 gap-4 p-3 border-b border-[#2b3139] bg-black/20 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
                  <div>Time</div>
                  <div>Asset</div>
                  <div>Side</div>
                  <div className="text-right">Price</div>
                  <div className="text-right">Amount</div>
                </div>
                <div className="max-h-[200px] overflow-y-auto custom-scrollbar">
                  {discrepancies.map((trade) => (
                    <div key={trade.id} className="grid grid-cols-5 gap-4 p-3 border-b border-[#2b3139]/50 last:border-0 hover:bg-white/5 text-xs font-mono items-center transition-colors">
                      <div className="text-gray-400">{trade.time}</div>
                      <div className="text-white font-sans font-bold">{trade.symbol.replace('USDT', '')}</div>
                      <div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.side === 'BUY' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                          {trade.side}
                        </span>
                      </div>
                      <div className="text-right text-gray-300">{trade.price}</div>
                      <div className="text-right text-gray-300">{trade.amount}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-md text-sm font-semibold transition-colors"
                >
                  Ignore
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    toast.error(`Force-Executing ${discrepancies.length} missed trades to Slave Account at Market Price.`, { icon: '⚠️' });
                    onClose();
                  }}
                  className="flex-[2] flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-sm font-semibold transition-all hover:shadow-[0_0_20px_rgba(79,70,229,0.4)]"
                >
                  Force Execute Now
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
