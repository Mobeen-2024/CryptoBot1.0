import React, { useState, useEffect } from 'react';

interface IndicatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMain: string | null;
  selectedSub: string[];
  onApply: (main: string | null, sub: string[]) => void;
}

export const IndicatorModal: React.FC<IndicatorModalProps> = ({
  isOpen, onClose, selectedMain, selectedSub, onApply
}) => {
  const [main, setMain] = useState<string | null>(selectedMain);
  const [sub, setSub] = useState<string[]>(selectedSub);

  useEffect(() => {
    if (isOpen) {
      setMain(selectedMain);
      setSub(selectedSub);
    }
  }, [isOpen, selectedMain, selectedSub]);

  if (!isOpen) return null;

  const mainIndicators = [
    { id: 'MA', title: 'MA', desc: 'Moving Average (SMA 20)' },
    { id: 'EMA', title: 'EMA', desc: 'Exponential Moving Average (200)' },
    { id: 'BOLL', title: 'BOLL', desc: 'Bollinger Bands (20, ±2σ)' },
    { id: 'SAR', title: 'SAR', desc: 'Parabolic SAR' },
    { id: 'SUPER', title: 'SUPER', desc: 'SuperTrend' },
    { id: 'ALLIGATOR', title: 'ALLIGATOR', desc: 'Bill Williams Alligator (Jaw/Teeth/Lips)' },
  ];

  const subIndicators = [
    { id: 'VOL', title: 'VOL', desc: 'Volume' },
    { id: 'MACD', title: 'MACD', desc: 'Moving Average Convergence Divergence' },
    { id: 'RSI', title: 'RSI', desc: 'Relative Strength Index' },
    { id: 'KDJ', title: 'KDJ', desc: 'KDJ Indicator' },
    { id: 'WR', title: 'WR', desc: 'Williams %R' },
    { id: 'OBV', title: 'OBV', desc: 'On-Balance Volume' },
    { id: 'StochRSI', title: 'StochRSI', desc: 'Stochastic RSI' },
  ];

  const handleApply = () => {
    onApply(main, sub);
    onClose();
  };

  const toggleSub = (id: string) => {
    setSub(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="fixed inset-0 z-[200] flex justify-center md:items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[#1e2329] w-full max-w-sm md:max-w-md absolute bottom-0 md:relative md:bottom-auto rounded-t-[20px] md:rounded-[20px] shadow-2xl flex flex-col font-sans animate-in slide-in-from-bottom md:zoom-in-95 border-t md:border border-white/10"
        onClick={e => e.stopPropagation()}
        style={{ maxHeight: '90vh' }}
      >
        {/* Handle */}
        <div className="w-full flex justify-center py-3 pb-1 md:hidden">
          <div className="w-8 h-1 bg-[#474d57] rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-5 pb-3 pt-2 md:pt-5 flex justify-between items-center border-b border-white/5">
          <h2 className="text-white text-base font-bold">Indicator Settings</h2>
          <button onClick={onClose} className="text-[#848e9c] p-1 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 custom-scrollbar" style={{ maxHeight: 'calc(90vh - 140px)' }}>
          {/* Main Indicators */}
          <div className="mb-6">
            <h3 className="text-xs font-bold text-[#848e9c] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="6.5"></line></svg>
              Main Indicators (Overlay)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {mainIndicators.map((ind) => {
                const isActive = main === ind.id;
                return (
                  <button
                    key={ind.id}
                    onClick={() => setMain(isActive ? null : ind.id)}
                    className={`relative p-2 py-2.5 rounded-lg border flex flex-col items-center justify-center transition-all ${isActive ? 'bg-[#fcd535]/10 border-[#fcd535] text-[#fcd535]' : 'bg-[#2b3139] border-transparent text-[#eaecef] hover:bg-[#474d57]'}`}
                    title={ind.desc}
                  >
                    <span className="font-bold text-[13px] tracking-wide">{ind.title}</span>
                    {isActive && (
                      <div className="absolute -top-1.5 -right-1.5 bg-[#fcd535] text-black w-4 h-4 rounded-full flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Sub Indicators */}
          <div>
            <h3 className="text-xs font-bold text-[#848e9c] uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
              Sub Indicators (Oscillators)
            </h3>
            <div className="grid grid-cols-3 gap-2">
              {subIndicators.map((ind) => {
                const isActive = sub.includes(ind.id);
                return (
                  <button
                    key={ind.id}
                    onClick={() => toggleSub(ind.id)}
                    className={`relative p-2 py-2.5 rounded-lg border flex flex-col items-center justify-center transition-all ${isActive ? 'bg-[#fcd535]/10 border-[#fcd535] text-[#fcd535]' : 'bg-[#2b3139] border-transparent text-[#eaecef] hover:bg-[#474d57]'}`}
                    title={ind.desc}
                  >
                    <span className="font-bold text-[13px] tracking-wide">{ind.title}</span>
                    {isActive && (
                      <div className="absolute -top-1.5 -right-1.5 bg-[#fcd535] text-black w-4 h-4 rounded-full flex items-center justify-center">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 px-5 border-t border-white/5 bg-[#181a20] rounded-b-[20px] shrink-0">
           <button 
             onClick={handleApply}
             className="w-full bg-[#fcd535] text-black font-bold py-3.5 rounded-[12px] hover:brightness-110 active:scale-95 transition-all uppercase tracking-wide text-sm shadow-lg shadow-[#fcd535]/10"
           >
             Apply Indicators
           </button>
        </div>
      </div>
    </div>
  )
}
