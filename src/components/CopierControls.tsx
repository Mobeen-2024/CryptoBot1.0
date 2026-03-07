import React, { useState } from 'react';
import { PauseCircle, PlayCircle, AlertOctagon, RefreshCw } from 'lucide-react';
import { SyncTradesModal } from './SyncTradesModal';

export const CopierControls: React.FC = () => {
  const [isPaused, setIsPaused] = useState(false);
  const [isLiquidating, setIsLiquidating] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

  const handlePauseToggle = () => {
    setIsPaused(!isPaused);
    // In a real app, this would dispatch a WebSocket command to the backend copy engine
  };

  const handleEmergencyClose = () => {
    const confirm = window.confirm(
      "EMERGENCY PROTOCOL:\n\nAre you sure you want to Market Close ALL open positions on the Slave account immediately?\n\nThis action cannot be undone and may incur high slippage."
    );
    
    if (confirm) {
      setIsLiquidating(true);
      // Mocking API call latency
      setTimeout(() => {
        setIsLiquidating(false);
        setIsPaused(true); // Automatically pause copying after a panic close
        alert("All slave positions have been liquidated to USDT successfully. Copier is currently PAUSED.");
      }, 1500);
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
            ? 'bg-rose-500/50 text-white border-rose-500 cursor-not-allowed opacity-70'
            : 'bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white border-rose-500/50 hover:border-rose-500 hover:shadow-[0_0_20px_rgba(244,63,94,0.4)]'
        }`}
        title="Liquidate all active Slave positions immediately"
      >
        <AlertOctagon className={`w-4 h-4 ${isLiquidating ? 'animate-pulse' : ''} ${!isLiquidating && 'fill-rose-500/20'}`} />
        {isLiquidating ? 'Liquidating...' : 'Close All'}
      </button>

      <SyncTradesModal 
        isOpen={isSyncModalOpen} 
        onClose={() => setIsSyncModalOpen(false)} 
      />
    </div>
  );
};
