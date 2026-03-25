import React, { useState, useEffect, useRef } from 'react';
import { Calculator } from 'lucide-react';

interface SmartInputProps {
  label: string;
  value: string | number;
  onChange: (val: number) => void;
  basePrice?: number; // Optional reference price if user just types "+5%"
  suffix?: string;
  placeholder?: string;
  className?: string;
  colorTheme?: 'cyan' | 'emerald' | 'rose';
}

export const SmartInput: React.FC<SmartInputProps> = ({
  label, value, onChange, basePrice = 0, suffix, placeholder, className = '', colorTheme = 'cyan'
}) => {
  const [localValue, setLocalValue] = useState<string>(value.toString());
  const [isAnimating, setIsAnimating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const colors = {
    cyan: 'border-[var(--holo-cyan)]/50 shadow-[0_0_10px_rgba(6,182,212,0.2)] text-[var(--holo-cyan)]',
    emerald: 'border-[var(--holo-cyan)]/50 shadow-[0_0_10px_rgba(16,185,129,0.2)] text-[var(--holo-cyan)]',
    rose: 'border-[var(--holo-magenta)]/50 shadow-[0_0_10px_rgba(244,63,94,0.2)] text-[var(--holo-magenta)]',
  };
  
  const hoverColors = {
    cyan: 'hover:text-[var(--holo-cyan)] hover:bg-[var(--holo-cyan)]/10 hover:border-[var(--holo-cyan)]/30 text-[var(--holo-cyan)]/70 bg-[var(--holo-cyan)]/5 border-[var(--holo-cyan)]/10',
    emerald: 'hover:text-[var(--holo-cyan)] hover:bg-[var(--holo-cyan)]/10 hover:border-[var(--holo-cyan)]/30 text-[var(--holo-cyan)]/70 bg-[var(--holo-cyan)]/5 border-[var(--holo-cyan)]/10',
    rose: 'hover:text-[var(--holo-magenta)] hover:bg-[var(--holo-magenta)]/10 hover:border-[var(--holo-magenta)]/30 text-[var(--holo-magenta)]/70 bg-[var(--holo-magenta)]/5 border-[var(--holo-magenta)]/10',
  };

  useEffect(() => {
    // Only sync incoming value if we're not focused, preventing cursor jumping
    if (!isFocused && value.toString() !== localValue) {
      setLocalValue(value.toString());
    }
  }, [value, isFocused]);

  const triggerConsumeAnimation = (finalValue: number) => {
    setIsAnimating(true);
    setTimeout(() => {
      setLocalValue(finalValue.toString());
      onChange(finalValue);
      setIsAnimating(false);
    }, 400); // 400ms fade duration
  };

  const evaluateMath = (input: string): number | null => {
    const raw = input.trim();
    if (!raw) return null;

    // Pattern 1: Fully qualified e.g. "64000 + 1.5%"
    const fullMatch = raw.match(/^([\d.]+)\s*([+-])\s*([\d.]+)\s*\%$/);
    if (fullMatch) {
      const base = parseFloat(fullMatch[1]);
      const op = fullMatch[2];
      const pct = parseFloat(fullMatch[3]);
      const delta = base * (pct / 100);
      return op === '+' ? base + delta : base - delta;
    }

    // Pattern 2: Relative e.g. "+ 1.5%" or "- 1.5%"
    const relMatch = raw.match(/^([+-])?\s*([\d.]+)\s*\%$/);
    if (relMatch && basePrice > 0) {
      const op = relMatch[1] || '+';
      const pct = parseFloat(relMatch[2]);
      const delta = basePrice * (pct / 100);
      return op === '+' ? basePrice + delta : basePrice - delta;
    }

    const num = Number(raw);
    return isNaN(num) ? null : num;
  };

  const handleBlur = () => {
    setIsFocused(false);
    const result = evaluateMath(localValue);
    
    // If it was a math equation, consume it via animation
    if (localValue.includes('%') && result !== null) {
      triggerConsumeAnimation(Number(result.toFixed(4)));
    } else if (result !== null) {
      onChange(Number(result.toFixed(4)));
    } else {
      // Revert if invalid
      setLocalValue(value.toString());
    }
  };

  const applyQuickMultiplier = (pct: number) => {
    const base = basePrice > 0 ? basePrice : (Number(value) || 0);
    if (base > 0) {
      const finalValue = base * (1 + (pct / 100));
      setLocalValue(`${base} + ${pct}%`);
      triggerConsumeAnimation(Number(finalValue.toFixed(4)));
    }
  };

  return (
    <div className={`flex flex-col gap-1 w-full ${className}`}>
      <div className={`relative group h-11 w-full bg-black/40 border rounded-lg overflow-hidden transition-all duration-300 ${isFocused ? colors[colorTheme] : 'border-[#1E293B]'}`}>
        
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
          <span className={`text-[10px] uppercase font-bold text-gray-500 tracking-wider transition-colors`}>{label}</span>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.blur()}
          placeholder={placeholder}
          className={`w-full h-full bg-transparent text-white text-[13px] font-mono focus:outline-none pl-20 ${suffix ? 'pr-10' : 'pr-3'} 
            transition-all duration-400 ${isAnimating ? 'opacity-0 scale-95 ' + colors[colorTheme] : 'opacity-100 scale-100'}`}
        />

        {suffix && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
            <span className="text-[10px] font-bold text-gray-500 group-focus-within:text-white transition-colors">{suffix}</span>
          </div>
        )}

        {/* Visual Cue that Smart Math is active */}
        {localValue.includes('%') && !isAnimating && (
          <div className="absolute inset-y-0 right-10 pr-2 flex items-center pointer-events-none z-10 animate-pulse">
            <Calculator className={`w-4 h-4 ${colors[colorTheme].split(' ')[2]}`} />
          </div>
        )}
      </div>

      {/* Quick Multiplier Pill Strip */}
      <div className="flex gap-2 px-1">
        {[1, 2, 3].map(pct => (
          <button
            key={pct}
            onClick={() => applyQuickMultiplier(pct)}
            className={`flex-1 text-[10px] font-bold tracking-wider rounded py-1 transition-all active:scale-95 border ${hoverColors[colorTheme]}`}
          >
            +{pct}%
          </button>
        ))}
      </div>
    </div>
  );
};
