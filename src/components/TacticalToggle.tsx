import React from 'react';

interface TacticalToggleProps {
  label: string;
  active: boolean;
  onToggle: (active: boolean) => void;
  icon?: React.ReactNode;
  subtitle?: string;
  color?: string;
}

const TacticalToggle: React.FC<TacticalToggleProps> = ({ label, active, onToggle, icon, subtitle, color = 'var(--holo-cyan)' }) => {
  return (
    <button
      onClick={() => onToggle(!active)}
      className={`
        w-full flex items-center justify-between p-2.5 lg:p-1.5 rounded-xl lg:rounded-lg transition-all duration-200
        ${active ? 'bg-[var(--holo-cyan)]/10 lg:bg-[var(--holo-cyan)]/5 border border-[var(--holo-cyan)]/30 lg:border-[var(--holo-cyan)]/15 shadow-[0_0_15px_rgba(0,255,242,0.1)] lg:shadow-[0_0_10px_rgba(0,255,242,0.03)]' : 'bg-transparent border border-transparent'}
        hover:bg-white/[0.03] active:bg-white/10 group/toggle touch-manipulation
      `}
    >
      <div className="flex items-center gap-3 lg:gap-2 flex-1 min-w-0">
        <div className={`flex-shrink-0 p-2 lg:p-1.5 rounded-lg transition-colors ${active ? 'bg-white/10 lg:bg-white/5 text-white' : 'text-[#5e6673]'}`}>
          {icon}
        </div>
        <div className="flex flex-col items-start translate-y-[1px] flex-1 min-w-0 overflow-hidden">
          <span className={`w-full text-[11px] lg:text-[10px] font-black uppercase tracking-tight leading-none ${active ? 'text-white' : 'text-[#5e6673]'} transition-colors truncate`}>
            {label}
          </span>
          {subtitle && (
            <span className="w-full text-[8px] lg:text-[7px] font-mono uppercase tracking-widest text-[#5e6673]/60 mt-1 truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      
      {/* Pill Switch */}
      <div className={`
        flex-shrink-0 w-8 h-4 lg:w-7 lg:h-3.5 rounded-full relative transition-all duration-300 ring-1 ring-inset
        ${active ? 'bg-[var(--holo-cyan)]/30 lg:bg-[var(--holo-cyan)]/20 ring-[var(--holo-cyan)]/40 lg:ring-[var(--holo-cyan)]/30' : 'bg-white/10 lg:bg-white/5 ring-white/20 lg:ring-white/10'}
      `}>
        <div className={`
          absolute top-0.5 w-3 h-3 lg:w-2.5 lg:h-2.5 rounded-full transition-all duration-300
          ${active ? 'left-4.5 lg:left-4 shadow-[0_0_8px_white]' : 'left-0.5'}
        `} 
        style={{ backgroundColor: active ? color : 'rgba(255,255,255,0.2)' }}
        />
      </div>
    </button>
  );
};

export default TacticalToggle;
