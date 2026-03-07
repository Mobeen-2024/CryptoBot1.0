import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, RefreshCw } from 'lucide-react';

interface Trade {
  slave_id: string;
  master_trade_id: string;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  timestamp: number;
}

interface ChartDataPoint {
  time: string;
  timestamp: number;
  MASTER: number;
  [slaveId: string]: string | number; // allowing numeric PnL values per slave
}

export function PerformanceChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [slavesFound, setSlavesFound] = useState<string[]>([]);
  
  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backend/trades');
      if (!res.ok) throw new Error('Network response was not ok');
      const rawTrades: Trade[] = await res.json();
      
      if (rawTrades.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // We need to calculate cumulative PnL.
      // For simplicity in this demo, let's track "spend vs acquired value" roughly as an Equity Curve 
      // or simply plot the executed price disparities to show slippage gaps.
      
      // A more standard approach for a trade copier is plotting cumulative PnL % per account.
      // We will group trades by master_trade_id (which syncs a master trade and its slave copies)
      
      const chartPoints: Record<string, ChartDataPoint> = {};
      const foundSlaveIds = new Set<string>();

      // Initialize base tracking
      let masterCumulativePnL = 0;
      const slaveCumulativePnL: Record<string, number> = {};

      // Identify all unique slaves first
      rawTrades.forEach(t => {
        if (!t.slave_id.startsWith('master')) {
             foundSlaveIds.add(t.slave_id);
             if (slaveCumulativePnL[t.slave_id] === undefined) slaveCumulativePnL[t.slave_id] = 0;
        }
      });
      
      setSlavesFound(Array.from(foundSlaveIds));

      // Group chronologically
      rawTrades.forEach((trade) => {
         const timeKey = new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
         
         if (!chartPoints[timeKey]) {
            chartPoints[timeKey] = {
               time: timeKey,
               timestamp: trade.timestamp,
               MASTER: masterCumulativePnL, // Carry forward
            };
            Array.from(foundSlaveIds).forEach(id => {
               chartPoints[timeKey][id] = slaveCumulativePnL[id] || 0;
            });
         }

         // Simplistic PnL calc for visualization: Buy = negative cash flow (subtract price*qty), Sell = positive cash flow (add price*qty)
         // In a real system, you'd calculate realized PnL against closed positions.
         // Here we visualize "Net Flow" which beautifully graphs execution divergence.
         const flow = (trade.side.toLowerCase() === 'sell' ? 1 : -1) * (trade.price * trade.quantity);

         // We associate webhook/master flows pseudo-randomly to the Master line if their ID matches a master tag.
         // Wait, the DB only tracks 'copied_fills' -> meaning we only have SLAVE executions in this DB schema!
         // To plot Master vs Slave, we use the `trade.price` (slave execution) vs `trade.master_price` (if we had it).
         // Given `copied_fills_v2` schema: we have `slave_id` and `price`.
         
         slaveCumulativePnL[trade.slave_id] += flow;
         chartPoints[timeKey][trade.slave_id] = slaveCumulativePnL[trade.slave_id];
         
         // Let's create a faux "Master" line by assuming Master got 0 slippage (ideal execution) 
         // For a webhook, it's just the exact price. We'll use the first slave's price as the anchor if master isn't tracked identically.
         // Update: `copied_fills_v2` tracks exactly what the slave executed. 
      });

      const finalData = Object.values(chartPoints).sort((a, b) => a.timestamp - b.timestamp);
      setData(finalData);

    } catch (error) {
       console.error("Failed to load analytics", error);
    } finally {
       setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    
    // Replace HTTP polling with real-time WebSockets
    const socket = io();
    socket.on('new_trade', (trade) => {
        console.log('Real-time execution detected, updating chart:', trade);
        fetchAnalytics();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const getLineColor = (index: number) => {
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-white/5 backdrop-blur-md rounded border border-white/10 p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          Performance Analytics (PnL Net Flow)
        </h2>
        <button onClick={fetchAnalytics} className="text-gray-500 hover:text-white transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      <div className="flex-1 w-full min-h-[200px]">
        {data.length === 0 && !loading ? (
          <div className="h-full flex items-center justify-center text-gray-500 text-xs font-mono">
            No trade execution history found.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="#ffffff40" 
                fontSize={10} 
                tickMargin={10}
                tick={{ fill: '#ffffff60' }}
              />
              <YAxis 
                stroke="#ffffff40" 
                fontSize={10} 
                tickFormatter={(val) => `$${val.toFixed(2)}`}
                tick={{ fill: '#ffffff60' }}
                domain={['auto', 'auto']}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#000000ee', border: '1px solid #ffffff20', borderRadius: '4px', fontSize: '12px' }}
                itemStyle={{ color: '#fff' }}
                labelStyle={{ color: '#aaa', marginBottom: '4px' }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              
              {slavesFound.map((slaveId, idx) => (
                <Line 
                    key={slaveId}
                    type="monotone" 
                    dataKey={slaveId} 
                    name={`Slave (${slaveId})`}
                    stroke={getLineColor(idx)} 
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
