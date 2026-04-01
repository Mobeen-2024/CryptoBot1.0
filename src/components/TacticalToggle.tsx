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
        w-full flex items-center justify-between py-4 px-6 lg:py-3 lg:px-5 rounded-2xl lg:rounded-xl transition-all duration-500
        ${active ? 'bg-[var(--holo-cyan)]/[0.07] border-y border-white/5 shadow-[0_0_30px_rgba(0,229,255,0.05)]' : 'bg-transparent border-y border-transparent'}
        hover:bg-white/[0.03] active:scale-[0.98] group/toggle relative overflow-hidden
      `}
    >
      {/* Side Spectral Glow Indicator */}
      <div className={`
        absolute left-0 top-0 bottom-0 w-[4px] transition-all duration-500
        ${active ? (color?.toLowerCase().includes('magenta') || color?.toLowerCase().includes('ff007f') ? 'spectral-glow-magenta' : 'spectral-glow-cyan') : 'bg-transparent'}
      `} />

      {/* Hover Shimmer */}
      <div className="absolute inset-0 opacity-0 group-hover/toggle:opacity-100 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover/toggle:translate-x-full transition-all duration-1000 pointer-events-none" />

      <div className="flex items-center gap-4 lg:gap-3 flex-1 min-w-0 relative z-10">
        <div className={`
          flex-shrink-0 p-2.5 lg:p-2 rounded-xl transition-all duration-500 
          ${active ? 'text-white scale-110' : 'text-[#5e6673] group-hover/toggle:text-white/60'}
        `}
        style={active ? { filter: `drop-shadow(0 0 8px ${color})` } : {}}
        >
          {icon}
        </div>
        <div className="flex flex-col items-start translate-y-[1px] flex-1 min-w-0 overflow-hidden">
          <span className={`w-full text-[12px] lg:text-[11px] font-black uppercase tracking-[0.15em] leading-none ${active ? 'text-white' : 'text-[#5e6673] group-hover/toggle:text-white/40'} transition-colors truncate`}>
            {label}
          </span>
          {subtitle && (
            <span className="w-full text-[9px] lg:text-[8px] font-mono uppercase tracking-[0.2em] text-[#5e6673]/60 mt-1.5 truncate">
              {subtitle}
            </span>
          )}
        </div>
      </div>
      
      {/* Neural Protocol Switch */}
      <div className={`
        flex-shrink-0 w-9 h-4.5 lg:w-8 lg:h-4 rounded-full relative transition-all duration-500 ring-1 ring-inset p-0.5
        ${active ? 'bg-black/40 ring-[var(--holo-cyan)]/30 holo-switch-active' : 'bg-white/5 ring-white/10'}
      `}>
        <div className={`
          h-full aspect-square rounded-full transition-all duration-500 ease-out
          ${active ? 'translate-x-4.5 lg:translate-x-4 bg-white shadow-[0_0_12px_#fff]' : 'translate-x-0 bg-white/20'}
        `} 
        style={{ 
          backgroundColor: active ? (color?.includes('#FF007F') || color?.includes('magenta') ? '#FF007F' : '#00E5FF') : undefined
        }}
        />
      </div>
    </button>
  );

};

export default TacticalToggle;
