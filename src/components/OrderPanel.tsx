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

  // Neon Cyber Elements Components
  const CyberInput = ({ label, suffix, value, onChange, placeholder, disabled, stepBtn, type = 'number', customPaddingRight, align = 'right', mode = 'BUY' }: any) => {
    const focusBorderClass = mode === 'BUY' ? 'focus-within:border-[#10b981] focus-within:shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'focus-within:border-[#ef4444] focus-within:shadow-[0_0_10px_rgba(239,68,68,0.2)]';
    const [localValue, setLocalValue] = React.useState<string | number>(value);
    const [isFocused, setIsFocused] = React.useState(false);
    const previousValueRef = React.useRef(value);
    
    // Sync external value changes to local state if the parent pushed a change we didn't initiate
    React.useEffect(() => {
      if (value !== previousValueRef.current) {
        setLocalValue(value);
        previousValueRef.current = value;
      }
    }, [value]);

    const handleBlur = () => {
      setIsFocused(false);
      let finalVal = localValue;
      if (typeof localValue === 'string' && localValue.trim() !== '') {
        let parsed = localValue.toLowerCase().trim();
        // Intelligent Parsing: k = 1000, m = 1000000
        if (parsed.endsWith('k')) parsed = (parseFloat(parsed) * 1000).toString();
        else if (parsed.endsWith('m')) parsed = (parseFloat(parsed) * 1000000).toString();
        
        // Intelligent Parsing: Math expressions
        try {
          if (/[+\-*/]/.test(parsed) && /^[0-9+\-*\/. ()]+$/.test(parsed)) {
            parsed = Function(`"use strict";return (${parsed})`)().toString();
          }
        } catch (e) {}

        const finalNum = parseFloat(parsed);
        if (!isNaN(finalNum)) {
          finalVal = finalNum;
        } else {
          finalVal = '';
        }
      }
      
      setLocalValue(finalVal);
      previousValueRef.current = finalVal;
      onChange({ target: { value: finalVal } });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setLocalValue(raw);
      // Real-time update if it's a simple number or empty
      if (raw === '' || (!isNaN(Number(raw)) && !raw.endsWith('.'))) {
        const numVal = raw === '' ? '' : Number(raw);
        previousValueRef.current = numVal;
        onChange({ target: { value: numVal } });
      }
    };

    const inputType = type === 'number' ? 'text' : type; // Use text to allow 'k', 'm', and '+'

    return (
    <div className={`relative group h-11 w-full bg-[#0d0f13] border border-white/5 rounded-lg overflow-hidden transition-all duration-300 ${disabled ? 'opacity-50 cursor-not-allowed' : focusBorderClass}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
        <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider group-focus-within:text-cyan-400 transition-colors drop-shadow-[0_0_2px_rgba(6,182,212,0)] group-focus-within:drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">{label}</span>
      </div>
      
      {stepBtn && (
        <button type="button" onClick={() => stepBtn(false)} className="absolute inset-y-0 left-[48px] px-2 flex items-center justify-center text-gray-600 hover:text-cyan-400 transition-all z-20 active:scale-75 hover:scale-110">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      )}

      <input 
        type={inputType} 
        value={localValue === '' ? '' : localValue} 
        onChange={handleChange} 
        onBlur={handleBlur}
        onFocus={() => setIsFocused(true)}
        disabled={disabled} 
        placeholder={placeholder}
        style={{ 
          paddingRight: customPaddingRight ? customPaddingRight : (suffix ? `${suffix.length * 8 + 24}px` : '12px'),
          paddingLeft: stepBtn ? '80px' : '56px',
          textAlign: align
        }}
        className={`w-full h-full bg-transparent text-white text-[13px] focus:outline-none font-mono placeholder-gray-700 z-0 relative transition-all ${isFocused ? 'drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]' : ''}`}
      />

      {stepBtn && (
        <button type="button" onClick={() => stepBtn(true)} className="absolute inset-y-0 right-[40px] px-2 flex items-center justify-center text-gray-600 hover:text-cyan-400 transition-all z-20 active:scale-75 hover:scale-110">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      )}

      {suffix && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none z-10">
          <span className="text-[10px] font-bold text-gray-500 group-focus-within:text-white transition-colors">{suffix}</span>
        </div>
      )}

      {/* 2035 Active Scanner Line Effect */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[2px] bg-cyan-400 group-focus-within:w-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(6,182,212,1)] opacity-0 group-focus-within:opacity-100"></div>
    </div>
  )};


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

  // 2035 Cyberpunk Color Palette 
  const activeColor = os.mode === 'BUY' ? '#10b981' : '#ef4444'; // Emerald / Crimson
  const neonGlow = os.mode === 'BUY' ? 'shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'shadow-[0_0_15px_rgba(239,68,68,0.4)]';
  const textNeon = os.mode === 'BUY' ? 'text-[#10b981] drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'text-[#ef4444] drop-shadow-[0_0_8px_rgba(239,68,68,0.8)]';
  const borderNeon = os.mode === 'BUY' ? 'border-[#10b981]/50' : 'border-[#ef4444]/50';
  const focusBorderClass = os.mode === 'BUY' ? 'focus-within:border-[#10b981] focus-within:shadow-[0_0_10px_rgba(16,185,129,0.2)]' : 'focus-within:border-[#ef4444] focus-within:shadow-[0_0_10px_rgba(239,68,68,0.2)]';
  
  // Derived values
  const executionPrice = os.orderType === 'MARKET' 
    ? currentPrice 
    : os.orderType === 'STOP_LIMIT'
      ? (Number(os.limitPrice) || currentPrice)
      : (Number(os.price) || currentPrice);
  
  const tpTotal = os.quantity && os.takeProfit ? Number((Number(os.quantity) * Number(os.takeProfit)).toFixed(4)) : 0;
  const slTotal = os.quantity && os.slTrigger ? Number((Number(os.quantity) * Number(os.slTrigger)).toFixed(4)) : 0;
  
  // Max calculations  // Determine available collateral based on order intent
  const isShorting = os.mode === 'SELL' && isSpotMargin && os.autoBorrow;
  const avbl = (os.mode === 'BUY' || isShorting) ? balance : baseBalance;
  
  const effectiveLeverage = Math.max(1, isSpotMargin ? os.leverage : 1); // Treat 0x as 1x for math purposes so we don't get 0 max
  const maxUsdt = (os.mode === 'BUY' || isShorting) ? avbl * effectiveLeverage : 0;
  
  const maxQuantity = (os.mode === 'BUY' || isShorting)
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
    let stepAmount = 1; 
    if (current < 1) stepAmount = 0.001;
    else if (current < 10) stepAmount = 0.01;
    else stepAmount = 0.1;

    let next = increment ? current + stepAmount : current - stepAmount;
    if (next < 0) next = 0;
    
    next = Number(next.toFixed(current < 1 ? 4 : 2));
    
    updateOs({ [field]: next });
    
    if (field === 'price' && os.quantity) {
      updateOs({ total: Number((Number(os.quantity) * next).toFixed(4)) });
    }
  };

  const setMaxQuantity = () => {
    if (maxQuantity > 0) {
      const q = Math.floor(maxQuantity * 10000) / 10000; 
      const t = executionPrice > 0 ? Number((q * executionPrice).toFixed(4)) : '';
      updateOs({ quantity: q, total: t });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRiskAccepted(false); 
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
    
    // Clear fields upon submission
    updateOs({
      quantity: '',
      total: '',
      stopPrice: '',
      limitPrice: '',
      takeProfit: '',
      slTrigger: '',
      slLimit: ''
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

  const MIN_NOTIONAL = 5.00; 
  const MIN_LOT_SIZE = symbol.includes('BTC') ? 0.00001 : 0.001; 

  if (!quantity || quantity <= 0) {
    isInvalid = true;
    if (quantity < 0) validationError = 'Quantity must be positive';
  } else if (quantity < MIN_LOT_SIZE) {
    isInvalid = true;
    validationError = `Min Size: ${MIN_LOT_SIZE} ${baseAsset}`;
  }

  const estTotalValue = os.orderType === 'MARKET' ? (quantity * currentPrice) : total;

  if (os.orderType === 'LIMIT' && (!price || price <= 0)) {
    isInvalid = true;
    if (price < 0) validationError = 'Price must be positive';
  }
  
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

  if (quantity > 0) {
    if (os.mode === 'BUY' || isShorting) {
      const checkTotal = os.orderType === 'MARKET' ? (quantity * currentPrice) : total;
      if (checkTotal > maxUsdt) {
        isInvalid = true;
        validationError = `Insuff. ${quoteAsset} Balance`;
      }
    } else { 
      if (quantity > maxQuantity) {
        isInvalid = true;
        validationError = `Insuff. ${baseAsset} Balance`;
      }
    }
  }

  const tpPrice = Number(os.takeProfit);
  const slPrice = Number(os.slTrigger);
  const basePrice = executionPrice;

  if (os.showTPSL || os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO') {
    if (tpPrice > 0) {
      if (os.mode === 'BUY' && tpPrice <= basePrice) {
        isInvalid = true;
        validationError = 'TP must be > Price';
      }
      if (os.mode === 'SELL' && tpPrice >= basePrice) {
        isInvalid = true;
        validationError = 'TP must be < Price';
      }
    }
    if (slPrice > 0) {
      if (os.mode === 'BUY' && slPrice >= basePrice) {
        isInvalid = true;
        validationError = 'SL must be < Price';
      }
      if (os.mode === 'SELL' && slPrice <= basePrice) {
        isInvalid = true;
        validationError = 'SL must be > Price';
      }
    }
  }

  if (os.showTPSL) {
    if (!tpPrice && !slPrice) {
      isInvalid = true;
      validationError = 'Set TP or SL';
    }
  }


  return (
    <div className="bg-[#0a0a0c]/90 backdrop-blur-xl border border-white/5 rounded-2xl p-4 w-full max-w-[360px] mx-auto flex flex-col h-full text-white shadow-[0_0_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header / Mode Toggle */}
      <div className="flex justify-between items-center mb-5 relative z-10">
        <div className="flex flex-col">
          <span className="text-[14px] font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">
            Terminal
          </span>
          <span className="text-[9px] font-mono text-cyan-400 tracking-widest mt-0.5 glow-text-cyan">v2.0.35</span>
        </div>
        
        {/* Spot/Margin Cyber Toggle */}
        <div className="flex items-center gap-2 bg-[#0d0f13] p-1 rounded-full border border-white/5 relative">
          <button 
            type="button" onClick={() => setIsSpotMargin(false)} 
            className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all duration-300 ${!isSpotMargin ? 'bg-white text-black shadow-[0_0_10px_rgba(255,255,255,0.3)]' : 'text-gray-500 hover:text-white'}`}
          >
            SPOT
          </button>
          <button 
            type="button" onClick={() => setIsSpotMargin(true)} 
            className={`px-3 py-1 text-[10px] font-bold rounded-full transition-all duration-300 ${isSpotMargin ? 'bg-cyan-500 text-black shadow-[0_0_15px_rgba(6,182,212,0.4)]' : 'text-gray-500 hover:text-white'}`}
          >
            MARGIN
          </button>
        </div>
      </div>

      {/* Advanced Margin Controls (Fluid Dropdown) */}
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isSpotMargin ? 'max-h-20 mb-4 opacity-100' : 'max-h-0 opacity-0 mb-0'}`}>
        <div className="grid grid-cols-4 gap-2">
          <button type="button" onClick={() => setMarginMode(prev => prev === 'Cross' ? 'Isolated' : 'Cross')} className="bg-[#0d0f13] hover:bg-[#1a1d24] py-2 rounded-lg text-cyan-400 text-[10px] font-bold transition-all border border-cyan-500/20 hover:border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.1)]">{marginMode.toUpperCase()}</button>
          <button type="button" onClick={() => setIsLeverageModalOpen(true)} className="bg-[#0d0f13] hover:bg-[#1a1d24] py-2 rounded-lg text-white text-[10px] font-mono font-bold transition-all border border-white/10 hover:border-white/30">{os.leverage}X</button>
          <button type="button" onClick={() => updateOs({ autoBorrow: !os.autoBorrow })} className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${os.autoBorrow ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-[#0d0f13] border-white/5 text-gray-500'}`}>BRRW</button>
          <button type="button" onClick={() => updateOs({ autoRepay: !os.autoRepay })} className={`py-2 rounded-lg text-[10px] font-bold transition-all border ${os.autoRepay ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'bg-[#0d0f13] border-white/5 text-gray-500'}`}>REPAY</button>
        </div>
      </div>

      {/* 2035 Fluid Mode Switcher */}
      <div className="relative h-12 rounded-xl bg-[#0d0f13] p-1 border border-white/5 mb-4 isolate shadow-inner">
        <div 
          className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-0"
          style={{
            left: os.mode === 'BUY' ? '4px' : 'calc(50%)',
            backgroundColor: os.mode === 'BUY' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${os.mode === 'BUY' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            boxShadow: neonGlow
          }}
        />
        <div className="flex h-full w-full relative z-10">
          <button type="button" onClick={() => updateOs({ mode: 'BUY' })} className={`flex-1 font-bold text-[13px] tracking-wider transition-all duration-300 flex items-center justify-center rounded-lg gap-2 ${os.mode === 'BUY' ? textNeon : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M7 17l9.2-9.2M7 7h10v10"/></svg>
            BUY
          </button>
          <button type="button" onClick={() => updateOs({ mode: 'SELL' })} className={`flex-1 font-bold text-[13px] tracking-wider transition-all duration-300 flex items-center justify-center rounded-lg gap-2 ${os.mode === 'SELL' ? textNeon : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 7l-9.2 9.2M17 17H7V7"/></svg>
            SELL
          </button>
        </div>
      </div>

      {/* Advanced Order Type Selector */}
      <div className="mb-4">
        <button type="button" onClick={() => setIsTypeModalOpen(true)} className="w-full flex items-center justify-between px-4 py-3 bg-[#0d0f13] border border-white/5 hover:border-white/20 rounded-lg group transition-all">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 group-hover:shadow-[0_0_8px_rgba(6,182,212,0.8)] transition-shadow"></div>
            <span className="text-[11px] font-bold text-gray-400 tracking-widest uppercase">Type</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-bold text-white tracking-wider">{os.orderType.replace('_', ' ')}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-500 group-hover:text-white transition-colors" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><mpath d="m6 9 6 6 6-6"/></svg>
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex-1 flex flex-col relative z-10">
        
        {/* Main Inputs Area */}
        <div className="space-y-3 mb-2">
          
          {/* Stop Trigger */}
          {(os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO') && (
             <CyberInput mode={os.mode} label="Stop" suffix={quoteAsset} value={os.stopPrice} onChange={(e: any) => updateOs({ stopPrice: e.target.value ? Number(e.target.value) : '' })} placeholder="0.00" />
          )}

  {/* Limit / Market Price */}
          {os.orderType === 'MARKET' ? (
             <CyberInput mode={os.mode} label="Price" suffix={quoteAsset} value="Market" disabled={true} type="text" />
          ) : (
             <div className="relative">
                <CyberInput mode={os.mode} 
                  label="Price" 
                  suffix={os.orderType !== 'STOP_LIMIT' && os.orderType !== 'OCO' ? null : quoteAsset} 
                  value={os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? os.limitPrice : os.price} 
                  onChange={(e: any) => os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? handleLimitPriceChange(e.target.value) : handlePriceChange(e.target.value)} 
                  placeholder="0.00" 
                  stepBtn={(inc: boolean) => stepPrice(os.orderType === 'STOP_LIMIT' || os.orderType === 'OCO' ? 'limitPrice' : 'price', inc)} 
                  // Add massive padding right for LIMIT orders because of the BBO/Pct buttons
                  customPaddingRight={os.orderType !== 'STOP_LIMIT' && os.orderType !== 'OCO' ? '100px' : null}
                />
                {os.orderType !== 'STOP_LIMIT' && os.orderType !== 'OCO' && (
                  <div className="absolute right-[8px] top-1/2 -translate-y-1/2 flex items-center gap-2 z-20 pointer-events-none">
                    {priceDelta && (
                      <span className={`text-[10px] font-mono font-bold ${Number(priceDelta) > 0 ? 'text-[#10b981] drop-shadow-[0_0_5px_rgba(16,185,129,0.5)]' : Number(priceDelta) < 0 ? 'text-[#ef4444] drop-shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'text-gray-500'}`}>
                        {Number(priceDelta) > 0 ? '+' : ''}{priceDelta}%
                      </span>
                    )}
                    <button type="button" onClick={setBBO} className="text-white text-[9px] font-bold px-2 py-1 rounded bg-[#1a1d24] hover:bg-cyan-500 hover:text-black transition-all border border-white/5 uppercase pointer-events-auto">BBO</button>
                  </div>
                )}
             </div>
          )}

          {/* Quantity */}
          <div className="relative">
             <CyberInput mode={os.mode} 
               label="Amount" 
               suffix={baseAsset} 
               value={os.quantity} 
               onChange={(e: any) => handleQuantityChange(e.target.value)} 
               placeholder="0.00" 
               customPaddingRight="80px"
               align="center"
             />
             <button type="button" onClick={setMaxQuantity} className={`absolute right-[46px] top-1/2 -translate-y-1/2 text-[9px] font-bold px-2 py-1 rounded transition-all uppercase z-20 ${os.mode === 'BUY' ? 'bg-[#10b981]/10 text-[#10b981] hover:bg-[#10b981]/20' : 'bg-[#ef4444]/10 text-[#ef4444] hover:bg-[#ef4444]/20'}`}>MAX</button>
          </div>
        </div>

        {/* 2035 Neon Slider */}
        <div className="py-4 relative">
          <div className="relative w-full h-1.5 flex items-center bg-[#1a1d24] rounded-full overflow-hidden border border-white/5">
            <div 
              className="absolute left-0 h-full rounded-full transition-all duration-300 ease-out"
              style={{ width: `${balancePercentage}%`, backgroundColor: activeColor, boxShadow: neonGlow }}
            ></div>
          </div>
          
          {/* Snap Nodes */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-0 pointer-events-none">
            {[0, 25, 50, 75, 100].map((mark) => {
              const isActive = balancePercentage >= mark;
              return (
                <div 
                  key={mark}
                  className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${isActive ? `bg-[${activeColor}] border-transparent ${neonGlow} scale-125` : 'bg-[#0a0a0c] border-[#1a1d24]'}`}
                  style={isActive ? { backgroundColor: activeColor } : {}}
                />
              );
            })}
          </div>

          <input 
            type="range" min="0" max="100" step="1" value={balancePercentage} onChange={handleSliderChange}
            onMouseDown={() => setIsDraggingSlider(true)} onMouseUp={() => setIsDraggingSlider(false)} onTouchStart={() => setIsDraggingSlider(true)} onTouchEnd={() => setIsDraggingSlider(false)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
          />

          {isDraggingSlider && (
             <div 
               className="absolute top-[-30px] z-30 transform -translate-x-1/2 bg-[#1a1d24] border border-white/10 text-white text-[10px] font-mono font-bold px-2.5 py-1 rounded shadow-xl whitespace-nowrap pointer-events-none backdrop-blur-md"
               style={{ left: `${balancePercentage}%` }}
             >
               {balancePercentage.toFixed(0)}%
               <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[#1a1d24] border-b border-r border-white/10 rotate-45"></div>
             </div>
           )}
        </div>

         {/* Total Output */}
         {os.orderType !== 'MARKET' && (
           <div className="mb-4">
             <CyberInput mode={os.mode} label="Total" suffix={quoteAsset} value={os.total} onChange={(e: any) => handleTotalChange(e.target.value)} placeholder="0.00" customPaddingRight="50px" />
           </div>
         )}

        {/* 2035 Cyber Toggles */}
        {os.orderType !== 'OCO' && os.orderType !== 'STOP_LIMIT' && (
          <div className="space-y-3 mb-4 bg-[#0d0f13]/50 p-3 rounded-xl border border-white/5">
            {/* TP/SL Toggle */}
            <div>
              <label className="flex items-center justify-between cursor-pointer group">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">Take Profit / Stop Loss</span>
                <div className="relative">
                  <input type="checkbox" checked={os.showTPSL} onChange={(e) => updateOs({ showTPSL: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-[#1a1d24] rounded-full peer-checked:bg-cyan-500/30 border border-white/5 peer-checked:border-cyan-500/50 transition-all duration-300" />
                  <div className="absolute top-1 left-1 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-4 peer-checked:bg-cyan-400 peer-checked:shadow-[0_0_8px_rgba(6,182,212,0.8)] transition-all duration-300" />
                </div>
              </label>
              
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${os.showTPSL ? 'max-h-60 mt-3 opacity-100' : 'max-h-0 opacity-0 mt-0'}`}>
                 <div className="space-y-2 border-l-2 border-cyan-500/20 pl-3">
                    <CyberInput mode={os.mode} label="TP" suffix={quoteAsset} value={os.takeProfit} onChange={(e: any) => updateOs({ takeProfit: e.target.value ? Number(e.target.value) : '' })} placeholder="0.00" />
                    <CyberInput mode={os.mode} label="SL Trigger" suffix={quoteAsset} value={os.slTrigger} onChange={(e: any) => updateOs({ slTrigger: e.target.value ? Number(e.target.value) : '' })} placeholder="0.00" />
                 </div>
              </div>
            </div>

            {/* Iceberg Toggle */}
             <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider group-hover:text-white transition-colors">Iceberg Order</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-600 group-hover:text-gray-400 transition-colors" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                </div>
                <div className="relative">
                  <input type="checkbox" checked={os.isIceberg} onChange={(e) => updateOs({ isIceberg: e.target.checked })} className="sr-only peer" />
                  <div className="w-9 h-5 bg-[#1a1d24] rounded-full peer-checked:bg-purple-500/30 border border-white/5 peer-checked:border-purple-500/50 transition-all duration-300" />
                  <div className="absolute top-1 left-1 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-4 peer-checked:bg-purple-400 peer-checked:shadow-[0_0_8px_rgba(168,85,247,0.8)] transition-all duration-300" />
                </div>
              </label>
          </div>
        )}

        {/* HUD Stats Panel */}
        <div className="bg-[#0d0f13] rounded-xl border border-white/5 p-3 mb-4 space-y-2 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-16 h-16 bg-gradient-to-br from-white/5 to-transparent rounded-bl-full pointer-events-none"></div>
          
          <div className="flex justify-between items-center z-10 relative">
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Available</span>
             <span className="text-[12px] font-mono text-white tracking-wider">{avbl.toFixed(2)} <span className="text-gray-500 text-[10px]">{os.mode === 'BUY' ? quoteAsset : baseAsset}</span></span>
          </div>
          <div className="w-full h-px bg-gradient-to-r from-white/5 via-white/10 to-white/5" />
          <div className="flex justify-between items-center z-10 relative">
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Max Potential</span>
             <span className="text-[12px] font-mono text-white tracking-wider">{maxQuantity.toFixed(4)} <span className="text-gray-500 text-[10px]">{baseAsset}</span></span>
          </div>
          
          {isSpotMargin && os.leverage > 1 && os.quantity && (
             <>
               <div className="w-full h-px bg-gradient-to-r from-red-500/10 via-red-500/30 to-red-500/10" />
               <div className="flex justify-between items-center z-10 relative">
                 <span className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Est. Liq Price</span>
                 <span className="text-[12px] font-mono text-red-400 tracking-wider drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]">
                    {os.mode === 'BUY' ? (executionPrice * 0.95).toFixed(2) : (executionPrice * 1.05).toFixed(2)}
                 </span>
               </div>
             </>
          )}
        </div>

        {/* Execution Engine Button */}
        <div className="mt-auto relative">
          {validationError && (
            <div className="absolute -top-10 left-0 right-0 text-[10px] text-[#ef4444] text-center font-bold bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg py-1.5 px-3 backdrop-blur-md flex items-center justify-center gap-2 animate-pulse">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
               {validationError}
            </div>
          )}
          
          <button
            type="submit"
            disabled={isInvalid}
            className={`w-full h-[52px] rounded-xl font-black text-white text-[15px] uppercase tracking-[0.2em] transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed hover:brightness-125 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-3 relative overflow-hidden ${os.mode === 'BUY' ? 'bg-[#10b981]' : 'bg-[#ef4444]'}`}
            style={{ boxShadow: os.mode === 'BUY' ? '0 10px 30px -10px rgba(16,185,129,0.8)' : '0 10px 30px -10px rgba(239,68,68,0.8)' }}
          >
             {/* Diagonal Cyber Stripes overlay */}
            <div className={`absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(0,0,0,0.5)_10px,rgba(0,0,0,0.5)_20px)] pointer-events-none`}></div>
            
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="relative z-10">
              {os.mode === 'BUY' ? <><path d="M7 17l9.2-9.2M7 7h10v10"/></> : <><path d="M17 7l-9.2 9.2M17 17H7V7"/></>}
            </svg>
            <span className="relative z-10 text-shadow-sm">{isSpotMargin ? 'MARGIN ' : ''}{os.mode === 'BUY' ? 'EXECUTE BUY' : 'EXECUTE SELL'}</span>
          </button>
        </div>
      </form>

      {/* 2035 Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
          <div className="bg-[#0a0a0c] w-full max-w-sm rounded-2xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden animate-in fade-in zoom-in-95 duration-200 relative">
            
            {/* Modal Accents */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${os.mode === 'BUY' ? 'bg-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'bg-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.8)]'}`}></div>

            <div className="p-5 border-b border-white/5 flex justify-between items-center">
              <h3 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                 Signal Confirm
              </h3>
              <button onClick={() => setShowConfirmModal(false)} className="text-gray-500 hover:text-white transition-colors bg-white/5 p-1 rounded-md hover:bg-white/10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
               {/* Cyber Data List */}
               <div className="space-y-3 font-mono text-[11px]">
                  <div className="flex justify-between items-center px-3 py-2 bg-[#0d0f13] rounded border border-white/5">
                     <span className="text-gray-500 uppercase">Operation</span>
                     <span className={`font-black tracking-widest ${textNeon}`}>{os.mode} {symbol}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-[#0d0f13] rounded border border-white/5">
                     <span className="text-gray-500 uppercase">Protocol</span>
                     <span className="text-white tracking-widest">{os.orderType}</span>
                  </div>
                  <div className="flex justify-between items-center px-3 py-2 bg-[#0d0f13] rounded border border-white/5">
                     <span className="text-gray-500 uppercase">Volume</span>
                     <span className="text-cyan-400 font-bold">{os.quantity}</span>
                  </div>
                  {os.orderType !== 'MARKET' && (
                     <div className="flex justify-between items-center px-3 py-2 bg-[#0d0f13] rounded border border-white/5">
                        <span className="text-gray-500 uppercase">Target Price</span>
                        <span className="text-white">{os.price || os.limitPrice}</span>
                     </div>
                  )}
               </div>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Value</span>
                <span className="text-base font-black text-white font-mono tracking-wider">
                  {os.orderType === 'MARKET' ? '~' : ''} {os.total || (Number(os.quantity) * currentPrice).toFixed(2)} {quoteAsset}
                </span>
              </div>

              {isSpotMargin && (
                <div className="bg-[#0d0f13] p-3 rounded-xl border border-white/5">
                   <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 mb-2 pb-2 border-b border-white/5">
                     <span>Leverage Engaged</span>
                     <span className={os.leverage > 1 ? 'text-red-400 glow-text-red' : 'text-cyan-400'}>{os.leverage}X</span>
                   </div>
                   
                   {os.leverage > 1 && (
                     <div className="mt-2">
                        <label className="flex items-start gap-3 cursor-pointer group">
                           <div className="relative mt-0.5">
                              <input type="checkbox" checked={riskAccepted} onChange={(e) => setRiskAccepted(e.target.checked)} className="sr-only peer" />
                              <div className="w-4 h-4 rounded-sm border-2 border-red-500/50 peer-checked:bg-red-500 peer-checked:border-red-500 transition-all flex items-center justify-center">
                                 {riskAccepted && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                              </div>
                           </div>
                           <span className="text-[10px] text-red-200/70 group-hover:text-red-200 transition-colors leading-tight">
                              PROTOCOL WARNING: High leverage detected. Position subject to extreme volatility and rapid liquidation. Confirm acceptance of elevated risk parameters.
                           </span>
                        </label>
                     </div>
                   )}
                </div>
              )}
            </div>

            <div className="p-4 flex gap-3 bg-[#0d0f13] border-t border-white/5">
               <button 
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 text-[11px] font-bold text-gray-400 uppercase tracking-widest hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg"
              >
                Abort
              </button>
              <button 
                onClick={confirmOrder}
                disabled={isSpotMargin && os.leverage > 1 && !riskAccepted}
                className={`flex-1 flex items-center justify-center gap-2 py-3 text-[11px] font-black text-white uppercase tracking-widest rounded-lg transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed ${os.mode === 'BUY' ? 'bg-[#10b981] shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]' : 'bg-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]'}`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Transmit
              </button>
            </div>
          </div>
        </div>
      )}

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
