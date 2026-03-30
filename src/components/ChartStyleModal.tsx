import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Check, MousePointer2, Type, LayoutGrid, Palette, Sliders, Activity, TrendingUp, Cpu, BarChart2, Zap, Shield, Globe, Terminal, Fingerprint } from 'lucide-react';
import { ChartConfig, DEFAULT_CHART_CONFIG } from '../types/chart';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChartStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ChartConfig;
  mainIndicator: string | null;
  subIndicators: string[];
  onApply: (config: ChartConfig, main: string | null, sub: string[]) => void;
  onReset: () => void;
}

export const ChartStyleModal: React.FC<ChartStyleModalProps> = ({
  isOpen, onClose, config, mainIndicator, subIndicators, onApply, onReset
}) => {
  const [activeTab, setActiveTab] = useState<'style' | 'indicators'>('indicators');
  const [localConfig, setLocalConfig] = useState<ChartConfig>(config);
  const [localMain, setLocalMain] = useState<string | null>(mainIndicator);
  const [localSub, setLocalSub] = useState<string[]>(subIndicators);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
      setLocalMain(mainIndicator);
      setLocalSub(subIndicators);
    }
  }, [isOpen, config, mainIndicator, subIndicators]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(localConfig, localMain, localSub);
    onClose();
  };

  const toggleSub = (id: string) => {
    setLocalSub(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const colorSwatch = (color: string, onChange: (color: string) => void) => (
    <div className="flex items-center gap-3 bg-white/5 p-2 rounded-xl border border-white/5">
      <div className="relative w-8 h-8 group rounded-lg p-[1px] bg-white/10 overflow-hidden shadow-inner">
        <input
          type="color"
          value={color.startsWith('#') ? color : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
        />
        <div
          className="w-full h-full rounded-md border border-black/50 transition-transform group-hover:scale-110 z-10"
          style={{ backgroundColor: color, boxShadow: `0 0 15px ${color}60` }}
        />
      </div>
      <span className="text-[10px] font-mono font-black text-white/40 uppercase tracking-widest">{color}</span>
    </div>
  );

  const hardwareSwitch = (active: boolean, onToggle: () => void, label: string) => (
    <button 
      onClick={onToggle}
      className={cn(
        "group relative flex items-center justify-between p-4 rounded-2xl transition-all border w-full",
        active ? "bg-[var(--holo-cyan)]/10 border-[var(--holo-cyan)]/40 shadow-[0_0_20px_rgba(0,255,242,0.1)]" : "bg-black/40 border-white/5 hover:border-white/20"
      )}
    >
      <div className="flex flex-col items-start translate-y-[1px]">
        <span className={cn("text-[10px] font-black uppercase tracking-widest leading-none mb-1", active ? "text-[var(--holo-cyan)]" : "text-white/40")}>{label}</span>
        <span className="text-[7px] font-mono text-white/20 uppercase tracking-[0.3em] font-bold">{active ? "PROTOCOL_ACTIVE" : "STANDBY"}</span>
      </div>
      
      <div className={cn(
        "w-10 h-5 rounded-full relative transition-all duration-500",
        active ? "bg-[var(--holo-cyan)]/30 shadow-[0_0_10px_var(--holo-cyan-glow)]" : "bg-white/5"
      )}>
        <div className={cn(
          "absolute top-1 w-3 h-3 rounded-full transition-all duration-500 shadow-lg",
          active ? "left-6 bg-white shadow-[0_0_15px_white]" : "left-1 bg-white/20"
        )} />
      </div>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-20 overflow-hidden">
      {/* Neural Link Backdrop */}
      <div
        className="absolute inset-0 bg-[#050b14]/95 backdrop-blur-3xl animate-in fade-in duration-700"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-[var(--holo-cyan)]/5 via-transparent to-[var(--holo-magenta)]/5" />
        <div className="grid-pattern opacity-10" />
        <div className="scan-lines opacity-20" />
      </div>

      {/* Cybernetic Terminal Portal */}
      <div
        className="relative w-full max-w-4xl h-full max-h-[90vh] sm:max-h-[850px] bg-[#0a0f1a]/80 border border-white/10 rounded-[2rem] sm:rounded-[3rem] shadow-[0_0_100px_rgba(0,0,0,1)] overflow-hidden flex flex-col animate-crt-on pb-10 sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="cyber-scanline" />
        
        {/* Warning Stripe Header */}
        <div className="h-1.5 w-full shrink-0" style={{ background: 'repeating-linear-gradient(45deg, #fcd535, #fcd535 10px, #000 10px, #000 20px)' }} />

        {/* Console Header */}
        <div className="p-8 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-8 bg-black/40 relative">
          <div className="absolute top-0 right-0 p-4 opacity-[0.03] select-none pointer-events-none">
             <Terminal className="w-48 h-48 rotate-12" />
          </div>
          
          <div className="flex items-center gap-6 relative z-10">
            <div className="w-14 h-14 rounded-2xl glass-panel flex items-center justify-center border border-[var(--holo-cyan)]/40 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
              <Cpu className="w-8 h-8 text-[var(--holo-cyan)] animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-3 mb-1.5">
                <span className="px-2 py-0.5 rounded-md bg-[var(--holo-cyan)]/10 border border-[var(--holo-cyan)]/40 text-[9px] font-black text-[var(--holo-cyan)] tracking-widest uppercase italic">Authorization: Root</span>
                <span className="text-[9px] font-mono text-white/30 tracking-widest uppercase">System_Override // v2.0.5</span>
              </div>
              <h2 className="text-2xl font-black text-white uppercase tracking-[0.4em] drop-shadow-[0_0_12px_rgba(255,255,255,0.3)]">Command Console</h2>
            </div>
          </div>

          <div className="flex items-center gap-4 relative z-10">
            <div className="flex bg-black p-1.5 rounded-2xl border border-white/10 shadow-2xl">
              <button
                onClick={() => setActiveTab('indicators')}
                className={cn(
                  "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500",
                  activeTab === 'indicators' ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]" : "text-white/40 hover:text-white"
                )}
              >
                Nodes
              </button>
              <button
                onClick={() => setActiveTab('style')}
                className={cn(
                  "px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-500",
                  activeTab === 'style' ? "bg-white text-black shadow-[0_0_20px_rgba(255,255,255,0.3)]" : "text-white/40 hover:text-white"
                )}
              >
                Optics
              </button>
            </div>
            <button 
              onClick={onClose} 
              className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 hover:border-white/30 text-white/40 hover:text-white flex items-center justify-center transition-all active:scale-90"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Central Intelligence Grid */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-10">
          
          {activeTab === 'indicators' ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
              
              {/* Overlay Engine Layer */}
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--holo-cyan)]" />
                  <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Neural Overlays</span>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {[
                    { id: 'SUPER', label: 'Supertrend', desc: 'Volatility Volumetric Tracking', color: 'var(--holo-cyan)', icon: <Zap className="w-5 h-5" /> },
                    { id: 'EMA', label: 'EMA-200', desc: 'Exponential Data Smoothing', color: 'var(--holo-gold)', icon: <Activity className="w-5 h-5" /> },
                    { id: 'BOLL', label: 'Bollinger', desc: 'Market Expansion Envelopes', color: 'var(--holo-cyan)', icon: <LayoutGrid className="w-5 h-5" /> },
                    { id: 'SAR', label: 'Para-SAR', desc: 'Structural Reversal Logic', color: 'var(--holo-magenta)', icon: <Shield className="w-5 h-5" /> },
                  ].map((ind) => {
                    const isActive = localMain === ind.id;
                    return (
                      <button
                        key={ind.id}
                        onClick={() => setLocalMain(isActive ? null : ind.id)}
                        className={cn(
                          "relative text-left p-5 rounded-3xl border transition-all duration-500 group overflow-hidden",
                          isActive ? "bg-[var(--holo-cyan)]/10 border-[var(--holo-cyan)]/50 shadow-inner" : "bg-black/40 border-white/5 hover:border-white/20"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500",
                            isActive ? "bg-[var(--holo-cyan)] text-black border-transparent" : "bg-white/5 text-white/20 border-white/5"
                          )}>
                             {ind.icon}
                          </div>
                          <div className="flex-1">
                            <h4 className={cn("text-[11px] font-black uppercase tracking-widest", isActive ? "text-white" : "text-white/40")}>{ind.label}</h4>
                            <p className="text-[9px] font-medium text-white/20 uppercase mt-1 tracking-tighter">{ind.desc}</p>
                          </div>
                          {isActive && <div className="w-2 h-2 rounded-full bg-[var(--holo-cyan)] shadow-[0_0_10px_var(--holo-cyan)]" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-Processor Layers */}
              <div className="space-y-6">
                 <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-[var(--holo-gold)]" />
                  <span className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em]">Sub-Processors</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'VOL', label: 'Volume', icon: <BarChart2 className="w-5 h-5" /> },
                    { id: 'RSI', label: 'RSI_IDX', icon: <Activity className="w-5 h-5" /> },
                    { id: 'MACD', label: 'MACD_OSC', icon: <TrendingUp className="w-5 h-5" /> },
                    { id: 'ATR', label: 'ATR_VOLA', icon: <Fingerprint className="w-5 h-5" /> },
                    { id: 'OBV', label: 'OBV_FLOW', icon: <Globe className="w-5 h-5" /> },
                    { id: 'KDJ', label: 'KDJ_TRK', icon: <Cpu className="w-5 h-5" /> },
                  ].map((ind) => {
                    const isActive = localSub.includes(ind.id);
                    return (
                      <button
                        key={ind.id}
                        onClick={() => toggleSub(ind.id)}
                        className={cn(
                          "relative p-5 rounded-3xl border transition-all duration-500 flex flex-col items-center gap-4 text-center",
                          isActive ? "bg-[var(--holo-gold)] text-black border-transparent shadow-[0_0_30px_rgba(252,213,53,0.2)]" : "bg-black/40 border-white/5 text-white/20 hover:border-white/20"
                        )}
                      >
                        <div className="relative">
                          {ind.icon}
                          {isActive && <div className="absolute -inset-2 rounded-full border border-black/20 animate-ping" />}
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">{ind.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
               {/* Global Optics Profile */}
               <div className="bg-black/40 rounded-[2.5rem] border border-white/5 p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 rotate-12 opacity-10">
                    <Palette className="w-48 h-48" />
                  </div>
                  
                  <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10">
                    <div>
                      <h4 className="text-[12px] font-black text-white uppercase tracking-[0.3em] mb-2">Lens Profile Configuration</h4>
                      <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest">Select hardware rendering style</p>
                    </div>
                    
                    <div className="flex bg-black/80 p-2 rounded-2xl border border-white/10 shrink-0">
                      {(['candle', 'line'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setLocalConfig({ ...localConfig, style: mode })}
                          className={cn(
                            "px-10 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.3em] transition-all duration-500",
                            localConfig.style === mode ? "bg-white/10 border border-white/20 text-white shadow-inner" : "text-white/20 hover:text-white/40"
                          )}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>
               </div>

               {/* Chromatic Offsets */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 <section className="space-y-5">
                   <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] border-l-2 border-[var(--holo-cyan)] pl-4">Chromatic: Pos</p>
                   <div className="space-y-3">
                      {hardwareSwitch(localConfig.candle.bull.style === 'hollow', 
                        () => setLocalConfig({...localConfig, candle: {...localConfig.candle, bull: {...localConfig.candle.bull, style: localConfig.candle.bull.style === 'hollow' ? 'solid' : 'hollow'}}}), 
                        "Vector Hollow Profile"
                      )}
                      {colorSwatch(localConfig.candle.bull.color, (c) => setLocalConfig({...localConfig, candle: {...localConfig.candle, bull: {...localConfig.candle.bull, color: c}}}))}
                   </div>
                 </section>

                 <section className="space-y-5">
                   <p className="text-[10px] font-black text-white/20 uppercase tracking-[0.5em] border-l-2 border-[var(--holo-magenta)] pl-4">Chromatic: Neg</p>
                   <div className="space-y-3">
                      {hardwareSwitch(localConfig.candle.bear.style === 'hollow', 
                        () => setLocalConfig({...localConfig, candle: {...localConfig.candle, bear: {...localConfig.candle.bear, style: localConfig.candle.bear.style === 'hollow' ? 'solid' : 'hollow'}}}), 
                        "Divergence Hollow Profile"
                      )}
                      {colorSwatch(localConfig.candle.bear.color, (c) => setLocalConfig({...localConfig, candle: {...localConfig.candle, bear: {...localConfig.candle.bear, color: c}}}))}
                   </div>
                 </section>
               </div>

               {/* Pattern Engine Expansion */}
               <div className="bg-[var(--holo-gold)]/5 rounded-[2.5rem] border border-[var(--holo-gold)]/20 p-8 space-y-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-[var(--holo-gold)]/10 border border-[var(--holo-gold)]/30 flex items-center justify-center text-[var(--holo-gold)]">
                        <Fingerprint className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.3em] text-[var(--holo-gold)]">Pattern Extraction Engine</span>
                    </div>
                    <div className="w-48">
                      {hardwareSwitch(localConfig.patternOverlay !== false, () => setLocalConfig({ ...localConfig, patternOverlay: localConfig.patternOverlay === false }), "Alpha Extract")}
                    </div>
                  </div>
                  
                  <div className="h-px bg-[var(--holo-gold)]/20" />
                  
                  <div className="flex items-center gap-8">
                     <span className="text-[9px] font-black text-white/20 uppercase tracking-widest whitespace-nowrap">Extraction Depth</span>
                     <input
                        type="range"
                        min="50" max="1000" step="50"
                        value={localConfig.patternLookback || 200}
                        onChange={(e) => setLocalConfig({ ...localConfig, patternLookback: parseInt(e.target.value) })}
                        className="range-slider-holo flex-1"
                        style={{ '--range-glow': 'var(--holo-gold-glow)' } as any}
                      />
                      <span className="text-[11px] font-mono text-[var(--holo-gold)] font-bold w-16 text-right">{localConfig.patternLookback || 200}B</span>
                  </div>
               </div>
            </div>
          )}

        </div>

        {/* Global Action Bar */}
        <div className="p-10 border-t border-white/5 bg-black/60 relative shrink-0">
          <div className="flex gap-6 relative z-10">
             <button
              onClick={onReset}
              className="flex-1 h-16 rounded-[1.5rem] bg-white/5 border border-white/10 text-white/40 font-black uppercase tracking-[0.3em] text-[11px] flex items-center justify-center gap-3 hover:bg-white/10 hover:text-white transition-all active:scale-[0.97]"
            >
              <RotateCcw className="w-5 h-5" /> 
              Purge Cache
            </button>
            <button
              onClick={handleApply}
              className="flex-[2] h-16 rounded-[1.5rem] protocol-btn-metallic text-black font-black uppercase tracking-[0.5em] text-[12px] flex items-center justify-center gap-4 group/apply active:scale-[0.98]"
            >
              <div className="absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent opacity-30" />
              <Check className="w-6 h-6" />
              Execute Protocol
              <div className="w-6 h-[1px] bg-black/20 group-hover/apply:w-12 transition-all" />
            </button>
          </div>
        </div>

        {/* Bottom Metadata */}
        <div className="px-10 py-3 bg-black border-t border-white/5 flex items-center justify-between opacity-30">
           <span className="text-[8px] font-mono text-white italic tracking-widest">Protocol: AI-ALPHA_OVERRIVE_INITIATED</span>
           <span className="text-[8px] font-mono text-white italic tracking-widest">System_Status: Stable</span>
        </div>
      </div>
    </div>
  );
};
