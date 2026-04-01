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
  const isMagenta = color?.toLowerCase().includes('magenta') || color?.toLowerCase().includes('ff007f');
  const accentColor = isMagenta ? '#FF007F' : '#00E5FF';

  return (
    <button
      onClick={() => onToggle(!active)}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300
        ${active
          ? 'bg-white/[0.05] border border-white/[0.08]'
          : 'bg-transparent border border-transparent hover:bg-white/[0.03] hover:border-white/[0.04]'
        }
        active:scale-[0.98] group/toggle relative overflow-hidden
      `}
    >
      {/* Active Left Bar */}
      {active && (
        <div
          className="absolute left-0 top-2 bottom-2 w-[2px] rounded-full"
          style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
        />
      )}

      {/* Icon */}
      <div
        className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center transition-all duration-300 ${
          active ? 'text-white' : 'text-white/25 group-hover/toggle:text-white/40'
        }`}
        style={active ? {
          backgroundColor: `${accentColor}18`,
          border: `1px solid ${accentColor}30`,
          filter: `drop-shadow(0 0 6px ${accentColor}60)`,
        } : { backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        {icon}
      </div>

      {/* Text */}
      <div className="flex flex-col items-start flex-1 min-w-0 overflow-hidden">
        <span
          className={`text-[11px] font-bold uppercase tracking-[0.12em] leading-none truncate transition-colors duration-300 ${
            active ? 'text-white' : 'text-white/30 group-hover/toggle:text-white/50'
          }`}
        >
          {label}
        </span>
        {subtitle && (
          <span className="text-[8px] font-mono text-white/15 mt-[3px] truncate tracking-[0.15em] uppercase">
            {subtitle}
          </span>
        )}
      </div>

      {/* Toggle Pill */}
      <div
        className={`flex-shrink-0 relative w-8 h-4 rounded-full transition-all duration-400 ${
          active ? 'bg-white/10' : 'bg-white/[0.04]'
        }`}
        style={active ? { boxShadow: `inset 0 0 6px ${accentColor}20, 0 0 0 1px ${accentColor}30` } : {}}
      >
        <div
          className={`absolute top-[3px] w-[10px] h-[10px] rounded-full transition-all duration-300 ease-out ${
            active ? 'left-[18px]' : 'left-[3px] bg-white/20'
          }`}
          style={active ? { backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}` } : {}}
        />
      </div>
    </button>
  );

};

export default TacticalToggle;
