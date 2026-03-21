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
      
      // Strip margin suffixes to get clean symbol for the API
      const cleanSymbol = sym.replace('-ISOLATED', '').replace('-CROSS', '');
      // Determine margin mode from the symbol suffix
      const marginMode = sym.includes('-ISOLATED') ? 'isolated' : sym.includes('-CROSS') ? 'cross' : undefined;
      
      const toastId = toast.loading(`Closing ${cleanSymbol}...`);
      
      const res = await fetch('/api/binance/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: cleanSymbol,
          side: side,
          type: 'MARKET',
          quantity: quantity,
          marginMode: marginMode,
          params: {
            isClosingPosition: true
          }
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to close position');
      }

      toast.success(`Position ${cleanSymbol} closed`, { id: toastId });
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
    <div className="bg-[#0b0e11] overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/5 bg-[#181a20] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse" />
          <h2 className="text-[11px] font-bold text-white uppercase tracking-widest">Active Positions</h2>
          <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">{positions.length}</span>
        </div>
        <span className="text-[9px] text-gray-500 font-mono tracking-widest">REAL-TIME PNL</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar max-h-[400px]">
        {positions.map((pos) => {
          let displaySymbol = pos.symbol;
          let marginTag = 'Cross 10x';
          if (pos.symbol.includes('-ISOLATED')) {
            displaySymbol = pos.symbol.replace('-ISOLATED', '');
            marginTag = 'Isolated 10x';
          } else if (pos.symbol.includes('-CROSS')) {
            displaySymbol = pos.symbol.replace('-CROSS', '');
            marginTag = 'Cross 10x';
          }

          const livePrc = livePrices[pos.symbol] || pos.averageEntryPrice;
          const isLong = pos.netQuantity > 0;
          const pnl = isLong 
              ? (pos.netQuantity * livePrc) - pos.totalCost 
              : pos.totalCost - (Math.abs(pos.netQuantity) * livePrc);
          const roi = (pos.totalCost > 0) ? (pnl / pos.totalCost) * 100 : 0;
          const isProfit = pnl >= 0;
          const base = displaySymbol.replace('/', '').replace('USDT', '');

          return (
            <div key={pos.symbol} className="bg-[#1e2329] rounded-lg border border-transparent hover:border-[#2b3139] transition-colors relative overflow-hidden">
              {/* Left accent bar */}
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-emerald-500 rounded-l-lg opacity-80" />

              {/* ── MOBILE LAYOUT (hidden on xl+) ── */}
              <div className="xl:hidden p-3 pl-4">
                {/* Top row: pair + PNL */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-emerald-500/15 flex items-center justify-center text-[9px] font-black text-emerald-400">{base.slice(0,2)}</div>
                    <div>
                      <div className="text-[12px] font-bold text-white font-mono">{displaySymbol}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[8px] font-bold px-1 rounded ${isLong ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>{isLong ? 'LONG' : 'SHORT'}</span>
                        <span className="text-[8px] font-bold text-yellow-400 bg-yellow-500/10 px-1 rounded">{marginTag}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-[14px] font-bold font-mono ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}</div>
                    <div className={`text-[10px] font-mono ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>{isProfit ? '+' : ''}{roi.toFixed(2)}%</div>
                  </div>
                </div>
                {/* Mid row: entry / mark / cost */}
                <div className="grid grid-cols-3 gap-1 mb-2 bg-black/20 rounded-lg p-2">
                  <div>
                    <div className="text-[9px] text-gray-600 uppercase tracking-wide">Entry</div>
                    <div className="text-[10px] font-mono text-gray-300">{pos.averageEntryPrice.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-gray-600 uppercase tracking-wide">Mark</div>
                    <div className="text-[10px] font-mono text-yellow-400 font-bold">{livePrc.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] text-gray-600 uppercase tracking-wide">Size</div>
                    <div className="text-[10px] font-mono text-gray-300">{Math.abs(pos.netQuantity).toFixed(4)}</div>
                  </div>
                </div>
                {/* TP/SL row */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-gray-600">TP</span>
                    <span className="text-[10px] font-mono text-emerald-400">{pos.tpPrice ? pos.tpPrice.toFixed(2) : '—'}</span>
                    <span className="text-[9px] text-gray-700">/</span>
                    <span className="text-[9px] text-gray-600">SL</span>
                    <span className="text-[10px] font-mono text-rose-400">{pos.slPrice ? pos.slPrice.toFixed(2) : '—'}</span>
                  </div>
                  <span className="text-[9px] font-mono text-gray-600">${pos.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
                {/* Action buttons */}
                <div className="flex gap-2">
                  <button onClick={() => { setTpslModal({ symbol: pos.symbol, quantity: Math.abs(pos.netQuantity), mode: pos.netQuantity > 0 ? 'SELL' : 'BUY', entryPrice: pos.averageEntryPrice, totalCost: pos.totalCost }); setTpPrice(pos.tpPrice ? pos.tpPrice.toString() : ''); setSlPrice(pos.slPrice ? pos.slPrice.toString() : ''); }}
                    className="flex-1 py-1.5 rounded bg-[#2b3139] hover:bg-[#474d57] text-yellow-400 text-[10px] font-bold transition-colors">TP / SL</button>
                  <button onClick={() => handleClosePosition(pos.symbol, pos.netQuantity)}
                    className="flex-1 py-1.5 rounded bg-[#2b3139] hover:bg-rose-500/80 text-rose-400 hover:text-white text-[10px] font-bold transition-colors">Close</button>
                </div>
              </div>

              {/* ── DESKTOP LAYOUT (hidden below xl) ── */}
              <div className="hidden xl:flex xl:items-center xl:gap-8 p-2 pl-4">
                {/* Symbol + margin tag */}
                <div className="flex items-center gap-2 w-[200px] shrink-0">
                  <div className="w-5 h-5 bg-emerald-500/20 rounded flex items-center justify-center text-emerald-500 font-bold text-[10px]">B</div>
                  <h3 className="font-bold text-[#eaecef] text-sm tracking-wide">{displaySymbol}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border ${isLong ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                    {isLong ? 'LONG' : 'SHORT'}
                  </span>
                  {marginTag && (
                    <span className="text-[10px] text-[#fcd535] bg-[#fcd535]/10 px-1.5 py-0.5 rounded font-mono border border-[#fcd535]/20">{marginTag}</span>
                  )}
                </div>

                {/* 4-Column Data */}
                <div className="flex flex-1 justify-between items-center">
                  {/* PNL */}
                  <div className="flex flex-col w-1/4">
                    <span className="text-[#848e9c] text-[10px] mb-0.5 border-b border-dashed border-[#848e9c]/50 w-max">Unrealized PNL (USDT)</span>
                    <span className={`text-base font-bold font-mono ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      {pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={`text-[11px] font-mono font-medium ${isProfit ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{isProfit ? '+' : ''}{roi.toFixed(2)}%</span>
                  </div>
                  {/* Size */}
                  <div className="flex flex-col w-1/4">
                    <span className="text-[#848e9c] text-[10px] mb-0.5 border-b border-dashed border-[#848e9c]/50 w-max">Realized PNL</span>
                    <span className="text-[13px] font-bold font-mono text-[#eaecef]">0.00</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[#848e9c] text-[10px]">Size:</span>
                      <span className="text-[11px] font-mono text-[#eaecef]">{Math.abs(pos.netQuantity).toString()}</span>
                    </div>
                  </div>
                  {/* TP/SL */}
                  <div className="flex flex-col w-1/4">
                    <span className="text-[#848e9c] text-[10px] mb-0.5 border-b border-dashed border-[#848e9c]/50 w-max">Take Profit / Stop Loss</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[12px] font-bold font-mono text-[#0ecb81]">{pos.tpPrice ? pos.tpPrice.toFixed(4) : '-'}</span>
                      <span className="text-[#5e6673] text-[10px]">&frasl;</span>
                      <span className="text-[12px] font-bold font-mono text-[#f6465d]">{pos.slPrice ? pos.slPrice.toFixed(4) : '-'}</span>
                    </div>
                  </div>
                  {/* Cost & Entry */}
                  <div className="flex flex-col w-1/4">
                    <span className="text-[#848e9c] text-[10px] mb-0.5 border-b border-dashed border-[#848e9c]/50 w-max">Cost (USDT)</span>
                    <span className="text-[13px] font-bold font-mono text-[#eaecef]">{pos.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[#848e9c] text-[10px]">Entry / Mark:</span>
                      <span className="text-[11px] font-mono text-[#eaecef]">{pos.averageEntryPrice.toFixed(2)} / <span className="text-[#fcd535]">{livePrc.toFixed(2)}</span></span>
                    </div>
                  </div>
                </div>

                {/* 3 Action Buttons */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { const currentLev = parseInt(marginTag?.match(/\d+/)?.[0] || '10'); setLeverageValue(currentLev); setMarginType(pos.symbol.includes('-ISOLATED') ? 'ISOLATED' : 'CROSS'); setLeverageModal({ symbol: pos.symbol, totalCost: pos.totalCost }); }}
                    className="bg-[#2b3139] hover:bg-[#474d57] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors whitespace-nowrap">
                    Adjust Leverage
                  </button>
                  <button onClick={() => { setTpslModal({ symbol: pos.symbol, quantity: Math.abs(pos.netQuantity), mode: pos.netQuantity > 0 ? 'SELL' : 'BUY', entryPrice: pos.averageEntryPrice, totalCost: pos.totalCost }); setTpPrice(pos.tpPrice ? pos.tpPrice.toString() : ''); setSlPrice(pos.slPrice ? pos.slPrice.toString() : ''); }}
                    className="bg-[#2b3139] hover:bg-[#474d57] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors whitespace-nowrap">
                    Stop Profit &amp; Loss
                  </button>
                  <button onClick={() => handleClosePosition(pos.symbol, pos.netQuantity)}
                    className="bg-[#2b3139] hover:bg-[#f6465d] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors whitespace-nowrap">
                    Close Position
                  </button>
                </div>
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
            <div className="w-full max-w-[400px] rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-[var(--border-subtle)]" style={{ background: 'var(--surface-modal)' }}>

              {/* ─── Header ───────────────────────────────────────── */}
              <div className="relative px-5 pt-5 pb-4 border-b border-[var(--border-subtle)]">
                {/* coloured side bar */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-tl-2xl ${isLong ? 'bg-[var(--tp-green)]' : 'bg-[var(--sl-red)]'}`} />
                <div className="flex items-center justify-between pl-2">
                  <div className="flex items-center gap-3">
                    <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm ${isLong ? 'bg-[var(--tp-green)]/15 text-[var(--tp-green)]' : 'bg-[var(--sl-red)]/15 text-[var(--sl-red)]'}`}>
                      {isLong ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="text-[var(--text-primary)] font-bold text-base leading-tight">{cleanSym}</p>
                      <p className={`text-[11px] font-semibold ${isLong ? 'text-[var(--tp-green)]' : 'text-[var(--sl-red)]'}`}>
                        {positionSide} Â· {tpslModal.quantity} units
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setTpslModal(null); setTpPrice(''); setSlPrice(''); }}
                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                {/* Price Context Bar */}
                <div className="flex gap-2 mt-4 pl-2">
                  <div className="flex-1 bg-[var(--surface-card)] rounded-xl px-3 py-2.5 border border-[var(--border-subtle)]">
                    <p className="text-[9px] text-[#5e6673] uppercase tracking-widest font-bold mb-0.5">Entry</p>
                    <p className="text-[var(--text-primary)] font-mono font-semibold text-sm">{tpslModal.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</p>
                  </div>
                  <div className="flex-1 bg-[var(--surface-card)] rounded-xl px-3 py-2.5 border border-[var(--primary-yellow)]/30">
                    <p className="text-[9px] text-[var(--primary-yellow)] opacity-80 uppercase tracking-widest font-bold mb-0.5">Mark</p>
                    <p className="text-[var(--primary-yellow)] font-mono font-semibold text-sm">{currentMark.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</p>
                  </div>
                  {rr !== null && (
                    <div className="flex-1 bg-[var(--surface-card)] rounded-xl px-3 py-2.5 border border-[var(--border-subtle)]">
                      <p className="text-[9px] text-[#5e6673] uppercase tracking-widest font-bold mb-0.5">R:R</p>
                      <p className="text-[var(--text-primary)] font-mono font-semibold text-sm">{rr.toFixed(1)}x</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ─── Body ────────────────────────────────────────── */}
              <div className="px-5 py-4 space-y-5">

                {/* Take Profit */}
                <div>
                  {/* Label + live P&L */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--tp-green)]" />
                      <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Take Profit</span>
                    </div>
                    {tpVal > 0 && !tpWarning && (
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${tpPnl >= 0 ? 'text-[var(--tp-green)] bg-[var(--tp-green)]/10' : 'text-[var(--sl-red)] bg-[var(--sl-red)]/10'}`}>
                        {tpPnl >= 0 ? '+' : ''}{tpPnl.toFixed(2)} USDT&nbsp;
                        <span className="opacity-70">({tpRoi >= 0 ? '+' : ''}{tpRoi.toFixed(1)}%)</span>
                      </span>
                    )}
                    {tpWarning && <span className="text-[10px] font-bold text-[var(--sl-red)]">{tpWarning}</span>}
                  </div>

                  {/* Input */}
                  <div className={`flex items-center rounded-xl bg-[var(--surface-card)] border transition-all ${tpWarning ? 'border-[var(--sl-red)]' : 'border-[var(--border-subtle)] hover:border-[var(--tp-green)]/40 focus-within:border-[var(--tp-green)] focus-within:shadow-[0_0_0_1px_var(--tp-green)]'}`}>
                    <div className="w-10 flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tp-green)" strokeWidth="2" strokeLinecap="round"><polyline points="18 15 12 9 6 15"/></svg>
                    </div>
                    <input
                      type="number"
                      value={tpPrice}
                      onChange={e => setTpPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && executeOrder()}
                      placeholder="Target price…"
                      className="flex-1 bg-transparent py-3 text-[var(--text-primary)] font-mono text-sm outline-none placeholder-[var(--text-secondary)]"
                    />
                    <span className="pr-3 text-[#5e6673] text-[11px] font-mono shrink-0">USDT</span>
                  </div>

                  {/* Quick % */}
                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 5, 10, 20].map(pct => (
                      <button key={pct} onClick={() => setTargetByRoi('TP', pct)}
                        className="flex-1 py-1.5 rounded-lg text-[var(--tp-green)] text-[10px] font-bold font-mono transition-all border border-[var(--border-subtle)] bg-transparent hover:bg-[var(--tp-green)]/10 hover:border-[var(--tp-green)]/30 active:bg-[var(--tp-green)] active:text-[var(--surface-modal)]">
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Separator */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                  <span className="text-[10px] text-[#474d57] font-bold tracking-widest uppercase">or</span>
                  <div className="flex-1 h-px bg-[var(--border-subtle)]" />
                </div>

                {/* Stop Loss */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[var(--sl-red)]" />
                      <span className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">Stop Loss</span>
                    </div>
                    {slVal > 0 && !slWarning && (
                      <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-md text-[var(--sl-red)] bg-[var(--sl-red)]/10">
                        {slPnl.toFixed(2)} USDT&nbsp;
                        <span className="opacity-70">({slRoi.toFixed(1)}%)</span>
                      </span>
                    )}
                    {slWarning && <span className="text-[10px] font-bold text-[var(--sl-red)]">{slWarning}</span>}
                  </div>

                  <div className={`flex items-center rounded-xl bg-[var(--surface-card)] border transition-all ${slWarning ? 'border-[var(--sl-red)]' : 'border-[var(--border-subtle)] hover:border-[var(--sl-red)]/40 focus-within:border-[var(--sl-red)] focus-within:shadow-[0_0_0_1px_var(--sl-red)]'}`}>
                    <div className="w-10 flex items-center justify-center shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--sl-red)" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                    <input
                      type="number"
                      value={slPrice}
                      onChange={e => setSlPrice(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && executeOrder()}
                      placeholder="Risk trigger…"
                      className="flex-1 bg-transparent py-3 text-[var(--text-primary)] font-mono text-sm outline-none placeholder-[var(--text-secondary)]"
                    />
                    <span className="pr-3 text-[#5e6673] text-[11px] font-mono shrink-0">USDT</span>
                  </div>

                  <div className="flex gap-1.5 mt-2">
                    {[1, 2, 5, 10, 20].map(pct => (
                      <button key={pct} onClick={() => setTargetByRoi('SL', pct)}
                        className="flex-1 py-1.5 rounded-lg text-[var(--sl-red)] text-[10px] font-bold font-mono transition-all border border-[var(--border-subtle)] bg-transparent hover:bg-[var(--sl-red)]/10 hover:border-[var(--sl-red)]/30 active:bg-[var(--sl-red)] active:text-[var(--surface-modal)]">
                        -{pct}%
                      </button>
                    ))}
                    <button onClick={() => setSlPrice(tpslModal.entryPrice.toFixed(4))}
                      className="flex-[1.5] py-1.5 rounded-lg bg-[var(--surface-card)] hover:bg-[var(--surface-card-hover)] text-[var(--text-primary)] text-[10px] font-bold font-mono transition-all border border-[var(--border-subtle)] hover:border-[var(--text-primary)]/50"
                      title="Set Stop Loss to exact Entry Price (Risk-Free)">
                      Break Even
                    </button>
                  </div>
                </div>

                {/* Order type badge */}
                {(tpPrice || slPrice) && (
                  <div className="flex justify-center">
                    <span className="text-[10px] font-mono font-bold text-[#5e6673] bg-[var(--surface-card)] border border-[var(--border-subtle)] px-3 py-1 rounded-full">
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
                      ? 'bg-[var(--surface-card)] text-[#474d57] cursor-not-allowed border border-[var(--border-subtle)]'
                      : 'text-[var(--surface-modal)] active:scale-[0.98]'
                  }`}
                  style={(!isSubmittingTpsl && !tpWarning && !slWarning && (tpPrice || slPrice)) ? {
                    background: 'linear-gradient(180deg, var(--primary-yellow) 0%, #e0bc2f 100%)',
                    boxShadow: 'var(--shadow-glow)'
                  } : {}}
                >
                  {isSubmittingTpsl ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Placing Order…</>
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
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

      {/* ─── Leverage Modal ─────────────────────────────────────── */}
      {leverageModal && (() => {
        const cleanSym = leverageModal.symbol.replace('-ISOLATED', '').replace('-CROSS', '');
        
        const executeLeverageChange = async () => {
          setIsSubmittingLeverage(true);
          try {
            const res = await fetch('/api/binance/leverage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                symbol: cleanSym,
                leverage: leverageValue,
                marginType: marginType.toLowerCase()
              })
            });
            if (res.ok) {
              toast.success(`Margin updated: ${marginType} ${leverageValue}x`);
              setLeverageModal(null);
              fetchPositions();
            } else {
              const err = await res.json();
              toast.error(err.error || 'Failed to adjust leverage');
            }
          } catch {
            toast.error('Network error');
          } finally {
            setIsSubmittingLeverage(false);
          }
        };

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(7,9,14,0.88)', backdropFilter: 'blur(16px)' }}>
            <div className="w-full max-w-[400px] rounded-2xl overflow-hidden shadow-[0_25px_60px_rgba(0,0,0,0.8)] border border-[#2b3139]/80" style={{ background: 'linear-gradient(145deg,#181a20 0%,#1e2329 100%)' }}>
              
              {/* Header */}
              <div className="relative px-5 pt-5 pb-4 border-b border-[#2b3139]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#fcd535]/10 flex items-center justify-center text-[#fcd535]">
                      <Briefcase className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-[#eaecef] font-bold text-base leading-tight">Adjust Leverage</p>
                      <p className="text-[11px] font-semibold text-[#848e9c]">{cleanSym}</p>
                    </div>
                  </div>
                  <button onClick={() => setLeverageModal(null)} className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#2b3139] hover:bg-[#3b4351] text-[#848e9c] hover:text-[#eaecef] transition-all">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="px-5 py-5 space-y-6">
                
                {/* Margin Mode Selector */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-bold text-[#eaecef] uppercase tracking-wider">Margin Mode</span>
                  </div>
                  <div className="flex bg-[#0b0e11] rounded-xl p-1 border border-[#2b3139]">
                    <button onClick={() => setMarginType('CROSS')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${marginType === 'CROSS' ? 'bg-[#2b3139] text-[#eaecef] shadow-[0_2px_8px_rgba(0,0,0,0.5)]' : 'text-[#5e6673] hover:text-[#848e9c]'}`}>Cross</button>
                    <button onClick={() => setMarginType('ISOLATED')} className={`flex-1 py-2 text-[11px] font-bold rounded-lg transition-all ${marginType === 'ISOLATED' ? 'bg-[#2b3139] text-[#eaecef] shadow-[0_2px_8px_rgba(0,0,0,0.5)]' : 'text-[#5e6673] hover:text-[#848e9c]'}`}>Isolated</button>
                  </div>
                </div>

                {/* Leverage Slider */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-[#eaecef] uppercase tracking-wider">Leverage</span>
                    <div className="flex items-center bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2 py-1">
                      <input type="number" value={leverageValue} onChange={e => setLeverageValue(Math.min(125, Math.max(1, parseInt(e.target.value) || 1)))} className="w-10 bg-transparent text-[#eaecef] font-mono text-sm outline-none text-right" />
                      <span className="text-[#5e6673] text-[11px] font-mono ml-1">x</span>
                    </div>
                  </div>
                  <div className="relative w-full h-8 flex items-center">
                    <input type="range" min="1" max="125" step="1" value={leverageValue} onChange={e => setLeverageValue(parseInt(e.target.value))} className="w-full relative z-10 appearance-none bg-transparent cursor-pointer [&::-webkit-slider-runnable-track]:bg-[#2b3139] [&::-webkit-slider-runnable-track]:h-1.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#fcd535] [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:-mt-[5px] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(252,213,53,0.5)]" />
                    <div className="absolute left-0 h-1.5 bg-[#fcd535] rounded-l-full z-0 pointer-events-none" style={{ width: `${((leverageValue - 1) / 124) * 100}%` }} />
                  </div>
                  <div className="flex justify-between mt-1 px-1">
                    {[1, 10, 20, 50, 100, 125].map(val => (
                      <span key={val} className="text-[9px] font-mono text-[#5e6673] cursor-pointer hover:text-[#eaecef]" onClick={() => setLeverageValue(val)}>{val}x</span>
                    ))}
                  </div>
                </div>
                
              </div>

              {/* Footer */}
              <div className="px-5 pb-5 pt-1 space-y-3">
                <button onClick={executeLeverageChange} disabled={isSubmittingLeverage} className={`w-full py-3.5 rounded-xl text-sm font-extrabold flex items-center justify-center gap-2.5 transition-all duration-150 ${isSubmittingLeverage ? 'bg-[#2b3139] text-[#474d57] cursor-not-allowed' : 'bg-[#fcd535] hover:bg-[#f0c800] active:scale-[0.98] text-[#0b0e11] shadow-[0_4px_24px_rgba(252,213,53,0.3)] hover:shadow-[0_6px_32px_rgba(252,213,53,0.45)]'}`}>
                  {isSubmittingLeverage ? <><RefreshCw className="w-4 h-4 animate-spin" /> Updating…</> : 'Confirm Adjustment'}
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
