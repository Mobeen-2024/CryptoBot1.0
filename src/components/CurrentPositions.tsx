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

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pl-2 mt-2 xl:flex xl:mt-0 xl:shrink-0 xl:gap-3">
                <button onClick={() => dummyAction('Adjust Leverage')} className="bg-[#2b3139] hover:bg-[#474d57] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors text-center w-full xl:w-auto">
                  Adjust Leverage
                </button>
                <button onClick={() => dummyAction('Stop Profit & Loss')} className="bg-[#2b3139] hover:bg-[#474d57] text-[#eaecef] text-[11px] font-medium py-1.5 px-3 rounded transition-colors text-center w-full xl:w-auto">
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
    </div>
  );
}
