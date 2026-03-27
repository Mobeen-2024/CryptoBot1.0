import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Check, MousePointer2, Type, LayoutGrid, Palette, Sliders, Activity, TrendingUp, Cpu, BarChart2 } from 'lucide-react';
import { ChartConfig, DEFAULT_CHART_CONFIG } from '../types/chart';

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
    <div className="flex items-center gap-2">
      <div className="relative w-8 h-8 group rounded-full p-[2px] bg-gradient-to-br from-white/20 to-white/5 shadow-[0_4px_10px_rgba(0,0,0,0.5)]">
        <input
          type="color"
          value={color.startsWith('#') ? color : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
        />
        <div
          className="w-full h-full rounded-full border border-black/50 transition-transform group-hover:scale-110 z-10"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}40` }}
        />
      </div>
      <span className="text-[9px] font-mono font-bold text-[#848e9c] uppercase tracking-widest">{color}</span>
    </div>
  );

  const cyberToggle = (active: boolean, onToggle: () => void, label1: string, label2: string) => (
    <div className="flex bg-black/60 rounded-lg p-1 border border-white/5 relative shadow-inner">
      <div
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] bg-gradient-to-r from-[var(--holo-cyan)] to-[var(--holo-cyan)] opacity-20 rounded-md transition-all duration-300 ease-out z-0"
        style={{ left: active ? '4px' : 'calc(50%)' }}
      />
      <div
        className="absolute top-1 bottom-1 w-[calc(50%-4px)] border border-[var(--holo-cyan)]/50 rounded-md transition-all duration-300 ease-out z-0 shadow-[0_0_10px_var(--holo-cyan-glow)]"
        style={{ left: active ? '4px' : 'calc(50%)' }}
      />
      <button
        onClick={() => !active && onToggle()}
        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md relative z-10 transition-colors ${
          active ? 'text-[var(--holo-cyan)]' : 'text-[#5e6673] hover:text-[#848e9c]'
        }`}
      >
        {label1}
      </button>
      <button
        onClick={() => active && onToggle()}
        className={`flex-1 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-md relative z-10 transition-colors ${
          !active ? 'text-[var(--holo-cyan)]' : 'text-[#5e6673] hover:text-[#848e9c]'
        }`}
      >
        {label2}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 pointer-events-none">
      {/* Deep Blur Backdrop */}
      <div
        className={`absolute inset-0 bg-[#050b14]/80 backdrop-blur-md transition-opacity duration-300 pointer-events-auto ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* 2050 HUD Container */}
      <div
        className={`relative w-full max-w-2xl bg-[#0a0f1a]/95 backdrop-blur-3xl rounded-2xl border border-[var(--holo-cyan)]/30 shadow-[0_0_50px_rgba(0,0,0,0.8),inset_0_0_30px_rgba(0,229,255,0.05)] transform transition-all duration-500 ease-out pointer-events-auto overflow-hidden flex flex-col ${
          isOpen ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-8'
        }`}
        style={{ maxHeight: 'calc(100vh - 40px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Aesthetic Layers */}
        <div className="scan-lines" />
        <div className="noise-grain" />
        <div className="grid-pattern opacity-30" />

        {/* Floating Neon Orbs */}
        <div className="absolute -top-32 -left-32 w-64 h-64 bg-[var(--holo-cyan)]/20 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-64 h-64 bg-[var(--holo-magenta)]/20 rounded-full blur-[100px] pointer-events-none" />

        {/* Header Ribbon */}
        <div className="h-1 w-full bg-gradient-to-r from-[var(--holo-cyan)] via-[var(--holo-magenta)] to-[var(--holo-cyan)] opacity-70" />

        <div className="flex flex-col h-full relative z-10">

          {/* Header & Tabs */}
          <div className="px-6 py-5 border-b border-white/10 flex flex-col gap-5 sm:flex-row sm:items-center justify-between shrink-0 bg-black/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl glass-card flex items-center justify-center border border-[var(--holo-cyan)]/30 shadow-[0_0_15px_var(--holo-cyan-glow)]">
                <Sliders className="w-5 h-5 text-[var(--holo-cyan)]" />
              </div>
              <div>
                <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">System Override</h2>
                <div className="text-[9px] font-mono font-bold text-[#00E5FF]/60 tracking-widest mt-0.5">CFG // CHART_PARAMETERS</div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex bg-black/50 p-1 rounded-xl border border-white/5 shadow-inner">
                <button
                  onClick={() => setActiveTab('indicators')}
                  className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-all duration-300 ${activeTab === 'indicators' ? 'bg-[var(--holo-cyan)] text-black shadow-[0_0_15px_var(--holo-cyan-glow)] scale-105' : 'text-[#848e9c] hover:text-white hover:bg-white/5'}`}
                >
                  Modules
                </button>
                <button
                  onClick={() => setActiveTab('style')}
                  className={`px-5 py-2 rounded-lg text-xs font-black uppercase tracking-[0.15em] transition-all duration-300 ${activeTab === 'style' ? 'bg-[var(--holo-gold)] text-black shadow-[0_0_15px_var(--holo-gold-glow)] scale-105' : 'text-[#848e9c] hover:text-white hover:bg-white/5'}`}
                >
                  Visuals
                </button>
              </div>
              <button onClick={onClose} className="p-2 rounded-lg bg-black/40 border border-white/10 hover:border-white/30 text-gray-400 hover:text-white transition-all shadow-md active:scale-95">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

            {/* INDICATORS TAB */}
            {activeTab === 'indicators' && (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">

                {/* Main Overlay */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                    <Activity className="w-4 h-4 text-[#848e9c]" />
                    <span className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.2em]">Core Overlay Algorithms</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { id: 'SUPER', label: 'Supertrend', desc: 'Volatility-based trailing stop', color: 'var(--holo-cyan)' },
                      { id: 'EMA', label: 'EMA 200', desc: 'Exponential Moving Average', color: 'var(--holo-gold)' },
                      { id: 'MA', label: 'SMA 50', desc: 'Simple Moving Average', color: 'var(--holo-gold)' },
                      { id: 'BOLL', label: 'Bollinger Bands', desc: 'Volatility Bands (20, 2)', color: 'var(--holo-cyan)' },
                      { id: 'SAR', label: 'Parabolic SAR', desc: 'Stop and Reverse Trailing', color: 'var(--holo-magenta)' },
                      { id: 'ALLIGATOR', label: 'Williams Alligator', desc: 'Trend confirmation lines', color: 'var(--holo-gold)' },
                    ].map((ind) => {
                      const isActive = localMain === ind.id;
                      return (
                        <button
                          key={ind.id}
                          onClick={() => setLocalMain(isActive ? null : ind.id)}
                          className={`relative text-left p-4 rounded-xl border transition-all duration-300 group overflow-hidden ${
                            isActive
                              ? `bg-[${ind.color}]/10 border-[${ind.color}]/50 shadow-[0_4px_20px_${ind.color}20,inset_0_0_15px_${ind.color}10]`
                              : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className={`absolute top-0 left-0 w-1 h-full transition-colors ${isActive ? `bg-[${ind.color}] shadow-[0_0_10px_${ind.color}]` : 'bg-transparent group-hover:bg-white/10'}`} />

                          <div className="flex justify-between items-start mb-1.5 pl-2">
                            <span className={`text-[12px] font-black uppercase tracking-widest ${isActive ? `text-[${ind.color}] drop-shadow-[0_0_8px_${ind.color}80]` : 'text-gray-300'}`}>
                              {ind.label}
                            </span>
                            {isActive && (
                              <div className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest border bg-[${ind.color}]/20 text-[${ind.color}] border-[${ind.color}]/40`}>
                                ACTIVE // NODE
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 font-medium pl-2">{ind.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sub Oscillators */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                    <TrendingUp className="w-4 h-4 text-[#848e9c]" />
                    <span className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.2em]">Sub-Chart Oscillators</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { id: 'VOL', label: 'Volume', icon: BarChart2, color: 'var(--holo-cyan)' },
                      { id: 'RSI', label: 'RSI', icon: Activity, color: 'var(--holo-cyan)' },
                      { id: 'MACD', label: 'MACD', icon: TrendingUp, color: 'var(--holo-cyan)' },
                      { id: 'ATR', label: 'ATR', icon: Activity, color: 'var(--holo-gold)' },
                      { id: 'WR', label: 'Williams %R', icon: TrendingUp, color: 'var(--holo-magenta)' },
                      { id: 'OBV', label: 'OBV', icon: BarChart2, color: 'var(--holo-cyan)' },
                      { id: 'STOCHRSI', label: 'Stoch RSI', icon: Activity, color: 'var(--holo-cyan)' },
                      { id: 'KDJ', label: 'KDJ', icon: TrendingUp, color: 'var(--holo-gold)' },
                    ].map((ind) => {
                      const isActive = localSub.includes(ind.id);
                      const Icon = ind.icon;
                      return (
                        <button
                          key={ind.id}
                          onClick={() => toggleSub(ind.id)}
                          className={`relative flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-300 group overflow-hidden ${
                            isActive
                              ? `bg-[${ind.color}]/10 border-[${ind.color}]/50 shadow-[0_4px_20px_${ind.color}30]`
                              : 'bg-black/40 border-white/5 hover:border-white/20 hover:bg-white/[0.02]'
                          }`}
                        >
                          {isActive && <div className={`absolute inset-0 bg-gradient-to-t from-[${ind.color}]/10 to-transparent pointer-events-none`} />}

                          <Icon className={`w-5 h-5 mb-2 transition-colors ${isActive ? `text-[${ind.color}] drop-shadow-[0_0_8px_${ind.color}]` : 'text-[#5e6673] group-hover:text-gray-400'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${isActive ? `text-[${ind.color}]` : 'text-gray-400'}`}>
                            {ind.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* STYLE TAB */}
            {activeTab === 'style' && (
              <div className="space-y-8 animate-in fade-in zoom-in-95 duration-300">

                {/* Main Render Type */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-2xl bg-black/40 border border-white/5 shadow-lg relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--holo-gold)]/5 rounded-full blur-3xl" />
                  <div className="relative z-10">
                    <span className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.2em] block mb-1">Canvas Render Mode</span>
                    <h3 className="text-white text-sm font-bold tracking-wider">Primary Chart Structure</h3>
                  </div>
                  <div className="relative z-10 bg-black/60 p-1.5 rounded-xl border border-white/10 flex shadow-inner w-full sm:w-auto">
                    {(['candle', 'line'] as const).map(mode => (
                      <button
                        key={mode}
                        onClick={() => setLocalConfig({ ...localConfig, style: mode })}
                        className={`flex-1 sm:w-28 py-2.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all duration-300 ${
                          localConfig.style === mode
                            ? 'bg-gradient-to-b from-white/10 to-transparent border border-white/20 text-white shadow-lg'
                            : 'text-[#5e6673] hover:text-[#848e9c] border border-transparent'
                        }`}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sub Settings */}
                {localConfig.style === 'candle' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Bullish */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-black/60 to-black/40 border border-white/5 shadow-lg relative overflow-hidden group hover:border-[var(--holo-cyan)]/30 transition-colors">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[var(--holo-cyan)] shadow-[0_0_15px_var(--holo-cyan)]" />
                      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity">
                        <TrendingUp className="w-16 h-16 text-[var(--holo-cyan)]" />
                      </div>

                      <div className="relative z-10 space-y-5">
                        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Bullish Action</h3>

                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] font-bold text-[#5e6673] uppercase tracking-widest">Body Fill Protocol</span>
                          <div className="w-3/4">
                            {cyberToggle(
                              localConfig.candle.bull.style === 'hollow',
                              () => setLocalConfig({
                                ...localConfig,
                                candle: { ...localConfig.candle, bull: { ...localConfig.candle.bull, style: localConfig.candle.bull.style === 'hollow' ? 'solid' : 'hollow' } }
                              }),
                              'Solid', 'Hollow'
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                          <span className="text-[9px] font-bold text-[#5e6673] uppercase tracking-widest">Base Color</span>
                          {colorSwatch(localConfig.candle.bull.color, (color) => {
                            setLocalConfig({ ...localConfig, candle: { ...localConfig.candle, bull: { ...localConfig.candle.bull, color } } })
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Bearish */}
                    <div className="p-5 rounded-2xl bg-gradient-to-br from-black/60 to-black/40 border border-white/5 shadow-lg relative overflow-hidden group hover:border-[var(--holo-magenta)]/30 transition-colors">
                      <div className="absolute top-0 left-0 w-1 h-full bg-[var(--holo-magenta)] shadow-[0_0_15px_var(--holo-magenta)]" />
                      <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:opacity-40 transition-opacity rotate-180">
                        <TrendingUp className="w-16 h-16 text-[var(--holo-magenta)]" />
                      </div>

                      <div className="relative z-10 space-y-5">
                        <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">Bearish Action</h3>

                        <div className="flex flex-col gap-2">
                          <span className="text-[9px] font-bold text-[#5e6673] uppercase tracking-widest">Body Fill Protocol</span>
                          <div className="w-3/4">
                            {cyberToggle(
                              localConfig.candle.bear.style === 'hollow',
                              () => setLocalConfig({
                                ...localConfig,
                                candle: { ...localConfig.candle, bear: { ...localConfig.candle.bear, style: localConfig.candle.bear.style === 'hollow' ? 'solid' : 'hollow' } }
                              }),
                              'Solid', 'Hollow'
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 pt-2">
                          <span className="text-[9px] font-bold text-[#5e6673] uppercase tracking-widest">Base Color</span>
                          {colorSwatch(localConfig.candle.bear.color, (color) => {
                            setLocalConfig({ ...localConfig, candle: { ...localConfig.candle, bear: { ...localConfig.candle.bear, color } } })
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 rounded-2xl bg-black/40 border border-white/5 shadow-lg space-y-6 relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-[var(--holo-cyan)]/5 to-transparent opacity-50 pointer-events-none" />

                    <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.2em]">Trajectory Color</span>
                        {colorSwatch(localConfig.line.color, (color) => {
                          setLocalConfig({ ...localConfig, line: { ...localConfig.line, color } })
                        })}
                      </div>

                      <div className="w-full sm:w-1/2 flex flex-col gap-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.2em]">Stroke Thickness</span>
                          <span className="text-[10px] font-mono text-[var(--holo-cyan)] font-bold">{localConfig.line.width}px</span>
                        </div>
                        <input
                          type="range"
                          min="1" max="5" step="1"
                          value={localConfig.line.width}
                          onChange={(e) => setLocalConfig({ ...localConfig, line: { ...localConfig.line, width: parseInt(e.target.value) } })}
                          className="range-slider-holo"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Environment Grid */}
                <div className="pt-2">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-4">
                    <LayoutGrid className="w-4 h-4 text-[#848e9c]" />
                    <span className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.2em]">Global Environment</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 shadow-lg">
                      <span className="text-[9px] font-black text-[#5e6673] uppercase tracking-widest">Canvas Background</span>
                      {colorSwatch(localConfig.global.background, (color) => {
                        setLocalConfig({ ...localConfig, global: { ...localConfig.global, background: color } })
                      })}
                    </div>
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 shadow-lg">
                      <span className="text-[9px] font-black text-[#5e6673] uppercase tracking-widest">Grid Alpha Matrix</span>
                      {colorSwatch(localConfig.global.gridLines, (color) => {
                        setLocalConfig({ ...localConfig, global: { ...localConfig.global, gridLines: color } })
                      })}
                    </div>
                    <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3 shadow-lg col-span-2">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[9px] font-black text-[#5e6673] uppercase tracking-widest">Pattern Recognition Profile</span>
                        <div className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-mono text-[var(--holo-cyan)]">CANDLESTICK_BIBLE_V5</div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        <div className="space-y-2">
                          <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Main Toggle</span>
                          {cyberToggle(
                            localConfig.patternOverlay !== false,
                            () => setLocalConfig({ ...localConfig, patternOverlay: localConfig.patternOverlay === false }),
                            'ON', 'OFF'
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Detection Depth</span>
                            <span className="text-[9px] font-mono text-[var(--holo-gold)] font-bold">{localConfig.patternLookback || 200} Bars</span>
                          </div>
                          <input
                            type="range"
                            min="50" max="1000" step="50"
                            value={localConfig.patternLookback || 200}
                            onChange={(e) => setLocalConfig({ ...localConfig, patternLookback: parseInt(e.target.value) })}
                            className="range-slider-holo"
                            style={{ 
                                accentColor: 'var(--holo-gold)',
                                '--range-glow': 'var(--holo-gold-glow)' 
                            } as any}
                          />
                        </div>

                        <div className="space-y-2 mt-1 px-1">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Visual Feedback</span>
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center justify-between p-2 rounded-lg bg-white/[0.03] border border-white/5">
                                <span className="text-[10px] text-white/60 font-medium">Highlight Box</span>
                                <div className="w-24">
                                    {cyberToggle(
                                        localConfig.showPatternBox !== false,
                                        () => setLocalConfig({ ...localConfig, showPatternBox: localConfig.showPatternBox === false }),
                                        'ON', 'OFF'
                                    )}
                                </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            )}

          </div>

          {/* Footer Ribbon Buttons */}
          <div className="p-5 border-t border-white/10 bg-black/40 backdrop-blur-3xl shrink-0 flex gap-4">
            <button
              onClick={onReset}
              className="flex-[1] h-12 sm:h-14 rounded-xl border border-white/10 text-gray-300 font-bold uppercase tracking-[0.2em] text-[10px] sm:text-[11px] flex items-center justify-center gap-2 hover:bg-white/5 hover:text-white transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={handleApply}
              className={`flex-[2] h-12 sm:h-14 rounded-xl font-black uppercase tracking-[0.2em] text-[10px] sm:text-[11px] flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(0,0,0,0.5)] active:scale-[0.98] ${
                activeTab === 'style'
                  ? 'bg-[var(--holo-gold)] text-black shadow-[0_0_20px_var(--holo-gold-glow)] hover:brightness-110'
                  : 'bg-[var(--holo-cyan)] text-black shadow-[0_0_20px_var(--holo-cyan-glow)] hover:brightness-110'
              }`}
            >
              <Check className="w-5 h-5" />
              EXECUTE PROTOCAL
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
