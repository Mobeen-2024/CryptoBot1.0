import React, { useMemo, useState } from 'react';
import { AlignJustify, ArrowDown, ArrowUp } from 'lucide-react';

interface OrderBookProps {
  bids: [string, string][]; // [price, quantity]
  asks: [string, string][];
}

type ViewMode = 'FULL' | 'BIDS' | 'ASKS';

export const OrderBook = React.memo(({ bids, asks }: OrderBookProps) => {
  const [viewMode, setViewMode] = useState<ViewMode>('FULL');
  const [precision, setPrecision] = useState<number>(2);

  const { asksWithTotal, bidsWithTotal, maxTotal } = useMemo(() => {
    let currentAskTotal = 0;
    // Asks come sorted lowest to highest price. We want to display highest to lowest.
    // Cumulative total builds up from the lowest ask price (closest to the spread).
    const asksList = asks.slice(0, viewMode === 'FULL' ? 15 : 30).map(ask => {
      currentAskTotal += parseFloat(ask[1]);
      return { price: ask[0], amount: ask[1], total: currentAskTotal };
    }).reverse();

    let currentBidTotal = 0;
    // Bids come sorted highest to lowest price. Cumulative total builds from highest bid.
    const bidsList = bids.slice(0, viewMode === 'FULL' ? 15 : 30).map(bid => {
      currentBidTotal += parseFloat(bid[1]);
      return { price: bid[0], amount: bid[1], total: currentBidTotal };
    });

    const maxTotal = Math.max(currentAskTotal, currentBidTotal);

    return { asksWithTotal: asksList, bidsWithTotal: bidsList, maxTotal };
  }, [bids, asks, viewMode]);

  const formatNumber = (num: number | string, decimals: number = 4) => {
    const val = typeof num === 'string' ? parseFloat(num) : num;
    return val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const spread = asks.length > 0 && bids.length > 0 
    ? parseFloat(asks[0][0]) - parseFloat(bids[0][0]) 
    : 0;
  const spreadPercent = asks.length > 0 && bids.length > 0 
    ? (spread / parseFloat(asks[0][0])) * 100 
    : 0;

  return (
    <div className="flex flex-col h-full text-[11px] font-mono">
      {/* Controls */}
      <div className="flex items-center justify-between px-2 mb-2">
        <div className="flex bg-black/40 rounded border border-white/5 p-0.5">
          <button 
            onClick={() => setViewMode('FULL')}
            className={`p-1 rounded transition-colors ${viewMode === 'FULL' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Order Book"
          >
            <AlignJustify className="w-3 h-3" />
          </button>
          <button 
            onClick={() => setViewMode('BIDS')}
            className={`p-1 rounded transition-colors ${viewMode === 'BIDS' ? 'bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)]' : 'text-gray-500 hover:text-[var(--holo-cyan)]/70'}`}
            title="Buy Orders"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
          <button 
            onClick={() => setViewMode('ASKS')}
            className={`p-1 rounded transition-colors ${viewMode === 'ASKS' ? 'bg-[var(--holo-magenta)]/20 text-[var(--holo-magenta)]' : 'text-gray-500 hover:text-[var(--holo-magenta)]/70'}`}
            title="Sell Orders"
          >
            <ArrowUp className="w-3 h-3" />
          </button>
        </div>
        
        <div className="flex items-center gap-1">
          <select 
            value={precision} 
            onChange={(e) => setPrecision(Number(e.target.value))}
            className="bg-black/40 border border-white/5 rounded text-gray-400 text-[10px] px-1 py-0.5 focus:outline-none focus:border-white/20"
          >
            <option value={0}>1</option>
            <option value={1}>0.1</option>
            <option value={2}>0.01</option>
            <option value={3}>0.001</option>
            <option value={4}>0.0001</option>
          </select>
        </div>
      </div>

      <div className="flex justify-between text-gray-500 mb-1 px-2 uppercase tracking-wider text-[9px]">
        <span className="w-1/3 text-left">Price</span>
        <span className="w-1/3 text-right">Amount</span>
        <span className="w-1/3 text-right">Total</span>
      </div>
      
      <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col pb-2">
        {/* Asks */}
        {(viewMode === 'FULL' || viewMode === 'ASKS') && (
          <div className="flex flex-col">
            {asksWithTotal.map((ask, i) => {
              const depth = maxTotal > 0 ? (ask.total / maxTotal) * 100 : 0;
              return (
                <div key={`ask-${i}`} className="relative flex justify-between hover:bg-white/5 px-2 py-[2px] cursor-pointer group">
                  <div className="absolute top-0 right-0 h-full bg-[var(--holo-magenta)]/10 transition-all duration-200" style={{ width: `${depth}%` }} />
                  <span className="w-1/3 text-left text-[var(--holo-magenta)] relative z-10">{formatNumber(ask.price, precision)}</span>
                  <span className="w-1/3 text-right text-gray-300 relative z-10">{formatNumber(ask.amount, 4)}</span>
                  <span className="w-1/3 text-right text-gray-500 relative z-10">{formatNumber(ask.total, 4)}</span>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Spread / Current Price Indicator */}
        <div className="my-1 py-1.5 px-2 flex items-center justify-between bg-black/20 border-y border-white/5">
           <div className="flex items-center gap-2">
             <span className={`text-sm font-bold ${asks.length > 0 && bids.length > 0 ? 'text-[var(--holo-cyan)] drop-shadow-[0_0_8px_var(--holo-cyan)]' : 'text-gray-400'}`}>
               {asks.length > 0 ? formatNumber(asks[0][0], precision) : '---'}
             </span>
             {asks.length > 0 && bids.length > 0 && (
               <ArrowUp className="w-3 h-3 text-[var(--holo-cyan)]" />
             )}
           </div>
           <div className="flex flex-col items-end">
             <span className="text-[9px] text-gray-500">Spread</span>
             <span className="text-[10px] text-gray-400">{formatNumber(spread, precision)} ({spreadPercent.toFixed(2)}%)</span>
           </div>
        </div>
        
        {/* Bids */}
        {(viewMode === 'FULL' || viewMode === 'BIDS') && (
          <div className="flex flex-col">
            {bidsWithTotal.map((bid, i) => {
              const depth = maxTotal > 0 ? (bid.total / maxTotal) * 100 : 0;
              return (
                <div key={`bid-${i}`} className="relative flex justify-between hover:bg-white/5 px-2 py-[2px] cursor-pointer group">
                  <div className="absolute top-0 right-0 h-full bg-[var(--holo-cyan)]/10 transition-all duration-200" style={{ width: `${depth}%` }} />
                  <span className="w-1/3 text-left text-[var(--holo-cyan)] relative z-10">{formatNumber(bid.price, precision)}</span>
                  <span className="w-1/3 text-right text-gray-300 relative z-10">{formatNumber(bid.amount, 4)}</span>
                  <span className="w-1/3 text-right text-gray-500 relative z-10">{formatNumber(bid.total, 4)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
