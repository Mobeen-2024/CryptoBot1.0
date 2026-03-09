import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Briefcase, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Position {
  symbol: string;
  netQuantity: number;
  averageEntryPrice: number;
  totalCost: number;
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
    toast(action + " feature is available in Pro mode", { icon: 'ℹ️', style: { borderRadius: '8px', background: '#1e2329', color: '#eaecef' }});
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

              {/* 3-Column Data Grid */}
              <div className="grid grid-cols-3 gap-2 pl-2 mb-3 xl:flex xl:flex-1 xl:justify-between xl:items-center xl:mb-0 xl:pl-0">
                
                {/* Column 1: PNL & ROI */}
                <div className="flex flex-col xl:w-1/3">
                  <span className="text-[#848e9c] text-[10px] mb-0.5 border-b border-dashed border-[#848e9c]/50 w-max cursor-help">Unrealized PNL (USDT)</span>
                  <span className={`text-base font-bold font-mono ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                    {pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`text-[11px] font-mono font-medium ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                    {isProfit ? '+' : ''}{roi.toFixed(2)}%
                  </span>
                </div>

                {/* Column 2: Realized & Size */}
                <div className="flex flex-col xl:w-1/3 xl:items-start">
                  <span className="text-[#848e9c] text-[10px] mb-0.5 border-b border-dashed border-[#848e9c]/50 w-max cursor-help">Realized PNL</span>
                  <span className="text-[13px] font-bold font-mono text-[#eaecef]">0.00</span>
                  <div className="mt-1 flex flex-col xl:flex-row xl:items-center xl:gap-2">
                    <span className="text-[#848e9c] text-[10px]">Size:</span>
                    <span className="text-[11px] font-mono text-[#eaecef]">{pos.netQuantity.toString()}</span>
                  </div>
                </div>

                {/* Column 3: Cost & Entry */}
                <div className="flex flex-col text-right xl:text-left xl:w-1/3">
                  <span className="text-[#848e9c] text-[10px] mb-0.5 ml-auto xl:ml-0 border-b border-dashed border-[#848e9c]/50 w-max cursor-help">Cost (USDT)</span>
                  <span className="text-[13px] font-bold font-mono text-[#eaecef]">{pos.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  <div className="mt-1 flex flex-col xl:flex-row xl:items-center xl:gap-2">
                    <span className="text-[#848e9c] text-[10px]">Entry / Mark:</span>
                    <span className="text-[11px] font-mono text-[#eaecef]">{pos.averageEntryPrice.toFixed(2)} / <span className="text-[#fcd535]">{livePrc.toFixed(2)}</span></span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pl-2 mt-2 xl:flex xl:mt-0 xl:shrink-0 xl:gap-3">
                <button onClick={() => toast('Binance locks leverage on open positions. Please close and recreate the order to adjust scaling.', { icon: '⚠️', style: { borderRadius: '8px', background: '#1e2329', color: '#eaecef', fontSize: '11px' }})} className="bg-[#2b3139] hover:bg-[#474d57] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors text-center w-full xl:w-auto">
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
                   setTpPrice('');
                   setSlPrice('');
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

      {/* TP/SL Advanced Modal Overlay (Pro-Grade Redesign) */}
      {tpslModal && (() => {
        const isLong = tpslModal.mode === 'SELL'; // if position is Long, we SELL to close via OCO
        const positionSide = isLong ? 'LONG' : 'SHORT';
        const tpVal = parseFloat(tpPrice) || 0;
        const slVal = parseFloat(slPrice) || 0;
        const currentMark = livePrices[tpslModal.symbol] || tpslModal.entryPrice;

        const tpPnl = tpVal > 0 ? (isLong ? (tpVal - tpslModal.entryPrice) * tpslModal.quantity : (tpslModal.entryPrice - tpVal) * tpslModal.quantity) : 0;
        const slPnl = slVal > 0 ? (isLong ? (slVal - tpslModal.entryPrice) * tpslModal.quantity : (tpslModal.entryPrice - slVal) * tpslModal.quantity) : 0;
        
        const tpRoi = (tpslModal.totalCost > 0 && tpPnl !== 0) ? (tpPnl / tpslModal.totalCost) * 100 : 0;
        const slRoi = (tpslModal.totalCost > 0 && slPnl !== 0) ? (slPnl / tpslModal.totalCost) * 100 : 0;

        let tpWarning = '';
        if (tpVal > 0) {
          if (isLong && tpVal <= currentMark) tpWarning = 'TP must be > Mark Price';
          if (!isLong && tpVal >= currentMark) tpWarning = 'TP must be < Mark Price';
        }
        let slWarning = '';
        if (slVal > 0) {
          if (isLong && slVal >= currentMark) slWarning = 'SL must be < Mark Price';
          if (!isLong && slVal <= currentMark) slWarning = 'SL must be > Mark Price';
        }

        const setTargetByRoi = (type: 'TP'|'SL', roiPct: number) => {
          const targetPnl = tpslModal.totalCost * (roiPct / 100);
          let targetPrice = 0;
          if (type === 'TP') {
            targetPrice = isLong ? tpslModal.entryPrice + (targetPnl / tpslModal.quantity) : tpslModal.entryPrice - (targetPnl / tpslModal.quantity);
            setTpPrice(targetPrice.toFixed(4));
          } else {
            const riskPnl = tpslModal.totalCost * (Math.abs(roiPct) / 100);
            targetPrice = isLong ? tpslModal.entryPrice - (riskPnl / tpslModal.quantity) : tpslModal.entryPrice + (riskPnl / tpslModal.quantity);
            if (targetPrice > 0) setSlPrice(targetPrice.toFixed(4));
          }
        };

        const executeOrder = async () => {
          if (!tpPrice && !slPrice) return toast.error('Submit at least one target');
          if (tpWarning || slWarning) return toast.error('Fix pricing errors before execution');
          setIsSubmittingTpsl(true);
          try {
            const res = await fetch('/api/binance/order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbol: tpslModal.symbol.replace('-ISOLATED', '').replace('-CROSS', ''),
                marginMode: tpslModal.symbol.includes('-ISOLATED') ? 'isolated' : (tpslModal.symbol.includes('-CROSS') ? 'cross' : undefined),
                side: tpslModal.mode,
                type: (tpPrice && slPrice) ? 'OCO' : (tpPrice ? 'LIMIT' : 'STOP_LOSS_LIMIT'), // Dynamic type fallbacks
                quantity: tpslModal.quantity,
                price: tpPrice || undefined,
                stopPrice: slPrice || undefined,
                limitPrice: slPrice || undefined
              })
            });
            if (res.ok) {
              toast.success(`TP/SL Pro Matrix Executed!`, { icon: '🚀' });
              setTpslModal(null);
            } else {
              const err = await res.json();
              toast.error(err.error || 'Failed to place execution triggers');
            }
          } catch (e) {
            toast.error('Network error during placement');
          } finally {
            setIsSubmittingTpsl(false);
          }
        };

        return (
          <div className="fixed inset-0 z-[100] bg-[#000000d0] backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
            <div className="bg-[#181a20] border border-[#2b3139] rounded-2xl shadow-[0_0_80px_rgba(0,0,0,0.8)] w-full max-w-[420px] overflow-hidden flex flex-col font-sans animate-in zoom-in-95 duration-200">
              
              {/* Header */}
              <div className="p-5 border-b border-[#2b3139] flex justify-between items-center bg-[#1e2329]/50">
                <div className="flex items-center gap-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-lg ${isLong ? 'bg-[#0ecb81]/20 text-[#0ecb81]' : 'bg-[#f6465d]/20 text-[#f6465d]'} font-bold text-sm`}>
                    {isLong ? 'L' : 'S'}
                  </div>
                  <div>
                    <h2 className="text-[#eaecef] font-bold text-lg leading-tight tracking-wide">{tpslModal.symbol.replace('-ISOLATED','').replace('-CROSS','')}</h2>
                    <span className={`text-xs font-medium ${isLong ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{positionSide} {tpslModal.quantity}</span>
                  </div>
                </div>
                <button onClick={() => setTpslModal(null)} className="text-[#848e9c] hover:text-[#eaecef] transition-colors p-1.5 bg-[#2b3139] hover:bg-[#3b4351] rounded-full">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>

              {/* Price Context */}
              <div className="grid grid-cols-2 gap-4 p-5 pb-2">
                <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3 shadow-inner">
                  <span className="text-[#848e9c] text-[10px] uppercase font-bold tracking-wider mb-1 block">Entry Price</span>
                  <span className="text-[#eaecef] font-mono text-base">{tpslModal.entryPrice.toFixed(4)}</span>
                </div>
                <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3 shadow-inner border-l-2 border-l-[#fcd535]/80">
                  <span className="text-[#848e9c] text-[10px] uppercase font-bold tracking-wider mb-1 block">Mark Price (Live)</span>
                  <span className="text-[#fcd535] font-mono text-base">{currentMark.toFixed(4)}</span>
                </div>
              </div>

              {/* Inputs */}
              <div className="p-5 pt-3 space-y-5">
                
                {/* Take Profit Input Area */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center h-5">
                    <label className="text-xs font-bold text-[#eaecef]">Take Profit</label>
                    {tpVal > 0 && !tpWarning && (
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${tpRoi >= 0 ? 'text-[#0ecb81] bg-[#0ecb81]/10' : 'text-[#f6465d] bg-[#f6465d]/10'}`}>
                        {tpPnl >= 0 ? '+' : ''}{tpPnl.toFixed(2)} USDT ({tpRoi >= 0 ? '+' : ''}{tpRoi.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                  <div className={`relative group flex items-center bg-[#0b0e11] border transition-colors rounded-xl overflow-hidden focus-within:ring-1 ${tpWarning ? 'border-[#f6465d] focus-within:ring-[#f6465d]' : 'border-[#2b3139] hover:border-[#5e6673] focus-within:border-[#0ecb81] focus-within:ring-[#0ecb81]'}`}>
                    <span className="pl-4 pr-3 text-[#0ecb81] font-bold text-sm select-none border-r border-[#2b3139]">TP</span>
                    <input 
                      type="number" value={tpPrice} onChange={e => setTpPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && executeOrder()}
                      className="flex-1 bg-transparent py-3 pl-3 text-[#eaecef] font-mono text-base outline-none placeholder-[#474d57]" placeholder="Target Price" 
                    />
                    <span className="pr-4 text-[#848e9c] text-xs font-mono select-none">USDT</span>
                  </div>
                  {tpWarning && <p className="text-[#f6465d] text-[10px] font-bold tracking-wide mt-1 animate-pulse">{tpWarning}</p>}
                  
                  {/* ROI Quick Keys */}
                  <div className="flex gap-2">
                    {[25, 50, 100, 200].map(pct => (
                      <button key={pct} onClick={() => setTargetByRoi('TP', pct)} className="flex-1 bg-[#2b3139] hover:bg-[#3b4351] text-[#b7bdc6] hover:text-[#0ecb81] py-1.5 rounded-lg text-[10px] font-mono font-bold transition-colors border border-transparent hover:border-[#0ecb81]/30">
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stop Loss Input Area */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center h-5">
                    <label className="text-xs font-bold text-[#eaecef]">Stop Loss</label>
                    {slVal > 0 && !slWarning && (
                      <span className="text-[11px] font-mono text-[#f6465d] bg-[#f6465d]/10 px-2 py-0.5 rounded font-bold">
                        {slPnl.toFixed(2)} USDT ({slRoi.toFixed(2)}%)
                      </span>
                    )}
                  </div>
                  <div className={`relative group flex items-center bg-[#0b0e11] border transition-colors rounded-xl overflow-hidden focus-within:ring-1 ${slWarning ? 'border-[#f6465d] focus-within:ring-[#f6465d]' : 'border-[#2b3139] hover:border-[#5e6673] focus-within:border-[#f6465d] focus-within:ring-[#f6465d]'}`}>
                    <span className="pl-4 pr-3 text-[#f6465d] font-bold text-sm select-none border-r border-[#2b3139]">SL</span>
                    <input 
                      type="number" value={slPrice} onChange={e => setSlPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && executeOrder()}
                      className="flex-1 bg-transparent py-3 pl-3 text-[#eaecef] font-mono text-base outline-none placeholder-[#474d57]" placeholder="Risk Trigger" 
                    />
                    <span className="pr-4 text-[#848e9c] text-xs font-mono select-none">USDT</span>
                  </div>
                  {slWarning && <p className="text-[#f6465d] text-[10px] font-bold tracking-wide mt-1 animate-pulse">{slWarning}</p>}
                  
                  {/* ROI Quick Keys */}
                  <div className="flex gap-2">
                    {[-10, -25, -50, -75].map(pct => (
                      <button key={pct} onClick={() => setTargetByRoi('SL', pct)} className="flex-1 bg-[#2b3139] hover:bg-[#3b4351] text-[#b7bdc6] hover:text-[#f6465d] py-1.5 rounded-lg text-[10px] font-mono font-bold transition-colors border border-transparent hover:border-[#f6465d]/30">
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>

              </div>

              {/* Footer */}
              <div className="p-5 bg-gradient-to-b from-[#1e2329]/20 to-[#1e2329]/60 border-t border-[#2b3139] flex gap-3">
                <button 
                  onClick={() => setTpslModal(null)} 
                  className="w-1/3 py-3 text-sm font-bold bg-[#2b3139] hover:bg-[#3b4351] text-[#eaecef] rounded-xl transition-colors focus:ring-2 focus:ring-[#5e6673] outline-none"
                  disabled={isSubmittingTpsl}
                >
                  Cancel
                </button>
                <button 
                  onClick={executeOrder} 
                  className={`flex-1 py-3 text-sm font-bold rounded-xl shadow-[0_4px_15px_rgba(252,213,53,0.15)] transition-all flex items-center justify-center pointer-events-auto focus:ring-2 outline-none
                    ${tpWarning || slWarning || (!tpPrice && !slPrice) 
                      ? 'bg-[#2b3139] text-[#5e6673] cursor-not-allowed shadow-none' 
                      : 'bg-[#fcd535] hover:bg-[#fcba03] text-[#0b0e11] focus:ring-[#fcd535]/50'}`}
                  disabled={isSubmittingTpsl || !!tpWarning || !!slWarning || (!tpPrice && !slPrice)}
                >
                  {isSubmittingTpsl ? <RefreshCw className="w-5 h-5 animate-spin text-[#0b0e11]" /> : 'Confirm (Enter)'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
