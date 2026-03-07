import React, { useState, useEffect } from 'react';

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
  const effectiveLeverage = Math.max(1, os.leverage); // Treat 0x as 1x for math purposes so we don't get 0 max
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
    const pct = Number(e.target.value);
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
      marginMode,
      leverage: os.leverage,
      autoBorrow: os.autoBorrow,
      autoRepay: os.autoRepay,
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
      // If TP/SL is checked but neither is filled, it's technically invalid state for "placing a TP/SL order"
      // but maybe we just ignore it? 
      // The original code set isInvalid = true. Let's keep it but maybe add a message.
      isInvalid = true;
      // validationError = 'Set TP or SL'; // Optional: might be too noisy if they are just toggling it
    }
  }

  return (
    <div className="bg-[#0b0e11] px-4 py-3 rounded-lg w-full max-w-[320px] mx-auto flex flex-col h-full text-[#eaecef]">
      
      {/* Header Section: Margin Mode & Leverage */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex bg-[#1e2329] rounded-md p-0.5">
          <button 
            type="button"
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${marginMode === 'Cross' ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}
            onClick={() => setMarginMode('Cross')}
          >Cross</button>
          <button 
            type="button"
            className={`px-3 py-1 text-xs font-medium rounded-sm transition-colors ${marginMode === 'Isolated' ? 'bg-[#2b3139] text-[#eaecef]' : 'text-[#848e9c] hover:text-[#eaecef]'}`}
            onClick={() => setMarginMode('Isolated')}
          >Isolated</button>
        </div>
        
        <div className="relative bg-[#1e2329] rounded-md flex items-center px-2 py-1 hover:bg-[#2b3139] transition-colors cursor-pointer border border-transparent hover:border-[#5e6673]">
          <select 
            value={os.leverage} 
            onChange={(e) => updateOs({ leverage: Number(e.target.value) })}
            className="appearance-none bg-transparent text-xs font-medium text-[#eaecef] outline-none cursor-pointer pr-4"
          >
            {[0,1,2,3,4,5,6,7,8,9,10].map(x => <option key={x} value={x} className="bg-[#1e2329]">{x}x</option>)}
          </select>
          <div className="absolute right-1.5 pointer-events-none">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#848e9c]"><path d="m6 9 6 6 6-6"/></svg>
          </div>
        </div>
      </div>

      {/* Auto Borrow / Repay */}
      <div className="flex justify-between items-center mb-4 px-1">
        <label className="flex items-center gap-2 cursor-pointer group">
          <span className="text-[#848e9c] text-xs group-hover:text-[#eaecef] transition-colors">Auto Borrow</span>
          <div className={`w-7 h-3.5 rounded-full relative transition-colors duration-300 ${os.autoBorrow ? 'bg-[#fcd535]' : 'bg-[#2b3139]'}`}>
            <div className={`absolute top-[2px] left-[2px] w-2.5 h-2.5 rounded-full bg-white transition-transform duration-300 ${os.autoBorrow ? 'translate-x-3.5' : ''}`}></div>
          </div>
          <input type="checkbox" className="hidden" checked={os.autoBorrow} onChange={(e) => updateOs({ autoBorrow: e.target.checked })} />
        </label>
        <label className="flex items-center gap-2 cursor-pointer group">
          <span className="text-[#848e9c] text-xs group-hover:text-[#eaecef] transition-colors">Auto Repay</span>
          <div className={`w-7 h-3.5 rounded-full relative transition-colors duration-300 ${os.autoRepay ? 'bg-[#fcd535]' : 'bg-[#2b3139]'}`}>
            <div className={`absolute top-[2px] left-[2px] w-2.5 h-2.5 rounded-full bg-white transition-transform duration-300 ${os.autoRepay ? 'translate-x-3.5' : ''}`}></div>
          </div>
          <input type="checkbox" className="hidden" checked={os.autoRepay} onChange={(e) => updateOs({ autoRepay: e.target.checked })} />
        </label>
      </div>

      {/* Action Toggle (Buy/Sell) */}
      <div className="flex mb-3 gap-[10px]">
        <button
          type="button"
          className={`flex-1 py-2.5 text-sm font-bold rounded transition-all duration-200 ${os.mode === 'BUY' ? 'text-white' : 'bg-[#1e2329] text-[#848e9c] hover:text-[#eaecef]'}`}
          style={{ backgroundColor: os.mode === 'BUY' ? activeColor : undefined }}
          onClick={() => updateOs({ mode: 'BUY' })}
        >
          Buy
        </button>
        <button
          type="button"
          className={`flex-1 py-2.5 text-sm font-bold rounded transition-all duration-200 ${os.mode === 'SELL' ? 'text-white' : 'bg-[#1e2329] text-[#848e9c] hover:text-[#eaecef]'}`}
          style={{ backgroundColor: os.mode === 'SELL' ? activeColor : undefined }}
          onClick={() => updateOs({ mode: 'SELL' })}
        >
          Sell
        </button>
      </div>

      {/* Trade Mode Header */}
      <div className="flex items-center justify-between border-b border-[#2b3139] mb-4 pb-0">
        <div className="flex gap-4">
          {(['LIMIT', 'MARKET', 'STOP_LIMIT', 'OCO'] as const).map((t) => {
            const isActive = os.orderType === t;
            const label = t === 'STOP_LIMIT' ? 'Stop Limit' : t === 'OCO' ? 'OCO' : t.charAt(0) + t.slice(1).toLowerCase();
            return (
              <button
                key={t}
                type="button"
                className={`pb-2 text-xs font-semibold relative transition-all ${
                  isActive ? 'text-[#eaecef] opacity-100' : 'text-[#848e9c] opacity-60 hover:opacity-100 hover:text-[#eaecef]'
                }`}
                onClick={() => updateOs({ orderType: t })}
              >
                {label}
                {isActive && (
                  <div className="absolute bottom-[-1px] left-0 w-full h-[2px] bg-[#fcd535] rounded-t-sm" />
                )}
              </button>
            );
          })}
        </div>
        <button type="button" className="text-[#848e9c] opacity-60 hover:opacity-100 hover:text-[#eaecef] transition-opacity pb-2" title="Order Type Info">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col">
        
        {/* Input Group */}
        <div className="flex flex-col gap-1.5 mb-1">
          {/* Take Profit for STOP_LIMIT (Integrated) */}
          {os.orderType === 'STOP_LIMIT' && (
            <div className="space-y-1">
              <div className={`bg-[#1e2329] rounded-lg flex items-center h-10 transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden px-1`}>
                <span className="text-[#848e9c] text-xs px-2 whitespace-nowrap">Take Profit</span>
                <input 
                  type="number" step="any" min="0" value={os.takeProfit} onChange={(e) => updateOs({ takeProfit: e.target.value ? Number(e.target.value) : '' })}
                  className="flex-1 bg-transparent text-[#eaecef] text-sm text-center focus:outline-none font-mono placeholder-[#848e9c]" placeholder="Optional"
                />
                <span className="text-[#eaecef] text-xs pr-2 font-medium">{quoteAsset}</span>
              </div>
              {tpTotal > 0 && <div className="text-[10px] text-gray-500 text-right px-1">Total: {tpTotal.toFixed(2)} {quoteAsset}</div>}
            </div>
          )}

          {/* Stop Input (Stop Loss Trigger) */}
          {(os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO') && (
            <div className="space-y-1">
              <div className={`bg-[#1e2329] rounded-lg flex items-center h-10 transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden px-1`}>
                <span className="text-[#848e9c] text-xs px-2 whitespace-nowrap">Stop Loss</span>
                <input 
                  type="number" step="any" min="0" value={os.stopPrice} onChange={(e) => updateOs({ stopPrice: e.target.value ? Number(e.target.value) : '' })}
                  className="flex-1 bg-transparent text-[#eaecef] text-sm text-center focus:outline-none font-mono placeholder-[#848e9c]" placeholder="Trigger" required
                />
                <span className="text-[#eaecef] text-xs pr-2 font-medium">{quoteAsset}</span>
              </div>
              {os.quantity && os.stopPrice && <div className="text-[10px] text-gray-500 text-right px-1">Total: {(Number(os.quantity) * Number(os.stopPrice)).toFixed(2)} {quoteAsset}</div>}
            </div>
          )}

          {/* Limit Input */}
          {(os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO') && (
            <div className={`bg-[#1e2329] rounded-lg flex items-center justify-between h-10 transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden`}>
              <button type="button" onClick={() => stepPrice('limitPrice', false)} className="w-10 h-full flex items-center justify-center text-[#848e9c] hover:bg-white/5 hover:text-[#eaecef] transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <input 
                type="number" step="any" min="0" value={os.limitPrice} onChange={(e) => handleLimitPriceChange(e.target.value)}
                className="flex-1 w-0 bg-transparent text-[#eaecef] text-sm text-center focus:outline-none font-mono placeholder-[#848e9c]" placeholder="Limit Price" required
              />
              <button type="button" onClick={() => stepPrice('limitPrice', true)} className="w-10 h-full flex items-center justify-center text-[#848e9c] hover:bg-white/5 hover:text-[#eaecef] transition-colors shrink-0">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
            </div>
          )}

          {/* Price Input */}
          {os.orderType === 'MARKET' ? (
            <div className="bg-[#1e2329] rounded-lg flex items-center h-10 transition-colors border border-transparent opacity-60 cursor-not-allowed pr-2">
              <input type="text" value="Market Price" disabled className="flex-1 bg-transparent text-[#eaecef] text-sm text-center focus:outline-none font-mono cursor-not-allowed" />
              <span className="text-[#eaecef] text-xs font-medium">{quoteAsset}</span>
            </div>
          ) : os.orderType !== 'STOP_LIMIT' ? (
            <div className={`bg-[#1e2329] rounded-lg flex items-center justify-between h-10 transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden`}>
              <button type="button" onClick={() => stepPrice('price', false)} className="w-10 h-full flex items-center justify-center text-[#848e9c] hover:bg-white/5 hover:text-[#eaecef] transition-colors shrink-0">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <input 
                type="number" step="any" min="0" value={os.price} onChange={(e) => handlePriceChange(e.target.value)}
                className="flex-1 w-0 bg-transparent text-[#eaecef] text-sm text-center focus:outline-none font-mono placeholder-[#848e9c]" placeholder={os.orderType === 'OCO' ? 'Take Profit Price' : 'Price'} required
              />
              <button type="button" onClick={() => stepPrice('price', true)} className="w-10 h-full flex items-center justify-center text-[#848e9c] hover:bg-white/5 hover:text-[#eaecef] transition-colors shrink-0 border-r border-[#2b3139]">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              </button>
              <button type="button" onClick={setBBO} className="text-[#eaecef] text-[10px] font-bold px-3 h-full hover:bg-white/5 transition-colors whitespace-nowrap bg-[#2b3139]/30">BBO</button>
            </div>
          ) : null}

          {/* Amount Input */}
          <div className={`bg-[#1e2329] rounded-lg flex items-center h-10 transition-colors border ${focusBorderClass} hover:border-[#5e6673] border-transparent overflow-hidden px-1`}>
             <span className="text-[#848e9c] text-xs px-2 whitespace-nowrap">Amount</span>
            <input 
              type="number" step="any" min="0" value={os.quantity} onChange={(e) => handleQuantityChange(e.target.value)}
              className="flex-1 w-0 bg-transparent text-[#eaecef] text-sm text-center focus:outline-none font-mono placeholder-[#848e9c]" placeholder="0.00" required
            />
            <button type="button" onClick={setMaxQuantity} className="text-[#eaecef] text-[10px] font-bold px-2 rounded hover:bg-white/10 transition-colors whitespace-nowrap mr-2">MAX</button>
            <span className="text-[#eaecef] text-xs pr-2 font-medium shrink-0">{baseAsset}</span>
          </div>
        </div>

        {/* Percentage Slider (Diamond Track) */}
        <div className="py-2 px-1 mt-5 mb-4 relative">
          <div className="relative w-full h-4 flex items-center">
            {/* Thin Light-Gray Background Track */}
            <div className="absolute left-0 right-0 h-[2px] bg-[#2b3139] z-0"></div>
            
            {/* Active Colored Track */}
            <div 
              className="absolute left-0 h-[2px] z-0 transition-all duration-150"
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

            {/* Invisible Range Input Overlay */}
            <input 
              type="range" min="0" max="100" step="1" value={balancePercentage} onChange={handleSliderChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            />
          </div>
        </div>

        {/* Total Input */}
        {os.orderType !== 'MARKET' && (
          <div className={`bg-[#1e2329] border border-transparent rounded-md flex items-center px-3 py-2 mb-2 transition-colors ${focusBorderClass} hover:border-[#5e6673]`}>
            <span className="text-[#848e9c] text-xs w-16">Total</span>
            <input 
              type="number" step="any" min="0" value={os.total} onChange={(e) => handleTotalChange(e.target.value)}
              className="flex-1 bg-transparent text-[#eaecef] text-sm text-left focus:outline-none font-mono placeholder-[#848e9c]" placeholder="0.00" required
            />
            <span className="text-[#eaecef] text-xs ml-2 font-medium">{quoteAsset}</span>
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
                <span className="text-[9px] text-[#5e6673] ml-1">(Hide from Order Book)</span>
              </label>
            </div>
            
          </div>
        )}

        {/* Asset & Liquidation Footer */}
        <div className="flex flex-col gap-1.5 mb-4 text-[10px] mt-2 bg-transparent p-0 rounded-none border-none">
          {/* Row: Available */}
          <div className="flex justify-between items-center group">
            <div className="flex items-center gap-1">
              <span className="text-gray-500">Avbl</span>
              <button type="button" className="text-[#fcd535] opacity-80 hover:opacity-100 transition-opacity" title="Transfer Funds">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="16 3 21 3 21 8"></polyline>
                  <line x1="4" y1="14" x2="21" y2="3"></line>
                  <polyline points="8 21 3 21 3 16"></polyline>
                  <line x1="20" y1="10" x2="3" y2="21"></line>
                </svg>
              </button>
            </div>
            <span className="text-white font-mono font-medium">{avbl.toFixed(2)} {os.mode === 'BUY' ? quoteAsset : baseAsset}</span>
          </div>
          
          {/* Row: Max */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Max {os.mode === 'BUY' ? 'Buy' : 'Sell'}</span>
            <span className="text-white font-mono font-medium">{maxQuantity.toFixed(4)} {baseAsset}</span>
          </div>

          {/* Row: Borrow (Mocked or calculated based on autoBorrow) */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500">Borrow</span>
            <span className="text-white font-mono font-medium">{os.autoBorrow && os.quantity > 0 && executionPrice > 0 ? (Math.max(0, (Number(os.quantity) * executionPrice) - avbl)).toFixed(2) : '0.00'} {quoteAsset}</span>
          </div>

          {/* Row: Liq. Price */}
          <div className="flex justify-between items-center">
            <span className="text-gray-500 hover:border-b border-gray-600 border-dashed cursor-help" title="Estimated Liquidation Price">Liq. Price</span>
            <span className="text-[#fcd535] font-mono font-medium">
              {os.leverage > 1 && os.quantity ? (os.mode === 'BUY' ? (executionPrice * 0.95).toFixed(2) : (executionPrice * 1.05).toFixed(2)) : '--'}
            </span>
          </div>
        </div>

        {/* Execution Button */}
        <div className="mt-auto pt-2">
          {validationError && (
            <div className="text-[10px] text-rose-500 text-center mb-1 font-medium animate-pulse">
              {validationError}
            </div>
          )}
          <button
            type="submit"
            disabled={isInvalid}
            className="w-full py-3 rounded-md font-bold text-white text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: activeColor }}
          >
            Margin {os.mode === 'BUY' ? 'Buy' : 'Sell'} {baseAsset}
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
    </div>
  );
};
