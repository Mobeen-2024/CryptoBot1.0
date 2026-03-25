import React, { useState } from 'react';
import { PauseCircle, PlayCircle, AlertOctagon, RefreshCw } from 'lucide-react';
import { SyncTradesModal } from './SyncTradesModal';
import toast from 'react-hot-toast';

export const CopierControls: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [isLiquidating, setIsLiquidating] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
    // In a real app, this would dispatch a WebSocket command to the backend copy engine
  };

  const handleEmergencyClose = async () => {
    const confirm = window.confirm(
      "EMERGENCY PROTOCOL:\n\nAre you sure you want to Market Close ALL open positions on the Slave account immediately?\n\nThis action cannot be undone and may incur high slippage."
    );
    
    if (confirm) {
      setIsLiquidating(true);
      const toastId = toast.loading('Initiating Emergency Liquidation...');
      
      try {
        const res = await fetch('/api/backend/positions');
        const positions = await res.json();
        
        let successCount = 0;
        let failCount = 0;

        for (const pos of positions) {
            if (pos.netQuantity === 0) continue;
            
            const side = pos.netQuantity > 0 ? 'SELL' : 'BUY';
            const quantity = Math.abs(pos.netQuantity);
            
            // To ensure margin modes map correctly on close, we need the raw symbol from the backend or ccxt format
            // In the DB it might be BTC/USDT-ISOLATED. The backend processes the symbol directly in server.js
            try {
                const orderRes = await fetch('/api/binance/order', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        symbol: pos.symbol.replace('-ISOLATED', '').replace('-CROSS', ''),
                        marginMode: pos.symbol.includes('-ISOLATED') ? 'isolated' : (pos.symbol.includes('-CROSS') ? 'cross' : undefined),
                        side: side,
                        type: 'MARKET',
                        quantity: quantity
                    })
                });
                
                if (orderRes.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (err) {
                failCount++;
            }
        }
        
        if (failCount === 0 && successCount > 0) {
            toast.success(`Emergency Shutdown Complete. ${successCount} positions liquidated.`, { id: toastId });
        } else if (successCount > 0 && failCount > 0) {
            toast.error(`Partial Liquidation: ${successCount} closed, ${failCount} failed.`, { id: toastId });
        } else {
            toast.error('Emergency Shutdown failed or no positions found.', { id: toastId });
        }
        
        setIsPaused(true); // Automatically pause copying after a panic close
      } catch (error) {
          toast.error('Critical failure accessing position database.', { id: toastId });
      } finally {
          setIsLiquidating(false);
      }
    }
  };

  return (
    <div className="flex items-center gap-3 bg-black/40 rounded-lg p-1.5 border border-white/5">
      
      {/* Trade Sync Button */}
      <button
        type="button"
        onClick={() => setIsSyncModalOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 border border-transparent"
        title="Check for missed trades during downtime"
      >
        <RefreshCw className="w-4 h-4" />
        Sync
      </button>

      <div className="w-px h-5 bg-white/10"></div>
      
      {/* Pause/Resume Toggle */}
      <button
        type="button"
        onClick={handlePauseToggle}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
          isPaused 
            ? 'bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-transparent'
        }`}
      >
        {isPaused ? <PlayCircle className="w-4 h-4 fill-amber-500/20" /> : <PauseCircle className="w-4 h-4" />}
        {isPaused ? 'Copier Paused' : 'Pause Copier'}
      </button>

      <div className="w-px h-5 bg-white/10"></div>

      {/* Emergency Liquidate Button */}
      <button
        type="button"
        onClick={handleEmergencyClose}
        disabled={isLiquidating}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider transition-all duration-200 border ${
          isLiquidating
            ? 'bg-[var(--holo-magenta)]/50 text-white border-[var(--holo-magenta)] cursor-not-allowed opacity-70'
            : 'bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] hover:bg-[var(--holo-magenta)] hover:text-white border-[var(--holo-magenta)]/50 hover:border-[var(--holo-magenta)] hover:shadow-[0_0_20px_var(--holo-magenta-glow)]'
        }`}
        title="Liquidate all active Slave positions immediately"
      >
        <AlertOctagon className={`w-4 h-4 ${isLiquidating ? 'animate-pulse' : ''} ${!isLiquidating && 'fill-[var(--holo-magenta)]/20'}`} />
        <span>{isLiquidating ? 'Liquidating...' : 'Liquidate Portfolio'}</span>
      </button>

      <SyncTradesModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
      />
    </div>
  );
};
