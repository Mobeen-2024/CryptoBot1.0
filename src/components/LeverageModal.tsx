import React, { useState, useEffect } from 'react';

interface LeverageModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLeverage: number;
  onConfirm: (leverage: number) => void;
  marginMode: 'Cross' | 'Isolated';
}

export const LeverageModal: React.FC<LeverageModalProps> = ({ 
  isOpen, 
  onClose, 
  initialLeverage, 
  onConfirm,
  marginMode
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
    <div className="fixed inset-0 z-[200] flex justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-[#1e2329] w-full max-w-sm absolute bottom-0 rounded-t-[20px] shadow-2xl flex flex-col font-sans animate-in slide-in-from-bottom border-t border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-full flex justify-center py-3">
          <div className="w-8 h-1 bg-[#474d57] rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-5 pb-4 flex justify-between items-center">
          <h2 className="text-white text-lg font-bold">Adjust {marginMode} Max Leverage</h2>
          {/* Yellow switch mock */}
          <div className="w-8 h-4 bg-[#fcd535] rounded-full relative cursor-pointer opacity-80 overflow-hidden">
            <div className="absolute right-0.5 top-0.5 w-3 h-3 bg-[#1e2329] rounded-full"></div>
          </div>
        </div>

        {/* Adjustment Box */}
        <div className="px-5 mb-8">
          <div className="bg-[#2b3139] rounded-[12px] h-20 flex items-center justify-between px-4 mt-2 border border-transparent hover:border-[#474d57] transition-colors relative">
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
          <div className="relative w-full h-[2px] bg-[#2b3139] flex items-center mb-6">
            {/* Active Track */}
            <div 
              className="absolute left-0 h-[2px] bg-[#fcd535]" 
              style={{ width: `${sliderPercentage}%` }}
            ></div>

            {/* Steps Track */}
            {steps.map((stepNode) => {
              const posPercent = ((stepNode - 1) / 9) * 100;
              const isPast = leverage >= stepNode;
              const isCurrent = leverage === stepNode;
              
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
                      <div className={`w-full h-full border-[2px] ${isCurrent ? 'border-[#fcd535] bg-[#1e2329]' : isPast ? 'border-transparent bg-[#fcd535]' : 'border-[#474d57] bg-[#1e2329]'}`}></div>
                    </div>
                  </div>
                  <div className="absolute text-[#848e9c] text-xs font-mono -left-1 top-4">{stepNode}x</div>
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
        <div className="px-5 pb-5 mt-auto bg-[#181a20] pt-4 border-t border-[#2b3139] rounded-b-[20px]">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-[#848e9c]">Max Borrowable</span>
            <span className="text-xs text-[#848e9c] font-mono">Approx. {(1000 * leverage).toLocaleString()} USDT</span>
          </div>
          
          <div className="mb-4">
            <p className="text-[12px] text-[#848e9c] leading-tight">
              Selecting higher leverage such as [10x] increases your liquidation risk. Always manage your risk level. <span className="text-[#fcd535] cursor-pointer hover:underline">Learn More</span>
            </p>
          </div>

          <button 
            onClick={() => onConfirm(leverage)}
            className="w-full bg-[#fcd535] text-black font-bold py-3.5 rounded-[12px] hover:brightness-110 active:scale-[0.98] transition-all text-sm uppercase tracking-wide"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
