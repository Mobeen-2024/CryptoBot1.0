import React, { useState, useEffect } from 'react';
import { LeverageModal } from './LeverageModal';
import { OrderTypeModal } from './OrderTypeModal';

interface OrderPanelProps {
  symbol: string;
  currentPrice: number;
  balance: number;
  baseBalance: number;
  onPlaceOrder: (order: { 
    side: 'BUY' | 'SELL', 
    type: 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'OCO', 
    quantity: number, 
    price?: number, 
    stopPrice?: number, 
    limitPrice?: number,
    marginMode: 'Cross' | 'Isolated',
    leverage: number,
    autoBorrow: boolean,
    autoRepay: boolean,
    takeProfit?: number,
    slTrigger?: number,
    slLimit?: number,
    isIceberg?: boolean
  }) => void;
}

type OrderState = {
  mode: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'STOP_LIMIT' | 'OCO';
  price: number | '';
  stopPrice: number | '';
  limitPrice: number | '';
  quantity: number | '';
  total: number | '';
  leverage: number;
  autoBorrow: boolean;
  autoRepay: boolean;
  showTPSL: boolean;
  takeProfit: number | '';
  slTrigger: number | '';
  slLimit: number | '';
  isIceberg: boolean;
};

export const OrderPanel: React.FC<OrderPanelProps> = ({ symbol, currentPrice, balance, baseBalance, onPlaceOrder }) => {
  const baseAsset = symbol.replace('USDT', '');
  const quoteAsset = 'USDT';
  
  const [marginMode, setMarginMode] = useState<'Cross' | 'Isolated'>('Cross');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [riskAccepted, setRiskAccepted] = useState(false);
  const [isSpotMargin, setIsSpotMargin] = useState(false);
  const [isLeverageModalOpen, setIsLeverageModalOpen] = useState(false);
  const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);

  // Unified state object
  const [os, setOs] = useState<OrderState>({
    mode: 'BUY',
    orderType: 'LIMIT',
    price: currentPrice,
    stopPrice: '',
    limitPrice: '',
    quantity: '',
    total: '',
    leverage: 10,
    autoBorrow: false,
    autoRepay: false,
    showTPSL: false,
    takeProfit: '',
    slTrigger: '',
    slLimit: '',
    isIceberg: false
  });

  const updateOs = (updates: Partial<OrderState>) => setOs(prev => ({ ...prev, ...updates }));

  const activeColor = os.mode === 'BUY' ? '#2ebd85' : '#f6465d';
  const focusBorderClass = os.mode === 'BUY' ? 'focus-within:border-[#2ebd85]' : 'focus-within:border-[#f6465d]';
  
  // Derived values
  const executionPrice = os.orderType === 'MARKET' 
    ? currentPrice 
    : os.orderType === 'STOP_LIMIT'
      ? (Number(os.limitPrice) || currentPrice)
      : (Number(os.price) || currentPrice);
  
  const tpTotal = os.quantity && os.takeProfit ? Number((Number(os.quantity) * Number(os.takeProfit)).toFixed(4)) : 0;
  const slTotal = os.quantity && os.slTrigger ? Number((Number(os.quantity) * Number(os.slTrigger)).toFixed(4)) : 0;
  
  // Max calculations
  const avbl = os.mode === 'BUY' ? balance : baseBalance;
  const effectiveLeverage = Math.max(1, isSpotMargin ? os.leverage : 1); // Treat 0x as 1x for math purposes so we don't get 0 max
  const maxUsdt = os.mode === 'BUY' ? avbl * effectiveLeverage : 0;
  const maxQuantity = os.mode === 'BUY' 
    ? (executionPrice > 0 ? (avbl * effectiveLeverage) / executionPrice : 0)
    : (baseBalance * effectiveLeverage);

  // Dynamically calculate slider percentage based on current quantity and max quantity
  const balancePercentage = os.quantity ? Math.min(100, Math.max(0, (Number(os.quantity) / maxQuantity) * 100)) : 0;

  // Update price if market
  useEffect(() => {
    if (os.orderType === 'MARKET') {
      updateOs({ price: currentPrice });
      if (os.quantity && currentPrice > 0) {
        updateOs({ total: Number((Number(os.quantity) * currentPrice).toFixed(4)) });
      }
    }
  }, [currentPrice, os.orderType]);

  // Handlers
  const handlePriceChange = (val: string) => {
    const p = val ? Number(val) : '';
    const newTotal = p && os.quantity ? Number((Number(p) * Number(os.quantity)).toFixed(4)) : '';
    updateOs({ price: p, total: newTotal });
  };

  const handleLimitPriceChange = (val: string) => {
    const lp = val ? Number(val) : '';
    if (os.orderType === 'STOP_LIMIT') {
      const newTotal = lp && os.quantity ? Number((Number(lp) * Number(os.quantity)).toFixed(4)) : '';
      updateOs({ limitPrice: lp, total: newTotal });
    } else {
      updateOs({ limitPrice: lp });
    }
  };

  const handleQuantityChange = (val: string) => {
    const q = val ? Number(val) : '';
    const newTotal = q && executionPrice > 0 ? Number((Number(q) * executionPrice).toFixed(4)) : '';
    updateOs({ quantity: q, total: newTotal });
  };

  const handleTotalChange = (val: string) => {
    const t = val ? Number(val) : '';
    const q = t && executionPrice > 0 ? Number((Number(t) / executionPrice).toFixed(4)) : '';
    updateOs({ total: t, quantity: q });
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let pct = Number(e.target.value);
    
    // Magnetic Snap Logic
    const snapPoints = [0, 25, 50, 75, 100];
    const snapThreshold = 4;
    for (const point of snapPoints) {
      if (Math.abs(pct - point) <= snapThreshold) {
        pct = point;
        break;
      }
    }

    const q = Number(((maxQuantity * pct) / 100).toFixed(4));
    const t = q && executionPrice > 0 ? Number((q * executionPrice).toFixed(4)) : '';
    updateOs({ quantity: q || '', total: t || '' });
  };

  const setBBO = () => {
    updateOs({ price: currentPrice });
    if (os.quantity && currentPrice > 0) {
      updateOs({ total: Number((Number(os.quantity) * currentPrice).toFixed(4)) });
    }
  };

  const stepPrice = (field: 'price' | 'limitPrice' | 'stopPrice', increment: boolean) => {
    let current = Number(os[field]) || currentPrice;
    let stepAmount = 1; // You could determine tick size based on currentPrice, hardcoded 1 for simplicity right now
    if (current < 1) stepAmount = 0.001;
    else if (current < 10) stepAmount = 0.01;
    else stepAmount = 0.1;

    let next = increment ? current + stepAmount : current - stepAmount;
    if (next < 0) next = 0;
    
    // Format to avoid long float trailing decimals
    next = Number(next.toFixed(current < 1 ? 4 : 2));
    
    updateOs({ [field]: next });
    
    // Automatically update total if adjusting regular price and quantity exists
    if (field === 'price' && os.quantity) {
      updateOs({ total: Number((Number(os.quantity) * next).toFixed(4)) });
    }
  };

  const setMaxQuantity = () => {
    if (maxQuantity > 0) {
      const q = Math.floor(maxQuantity * 10000) / 10000; // Floor to 4 decimals to avoid tiny rounding errors pushing over balance
      const t = executionPrice > 0 ? Number((q * executionPrice).toFixed(4)) : '';
      updateOs({ quantity: q, total: t });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRiskAccepted(false); // Reset risk acceptance when opening modal
    setShowConfirmModal(true);
  };

  const confirmOrder = () => {
    onPlaceOrder({ 
      side: os.mode, 
      type: os.orderType, 
      quantity: Number(os.quantity), 
      price: os.orderType === 'LIMIT' || os.orderType === 'OCO' ? Number(os.price) : undefined,
      stopPrice: os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? Number(os.stopPrice) : undefined,
      limitPrice: os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? Number(os.limitPrice) : undefined,
      marginMode: isSpotMargin ? marginMode : undefined,
      leverage: isSpotMargin ? os.leverage : undefined,
      autoBorrow: isSpotMargin ? os.autoBorrow : undefined,
      autoRepay: isSpotMargin ? os.autoRepay : undefined,
      takeProfit: (os.orderType === 'STOP_LIMIT' || os.showTPSL) && os.takeProfit ? Number(os.takeProfit) : undefined,
      slTrigger: os.showTPSL && os.slTrigger ? Number(os.slTrigger) : undefined,
      slLimit: os.showTPSL && os.slLimit ? Number(os.slLimit) : undefined,
      isIceberg: os.isIceberg
    });
    setShowConfirmModal(false);
  };

  // Validation
  let isInvalid = false;
  let validationError = '';

  const getPriceDelta = () => {
    if (os.orderType === 'MARKET' || !os.price || currentPrice === 0) return null;
    return (((Number(os.price) - currentPrice) / currentPrice) * 100).toFixed(2);
  };
  const priceDelta = getPriceDelta();

  const quantity = Number(os.quantity);
  const price = Number(os.price);
  const total = Number(os.total);
  const stopPrice = Number(os.stopPrice);
  const limitPrice = Number(os.limitPrice);

  // 1. Basic Input Validation (incl Exchange Precision & Notional Rules)
  const MIN_NOTIONAL = 5.00; // Standard $5 min notional
  const MIN_LOT_SIZE = symbol.includes('BTC') ? 0.00001 : 0.001; // Mock lot sizes for BTC vs Alts

  if (!quantity || quantity <= 0) {
    isInvalid = true;
    if (quantity < 0) validationError = 'Quantity must be positive';
  } else if (quantity < MIN_LOT_SIZE) {
    isInvalid = true;
    validationError = `Min Quantity: ${MIN_LOT_SIZE} ${baseAsset}`;
  }

  const estTotalValue = os.orderType === 'MARKET' ? (quantity * currentPrice) : total;

  if (os.orderType === 'LIMIT' && (!price || price <= 0)) {
    isInvalid = true;
    if (price < 0) validationError = 'Price must be positive';
  }
  
  // Enforce MIN_NOTIONAL
  if (quantity > 0 && estTotalValue > 0 && estTotalValue < MIN_NOTIONAL) {
    isInvalid = true;
    validationError = `Min Notional: $${MIN_NOTIONAL.toFixed(2)}`;
  }
  
  if (os.orderType === 'STOP_LIMIT') {
    if (!stopPrice || stopPrice <= 0) isInvalid = true;
    if (!limitPrice || limitPrice <= 0) isInvalid = true;
  }

  if (os.orderType === 'OCO') {
    if (!price || price <= 0) isInvalid = true;
    if (!stopPrice || stopPrice <= 0) isInvalid = true;
    if (!limitPrice || limitPrice <= 0) isInvalid = true;
  }

  // 2. Balance Validation (considering leverage)
  if (quantity > 0) {
    if (os.mode === 'BUY') {
      // For Market Buy, we estimate total using currentPrice if total isn't set
      const checkTotal = os.orderType === 'MARKET' ? (quantity * currentPrice) : total;
      
      // Allow a small epsilon for floating point math or fee buffers if needed, 
      // but strictly speaking, you can't spend more than you have * leverage.
      if (checkTotal > maxUsdt) {
        isInvalid = true;
        validationError = `Insufficient ${quoteAsset} balance (Max: ${maxUsdt.toFixed(2)})`;
      }
    } else { // SELL
      if (quantity > maxQuantity) {
        isInvalid = true;
        validationError = `Insufficient ${baseAsset} balance (Max: ${maxQuantity.toFixed(4)})`;
      }
    }
  }

  // 3. TP/SL Validation
  const tpPrice = Number(os.takeProfit);
  const slPrice = Number(os.slTrigger);
  const basePrice = executionPrice;

  if (os.showTPSL || os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO') {
    if (tpPrice > 0) {
      if (os.mode === 'BUY' && tpPrice <= basePrice) {
        isInvalid = true;
        validationError = 'Take Profit must be > Price';
      }
      if (os.mode === 'SELL' && tpPrice >= basePrice) {
        isInvalid = true;
        validationError = 'Take Profit must be < Price';
      }
    }
    if (slPrice > 0) {
      if (os.mode === 'BUY' && slPrice >= basePrice) {
        isInvalid = true;
        validationError = 'Stop Loss must be < Price';
      }
      if (os.mode === 'SELL' && slPrice <= basePrice) {
        isInvalid = true;
        validationError = 'Stop Loss must be > Price';
      }
    }
  }

  if (os.showTPSL) {
    if (!tpPrice && !slPrice) {
      isInvalid = true;
      validationError = 'Set Take Profit or Stop Loss';
    }
  }

  return (
    <div className="bg-[#0b0e11] border border-[#1e2329] rounded-xl px-3 sm:px-4 py-3 w-full max-w-[340px] mx-auto flex flex-col h-full text-[#eaecef] shadow-[0_0_30px_rgba(0,0,0,0.3)]">
      
      {/* Top Toggle: Spot vs Margin */}
      <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-[#1e2329]">
        <span className="text-[12px] sm:text-[13px] font-bold text-[#eaecef] tracking-tight">
          {isSpotMargin ? 'Margin' : 'Spot'}<span className="text-[#5e6673] font-normal ml-1">Trading</span>
        </span>
        <label className="flex items-center cursor-pointer group gap-2">
          <span className="text-[#5e6673] text-[10px] font-bold uppercase tracking-wider group-hover:text-[#848e9c] transition-colors">Margin</span>
          <div className="relative">
            <input type="checkbox" className="sr-only peer" checked={isSpotMargin} onChange={(e) => setIsSpotMargin(e.target.checked)} />
            <div className="w-8 h-[18px] bg-[#2b3139] rounded-full peer-checked:bg-[#fcd535]/30 transition-colors" />
            <div className="absolute top-[3px] left-[3px] w-3 h-3 bg-[#5e6673] rounded-full peer-checked:translate-x-3.5 peer-checked:bg-[#fcd535] transition-all shadow-sm" />
          </div>
        </label>
      </div>

      {/* Functional Pills (Margin Only) */}
      {isSpotMargin && (
        <div className="flex gap-1 mb-2.5">
          <button type="button" onClick={() => setMarginMode(prev => prev === 'Cross' ? 'Isolated' : 'Cross')} className="flex-1 bg-[#181a20] hover:bg-[#1e2329] py-1.5 rounded-lg text-[#fcd535] text-[9px] sm:text-[10px] font-bold transition-all border border-[#2b3139] hover:border-[#fcd535]/20">{marginMode}</button>
          <button type="button" onClick={() => setIsLeverageModalOpen(true)} className="flex-1 bg-[#181a20] hover:bg-[#1e2329] py-1.5 rounded-lg text-[#eaecef] text-[9px] sm:text-[10px] font-bold transition-all border border-[#2b3139]">{os.leverage}x</button>
          <button type="button" onClick={() => updateOs({ autoBorrow: !os.autoBorrow })} className={`flex-1 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all border ${os.autoBorrow ? 'bg-[#fcd535]/15 border-[#fcd535]/30 text-[#fcd535]' : 'bg-[#181a20] border-[#2b3139] text-[#5e6673]'}`}>Borrow</button>
          <button type="button" onClick={() => updateOs({ autoRepay: !os.autoRepay })} className={`flex-1 py-1.5 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all border ${os.autoRepay ? 'bg-[#fcd535]/15 border-[#fcd535]/30 text-[#fcd535]' : 'bg-[#181a20] border-[#2b3139] text-[#5e6673]'}`}>Repay</button>
        </div>
      )}

      {/* Action Toggle (Buy/Sell) - Sliding Pill */}
      <div className="flex mb-3 relative h-10 rounded-xl bg-[#181a20] p-1 border border-[#1e2329]">
        <div 
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-[10px] transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{
            left: os.mode === 'BUY' ? '4px' : 'calc(50%)',
            backgroundImage: os.mode === 'BUY' ? 'linear-gradient(135deg, #2ebd85, #1fa06e)' : 'linear-gradient(135deg, #f6465d, #d13045)',
            boxShadow: os.mode === 'BUY' ? '0 2px 12px rgba(46,189,133,0.3)' : '0 2px 12px rgba(246,70,93,0.3)'
          }}
        />
        <button type="button" onClick={() => updateOs({ mode: 'BUY' })} className={`flex-1 relative z-10 font-bold text-[12px] sm:text-[13px] transition-colors duration-300 flex items-center justify-center rounded-[10px] gap-1 ${os.mode === 'BUY' ? 'text-white' : 'text-[#5e6673] hover:text-[#848e9c]'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M7 7h10v10"/></svg>
          Buy
        </button>
        <button type="button" onClick={() => updateOs({ mode: 'SELL' })} className={`flex-1 relative z-10 font-bold text-[12px] sm:text-[13px] transition-colors duration-300 flex items-center justify-center rounded-[10px] gap-1 ${os.mode === 'SELL' ? 'text-white' : 'text-[#5e6673] hover:text-[#848e9c]'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7l-9.2 9.2M17 17H7V7"/></svg>
          Sell
        </button>
      </div>

      {/* Order Type Dropdown Trigger */}
      <div className="mb-3">
        <button type="button" onClick={() => setIsTypeModalOpen(true)} className="w-full flex items-center justify-center gap-1.5 text-[11px] font-bold text-[#848e9c] hover:text-[#eaecef] bg-[#181a20] hover:bg-[#1e2329] px-3 py-2 rounded-lg transition-all border border-[#1e2329] hover:border-[#2b3139]">
          <span className="text-[#eaecef]">{os.orderType === 'STOP_LIMIT' ? 'Stop Limit' : os.orderType === 'OCO' ? 'OCO' : os.orderType.charAt(0) + os.orderType.slice(1).toLowerCase()}</span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5e6673" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        
        {/* Input Group */}
        <div className="flex flex-col gap-1.5 mb-1">
          {/* Take Profit for STOP_LIMIT (Integrated) */}
          {os.orderType === 'STOP_LIMIT' && (
            <div className="space-y-1">
              <div className={`bg-[#1e2329] rounded-[8px] flex items-center h-[34px] transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden px-1`}>
                <span className="text-[#848e9c] text-xs px-2 whitespace-nowrap opacity-60">Take Profit</span>
                <input 
                  type="number" step="any" min="0" value={os.takeProfit} onChange={(e) => updateOs({ takeProfit: e.target.value ? Number(e.target.value) : '' })}
                  className="flex-1 bg-transparent text-[#eaecef] text-sm text-right focus:outline-none font-mono placeholder-[#848e9c]" placeholder="Optional"
                />
                <span className="text-[#eaecef] text-xs px-2 font-medium shrink-0">{quoteAsset}</span>
              </div>
              {tpTotal > 0 && <div className="text-[10px] text-[#848e9c] text-right px-1">Total: {tpTotal.toFixed(2)} {quoteAsset}</div>}
            </div>
          )}

          {/* Stop Input (Stop Loss Trigger) */}
          {(os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO') && (
            <div className="space-y-1">
              <div className={`bg-[#1e2329] rounded-[6px] flex items-center h-[34px] transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden px-1`}>
                <span className="text-[#848e9c] text-xs px-2 whitespace-nowrap opacity-60">Stop Loss</span>
                <input 
                  type="number" step="any" min="0" value={os.stopPrice} onChange={(e) => updateOs({ stopPrice: e.target.value ? Number(e.target.value) : '' })}
                  className="flex-1 bg-transparent text-[#eaecef] text-sm text-right focus:outline-none font-mono placeholder-[#848e9c]" placeholder="Trigger" required
                />
                <span className="text-[#eaecef] text-xs px-2 font-medium shrink-0">{quoteAsset}</span>
              </div>
              {os.quantity && os.stopPrice && <div className="text-[10px] text-[#848e9c] text-right px-1">Total: {(Number(os.quantity) * Number(os.stopPrice)).toFixed(2)} {quoteAsset}</div>}
            </div>
          )}

          {/* Limit / Price Input */}
          {os.orderType === 'MARKET' ? (
            <div className="bg-[#181a20] rounded-lg flex items-center h-[36px] border border-[#1e2329] opacity-50 cursor-not-allowed pr-2 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]">
              <input type="text" value="Market Price" disabled className="flex-1 bg-transparent text-[#5e6673] text-xs sm:text-sm text-center focus:outline-none font-mono cursor-not-allowed" />
              <span className="text-[#5e6673] text-[10px] font-bold">{quoteAsset}</span>
            </div>
          ) : (
            <div className={`bg-[#181a20] rounded-lg flex items-center justify-between h-[36px] transition-all border ${focusBorderClass} hover:border-[#2b3139] border-[#1e2329] overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]`}>
              <button type="button" onClick={() => stepPrice(os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? 'limitPrice' : 'price', false)} className={`w-8 h-full flex items-center justify-center text-[#5e6673] hover:bg-white/5 ${os.mode === 'BUY' ? 'hover:text-[#2ebd85]' : 'hover:text-[#f6465d]'} transition-colors shrink-0`}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
              
              <span className="text-[#5e6673] text-[10px] pl-1 whitespace-nowrap font-bold select-none">Price</span>
              
              <input 
                type="number" step="any" min="0" 
                value={os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? os.limitPrice : os.price} 
                onChange={(e) => os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? handleLimitPriceChange(e.target.value) : handlePriceChange(e.target.value)}
                className="flex-1 w-0 bg-transparent text-[#eaecef] text-xs sm:text-sm text-right focus:outline-none font-mono placeholder-[#2b3139] pr-1" placeholder="0.00" required
              />
              
              <div className="flex items-center shrink-0 pr-1 gap-1">
                {priceDelta && (
                  <span className={`text-[9px] font-mono font-bold ${Number(priceDelta) > 0 ? 'text-[#0ecb81]' : Number(priceDelta) < 0 ? 'text-[#f6465d]' : 'text-[#5e6673]'}`}>
                    {Number(priceDelta) > 0 ? '+' : ''}{priceDelta}%
                  </span>
                )}
                {os.orderType !== 'STOP_LIMIT' && os.orderType !== 'OCO' ? (
                  <button type="button" onClick={setBBO} className="text-[#eaecef] text-[9px] font-bold px-1.5 py-0.5 rounded-md hover:bg-white/10 transition-colors whitespace-nowrap bg-[#2b3139]/60 border border-[#2b3139]">BBO</button>
                ) : (
                  <span className="text-[#5e6673] text-[10px] font-bold pr-1">{quoteAsset}</span>
                )}
              </div>

              <button type="button" onClick={() => stepPrice(os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? 'limitPrice' : 'price', true)} className={`w-8 h-full flex items-center justify-center text-[#5e6673] hover:bg-white/5 ${os.mode === 'BUY' ? 'hover:text-[#2ebd85]' : 'hover:text-[#f6465d]'} transition-colors shrink-0`}>
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              </button>
            </div>
          )}

          {/* Amount Input */}
          <div className={`bg-[#181a20] rounded-lg flex items-center h-[36px] transition-all border ${focusBorderClass} hover:border-[#2b3139] border-[#1e2329] overflow-hidden px-1 shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]`}>
             <span className="text-[#5e6673] text-[10px] px-2 whitespace-nowrap font-bold select-none">Amt</span>
            <input 
              type="number" step="any" min="0" value={os.quantity} onChange={(e) => handleQuantityChange(e.target.value)}
              className="flex-1 w-0 bg-transparent text-[#eaecef] text-xs sm:text-sm text-right focus:outline-none font-mono placeholder-[#2b3139] pr-1" placeholder="0.00" required
            />
            <button type="button" onClick={setMaxQuantity} className="text-[#fcd535] text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all whitespace-nowrap border border-[#fcd535]/20 bg-[#fcd535]/8 hover:bg-[#fcd535]/15 mr-1">MAX</button>
            <span className="text-[#5e6673] text-[10px] pr-2 font-bold shrink-0">{baseAsset}</span>
          </div>
        </div>

        {/* Percentage Slider (Diamond Track) */}
        <div className="py-2 px-1 mt-5 mb-4 relative">
          <div className="relative w-full h-4 flex items-center">
            {/* Thin Light-Gray Background Track */}
            <div className="absolute left-0 right-0 h-[2px] bg-[#1e2329] z-0 rounded-full"></div>
            
            {/* Active Colored Track */}
            <div 
              className="absolute left-0 h-[2px] z-0 transition-all duration-150 rounded-full"
              style={{ width: `${balancePercentage}%`, backgroundColor: activeColor }}
            ></div>

            {/* Diamond Nodes Container */}
            <div className="absolute inset-0 flex justify-between items-center z-10 pointer-events-none px-[2px]">
              {[0, 25, 50, 75, 100].map((mark) => {
                const isActive = balancePercentage >= mark;
                return (
                  <div 
                    key={mark}
                    className="w-2.5 h-2.5 transition-colors duration-150 flex items-center justify-center bg-[#0b0e11]"
                    style={{ transform: 'rotate(45deg)' }}
                  >
                    <div 
                      className={`w-full h-full border ${isActive ? 'border-transparent' : 'border-[#474d57]'}`}
                      style={{ backgroundColor: isActive ? activeColor : 'transparent' }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Tooltip Bubble */}
            {isDraggingSlider && (
              <div 
                className="absolute top-[-26px] z-30 transform -translate-x-1/2 bg-[#1e2329] border border-[#2b3139] text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded shadow shadow-black/50 whitespace-nowrap pointer-events-none"
                style={{ left: `${balancePercentage}%` }}
              >
                {balancePercentage}%
              </div>
            )}

            {/* Invisible Range Input Overlay */}
            <input 
              type="range" min="0" max="100" step="1" value={balancePercentage} onChange={handleSliderChange}
              onMouseDown={() => setIsDraggingSlider(true)} onMouseUp={() => setIsDraggingSlider(false)} onTouchStart={() => setIsDraggingSlider(true)} onTouchEnd={() => setIsDraggingSlider(false)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
          </div>
        </div>

        {/* Total Input */}
        {os.orderType !== 'MARKET' && (
          <div className={`bg-[#181a20] border ${focusBorderClass} hover:border-[#2b3139] border-[#1e2329] rounded-lg h-[36px] flex items-center px-1 mb-2 transition-all overflow-hidden shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]`}>
            <span className="text-[#5e6673] text-[10px] px-2 whitespace-nowrap font-bold select-none">Total</span>
            <input 
              type="number" step="any" min="0" value={os.total} onChange={(e) => handleTotalChange(e.target.value)}
              className="flex-1 w-0 bg-transparent text-[#eaecef] text-xs sm:text-sm text-right pr-1 focus:outline-none font-mono placeholder-[#2b3139]" placeholder="0.00" required
            />
            <span className="text-[#5e6673] text-[10px] px-2 font-bold shrink-0">{quoteAsset}</span>
          </div>
        )}

        {/* Advanced Conditional Toggles */}
        {os.orderType !== 'OCO' && os.orderType !== 'STOP_LIMIT' && (
          <div className="mb-2 space-y-2">
            {/* TP/SL ToggleRow */}
            <div>
              <label className="flex items-center gap-2 text-[11px] text-[#848e9c] hover:text-[#eaecef] cursor-pointer w-max select-none transition-colors">
                <div className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center transition-colors ${os.showTPSL ? 'bg-[#fcd535] border-[#fcd535]' : 'border-[#5e6673] bg-[#1e2329]'}`}>
                  {os.showTPSL && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0b0e11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
                <input type="checkbox" checked={os.showTPSL} onChange={(e) => updateOs({ showTPSL: e.target.checked })} className="hidden" />
                <span className="font-medium">TP/SL</span>
                {/* Expand Arrow */}
                <svg 
                  width="10" height="10" viewBox="0 0 24 24" fill="currentColor" 
                  className={`transition-transform duration-200 ${os.showTPSL ? 'rotate-180' : 'rotate-0'}`}
                >
                  <path d="M7 10l5 5 5-5z"></path>
                </svg>
              </label>
              
              {/* Collapsible TP/SL Inputs */}
              {os.showTPSL && (
                <div className="space-y-2 mt-2 ml-1 border-l-2 border-[#2b3139] pl-3 py-1 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="space-y-1">
                    <div className={`bg-[#1e2329] rounded-lg flex items-center h-8 transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden px-1`}>
                      <span className="text-[#848e9c] text-[10px] px-2 whitespace-nowrap">Take Profit</span>
                      <input type="number" step="any" min="0" value={os.takeProfit} onChange={(e) => updateOs({ takeProfit: e.target.value ? Number(e.target.value) : '' })} className="flex-1 w-0 bg-transparent text-[#eaecef] text-[11px] text-center focus:outline-none font-mono placeholder-[#848e9c]" placeholder="0.00" />
                      <span className="text-[#eaecef] text-[10px] pr-2 font-medium">{quoteAsset}</span>
                    </div>
                    {tpTotal > 0 && <div className="text-[9px] text-gray-500 text-right px-1">Total: {tpTotal.toFixed(2)} {quoteAsset}</div>}
                  </div>
                  <div className="space-y-1">
                    <div className={`bg-[#1e2329] rounded-lg flex items-center h-8 transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden px-1`}>
                      <span className="text-[#848e9c] text-[10px] px-2 whitespace-nowrap">SL Trigger</span>
                      <input type="number" step="any" min="0" value={os.slTrigger} onChange={(e) => updateOs({ slTrigger: e.target.value ? Number(e.target.value) : '' })} className="flex-1 w-0 bg-transparent text-[#eaecef] text-[11px] text-center focus:outline-none font-mono placeholder-[#848e9c]" placeholder="0.00" />
                      <span className="text-[#eaecef] text-[10px] pr-2 font-medium">{quoteAsset}</span>
                    </div>
                    {slTotal > 0 && <div className="text-[9px] text-gray-500 text-right px-1">Total: {slTotal.toFixed(2)} {quoteAsset}</div>}
                  </div>
                  <div className={`bg-[#1e2329] rounded-lg flex items-center h-8 transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden px-1`}>
                    <span className="text-[#848e9c] text-[10px] px-2 whitespace-nowrap">SL Limit</span>
                    <input type="number" step="any" min="0" value={os.slLimit} onChange={(e) => updateOs({ slLimit: e.target.value ? Number(e.target.value) : '' })} className="flex-1 w-0 bg-transparent text-[#eaecef] text-[11px] text-center focus:outline-none font-mono placeholder-[#848e9c]" placeholder="0.00" />
                    <span className="text-[#eaecef] text-[10px] pr-2 font-medium">{quoteAsset}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Iceberg ToggleRow */}
            <div>
              <label className="flex items-center gap-2 text-[11px] text-[#848e9c] hover:text-[#eaecef] cursor-pointer w-max select-none transition-colors">
                <div className={`w-3.5 h-3.5 rounded-[2px] border flex items-center justify-center transition-colors ${os.isIceberg ? 'bg-[#fcd535] border-[#fcd535]' : 'border-[#5e6673] bg-[#1e2329]'}`}>
                  {os.isIceberg && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0b0e11" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                </div>
                <input type="checkbox" checked={os.isIceberg} onChange={(e) => updateOs({ isIceberg: e.target.checked })} className="hidden" />
                <span className="font-medium">Iceberg</span>
                <span className="relative group flex items-center justify-center cursor-help">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#848e9c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 hidden group-hover:block bg-[#1e2329] border border-[#2b3139] text-[#eaecef] text-[10px] p-2 rounded shadow-lg whitespace-nowrap z-50">
                    Hide large orders from the public Order Book
                  </div>
                </span>
              </label>
            </div>
            
          </div>
        )}

        {/* Balance Stats Card */}
        <div className="bg-[#181a20] rounded-lg border border-[#1e2329] px-3 py-2 mb-3 space-y-1.5">
          <div className="flex justify-between items-center text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[#5e6673] font-medium">Avbl</span>
              <button type="button" className="text-[#fcd535] opacity-70 hover:opacity-100 transition-opacity" title="Transfer Funds">
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="14" x2="21" y2="3"/><polyline points="8 21 3 21 3 16"/><line x1="20" y1="10" x2="3" y2="21"/></svg>
              </button>
            </div>
            <span className="text-[#eaecef] font-mono font-bold">{avbl.toFixed(2)} <span className="text-[#5e6673]">{os.mode === 'BUY' ? quoteAsset : baseAsset}</span></span>
          </div>
          <div className="w-full h-px bg-[#1e2329]" />
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-[#5e6673] font-medium">Max {os.mode === 'BUY' ? 'Buy' : 'Sell'}</span>
            <span className="text-[#eaecef] font-mono font-bold">{maxQuantity.toFixed(4)} <span className="text-[#5e6673]">{baseAsset}</span></span>
          </div>
          {os.autoBorrow && (
            <>
              <div className="w-full h-px bg-[#1e2329]" />
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#5e6673] font-medium">Borrow</span>
                <span className="text-[#fcd535] font-mono font-bold">{os.quantity > 0 && executionPrice > 0 ? (Math.max(0, (Number(os.quantity) * executionPrice) - avbl)).toFixed(2) : '0.00'} <span className="text-[#5e6673]">{quoteAsset}</span></span>
              </div>
            </>
          )}
          {isSpotMargin && (
            <>
              <div className="w-full h-px bg-[#1e2329]" />
              <div className="flex justify-between items-center text-[10px]">
                <span className="text-[#5e6673] font-medium">Liq. Price</span>
                <span className="text-[#fcd535] font-mono font-bold">
                  {os.leverage > 1 && os.quantity ? (os.mode === 'BUY' ? (executionPrice * 0.95).toFixed(2) : (executionPrice * 1.05).toFixed(2)) : '--'}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Advanced Settings Bottom (Margin Only) */}
        {isSpotMargin && (
          <div className="mb-3 space-y-1">
            <label className="flex items-center justify-between cursor-pointer group bg-[#181a20] p-2.5 rounded-lg border border-[#1e2329] hover:border-[#2b3139] transition-all">
              <div className="flex flex-col">
                <span className="text-[#eaecef] text-[11px] font-bold">Auto Borrow</span>
                <span className="text-[#5e6673] text-[9px] mt-0.5">Borrow funds before placement</span>
              </div>
              <div className="relative ml-3 shrink-0">
                <input type="checkbox" className="sr-only peer" checked={os.autoBorrow} onChange={(e) => updateOs({ autoBorrow: e.target.checked })} />
                <div className="w-8 h-[18px] bg-[#2b3139] rounded-full peer-checked:bg-[#fcd535]/30 transition-colors" />
                <div className="absolute top-[3px] left-[3px] w-3 h-3 bg-[#5e6673] rounded-full peer-checked:translate-x-3.5 peer-checked:bg-[#fcd535] transition-all" />
              </div>
            </label>

            <label className="flex items-center justify-between cursor-pointer group bg-[#181a20] p-2.5 rounded-lg border border-[#1e2329] hover:border-[#2b3139] transition-all">
              <div className="flex flex-col">
                <span className="text-[#eaecef] text-[11px] font-bold">Auto Repay</span>
                <span className="text-[#5e6673] text-[9px] mt-0.5">Repay loan on execution</span>
              </div>
              <div className="relative ml-3 shrink-0">
                <input type="checkbox" className="sr-only peer" checked={os.autoRepay} onChange={(e) => updateOs({ autoRepay: e.target.checked })} />
                <div className="w-8 h-[18px] bg-[#2b3139] rounded-full peer-checked:bg-[#fcd535]/30 transition-colors" />
                <div className="absolute top-[3px] left-[3px] w-3 h-3 bg-[#5e6673] rounded-full peer-checked:translate-x-3.5 peer-checked:bg-[#fcd535] transition-all" />
              </div>
            </label>
          </div>
        )}

        {/* Execution Button */}
        <div className="mt-auto pt-2">
          {validationError && (
            <div className="text-[9px] text-[#f6465d] text-center mb-1.5 font-bold bg-[#f6465d]/8 border border-[#f6465d]/15 rounded-lg py-1 px-2">
              {validationError}
            </div>
          )}
          <button
            type="submit"
            disabled={isInvalid}
            className="w-full py-3 sm:py-3.5 rounded-xl font-bold text-white text-[12px] sm:text-[13px] uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
            style={{ 
              backgroundImage: os.mode === 'BUY' ? 'linear-gradient(135deg, #2ebd85, #1fa06e)' : 'linear-gradient(135deg, #f6465d, #d13045)',
              boxShadow: os.mode === 'BUY' ? '0 4px 16px rgba(46,189,133,0.25)' : '0 4px 16px rgba(246,70,93,0.25)'
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {os.mode === 'BUY' ? <><path d="M7 17l9.2-9.2M7 7h10v10"/></> : <><path d="M17 7l-9.2 9.2M17 17H7V7"/></>}
            </svg>
            {isSpotMargin ? 'Margin ' : ''}{os.mode === 'BUY' ? 'Buy' : 'Sell'} {baseAsset}
          </button>
        </div>
      </form>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#1e2329] w-full max-w-sm rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-4 border-b border-white/10 flex justify-between items-center">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Confirm Order</h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-gray-400 hover:text-white transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Side</span>
                <span className={`text-sm font-bold px-2 py-0.5 rounded ${os.mode === 'BUY' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-rose-500/20 text-rose-500'}`}>
                  {os.mode}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Symbol</span>
                <span className="text-sm font-bold text-white">{symbol}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Type</span>
                <span className="text-sm font-medium text-gray-200">{os.orderType}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Amount</span>
                <span className="text-sm font-mono font-bold text-white">{os.quantity} {baseAsset}</span>
              </div>

              {os.orderType !== 'MARKET' && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Price</span>
                  <span className="text-sm font-mono font-bold text-white">{os.price || os.limitPrice} {quoteAsset}</span>
                </div>
              )}

              {os.isIceberg && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Visibility</span>
                  <span className="text-xs font-mono font-medium text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded border border-cyan-400/20">ICEBERG (Hidden)</span>
                </div>
              )}

              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-gray-400">Total</span>
                <span className="text-sm font-mono font-bold text-white">
                  {os.orderType === 'MARKET' ? '~' : ''} {os.total || (Number(os.quantity) * currentPrice).toFixed(2)} {quoteAsset}
                </span>
              </div>

              <div className="bg-black/20 p-3 rounded-lg border border-white/5">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Margin Mode</span>
                  <span>{marginMode}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-500">
                  <span>Leverage</span>
                  <span className={os.leverage > 1 ? 'text-rose-500 font-bold' : ''}>{os.leverage}x</span>
                </div>
              </div>

              {os.leverage > 1 && (
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg space-y-2">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 9 4 4-4 4"/><path d="M4 12h16"/><path d="m12 9-4 4 4 4"/></svg>
                    <p className="text-[10px] text-rose-200 leading-tight">
                      <span className="font-bold text-rose-500 uppercase">High Risk Warning:</span> Leverage increases both potential profits and potential losses. Your position can be liquidated if the market moves against you.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer group select-none">
                    <div className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center transition-colors ${riskAccepted ? 'bg-rose-500 border-rose-500' : 'border-rose-500/50 bg-transparent'}`}>
                      {riskAccepted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                    </div>
                    <input type="checkbox" checked={riskAccepted} onChange={(e) => setRiskAccepted(e.target.checked)} className="hidden" />
                    <span className="text-[10px] text-rose-200 group-hover:text-white transition-colors">I understand the risks of using {os.leverage}x leverage</span>
                  </label>
                </div>
              )}
            </div>

            <div className="p-4 bg-black/20 flex gap-3">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 text-xs font-bold text-gray-400 hover:text-white transition-colors border border-white/10 rounded-md"
              >
                Cancel
              </button>
              <button 
                onClick={confirmOrder}
                disabled={os.leverage > 1 && !riskAccepted}
                className="flex-1 py-2.5 text-xs font-bold text-white rounded-md transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                style={{ backgroundColor: activeColor }}
              >
                Confirm {os.mode}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Leverage Bottom Sheet Modal */}
      <LeverageModal 
        isOpen={isLeverageModalOpen}
        onClose={() => setIsLeverageModalOpen(false)}
        initialLeverage={os.leverage}
        marginMode={marginMode}
        availableBalance={balance}
        onConfirm={(newLev) => {
          updateOs({ leverage: newLev });
          setIsLeverageModalOpen(false);
          setRiskAccepted(false);
        }}
      />
      <OrderTypeModal 
        isOpen={isTypeModalOpen}
        onClose={() => setIsTypeModalOpen(false)}
        currentType={os.orderType}
        onSelect={(t) => updateOs({ orderType: t })}
      />
    </div>
  );
};
