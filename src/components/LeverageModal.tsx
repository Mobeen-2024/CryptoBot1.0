import React, { useState, useEffect } from 'react';

interface LeverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLeverage: number;
  onConfirm: (leverage: number) => void;
  marginMode: 'Cross' | 'Isolated';
  availableBalance: number;
}

export const LeverageModal: React.FC<LeverageModalProps> = ({ 
  isOpen, 
  onClose, 
  initialLeverage, 
  onConfirm,
  marginMode,
  availableBalance
}) => {
  const [leverage, setLeverage] = useState(initialLeverage);
  const steps = [1, 3, 5, 7, 10];

  useEffect(() => {
    if (isOpen) {
      setLeverage(initialLeverage);
    }
  }, [isOpen, initialLeverage]);

  if (!isOpen) return null;

  const handleDecrease = () => setLeverage(prev => Math.max(1, prev - 1));
  const handleIncrease = () => setLeverage(prev => Math.min(10, prev + 1));

  // Find the closest step to the left for the active track width
  const activeStepIndex = steps.findIndex(s => s >= leverage);
  const lastValidIndex = activeStepIndex === -1 ? steps.length - 1 : (steps[activeStepIndex] === leverage ? activeStepIndex : Math.max(0, activeStepIndex - 1));
  const sliderPercentage = (leverage - 1) / (10 - 1) * 100;

  return (
    <div className="fixed inset-0 z-[200] flex justify-center md:items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="glass-panel w-full max-w-sm absolute bottom-0 md:relative md:bottom-auto rounded-t-[20px] md:rounded-[20px] shadow-2xl flex flex-col font-sans animate-in slide-in-from-bottom md:zoom-in-95 border-t md:border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-full flex justify-center py-3 md:hidden">
          <div className="w-8 h-1 bg-[#474d57] rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-5 pb-4 md:pt-6 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold">Adjust {marginMode} Max Leverage</h2>
          {/* Yellow switch mock */}
          <div className="w-8 h-4 bg-[var(--holo-gold)] rounded-full relative cursor-pointer opacity-80 overflow-hidden">
            <div className="absolute right-0.5 top-0.5 w-3 h-3 glass-panel rounded-full"></div>
          </div>
        </div>

        {/* Adjustment Box */}
        <div className="px-5 mb-8">
          <div className="bg-white/5 rounded-[12px] h-20 flex items-center justify-between px-4 mt-2 border border-transparent hover:border-white/10 transition-colors relative">
            <button 
              onClick={handleDecrease}
              className="text-[#848e9c] hover:text-white hover:bg-white/5 w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <div className="flex bg-transparent items-baseline gap-1">
              <span className="text-white text-4xl font-bold font-mono tracking-tight">{leverage}</span>
              <span className="text-white text-xl font-bold font-mono">x</span>
            </div>
            <button 
              onClick={handleIncrease}
              className="text-[#848e9c] hover:text-white hover:bg-white/5 w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        </div>

        {/* Leverage Slider */}
        <div className="px-8 mb-10">
          <div className="relative w-full h-[2px] bg-white/5 flex items-center mb-6">
            {/* Active Track */}
            <div 
              className={`absolute left-0 h-[2px] transition-colors ${leverage >= 8 ? 'bg-var(--holo-magenta)' : leverage >= 5 ? 'bg-[var(--holo-gold)]' : 'bg-[var(--holo-cyan)]'}`}
              style={{ width: `${sliderPercentage}%` }}
            ></div>

            {/* Steps Track */}
            {steps.map((stepNode) => {
              const posPercent = ((stepNode - 1) / 9) * 100;
              const isPast = leverage >= stepNode;
              const isCurrent = leverage === stepNode;
              
              let currentBorder = 'border-[var(--holo-cyan)]';
              let pastBg = 'bg-[var(--holo-cyan)]';
              
              if (leverage >= 8) {
                currentBorder = 'border-var(--holo-magenta)';
                pastBg = 'bg-var(--holo-magenta)';
              } else if (leverage >= 5) {
                currentBorder = 'border-[var(--holo-gold)]';
                pastBg = 'bg-[var(--holo-gold)]';
              }
              
              return (
                <div 
                  key={stepNode} 
                  className="absolute"
                  style={{ left: `${posPercent}%`, transform: 'translateX(-50%)' }}
                >
                  <div 
                    className="cursor-pointer"
                    onClick={() => setLeverage(stepNode)}
                  >
                    <div 
                      className={`w-3.5 h-3.5 flex items-center justify-center transition-colors`}
                      style={{ transform: 'rotate(45deg)' }}
                    >
                      <div className={`w-full h-full border-[2px] ${isCurrent ? `${currentBorder} glass-panel` : isPast ? `border-transparent ${pastBg}` : 'border-white/10 glass-panel'}`}></div>
                    </div>
                  </div>
                  <div className={`absolute text-xs font-mono -left-1 top-4 transition-colors ${isCurrent ? 'text-white font-bold' : 'text-[#848e9c]'}`}>{stepNode}x</div>
                </div>
              );
            })}
            
            <input 
              type="range" min="1" max="10" step="1" value={leverage} onChange={(e) => setLeverage(Number(e.target.value))}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 mt-auto bg-black/40 pt-4 border-t border-white/10 rounded-b-[20px]">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-[#848e9c]">Max Borrowable</span>
            <span className="text-sm text-[#eaecef] font-bold font-mono">Approx. {(availableBalance * leverage).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</span>
          </div>
          
          <div className="mb-4 bg-black/20 p-3 rounded-lg border border-white/5">
            <p className={`text-[12px] leading-relaxed ${leverage >= 8 ? 'text-var(--holo-magenta) font-medium' : leverage >= 5 ? 'text-amber-400 font-medium' : 'text-[#848e9c]'}`}>
              {leverage >= 8 ? 
                `High Risk Warning: Selecting ${leverage}x leverage significantly increases liquidation probability. Ensure strict margin maintenance.` : 
               leverage >= 5 ? 
                `Moderate Risk: ${leverage}x leverage amplifies volatility. Carefully manage your stop losses.` : 
                `Standard Risk: Normal margin borrow limits active. Always manage your risk level.`
              } <span className="text-[var(--holo-gold)] cursor-pointer hover:underline text-[11px] font-normal ml-1">Learn More</span>
            </p>
          </div>

          <button 
            onClick={() => onConfirm(leverage)}
            className={`w-full font-bold py-3.5 rounded-[12px] hover:brightness-110 active:scale-[0.98] transition-all text-sm uppercase tracking-wide border-transparent border shadow-lg ${leverage >= 8 ? 'bg-var(--holo-magenta)/20 text-var(--holo-magenta) border-var(--holo-magenta)/50 hover:bg-var(--holo-magenta) hover:text-white' : 'bg-[var(--holo-gold)] text-black'}`}
          >
            Confirm {leverage}x Leverage
          </button>
        </div>
      </div>
    </div>
  );
};
