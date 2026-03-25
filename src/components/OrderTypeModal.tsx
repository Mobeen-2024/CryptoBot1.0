import React, { useState, useEffect } from 'react';

interface OrderTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentType: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'OCO';
  onSelect: (type: 'LIMIT' | 'MARKET' | 'STOP_LIMIT' | 'OCO') => void;
}

export const OrderTypeModal: React.FC<OrderTypeModalProps> = ({
  isOpen,
  onClose,
  currentType,
  onSelect
}) => {
  if (!isOpen) return null;

  const types = [
    {
      id: 'LIMIT' as const,
      title: 'Limit',
      description: 'Buy or Sell at a specific price or better',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12" strokeDasharray="4 4" opacity="0.5"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>
    },
    {
      id: 'MARKET' as const,
      title: 'Market',
      description: 'Buy or Sell immediately at the best available current price',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" fill="currentColor" fillOpacity="0.2"/></svg>
    },
    {
      id: 'STOP_LIMIT' as const,
      title: 'Stop Limit',
      description: 'An order that has a stop price and a limit price',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" fillOpacity="0.1"/><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/></svg>
    },
    {
      id: 'OCO' as const,
      title: 'OCO',
      description: 'One-Cancels-the-Other: Combines a stop-limit order and a limit order',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6"/><path d="M6 15l6-6 6 6" opacity="0.4"/></svg>
    }
  ];

  return (
    <div className="fixed inset-0 z-[200] flex justify-center md:items-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="glass-panel w-full max-w-sm absolute bottom-0 md:relative md:bottom-auto rounded-t-[20px] md:rounded-[20px] shadow-2xl flex flex-col font-sans animate-in slide-in-from-bottom md:zoom-in-95 border-t md:border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="w-full flex justify-center py-3 pb-1 md:hidden">
          <div className="w-8 h-1 bg-[#474d57] rounded-full"></div>
        </div>

        {/* Header */}
        <div className="px-5 pb-2 pt-2 md:pt-5 flex justify-between items-center border-b border-white/5">
          <h2 className="text-white text-base font-bold">Select Order Type</h2>
          <button onClick={onClose} className="text-[#848e9c] p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* List */}
        <div className="px-3 py-2 mb-6 space-y-1">
          {types.map((type) => {
            const isActive = currentType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => {
                  onSelect(type.id);
                  onClose();
                }}
                className={`w-full text-left flex items-center justify-between p-3 rounded-xl transition-colors ${isActive ? 'bg-white/5' : 'hover:bg-white/5'}`}
              >
                <div className="flex gap-3 items-center w-full pr-2">
                  <div className={`shrink-0 flex items-center justify-center w-8 h-8 rounded-full ${isActive ? 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)]' : 'bg-[#2b3139] text-[#848e9c]'}`}>
                    {type.icon}
                  </div>
                  <div className="flex flex-col gap-0.5 max-w-[260px]">
                    <span className={`font-bold ${isActive ? 'text-[var(--holo-cyan)]' : 'text-white'}`}>
                      {type.title}
                    </span>
                    <span className="text-[11px] text-[#848e9c] leading-tight">
                      {type.description}
                    </span>
                  </div>
                </div>
                {isActive && (
                  <div className="ml-4 shrink-0">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--holo-cyan)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
