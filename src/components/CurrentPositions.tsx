import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { Briefcase, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Position {
  symbol: string;
  netQuantity: number;
  averageEntryPrice: number;
  totalCost: number;
  tpPrice?: number;
  slPrice?: number;
}

export function CurrentPositions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  
  // TP/SL Modal State
  const [tpslModal, setTpslModal] = useState<{ symbol: string, quantity: number, mode: 'BUY'|'SELL', entryPrice: number, totalCost: number } | null>(null);
  const [tpPrice, setTpPrice] = useState('');
  const [slPrice, setSlPrice] = useState('');
  const [isSubmittingTpsl, setIsSubmittingTpsl] = useState(false);
  const [loading, setLoading] = useState(true);

  // Leverage Modal State
  const [leverageModal, setLeverageModal] = useState<{ symbol: string, totalCost: number } | null>(null);
  const [leverageValue, setLeverageValue] = useState(10);
  const [marginType, setMarginType] = useState<'CROSS' | 'ISOLATED'>('CROSS');
  const [isSubmittingLeverage, setIsSubmittingLeverage] = useState(false);

  const handleClosePosition = async (sym: string, netQty: number) => {
    try {
      const side = netQty > 0 ? 'SELL' : 'BUY';
      const quantity = Math.abs(netQty);
      
      const toastId = toast.loading(`Closing ${sym}...`);
      
      const res = await fetch('/api/binance/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sym,
          side: side,
          type: 'MARKET',
          quantity: quantity
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to close position');
      }

      toast.success(`Position ${sym} closed`, { id: toastId });
      fetchPositions(); // Refresh
    } catch (err: any) {
      toast.error(err.message, { id: err.message });
    }
  };

  const dummyAction = (action: string) => {
    toast(action + " feature is available in Pro mode", { icon: 'â„¹ï¸', style: { borderRadius: '8px', background: '#1e2329', color: '#eaecef' }});
  };

  const fetchPositions = async () => {
    try {
       const res = await fetch('/api/backend/positions');
       if (res.ok) {
           const data = await res.json();
           setPositions(data);
       }
    } catch (err) {
       console.error('Failed to fetch active positions:', err);
    } finally {
       setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    
    const socket = io();
    socket.on('new_trade', () => {
       fetchPositions();
    });

    return () => { socket.disconnect(); };
  }, []);

  // Subscribe to live binance stream to track live mark price for ALL active positions
  useEffect(() => {
    if (positions.length === 0) return;

    // Extract raw symbols without margin suffix to subscribe to Binance Ticker (e.g. BTCUSDT)
    const rawStreams = positions.map(p => {
        const baseSymbol = p.symbol.split('-')[0];
        return `${baseSymbol.replace('/', '').toLowerCase()}@ticker`;
    });
    // Remove duplicates so we don't crash the WS connection by requesting identical streams
    const uniqueStreams = [...new Set(rawStreams)];
    
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${uniqueStreams.join('/')}`;
    
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
       const payload = JSON.parse(event.data);
       if (payload.stream && payload.data) {
           const sym = payload.data.s; // Output: BTCUSDT
           // Update live price for any position (Spot, Cross, Isolated) matching this base symbol
           const matchingPositions = positions.filter(p => p.symbol.replace('/', '').split('-')[0] === sym);
           if (matchingPositions.length > 0) {
               setLivePrices(prev => {
                   const next = { ...prev };
                   matchingPositions.forEach(p => { next[p.symbol] = parseFloat(payload.data.c); });
                   return next;
               });
           }
       }
    };

    return () => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.close();
        }
    };
  }, [positions]);

  if (loading) return (
     <div className="h-full flex items-center justify-center text-gray-500 font-mono text-sm tracking-tight border border-white/5 bg-white/5 backdrop-blur-md rounded">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading Portfolio...
     </div>
  );

  if (positions.length === 0) return (
     <div className="h-full flex flex-col items-center justify-center text-gray-500 font-mono text-sm tracking-tight border border-white/5 bg-white/5 backdrop-blur-md rounded">
        <Briefcase className="w-8 h-8 text-gray-700 mb-2" />
        No active positions.
     </div>
  );

  return (
    <div className="bg-white/5 backdrop-blur-md rounded border border-white/10 overflow-hidden flex flex-col h-full">
      <div className="p-2 border-b border-white/10 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-indigo-500" />
          Active Positions
        </h2>
        <span className="text-[10px] text-gray-500 font-mono bg-black/40 px-2 py-0.5 rounded">REAL-TIME PNL</span>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">
        {positions.map((pos) => {
          let displaySymbol = pos.symbol;
          let marginTag = 'Cross 10x'; // Default fallback
          if (pos.symbol.includes('-ISOLATED')) {
            displaySymbol = pos.symbol.replace('-ISOLATED', '');
            marginTag = 'Isolated 10x';
          } else if (pos.symbol.includes('-CROSS')) {
            displaySymbol = pos.symbol.replace('-CROSS', '');
            marginTag = 'Cross 10x';
          }

          const livePrc = livePrices[pos.symbol] || pos.averageEntryPrice;
          const currentValue = pos.netQuantity * livePrc;
          const pnl = currentValue - pos.totalCost;
          const roi = (pos.totalCost > 0) ? (pnl / pos.totalCost) * 100 : 0;
          
          const isProfit = pnl >= 0;

          return (
            <div key={pos.symbol} className="bg-[#1e2329] rounded-[8px] p-1 border border-transparent hover:border-[#2b3139] transition-colors relative overflow-hidden group flex flex-col xl:flex-row xl:items-center xl:gap-8 min-w-[max-content] xl:min-w-0">
              {/* Left Green Indicator line for LONG */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 rounded-l-md opacity-70" />
              
              {/* Card Header */}
              <div className="flex items-center justify-between mb-3 pl-2 xl:mb-0 xl:w-[200px] xl:shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 bg-emerald-500/20 rounded flex items-center justify-center text-emerald-500 font-bold text-[10px]">B</div>
                  <h3 className="font-bold text-[#eaecef] text-sm tracking-wide">{displaySymbol}</h3>
                  {marginTag && (
                    <span className="text-[10px] text-[#fcd535] bg-[#fcd535]/10 px-1.5 py-0.5 rounded font-mono border border-[#fcd535]/20">{marginTag}</span>
                  )}
                </div>
                <button className="text-[#848e9c] hover:text-white transition-colors xl:hidden">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                </button>
              </div>

              {/* 4-Column Data Grid */}
              <div className="grid grid-cols-2 gap-y-3 gap-x-2 pl-2 mb-3 xl:flex xl:flex-1 xl:justify-between xl:items-center xl:mb-0 xl:pl-0">
                
                {/* Column 1: PNL & ROI */}
                <div className="flex flex-col xl:w-1/4">
                  <span className="text-[#848e9c] text-[10px] mb-0.5 border-b border-dashed border-[#848e9c]/50 w-max cursor-help">Unrealized PNL (USDT)</span>
                  <span className={`text-base font-bold font-mono ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[11px] font-mono font-medium ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                    {isProfit ? '+' : ''}{roi.toFixed(2)}%
                  </span>
                </div>

                {/* Column 2: Size & Realized */}
                <div className="flex flex-col xl:w-1/4 xl:items-start text-right xl:text-left">
                  <span className="text-[#848e9c] text-[10px] mb-0.5 ml-auto xl:ml-0 border-b border-dashed border-[#848e9c]/50 w-max cursor-help">Realized PNL</span>
                  <span className="text-[13px] font-bold font-mono text-[#eaecef]">0.00</span>
                  <div className="mt-1 flex flex-col xl:flex-row xl:items-center xl:gap-2 ml-auto xl:ml-0 border-b-0 border-transparent border-dashed">
                    <span className="text-[#848e9c] text-[10px]">Size:</span>
                    <span className="text-[11px] font-mono text-[#eaecef]">{pos.netQuantity.toString()}</span>
                  </div>
                </div>

                {/* Column 3: TP/SL Targets */}
                <div className="flex flex-col xl:w-1/4 xl:items-start">
                  <span className="text-[#848e9c] text-[10px] mb-0.5 border-b border-dashed border-[#848e9c]/50 w-max cursor-help">Take Profit / Stop Loss</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[12px] font-bold font-mono text-[#0ecb81]">
                      {pos.tpPrice ? pos.tpPrice.toFixed(4) : '-'}
                    </span>
                    <span className="text-[#5e6673] text-[10px]">&frasl;</span>
                    <span className="text-[12px] font-bold font-mono text-[#f6465d]">
                      {pos.slPrice ? pos.slPrice.toFixed(4) : '-'}
                    </span>
                  </div>
                </div>

                {/* Column 4: Cost & Entry */}
                <div className="flex flex-col text-right xl:text-left xl:w-1/4">
                  <span className="text-[#848e9c] text-[10px] mb-0.5 ml-auto xl:ml-0 border-b border-dashed border-[#848e9c]/50 w-max cursor-help">Cost (USDT)</span>
                  <span className="text-[13px] font-bold font-mono text-[#eaecef]">{pos.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <div className="mt-1 flex flex-col xl:flex-row xl:items-center xl:gap-2 ml-auto xl:ml-0 border-b-0 border-transparent border-dashed">
                    <span className="text-[#848e9c] text-[10px]">Entry / Mark:</span>
                    <span className="text-[11px] font-mono text-[#eaecef]">{pos.averageEntryPrice.toFixed(2)} / <span className="text-[#fcd535]">{livePrc.toFixed(2)}</span></span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pl-2 mt-2 xl:flex xl:mt-0 xl:shrink-0 xl:gap-3">
                <button
                  onClick={() => {
                    const currentLev = parseInt(marginTag?.match(/\d+/)?.[0] || '10');
                    setLeverageValue(currentLev);
                    setMarginType(pos.symbol.includes('-ISOLATED') ? 'ISOLATED' : 'CROSS');
                    setLeverageModal({ symbol: pos.symbol, totalCost: pos.totalCost });
                  }}
                  className="bg-[#2b3139] hover:bg-[#474d57] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors text-center w-full xl:w-auto">
                  Adjust Leverage
                </button>
                <button onClick={() => {
                   setTpslModal({ 
                     symbol: pos.symbol, 
                     quantity: Math.abs(pos.netQuantity), 
                     mode: pos.netQuantity > 0 ? 'SELL' : 'BUY',
                     entryPrice: pos.averageEntryPrice,
                     totalCost: pos.totalCost
                   });
                   setTpPrice(pos.tpPrice ? pos.tpPrice.toString() : '');
                   setSlPrice(pos.slPrice ? pos.slPrice.toString() : '');
                }} className="bg-[#2b3139] hover:bg-[#474d57] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors text-center w-full xl:w-auto">
                  Stop Profit & Loss
                </button>
                <button onClick={() => handleClosePosition(pos.symbol, pos.netQuantity)} className="bg-[#2b3139] hover:bg-[#f6465d] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors text-center w-full xl:w-auto">
                  Close Position
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* â”€â”€â”€ TP/SL Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {tpslModal && (() => {
        const isLong = tpslModal.mode === 'SELL';
        const positionSide = isLong ? 'LONG' : 'SHORT';
        const tpVal = parseFloat(tpPrice) || 0;
        const slVal = parseFloat(slPrice) || 0;
        const currentMark = livePrices[tpslModal.symbol] || tpslModal.entryPrice;

        const tpPnl = tpVal > 0 ? (isLong ? (tpVal - tpslModal.entryPrice) * tpslModal.quantity : (tpslModal.entryPrice - tpVal) * tpslModal.quantity) : 0;
        const slPnl = slVal > 0 ? (isLong ? (slVal - tpslModal.entryPrice) * tpslModal.quantity : (tpslModal.entryPrice - slVal) * tpslModal.quantity) : 0;
        const tpRoi = (tpslModal.totalCost > 0 && tpPnl !== 0) ? (tpPnl / tpslModal.totalCost) * 100 : 0;
        const slRoi = (tpslModal.totalCost > 0 && slPnl !== 0) ? (slPnl / tpslModal.totalCost) * 100 : 0;
        const rr = slPnl < 0 && tpPnl > 0 ? (tpPnl / Math.abs(slPnl)) : null;

        let tpWarning = '';
        if (tpVal > 0) {
          if (isLong && tpVal <= currentMark) tpWarning = 'TP must be above Mark Price';
          if (!isLong && tpVal >= currentMark) tpWarning = 'TP must be below Mark Price';
        }
        let slWarning = '';
        if (slVal > 0) {
          if (isLong && slVal >= currentMark) slWarning = 'SL must be below Mark Price';
          if (!isLong && slVal <= currentMark) slWarning = 'SL must be above Mark Price';
        }

        const setTargetByRoi = (type: 'TP' | 'SL', roiPct: number) => {
          const targetPnl = tpslModal.totalCost * (roiPct / 100);
          if (type === 'TP') {
            const tp = isLong ? tpslModal.entryPrice + (targetPnl / tpslModal.quantity) : tpslModal.entryPrice - (targetPnl / tpslModal.quantity);
            setTpPrice(tp.toFixed(4));
          } else {
            const riskPnl = tpslModal.totalCost * (Math.abs(roiPct) / 100);
            const sl = isLong ? tpslModal.entryPrice - (riskPnl / tpslModal.quantity) : tpslModal.entryPrice + (riskPnl / tpslModal.quantity);
            if (sl > 0) setSlPrice(sl.toFixed(4));
          }
        };

        const executeOrder = async () => {
          if (!tpPrice && !slPrice) return toast.error('Enter at least one target');
          if (tpWarning || slWarning) return toast.error('Fix pricing errors before submitting');
          setIsSubmittingTpsl(true);
          try {
            const res = await fetch('/api/binance/order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbol: tpslModal.symbol.replace('-ISOLATED', '').replace('-CROSS', ''),
                marginMode: tpslModal.symbol.includes('-ISOLATED') ? 'isolated' : (tpslModal.symbol.includes('-CROSS') ? 'cross' : undefined),
                side: tpslModal.mode,
                type: (tpPrice && slPrice) ? 'OCO' : (tpPrice ? 'LIMIT' : 'STOP_LOSS_LIMIT'),
                quantity: tpslModal.quantity,
                price: tpPrice || undefined,
                stopPrice: slPrice || undefined,
                limitPrice: slPrice || undefined
              })
            });
            if (res.ok) {
              toast.success('TP/SL order placed successfully!');
              setTpslModal(null);
              setTpPrice('');
              setSlPrice('');
              fetchPositions();
            } else {
              const err = await res.json();
              toast.error(err.error || 'Failed to place order');
            }
          } catch {
            toast.error('Network error');
          } finally {
            setIsSubmittingTpsl(false);
          }
        };

        const cleanSym = tpslModal.symbol.replace('-ISOLATED', '').replace('-CROSS', '');

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(7,9,14,0.88)', backdropFilter: 'blur(16px)' }}>
            <div className="w-full max-w-[400px] rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-[#2b3139]/80" style={{ background: 'linear-gradient(145deg,#181a20 0%,#1e2329 100%)' }}>

              {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="relative px-5 pt-5 pb-4 border-b border-[#2b3139]">
                {/* coloured side bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-tl-2xl ${isLong ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`} />
                <div className="flex items-center justify-between pl-2">
                  <div className="flex items-center gap-3">
                    <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${isLong ? 'bg-[#0ecb81]/15 text-[#0ecb81]' : 'bg-[#f6465d]/15 text-[#f6465d]'}`}>
                      {isLong ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-[#eaecef] font-bold text-base leading-tight">{cleanSym}</p>
                      <p className={`text-[11px] font-semibold ${isLong ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                        {positionSide} Â· {tpslModal.quantity} units
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setTpslModal(null); setTpPrice(''); setSlPrice(''); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2b3139] hover:bg-[#3b4351] text-[#848e9c] hover:text-[#eaecef] transition-all"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* Price Context Bar */}
                <div className="flex gap-2 mt-4 pl-2">
                  <div className="flex-1 bg-[#0b0e11] rounded-xl px-3 py-2.5 border border-[#2b3139]">
                    <p className="text-[9px] text-[#5e6673] uppercase tracking-widest font-bold mb-0.5">Entry</p>
                    <p className="text-[#eaecef] font-mono font-semibold text-sm">{tpslModal.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</p>
                  </div>
                  <div className="flex-1 bg-[#0b0e11] rounded-xl px-3 py-2.5 border border-[#fcd535]/25">
                    <p className="text-[9px] text-[#5e6673] uppercase tracking-widest font-bold mb-0.5">Mark</p>
                    <p className="text-[#fcd535] font-mono font-semibold text-sm">{currentMark.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</p>
                  </div>
                  {rr !== null && (
                    <div className="flex-1 bg-[#0b0e11] rounded-xl px-3 py-2.5 border border-[#2b3139]">
                      <p className="text-[9px] text-[#5e6673] uppercase tracking-widest font-bold mb-0.5">R:R</p>
                      <p className="text-[#eaecef] font-mono font-semibold text-sm">{rr.toFixed(1)}x</p>
                    </div>
                  )}
                </div>
              </div>

              {/* â”€â”€ Body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
              <div className="px-5 py-4 space-y-5">

                {/* Take Profit */}
                <div>
                  {/* Label + live P&L */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#0ecb81]" />
                      <span className="text-xs font-bold text-[#eaecef] uppercase tracking-wider">Take Profit</span>
                    </div>
                    {tpVal > 0 && !tpWarning && (
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${tpPnl >= 0 ? 'text-[#0ecb81] bg-[#0ecb81]/10' : 'text-[#f6465d] bg-[#f6465d]/10'}`}>
                        {tpPnl >= 0 ? '+' : ''}{tpPnl.toFixed(2)} USDT&nbsp;
                        <span className="opacity-70">({tpRoi >= 0 ? '+' : ''}{tpRoi.toFixed(1)}%)</span>
                      </span>
                    )}
                    {tpWarning && <span className="text-[10px] font-bold text-[#f6465d]">{tpWarning}</span>}
                  </div>

                  {/* Input */}
                  <div className={`flex items-center rounded-xl bg-[#0b0e11] border transition-all ${tpWarning ? 'border-[#f6465d]' : 'border-[#2b3139] hover:border-[#0ecb81]/40 focus-within:border-[#0ecb81] focus-within:shadow-[0_0_0_1px_#0ecb8122]'}`}>
                    <div className="w-10 flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0ecb81" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </div>
                    <input
                      type="number"
                      value={tpPrice}
                      onChange={e => setTpPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && executeOrder()}
                      placeholder="Target priceâ€¦"
                      className="flex-1 bg-transparent py-3 text-[#eaecef] font-mono text-sm outline-none placeholder-[#3b4351]"
                    />
                    <span className="pr-3 text-[#5e6673] text-[11px] font-mono shrink-0">USDT</span>
                  </div>

                  {/* Quick % */}
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 5, 10, 20].map(pct => (
                      <button key={pct} onClick={() => setTargetByRoi('TP', pct)}
                        className="flex-1 py-1.5 rounded-lg bg-[#0ecb81]/8 hover:bg-[#0ecb81]/20 text-[#0ecb81] text-[10px] font-bold font-mono transition-all border border-[#0ecb81]/15 hover:border-[#0ecb81]/40">
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Separator */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-[#2b3139]" />
                  <span className="text-[10px] text-[#474d57] font-bold tracking-widest uppercase">or</span>
                  <div className="flex-1 h-px bg-[#2b3139]" />
                </div>

                {/* Stop Loss */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#f6465d]" />
                      <span className="text-xs font-bold text-[#eaecef] uppercase tracking-wider">Stop Loss</span>
                    </div>
                    {slVal > 0 && !slWarning && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md text-[#f6465d] bg-[#f6465d]/10">
                        {slPnl.toFixed(2)} USDT&nbsp;
                        <span className="opacity-70">({slRoi.toFixed(1)}%)</span>
                      </span>
                    )}
                    {slWarning && <span className="text-[10px] font-bold text-[#f6465d]">{slWarning}</span>}
                  </div>

                  <div className={`flex items-center rounded-xl bg-[#0b0e11] border transition-all ${slWarning ? 'border-[#f6465d]' : 'border-[#2b3139] hover:border-[#f6465d]/40 focus-within:border-[#f6465d] focus-within:shadow-[0_0_0_1px_#f6465d22]'}`}>
                    <div className="w-10 flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f6465d" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <input
                      type="number"
                      value={slPrice}
                      onChange={e => setSlPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && executeOrder()}
                      placeholder="Risk triggerâ€¦"
                      className="flex-1 bg-transparent py-3 text-[#eaecef] font-mono text-sm outline-none placeholder-[#3b4351]"
                    />
                    <span className="pr-3 text-[#5e6673] text-[11px] font-mono shrink-0">USDT</span>
                  </div>

                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 5, 10, 20].map(pct => (
                      <button key={pct} onClick={() => setTargetByRoi('SL', pct)}
                        className="flex-1 py-1.5 rounded-lg bg-[#f6465d]/8 hover:bg-[#f6465d]/20 text-[#f6465d] text-[10px] font-bold font-mono transition-all border border-[#f6465d]/15 hover:border-[#f6465d]/40">
                        -{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Order type badge */}
                {(tpPrice || slPrice) && (
                  <div className="flex justify-center">
                    <span className="text-[10px] font-mono font-bold text-[#5e6673] bg-[#0b0e11] border border-[#2b3139] px-3 py-1 rounded-full">
                      Order type: {(tpPrice && slPrice) ? 'OCO' : tpPrice ? 'LIMIT' : 'STOP LIMIT'}
                    </span>
                  </div>
                )}
              </div>

              {/* ―― Footer ────────────────────────── */}
              <div className="px-5 pb-5 pt-1 space-y-3">
                {/* Primary Submit */}
                <button
                  id="tpsl-submit-btn"
                  onClick={executeOrder}
                  disabled={isSubmittingTpsl || !!tpWarning || !!slWarning || (!tpPrice && !slPrice)}
                  className={`w-full py-3.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2.5 transition-all duration-150 ${
                    isSubmittingTpsl || !!tpWarning || !!slWarning || (!tpPrice && !slPrice)
                      ? 'bg-[#2b3139] text-[#474d57] cursor-not-allowed'
                      : 'bg-[#fcd535] hover:bg-[#f0c800] active:scale-[0.98] text-[#0b0e11] shadow-[0_4px_24px_rgba(252,213,53,0.3)] hover:shadow-[0_6px_32px_rgba(252,213,53,0.45)]'
                  }`}
                >
                  {isSubmittingTpsl ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Placing Order…</>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                      Submit TP / SL Order
                    </>
                  )}
                </button>

                {/* Secondary Cancel */}
                <button
                  onClick={() => { setTpslModal(null); setTpPrice(''); setSlPrice(''); }}
                  disabled={isSubmittingTpsl}
                  className="w-full py-2 text-xs font-bold text-[#5e6673] hover:text-[#848e9c] transition-colors"
                >
                  Cancel
                </button>
              </div>

            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
