import React from 'react';
import { Cpu, Activity, Network, Radio } from 'lucide-react';

interface BotState {
  isActive: boolean;
  phase?: string;
}

interface CommandHeaderProps {
  status: BotState;
  usePreviousDayAvg: boolean;
  currentPrice: number;
  customAnchorPrice: number;
}

export const CommandHeader: React.FC<CommandHeaderProps> = ({ status, usePreviousDayAvg, currentPrice, customAnchorPrice }) => {
  return (
    <div className="shrink-0 p-5 border-b border-white/5 bg-black/40 backdrop-blur-xl flex flex-col gap-1 relative overflow-hidden">
      {/* Soft Ambient Glow */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[var(--holo-cyan)]/10 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2 pointer-events-none" />
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-[var(--holo-cyan)]/20 to-purple-500/20 border border-white/10 flex items-center justify-center shadow-[0_8px_32px_rgba(99,102,241,0.15)] flex-shrink-0 transition-transform duration-500 hover:scale-105">
          <Cpu className="w-6 h-6 text-[var(--holo-cyan)]" />
        </div>
        
        <div className="flex-1">
          <h2 className="text-[14px] font-bold tracking-[0.15em] text-white/90 uppercase drop-shadow-md">
             Command Center (Master Bot)
          </h2>
          
          <div className="flex flex-wrap items-center gap-2.5 mt-2">
            {/* Status Pill */}
            <span className={`flex justify-center items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-widest border transition-colors duration-300 ${
              status.isActive 
                ? 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/30 shadow-[0_0_15px_rgba(99,102,241,0.2)]' 
                : 'bg-white/5 text-gray-400 border-white/10'
            }`}>
              {status.isActive ? <Activity className="w-3 h-3 animate-pulse" /> : <Network className="w-3 h-3" />}
              Sys: {status.isActive ? status.phase : 'Standby'}
            </span>
            
            {/* Candle Sync Pill */}
            <span className={`flex justify-center items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold uppercase tracking-widest border transition-colors duration-300 ${
              !usePreviousDayAvg && !status.isActive 
                ? 'bg-[#FCD535]/10 text-[#FCD535] border-[#FCD535]/30 shadow-[0_0_15px_rgba(252,213,53,0.1)]' 
                : 'bg-white/5 text-gray-400 border-white/10'
            }`}>
              <Radio className={`w-3 h-3 ${!usePreviousDayAvg && !status.isActive ? "animate-pulse" : ""}`} />
              Sync: {!usePreviousDayAvg && !status.isActive ? 'Active' : 'Offline'}
            </span>

            {/* Live Spread Telemetry */}
            {currentPrice > 0 && customAnchorPrice > 0 && (
              <span className={`flex justify-center items-center px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest border transition-all duration-300 ${
                Math.abs(currentPrice - customAnchorPrice) < 0.0001 
                  ? 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/30 shadow-[0_0_15px_rgba(16,185,129,0.2)]' 
                  : 'bg-white/5 text-gray-400 border-white/10'
              }`}>
                Spread: ${Math.abs(currentPrice - customAnchorPrice).toFixed(2)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
