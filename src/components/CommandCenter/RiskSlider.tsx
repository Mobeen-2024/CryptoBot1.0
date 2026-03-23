import React from 'react';
import { Zap } from 'lucide-react';

interface RiskSliderProps {
  riskAppetite: number;
  setRiskAppetite: (val: number) => void;
  isShimmering: boolean;
}

export const RiskSlider: React.FC<RiskSliderProps> = ({ riskAppetite, setRiskAppetite, isShimmering }) => {
  return (
    <div className="px-5 pb-5">
      <div className={`bg-white/[0.02] border border-white/5 rounded-2xl p-5 transition-all duration-700 backdrop-blur-md ${
        isShimmering ? 'shadow-[0_0_30px_rgba(16,185,129,0.15)] border-emerald-500/30 scale-[1.01]' : 'shadow-sm'
      }`}>
          <div className="flex justify-between items-center mb-4">
            <span className="text-[11px] font-bold uppercase tracking-widest text-emerald-400/90 flex items-center gap-2">
              <Zap className="w-4 h-4 opacity-80" /> Risk Intuition Array
            </span>
            <span className={`text-[12px] font-mono font-bold transition-colors duration-500 ${
              riskAppetite > 75 ? 'text-rose-400' : riskAppetite < 25 ? 'text-cyan-400' : 'text-gray-400'
            }`}>
              {riskAppetite}%
            </span>
          </div>
          
          <div className="relative py-2">
            <input 
              type="range" 
              min="1" max="100" 
              value={riskAppetite} 
              onChange={(e) => setRiskAppetite(Number(e.target.value))} 
              className="w-full h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer border border-white/5 accent-emerald-500 hover:accent-emerald-400 transition-all focus:outline-none" 
            />
          </div>
          
          {/* Risk Profile Presets */}
          <div className="flex justify-between gap-3 mt-4">
            {[
              { label: 'Conservative', val: 15, baseColor: 'text-cyan-400/80', activeBg: 'bg-cyan-500/15', activeBorder: 'border-cyan-500/40', glow: 'shadow-[0_0_15px_rgba(6,182,212,0.15)]' },
              { label: 'Balanced', val: 50, baseColor: 'text-emerald-400/80', activeBg: 'bg-emerald-500/15', activeBorder: 'border-emerald-500/40', glow: 'shadow-[0_0_15px_rgba(16,185,129,0.15)]' },
              { label: 'Aggressive', val: 85, baseColor: 'text-rose-400/80', activeBg: 'bg-rose-500/15', activeBorder: 'border-rose-500/40', glow: 'shadow-[0_0_15px_rgba(244,63,94,0.15)]' }
            ].map(p => {
              const isActive = riskAppetite === p.val;
              return (
                <button 
                  key={p.label} 
                  onClick={() => setRiskAppetite(p.val)} 
                  className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-lg border transition-all duration-300 ${
                    isActive 
                      ? `${p.activeBg} ${p.baseColor.replace('/80', '')} ${p.activeBorder} ${p.glow} scale-[1.02]` 
                      : `bg-white/5 hover:bg-white/10 ${p.baseColor} border-white/5`
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
      </div>
    </div>
  );
};
