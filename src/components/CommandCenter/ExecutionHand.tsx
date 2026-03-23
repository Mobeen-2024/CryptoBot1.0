import React from 'react';
import { LucideIcon } from 'lucide-react';
import { SmartInput } from '../SmartInput';

interface ExecutionHandProps {
  title: string;
  icon: LucideIcon;
  colorTheme: 'emerald' | 'rose';
  slLabel: string;
  slValue: number;
  setSL: (val: number) => void;
  tpLabel: string;
  tpValue: number;
  setTP: (val: number) => void;
  activeAnchor: number;
  isReversed?: boolean;
}

export const ExecutionHand: React.FC<ExecutionHandProps> = ({
  title, icon: Icon, colorTheme, slLabel, slValue, setSL, tpLabel, tpValue, setTP, activeAnchor, isReversed
}) => {
  const isEmerald = colorTheme === 'emerald';
  const bgClass = isEmerald ? 'bg-emerald-500/[0.03]' : 'bg-rose-500/[0.03]';
  const borderTopClass = isEmerald ? 'border-t-emerald-500/20' : 'border-t-rose-500/20';
  const textClass = isEmerald ? 'text-emerald-400' : 'text-rose-400';
  const shadowClass = isEmerald ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]' : 'drop-shadow-[0_0_8px_rgba(244,63,94,0.3)]';

  return (
    <div className={`p-6 space-y-5 border-t ${borderTopClass} ${bgClass} backdrop-blur-sm relative overflow-hidden`}>
      {/* Subtle background glow */}
      <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-[60px] pointer-events-none ${isEmerald ? 'bg-emerald-500/10' : 'bg-rose-500/10'} -translate-y-1/2 translate-x-1/2`} />
      
      <h3 className={`text-[12px] font-black uppercase tracking-[0.25em] ${textClass} flex items-center gap-2.5 ${shadowClass} relative z-10`}>
        <Icon className={`w-4 h-4 opacity-90 ${isReversed ? 'rotate-180' : ''}`} /> {title}
      </h3>
      
      <div className="grid gap-4 relative z-10">
        <SmartInput 
          label={slLabel} 
          value={slValue} 
          onChange={setSL} 
          basePrice={Number(activeAnchor)} 
          colorTheme={colorTheme} 
          suffix="USDT" 
        />
        <SmartInput 
          label={tpLabel} 
          value={tpValue} 
          onChange={setTP} 
          basePrice={slValue > 0 ? Number(activeAnchor) : undefined} 
          colorTheme={colorTheme} 
          suffix="USDT" 
        />
      </div>
    </div>
  );
};
