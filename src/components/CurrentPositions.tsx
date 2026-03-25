import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { io } from 'socket.io-client';
import { Briefcase, ArrowUpRight, ArrowDownRight, RefreshCw, Crosshair, Cpu } from 'lucide-react';
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
      const cleanSymbol = sym.replace('-ISOLATED', '').replace('-CROSS', '');
      const marginMode = sym.includes('-ISOLATED') ? 'isolated' : sym.includes('-CROSS') ? 'cross' : undefined;
      
      const toastId = toast.loading(`Initiating termination sequence on ${cleanSymbol}...`, {
        style: { background: 'var(--surface-modal)', color: 'var(--holo-cyan)', border: '1px solid var(--holo-cyan)' }
      });
      
      const res = await fetch('/api/binance/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: cleanSymbol,
          side: side,
          type: 'MARKET',
          quantity: quantity,
          marginMode: marginMode,
          params: { isClosingPosition: true }
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Sequence failed');
      }

      toast.success(`Position ${cleanSymbol} Terminated`, { id: toastId });
      fetchPositions(); 
    } catch (err: any) {
      toast.error(err.message, { id: err.message, style: { background: '#0a0d14', color: 'var(--holo-magenta)', border: '1px solid var(--holo-magenta)' } });
    }
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
    socket.on('new_trade', fetchPositions);
    return () => { socket.disconnect(); };
  }, []);

  useEffect(() => {
    if (positions.length === 0) return;
    const rawStreams = positions.map(p => `${p.symbol.split('-')[0].replace('/', '').toLowerCase()}@ticker`);
    const uniqueStreams = [...new Set(rawStreams)];
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${uniqueStreams.join('/')}`;
    
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
       const payload = JSON.parse(event.data);
       if (payload.stream && payload.data) {
           const sym = payload.data.s; 
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
    return () => { if (ws.readyState === WebSocket.OPEN) ws.close(); };
  }, [positions]);

  if (loading) return (
     <div className="h-full flex items-center justify-center text-[var(--holo-cyan)] font-mono text-xs uppercase tracking-widest glass-panel border border-[var(--holo-cyan)]/20 shadow-[0_0_20px_var(--holo-cyan-glow)]">
        <Cpu className="w-5 h-5 animate-pulse mr-3" /> Establishing Uplink...
     </div>
  );

  if (positions.length === 0) return (
     <div className="h-full flex flex-col items-center justify-center text-gray-500 font-mono text-xs uppercase tracking-[0.2em] glass-panel border border-white/5 opacity-80">
        <Crosshair className="w-10 h-10 text-white/10 mb-3" />
        No active engagements
     </div>
  );

  return (
    <div className="glass-panel overflow-hidden flex flex-col h-full bg-transparent shadow-[0_0_30px_rgba(0,0,0,0.5)]">
      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-black/30 shrink-0 relative overflow-hidden group">
        <div className="absolute inset-x-0 bottom-0 h-[1px] bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/40 to-transparent shadow-[0_0_10px_var(--holo-cyan)] opacity-50 group-hover:opacity-100 transition-opacity" />
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative flex items-center justify-center w-6 h-6 bg-[var(--holo-cyan)]/10 rounded-md border border-[var(--holo-cyan)]/30 inner-glow">
             <div className="w-1.5 h-1.5 rounded-full bg-[var(--holo-cyan)] shadow-[0_0_8px_var(--holo-cyan)] animate-ping absolute" />
             <div className="w-1.5 h-1.5 rounded-full bg-[var(--holo-cyan)] shadow-[0_0_8px_var(--holo-cyan)]" />
          </div>
          <h2 className="text-[11px] font-black text-white uppercase tracking-[0.2em] drop-shadow-[0_0_5px_var(--holo-cyan-glow)]">Active Nodes</h2>
          <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[var(--holo-cyan)] text-black ml-1 leading-none">{positions.length}</span>
        </div>
        <span className="text-[9px] text-[var(--holo-cyan)]/60 font-mono tracking-widest uppercase hidden sm:block">Real-Time PNL Stream</span>
      </div>

      {/* ── POSITIONS LIST ── */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar relative z-10">
        <div className="scan-lines pointer-events-none opacity-50 z-0 bg-transparent" />
        {positions.map((pos) => {
          let displaySymbol = pos.symbol;
          let marginTag = 'CROSS_10X';
          if (pos.symbol.includes('-ISOLATED')) {
            displaySymbol = pos.symbol.replace('-ISOLATED', '');
            marginTag = 'ISO_10X';
          } else if (pos.symbol.includes('-CROSS')) {
            displaySymbol = pos.symbol.replace('-CROSS', '');
          }

          const livePrc = livePrices[pos.symbol] || pos.averageEntryPrice;
          const isLong = pos.netQuantity > 0;
          const pnl = isLong 
              ? (pos.netQuantity * livePrc) - pos.totalCost 
              : pos.totalCost - (Math.abs(pos.netQuantity) * livePrc);
          const roi = (pos.totalCost > 0) ? (pnl / pos.totalCost) * 100 : 0;
          const isProfit = pnl >= 0;
          const base = displaySymbol.replace('/', '').replace('USDT', '');
          
          // Theme selection based on PNL health
          const healthColor = isProfit ? 'var(--holo-cyan)' : 'var(--holo-magenta)';
          const healthGlow = isProfit ? 'var(--holo-cyan-glow)' : 'var(--holo-magenta-glow)';

          return (
            <div key={pos.symbol} 
                 className="bg-black/40 backdrop-blur-md rounded-lg border border-white/5 relative overflow-hidden group transition-all duration-300 hover:bg-black/60 z-10"
                 style={{
                   // Dynamic hover glow based on profitability
                   ':hover': { borderColor: `color-mix(in srgb, ${healthColor} 30%, transparent)` }
                 } as any}
            >
              {/* Health Accent Line */}
              <div className="absolute left-0 top-0 bottom-0 w-[2px] transition-colors duration-300 group-hover:w-[4px] group-hover:shadow-[4px_0_15px_currentColor]" style={{ backgroundColor: healthColor, color: healthColor }} />
              
              {/* Subtle Noise Texture on Row */}
              <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

              {/* ── MOBILE LAYOUT (hidden on xl+) ── */}
              <div className="xl:hidden p-3 pl-4 relative z-10">
                <div className="flex items-center justify-between mb-3 border-b border-white/[0.05] pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border flex items-center justify-center text-[10px] font-black" style={{ backgroundColor: `color-mix(in srgb, ${healthColor} 15%, transparent)`, borderColor: `color-mix(in srgb, ${healthColor} 30%, transparent)`, color: healthColor }}>
                      {base.slice(0,2)}
                    </div>
                    <div>
                      <div className="text-[12px] font-black tracking-widest text-white font-mono">{displaySymbol}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className={`text-[8px] font-black tracking-widest px-1 rounded uppercase ${isLong ? 'text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10' : 'text-[var(--holo-magenta)] bg-[var(--holo-magenta)]/10'}`}>{isLong ? 'LONG' : 'SHORT'}</span>
                        <span className="text-[8px] font-black tracking-widest text-[var(--holo-gold)] bg-[var(--holo-gold)]/10 px-1 rounded uppercase">{marginTag}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-black font-mono tracking-tighter drop-shadow-[0_0_8px_currentColor]" style={{ color: healthColor }}>{pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}</div>
                    <div className="text-[10px] font-mono tracking-widest" style={{ color: healthColor }}>{isProfit ? '+' : ''}{roi.toFixed(2)}%</div>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-1 mb-3 bg-white/[0.02] rounded border border-white/[0.05] p-2">
                  <div>
                    <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Entry / Cost</div>
                    <div className="text-[10px] font-mono text-white font-bold">{pos.averageEntryPrice.toFixed(2)}</div>
                    <div className="text-[9px] font-mono text-gray-400">${pos.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
                  </div>
                  <div className="text-center border-x border-white/[0.05]">
                    <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Mark</div>
                    <div className="text-[10px] font-mono text-[var(--holo-gold)] font-bold">{livePrc.toFixed(2)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] text-gray-500 uppercase font-bold tracking-widest">Size</div>
                    <div className="text-[10px] font-mono text-white font-bold">{Math.abs(pos.netQuantity).toFixed(4)}</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button onClick={() => { setTpslModal({ symbol: pos.symbol, quantity: Math.abs(pos.netQuantity), mode: pos.netQuantity > 0 ? 'SELL' : 'BUY', entryPrice: pos.averageEntryPrice, totalCost: pos.totalCost }); setTpPrice(pos.tpPrice ? pos.tpPrice.toString() : ''); setSlPrice(pos.slPrice ? pos.slPrice.toString() : ''); }}
                    className="flex-1 py-1.5 rounded border border-white/10 text-[10px] font-black font-mono tracking-widest uppercase text-gray-300 hover:text-[var(--holo-gold)] hover:border-[var(--holo-gold)]/50 transition-colors bg-white/[0.01]">Overrides</button>
                    <button onClick={() => { const currentLev = parseInt(marginTag?.match(/\d+/)?.[0] || '10'); setLeverageValue(currentLev); setMarginType(pos.symbol.includes('-ISOLATED') ? 'ISOLATED' : 'CROSS'); setLeverageModal({ symbol: pos.symbol, totalCost: pos.totalCost }); }}
                    className="flex-1 py-1.5 rounded border border-white/10 text-[10px] font-black font-mono tracking-widest uppercase text-gray-300 hover:text-[var(--holo-cyan)] hover:border-[var(--holo-cyan)]/50 transition-colors bg-white/[0.01]">Lev</button>
                  <button onClick={() => handleClosePosition(pos.symbol, pos.netQuantity)}
                    className="flex-1 py-1.5 rounded border border-[var(--holo-magenta)]/30 text-[10px] font-black font-mono tracking-widest uppercase text-[var(--holo-magenta)] hover:bg-[var(--holo-magenta)] hover:text-white transition-all shadow-[inset_0_0_10px_var(--holo-magenta-glow)] cursor-crosshair">Term</button>
                </div>
              </div>

              {/* ── DESKTOP LAYOUT (hidden below xl) ── */}
              <div className="hidden xl:flex xl:items-center xl:gap-6 p-2.5 pl-5 relative z-10 transition-colors group-hover:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.01)_50%,transparent)]">
                {/* Node Identity */}
                <div className="flex items-center gap-3 w-[180px] shrink-0">
                  <div className="w-8 h-8 rounded border flex flex-col items-center justify-center leading-none shadow-[0_0_15px_currentColor]" style={{ backgroundColor: `color-mix(in srgb, ${healthColor} 5%, transparent)`, borderColor: `color-mix(in srgb, ${healthColor} 30%, transparent)`, color: healthColor }}>
                    <span className="text-[8px] font-black uppercase opacity-60 mb-[1px]">NOD</span>
                    <span className="text-[11px] font-black">{base.slice(0,1)}</span>
                  </div>
                  <div className="flex flex-col">
                    <h3 className="font-black text-white text-[12px] tracking-[0.1em]">{displaySymbol}</h3>
                    <div className="flex gap-1 mt-0.5">
                      <span className={`text-[9px] px-1 rounded-sm font-black font-mono tracking-widest uppercase ${isLong ? 'text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10' : 'text-[var(--holo-magenta)] bg-[var(--holo-magenta)]/10'}`}>{isLong ? 'LONG' : 'SHORT'}</span>
                      <span className="text-[9px] text-[var(--holo-gold)] bg-[var(--holo-gold)]/10 px-1 rounded-sm font-black font-mono tracking-widest uppercase">{marginTag}</span>
                    </div>
                  </div>
                </div>

                {/* Cyber Matrix Data */}
                <div className="flex flex-1 justify-between items-center bg-black/50 rounded-lg border border-white/[0.02] px-4 py-2">
                  <div className="flex flex-col w-1/4">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5">Live Delta</span>
                    <div className="flex items-baseline gap-2">
                       <span className="text-[14px] font-black font-mono tracking-tighter drop-shadow-[0_0_10px_currentColor]" style={{ color: healthColor }}>
                         {pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                       </span>
                       <span className="text-[10px] font-mono tracking-widest font-bold" style={{ color: healthColor }}>{isProfit ? '+' : ''}{roi.toFixed(2)}%</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col w-1/4 border-l border-white/[0.05] pl-4">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 flex justify-between pr-4"><span>Size</span><span>Cost</span></span>
                    <div className="flex justify-between pr-4 items-baseline">
                      <span className="text-[12px] font-bold font-mono text-white tracking-widest">{Math.abs(pos.netQuantity).toString()}</span>
                      <span className="text-[10px] font-mono text-gray-400 tracking-widest">${pos.totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  <div className="flex flex-col w-1/4 border-l border-white/[0.05] pl-4">
                     <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 flex justify-between pr-4"><span>Entry</span><span>Mark</span></span>
                     <div className="flex justify-between pr-4 items-baseline">
                      <span className="text-[11px] font-bold font-mono text-white tracking-widest">{pos.averageEntryPrice.toFixed(2)}</span>
                      <span className="text-[11px] font-black font-mono text-[var(--holo-gold)] tracking-widest">{livePrc.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col w-1/4 border-l border-white/[0.05] pl-4">
                     <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 text-center">Protocol Limits</span>
                     <div className="flex gap-1.5 justify-center items-center h-full">
                       <span className="text-[11px] font-black font-mono tracking-widest text-[var(--holo-cyan)]">{pos.tpPrice ? pos.tpPrice.toFixed(4) : '-'}</span>
                       <span className="text-white/20">|</span>
                       <span className="text-[11px] font-black font-mono tracking-widest text-[var(--holo-magenta)]">{pos.slPrice ? pos.slPrice.toFixed(4) : '-'}</span>
                     </div>
                  </div>
                </div>

                {/* Tactical Actions */}
                <div className="flex gap-2 shrink-0 ml-2">
                  <button onClick={() => { const currentLev = parseInt(marginTag?.match(/\d+/)?.[0] || '10'); setLeverageValue(currentLev); setMarginType(pos.symbol.includes('-ISOLATED') ? 'ISOLATED' : 'CROSS'); setLeverageModal({ symbol: pos.symbol, totalCost: pos.totalCost }); }}
                    className="p-2 bg-white/[0.02] border border-white/10 hover:border-[var(--holo-gold)] hover:bg-[var(--holo-gold)]/10 text-gray-400 hover:text-[var(--holo-gold)] rounded-lg transition-all" title="Adjust Margin/Leverage">
                    <Crosshair className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => { setTpslModal({ symbol: pos.symbol, quantity: Math.abs(pos.netQuantity), mode: pos.netQuantity > 0 ? 'SELL' : 'BUY', entryPrice: pos.averageEntryPrice, totalCost: pos.totalCost }); setTpPrice(pos.tpPrice ? pos.tpPrice.toString() : ''); setSlPrice(pos.slPrice ? pos.slPrice.toString() : ''); }}
                    className="p-2 bg-white/[0.02] border border-white/10 hover:border-white/30 text-gray-400 hover:text-white rounded-lg font-black tracking-widest text-[9px] uppercase font-mono flex items-center transition-all">
                    Overrides
                  </button>
                  <button onClick={() => handleClosePosition(pos.symbol, pos.netQuantity)}
                    className="group relative items-center justify-center p-2 bg-[var(--holo-magenta)]/10 border border-[var(--holo-magenta)]/30 hover:bg-[var(--holo-magenta)] rounded-lg transition-all cursor-crosshair ml-1 shadow-[inset_0_0_10px_var(--holo-magenta-glow)] hover:shadow-[0_0_20px_var(--holo-magenta-glow)]" title="Terminate Position">
                    <svg className="w-3.5 h-3.5 text-[var(--holo-magenta)] group-hover:text-black transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── TP/SL HUD OVERRIDE MODAL ─── */}
      {tpslModal && (() => {
        const isLong = tpslModal.mode === 'SELL';
        const positionSide = isLong ? 'LONG_NODE' : 'SHORT_NODE';
        const tpVal = parseFloat(tpPrice) || 0;
        const slVal = parseFloat(slPrice) || 0;
        const currentMark = livePrices[tpslModal.symbol] || tpslModal.entryPrice;

        const tpPnl = tpVal > 0 ? (isLong ? (tpVal - tpslModal.entryPrice) * tpslModal.quantity : (tpslModal.entryPrice - tpVal) * tpslModal.quantity) : 0;
        const slPnl = slVal > 0 ? (isLong ? (slVal - tpslModal.entryPrice) * tpslModal.quantity : (tpslModal.entryPrice - slVal) * tpslModal.quantity) : 0;
        const tpRoi = (tpslModal.totalCost > 0 && tpPnl !== 0) ? (tpPnl / tpslModal.totalCost) * 100 : 0;
        const slRoi = (tpslModal.totalCost > 0 && slPnl !== 0) ? (slPnl / tpslModal.totalCost) * 100 : 0;

        let tpWarning = '';
        if (tpVal > 0) {
          if (isLong && tpVal <= currentMark) tpWarning = 'ERR: TP <= MARK';
          if (!isLong && tpVal >= currentMark) tpWarning = 'ERR: TP >= MARK';
        }
        let slWarning = '';
        if (slVal > 0) {
          if (isLong && slVal >= currentMark) slWarning = 'ERR: SL >= MARK';
          if (!isLong && slVal <= currentMark) slWarning = 'ERR: SL <= MARK';
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
          if (!tpPrice && !slPrice) return toast.error('Requires valid targeting sequence');
          if (tpWarning || slWarning) return toast.error('Resolve firing solutions before execution');
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
              toast.success('Protocol Override Accepted');
              setTpslModal(null); setTpPrice(''); setSlPrice(''); fetchPositions();
            } else {
              const err = await res.json();
              toast.error(err.error || 'Execution Rejected');
            }
          } catch {
            toast.error('Uplink Failed');
          } finally {
            setIsSubmittingTpsl(false);
          }
        };

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(5,7,10,0.92)', backdropFilter: 'blur(20px)' }}>
            <div className="w-full max-w-[420px] rounded-xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,1)] border border-white/10 glass-card relative isolate">
              
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-white/[0.02] rounded-full blur-[80px] pointer-events-none" />
              <div className="noise-grain opacity-20 pointer-events-none" />
              
              <div className="px-6 pt-6 pb-4 border-b border-white/[0.05] relative z-10 font-mono">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-[14px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                       <Crosshair className="w-4 h-4 text-[var(--holo-cyan)]" /> SYS.OVERRIDE
                    </h3>
                    <p className="text-[10px] text-gray-500 tracking-widest mt-1">TARGET_LOCKED // {tpslModal.symbol}</p>
                  </div>
                  <button onClick={() => { setTpslModal(null); setTpPrice(''); setSlPrice(''); }} className="text-gray-500 hover:text-white transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <div className="flex gap-2">
                  <div className="flex-1 bg-black/50 border border-white/5 p-2 rounded flex flex-col items-center">
                    <span className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">Entry</span>
                    <span className="text-[12px] font-black text-white">{tpslModal.entryPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex-1 bg-black/50 border border-[var(--holo-gold)]/20 p-2 rounded flex flex-col items-center shadow-[inset_0_0_15px_var(--holo-gold-glow)]">
                    <span className="text-[9px] font-bold text-[var(--holo-gold)] uppercase tracking-widest mb-1">Live Mark</span>
                    <span className="text-[12px] font-black text-[var(--holo-gold)]">{currentMark.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 space-y-6 relative z-10 font-mono">
                {/* TAKE PROFIT NODE */}
                <div className="relative pl-4 border-l-2 border-[var(--holo-cyan)] group focus-within:border-[var(--holo-cyan)]">
                   <div className="absolute top-0 -left-1.5 w-2.5 h-2.5 bg-[var(--holo-cyan)] rounded shadow-[0_0_10px_var(--holo-cyan-glow)]" />
                   <div className="flex justify-between items-baseline mb-2">
                     <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase">Set Take Profit</span>
                     {tpVal > 0 && !tpWarning && (
                       <span className="text-[10px] font-bold text-[var(--holo-cyan)] tracking-widest drop-shadow-[0_0_5px_currentColor]">+{tpPnl.toFixed(2)} USDT ({tpRoi.toFixed(1)}%)</span>
                     )}
                     {tpWarning && <span className="text-[10px] font-bold text-[var(--holo-magenta)] tracking-widest animate-pulse">{tpWarning}</span>}
                   </div>
                   <input 
                     type="number" value={tpPrice} onChange={e => setTpPrice(e.target.value)}
                     className="w-full bg-transparent text-white font-black text-lg outline-none border-b border-white/20 pb-2 focus:border-[var(--holo-cyan)] transition-colors placeholder:text-gray-700"
                     placeholder="0.0000"
                   />
                   <div className="flex gap-1 mt-3">
                     {[5, 15, 25, 50].map(pct => (
                       <button key={pct} onClick={() => setTargetByRoi('TP', pct)} className="flex-1 py-1 rounded bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] text-[9px] font-black tracking-widest border border-transparent hover:border-[var(--holo-cyan)]/50 transition-all">+{pct}%</button>
                     ))}
                   </div>
                </div>

                {/* STOP LOSS NODE */}
                <div className="relative pl-4 border-l-2 border-[var(--holo-magenta)] group focus-within:border-[var(--holo-magenta)] mt-8">
                   <div className="absolute top-0 -left-1.5 w-2.5 h-2.5 bg-[var(--holo-magenta)] rounded shadow-[0_0_10px_var(--holo-magenta-glow)]" />
                   <div className="flex justify-between items-baseline mb-2">
                     <span className="text-[10px] font-black text-white tracking-[0.2em] uppercase">Set Risk Limit</span>
                     {slVal > 0 && !slWarning && (
                       <span className="text-[10px] font-bold text-[var(--holo-magenta)] tracking-widest drop-shadow-[0_0_5px_currentColor]">{slPnl.toFixed(2)} USDT ({slRoi.toFixed(1)}%)</span>
                     )}
                     {slWarning && <span className="text-[10px] font-bold text-[var(--holo-magenta)] tracking-widest animate-pulse">{slWarning}</span>}
                   </div>
                   <input 
                     type="number" value={slPrice} onChange={e => setSlPrice(e.target.value)}
                     className="w-full bg-transparent text-white font-black text-lg outline-none border-b border-white/20 pb-2 focus:border-[var(--holo-magenta)] transition-colors placeholder:text-gray-700"
                     placeholder="0.0000"
                   />
                   <div className="flex gap-1 mt-3">
                     {[5, 10, 20].map(pct => (
                       <button key={pct} onClick={() => setTargetByRoi('SL', pct)} className="flex-1 py-1 rounded bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] text-[9px] font-black tracking-widest border border-transparent hover:border-[var(--holo-magenta)]/50 transition-all">-{pct}%</button>
                     ))}
                     <button onClick={() => setSlPrice(tpslModal.entryPrice.toFixed(4))} className="flex-[1.5] py-1 rounded bg-white/5 text-white text-[9px] font-black tracking-widest border border-white/10 hover:border-white/40 transition-all uppercase">Break Even</button>
                   </div>
                </div>
              </div>

              <div className="p-6 pt-2">
                <button onClick={executeOrder} disabled={isSubmittingTpsl || !!tpWarning || !!slWarning || (!tpPrice && !slPrice)}
                   className={`w-full py-3.5 rounded-lg text-[12px] uppercase font-black tracking-[0.3em] font-mono transition-all duration-300 flex items-center justify-center gap-3 ${
                    isSubmittingTpsl || !!tpWarning || !!slWarning || (!tpPrice && !slPrice)
                      ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                      : 'bg-gradient-to-r from-[var(--holo-cyan)] to-[var(--holo-cyan)]/70 text-black border border-[var(--holo-cyan)]/50 shadow-[0_0_30px_var(--holo-cyan-glow)] hover:brightness-125'  
                   }`}>
                   {isSubmittingTpsl ? 'TRANSMITTING...' : 'COMMIT PROTOCOL'}
                </button>
              </div>
            </div>
          </div>, document.body
        );
      })()}

      {/* ─── LEVERAGE HUD OVERRIDE MODAL ─── */}
      {leverageModal && (() => {
        const cleanSym = leverageModal.symbol.replace('-ISOLATED', '').replace('-CROSS', '');
        
        const executeLeverageChange = async () => {
          setIsSubmittingLeverage(true);
          try {
            const res = await fetch('/api/binance/leverage', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ symbol: cleanSym, leverage: leverageValue, marginType: marginType.toLowerCase() })
            });
            if (res.ok) {
              toast.success(`Margin sync complete: ${marginType} ${leverageValue}x`);
              setLeverageModal(null); fetchPositions();
            } else {
              const err = await res.json(); toast.error(err.error || 'Sync Rejected');
            }
          } catch { toast.error('Uplink Failed');
          } finally { setIsSubmittingLeverage(false); }
        };

        return createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(5,7,10,0.92)', backdropFilter: 'blur(20px)' }}>
            <div className="w-full max-w-[420px] rounded-xl overflow-hidden shadow-[0_0_80px_rgba(0,0,0,1)] border border-[var(--holo-gold)]/30 glass-card relative isolate">
              
              <div className="absolute inset-0 bg-[linear-gradient(135deg,transparent,rgba(252,213,53,0.05))] pointer-events-none" />
              <div className="noise-grain opacity-20 pointer-events-none" />
              
              <div className="px-6 pt-6 pb-4 border-b border-[var(--holo-gold)]/20 relative z-10 font-mono">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-[14px] font-black text-white uppercase tracking-[0.3em] flex items-center gap-2">
                       <Cpu className="w-4 h-4 text-[var(--holo-gold)]" /> MARGIN.LINK
                    </h3>
                    <p className="text-[10px] text-gray-500 tracking-widest mt-1">NODE // {cleanSym}</p>
                  </div>
                  <button onClick={() => setLeverageModal(null)} className="text-gray-500 hover:text-white transition-colors">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>

              <div className="px-6 py-8 space-y-8 relative z-10 font-mono">
                
                {/* Margin Mode Selector */}
                <div>
                  <div className="flex items-center justify-between mb-3 text-[10px] font-black text-[var(--holo-gold)] tracking-[0.2em] uppercase">SYSTEM MODE</div>
                  <div className="flex bg-black/60 rounded border border-white/5 p-1">
                    <button onClick={() => setMarginType('CROSS')} className={`flex-1 py-3 text-[11px] font-black tracking-widest uppercase rounded transition-all ${marginType === 'CROSS' ? 'bg-[var(--holo-gold)]/20 text-[var(--holo-gold)] shadow-[inset_0_0_15px_var(--holo-gold-glow)]' : 'text-gray-500 hover:text-white'}`}>Cross Linked</button>
                    <button onClick={() => setMarginType('ISOLATED')} className={`flex-1 py-3 text-[11px] font-black tracking-widest uppercase rounded transition-all ${marginType === 'ISOLATED' ? 'bg-[var(--holo-gold)]/20 text-[var(--holo-gold)] shadow-[inset_0_0_15px_var(--holo-gold-glow)]' : 'text-gray-500 hover:text-white'}`}>Isolated</button>
                  </div>
                </div>

                {/* Leverage Slider */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black text-[var(--holo-gold)] tracking-[0.2em] uppercase">MULTIPLIER</span>
                    <div className="flex items-baseline border-b-2 border-[var(--holo-gold)] pb-1 px-2 shadow-[0_5px_10px_-5px_var(--holo-gold-glow)]">
                      <input type="number" value={leverageValue} onChange={e => setLeverageValue(Math.min(125, Math.max(1, parseInt(e.target.value) || 1)))} className="w-12 bg-transparent text-white font-black text-2xl outline-none text-right" />
                      <span className="text-[var(--holo-gold)] text-[12px] font-black ml-1">X</span>
                    </div>
                  </div>
                  
                  <div className="relative w-full h-8 flex items-center mt-6 group">
                    <input type="range" min="1" max="125" step="1" value={leverageValue} onChange={e => setLeverageValue(parseInt(e.target.value))} 
                           className="w-full relative z-10 appearance-none bg-transparent cursor-crosshair
                           [&::-webkit-slider-runnable-track]:bg-white/10 [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-none 
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:bg-[var(--holo-gold)] [&::-webkit-slider-thumb]:rounded-none [&::-webkit-slider-thumb]:-mt-[8px] [&::-webkit-slider-thumb]:shadow-[0_0_15px_var(--holo-gold-glow)] group-hover:[&::-webkit-slider-thumb]:scale-110 transition-all font-mono" />
                    <div className="absolute left-0 h-1 bg-[var(--holo-gold)] shadow-[0_0_10px_var(--holo-gold-glow)] z-0 pointer-events-none transition-all duration-75" style={{ width: `${((leverageValue - 1) / 124) * 100}%` }} />
                  </div>
                  
                  <div className="flex justify-between mt-3">
                    {[1, 20, 50, 100, 125].map(val => (
                      <span key={val} className="text-[10px] font-black tracking-widest text-gray-500 hover:text-[var(--holo-gold)] cursor-crosshair transition-colors" onClick={() => setLeverageValue(val)}>{val}X</span>
                    ))}
                  </div>
                </div>
                
              </div>

              <div className="p-6 pt-2">
                <button onClick={executeLeverageChange} disabled={isSubmittingLeverage} 
                   className={`w-full py-4 rounded-lg text-[12px] uppercase font-black tracking-[0.3em] font-mono transition-all duration-300 flex items-center justify-center gap-3 ${
                    isSubmittingLeverage ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-[var(--holo-gold)] to-[#d4af37] text-black shadow-[0_0_40px_var(--holo-gold-glow)] hover:brightness-125'  
                   }`}>
                   {isSubmittingLeverage ? 'SYNCING...' : 'CONFIRM LINK'}
                </button>
              </div>

            </div>
          </div>, document.body
        );
      })()}
    </div>
  );
}
