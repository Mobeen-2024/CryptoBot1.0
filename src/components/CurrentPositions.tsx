import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Briefcase, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

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

    const streams = positions.map(p => `${p.symbol.replace('/', '').toLowerCase()}@ticker`).join('/');
    const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
    
    const ws = new WebSocket(wsUrl);
    ws.onmessage = (event) => {
       const payload = JSON.parse(event.data);
       if (payload.stream && payload.data) {
           const sym = payload.data.s; // Output: BTCUSDT
           // The API gives us BTC/USDT so we need to match it roughly
           const positionSymbol = positions.find(p => p.symbol.replace('/', '') === sym)?.symbol;
           if (positionSymbol) {
               setLivePrices(prev => ({
                   ...prev,
                   [positionSymbol]: parseFloat(payload.data.c)
               }));
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
      
      <div className="flex-1 overflow-x-auto p-2">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 text-gray-500">
              <th className="p-2 text-xs font-semibold uppercase tracking-wider">Asset</th>
              <th className="p-2 text-xs font-semibold uppercase tracking-wider text-right">Size (Net)</th>
              <th className="p-2 text-xs font-semibold uppercase tracking-wider text-right">Avg Entry</th>
              <th className="p-2 text-xs font-semibold uppercase tracking-wider text-right">Mark Price</th>
              <th className="p-2 text-xs font-semibold uppercase tracking-wider text-right">Unrl. PnL (USDT)</th>
              <th className="p-2 text-xs font-semibold uppercase tracking-wider text-right">ROI %</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos) => {
              const livePrc = livePrices[pos.symbol] || pos.averageEntryPrice;
              const currentValue = pos.netQuantity * livePrc;
              const pnl = currentValue - pos.totalCost;
              const roi = (pnl / pos.totalCost) * 100;
              
              const isProfit = pnl >= 0;

              return (
                <tr key={pos.symbol} className="border-b border-white/5 hover:bg-white/5 transition-colors group">
                  <td className="p-2 font-mono text-sm font-bold text-white flex items-center gap-1.5">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse hidden group-hover:block" />
                     {pos.symbol}
                  </td>
                  <td className="p-2 font-mono text-sm text-gray-300 text-right">{pos.netQuantity.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                  <td className="p-2 font-mono text-sm text-gray-400 text-right">${pos.averageEntryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-2 font-mono text-sm text-white text-right font-semibold">${livePrc.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className={`p-2 font-mono text-sm text-right font-bold ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                    ${pnl >= 0 ? '+' : ''}{pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className={`p-2 font-mono text-sm text-right flex items-center justify-end gap-1 ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {isProfit ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {Math.abs(roi).toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
