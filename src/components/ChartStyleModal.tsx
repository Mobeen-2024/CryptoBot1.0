import React, { useState, useEffect } from 'react';
import { X, RotateCcw, Check, MousePointer2, Type, LayoutGrid, Palette, Sliders } from 'lucide-react';
import { ChartConfig, DEFAULT_CHART_CONFIG } from '../types/chart';

interface ChartStyleModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: ChartConfig;
  onApply: (config: ChartConfig) => void;
  onReset: () => void;
}

export const ChartStyleModal: React.FC<ChartStyleModalProps> = ({
  isOpen,
  onClose,
  config,
  onApply,
  onReset,
}) => {
  const [localConfig, setLocalConfig] = useState<ChartConfig>(config);

  useEffect(() => {
    if (isOpen) {
      setLocalConfig(config);
    }
  }, [isOpen, config]);

  if (!isOpen) return null;

  const handleApply = () => {
    onApply(localConfig);
    onClose();
  };

  const colorSwatch = (color: string, onChange: (color: string) => void) => (
    <div className="flex items-center gap-3">
      <div className="relative w-10 h-10 group">
        <input
          type="color"
          value={color.startsWith('#') ? color : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
        />
        <div 
          className="absolute inset-0 rounded-lg border border-white/20 shadow-lg transition-transform group-hover:scale-105 z-10"
          style={{ backgroundColor: color }}
        />
      </div>
      <span className="text-[10px] font-mono text-[#848e9c] uppercase">{color}</span>
    </div>
  );

  const toggleSwitch = (active: boolean, onToggle: () => void, label1: string, label2: string) => (
    <div className="flex bg-[#0b0e11] rounded-lg p-1 border border-[#2b3139]">
      <button
        onClick={() => !active && onToggle()}
        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
          active ? 'bg-[#fcd535] text-[#0b0e11]' : 'text-[#5e6673] hover:text-[#eaecef]'
        }`}
      >
        {label1}
      </button>
      <button
        onClick={() => active && onToggle()}
        className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${
          !active ? 'bg-[#fcd535] text-[#0b0e11]' : 'text-[#5e6673] hover:text-[#eaecef]'
        }`}
      >
        {label2}
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Sheet Container */}
      <div 
        className={`relative w-full max-w-lg bg-[#181a20] rounded-t-3xl border-t border-white/10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] transform transition-transform duration-500 ease-out pointer-events-auto overflow-hidden flex flex-col ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ maxHeight: '85vh' }}
      >
        {/* Handle & Header */}
        <div className="flex flex-col items-center pt-3 pb-2 shrink-0">
          <div className="w-12 h-1.5 bg-[#2b3139] rounded-full mb-4" />
          <div className="flex items-center justify-between w-full px-6">
            <h2 className="text-lg font-black text-white uppercase tracking-[0.2em]">Style</h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-[#5e6673] hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-8 pb-32">
          
          {/* Main Toggle (Candle vs Line) */}
          <div className="flex flex-col gap-3">
            <span className="text-xs font-bold text-[#5e6673] uppercase tracking-widest">Chart Style</span>
            <div className="flex bg-[#0b0e11] rounded-xl p-1 border border-[#2b3139] w-full max-w-[240px]">
              <button
                onClick={() => setLocalConfig({ ...localConfig, style: 'candle' })}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  localConfig.style === 'candle' ? 'bg-[#fcd535] text-[#0b0e11] shadow-[0_4px_12px_rgba(252,213,53,0.2)]' : 'text-[#848e9c] hover:text-white'
                }`}
              >
                Candle
              </button>
              <button
                onClick={() => setLocalConfig({ ...localConfig, style: 'line' })}
                className={`flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all ${
                  localConfig.style === 'line' ? 'bg-[#fcd535] text-[#0b0e11] shadow-[0_4px_12px_rgba(252,213,53,0.2)]' : 'text-[#848e9c] hover:text-white'
                }`}
              >
                Line
              </button>
            </div>
          </div>

          {/* Conditional Sections */}
          {localConfig.style === 'candle' ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Bullish Settings */}
              <div className="p-4 rounded-2xl bg-[#0b0e11] border border-white/5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-4 rounded-sm bg-[#00E676]" />
                  <span className="text-sm font-bold text-white uppercase tracking-wider">Bullish Action</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#5e6673] uppercase font-bold tracking-widest">Body Style</span>
                    {toggleSwitch(
                      localConfig.candle.bull.style === 'hollow',
                      () => setLocalConfig({
                        ...localConfig,
                        candle: { 
                          ...localConfig.candle, 
                          bull: { ...localConfig.candle.bull, style: localConfig.candle.bull.style === 'hollow' ? 'solid' : 'hollow' } 
                        }
                      }),
                      'Hollow', 'Solid'
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-[#5e6673] uppercase font-bold tracking-widest text-right">Theme Color</span>
                    {colorSwatch(localConfig.candle.bull.color, (color) => {
                      setLocalConfig({
                        ...localConfig,
                        candle: { 
                          ...localConfig.candle, 
                          bull: { ...localConfig.candle.bull, color } 
                        }
                      })
                    })}
                  </div>
                </div>
              </div>

              {/* Bearish Settings */}
              <div className="p-4 rounded-2xl bg-[#0b0e11] border border-white/5 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-4 rounded-sm bg-[#FF1744]" />
                  <span className="text-sm font-bold text-white uppercase tracking-wider">Bearish Action</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] text-[#5e6673] uppercase font-bold tracking-widest">Body Style</span>
                    {toggleSwitch(
                      localConfig.candle.bear.style === 'hollow',
                      () => setLocalConfig({
                        ...localConfig,
                        candle: { 
                          ...localConfig.candle, 
                          bear: { ...localConfig.candle.bear, style: localConfig.candle.bear.style === 'hollow' ? 'solid' : 'hollow' } 
                        }
                      }),
                      'Hollow', 'Solid'
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-[#5e6673] uppercase font-bold tracking-widest text-right">Theme Color</span>
                    {colorSwatch(localConfig.candle.bear.color, (color) => {
                      setLocalConfig({
                        ...localConfig,
                        candle: { 
                          ...localConfig.candle, 
                          bear: { ...localConfig.candle.bear, color } 
                        }
                      })
                    })}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="p-4 rounded-2xl bg-[#0b0e11] border border-white/5 space-y-6">
                 <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-1.5">
                       <span className="text-xs font-bold text-white uppercase tracking-widest">Line Color</span>
                       <span className="text-[10px] text-[#5e6673] uppercase tracking-wider">Main price trajectory</span>
                    </div>
                    {colorSwatch(localConfig.line.color, (color) => {
                      setLocalConfig({
                        ...localConfig,
                        line: { ...localConfig.line, color }
                      })
                    })}
                 </div>

                 <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between">
                       <span className="text-xs font-bold text-white uppercase tracking-widest">Line Width</span>
                       <div className="flex bg-[#181a20] rounded-lg p-1 border border-[#2b3139]">
                          {[1, 2, 3, 4].map((w) => (
                            <button
                              key={w}
                              onClick={() => setLocalConfig({ ...localConfig, line: { ...localConfig.line, width: w } })}
                              className={`w-8 h-8 flex items-center justify-center rounded transition-all ${
                                localConfig.line.width === w ? 'bg-[#fcd535] text-[#0b0e11] font-black' : 'text-[#848e9c] hover:text-white'
                              }`}
                            >
                              {w}px
                            </button>
                          ))}
                       </div>
                    </div>
                 </div>
               </div>
            </div>
          )}

          {/* Global Environment Settings */}
          <div className="space-y-4 pt-4">
            <span className="text-xs font-bold text-[#5e6673] uppercase tracking-widest">Global Environment</span>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#0b0e11] border border-white/5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-cyan-400" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Background</span>
                </div>
                {colorSwatch(localConfig.global.background, (color) => {
                  setLocalConfig({
                    ...localConfig,
                    global: { ...localConfig.global, background: color }
                  })
                })}
              </div>

              <div className="p-4 rounded-2xl bg-[#0b0e11] border border-white/5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Palette className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest">Grid Lines</span>
                </div>
                {colorSwatch(localConfig.global.gridLines, (color) => {
                  setLocalConfig({
                    ...localConfig,
                    global: { ...localConfig.global, gridLines: color }
                  })
                })}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="absolute bottom-0 inset-x-0 p-6 bg-[#181a20] border-t border-white/10 flex gap-4">
          <button
            onClick={onReset}
            className="flex-1 h-14 rounded-xl border border-white/10 text-white font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/5 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
          <button
            onClick={handleApply}
            className="flex-[2] h-14 rounded-xl bg-[#fcd535] text-[#0b0e11] font-black uppercase tracking-[0.2em] flex items-center justify-center gap-2 shadow-[0_8px_24px_rgba(252,213,53,0.3)] hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <Check className="w-5 h-5" />
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
