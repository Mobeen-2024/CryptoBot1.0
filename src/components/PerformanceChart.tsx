import React, { useEffect, useState, useMemo } from 'react';
import { io } from 'socket.io-client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity, RefreshCw, TrendingUp, BarChart2, Layers, Cpu } from 'lucide-react';

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
  TotalNetFlow: number;
  [slaveId: string]: string | number;
}

export function PerformanceChart() {
  const [data, setData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [slavesFound, setSlavesFound] = useState<string[]>([]);
  const [stats, setStats] = useState({ flow: 0, volume: 0, trades: 0, accounts: 0 });

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/backend/trades');
      if (!res.ok) throw new Error('Network response was not ok');
      const rawTrades: Trade[] = await res.json();
      
      if (rawTrades.length === 0) {
        setData([]);
        setStats({ flow: 0, volume: 0, trades: 0, accounts: 0 });
        setLoading(false);
        return;
      }

      const chartPoints: Record<string, ChartDataPoint> = {};
      const foundSlaveIds = new Set<string>();
      const slaveCumulativePnL: Record<string, number> = {};
      
      let totalVolume = 0;
      let totalFlow = 0;

      rawTrades.forEach(t => {
        foundSlaveIds.add(t.slave_id);
        if (slaveCumulativePnL[t.slave_id] === undefined) slaveCumulativePnL[t.slave_id] = 0;
      });
      
      setSlavesFound(Array.from(foundSlaveIds));

      rawTrades.forEach((trade) => {
         const timeKey = new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
         const tradeValue = trade.price * trade.quantity;
         totalVolume += tradeValue;

         if (!chartPoints[timeKey]) {
            chartPoints[timeKey] = { time: timeKey, timestamp: trade.timestamp, TotalNetFlow: totalFlow };
            Array.from(foundSlaveIds).forEach(id => { chartPoints[timeKey][id] = slaveCumulativePnL[id] || 0; });
         }

         const flow = (trade.side.toLowerCase() === 'sell' ? 1 : -1) * tradeValue;
         slaveCumulativePnL[trade.slave_id] += flow;
         totalFlow += flow;

         chartPoints[timeKey][trade.slave_id] = slaveCumulativePnL[trade.slave_id];
         chartPoints[timeKey].TotalNetFlow = totalFlow;
      });

      const finalData = Object.values(chartPoints).sort((a, b) => a.timestamp - b.timestamp);
      setData(finalData);
      setStats({ flow: totalFlow, volume: totalVolume, trades: rawTrades.length, accounts: foundSlaveIds.size });

    } catch (error) {
       console.error("Failed to load analytics", error);
    } finally {
       setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const socket = io();
    socket.on('new_trade', () => fetchAnalytics());
    return () => { socket.disconnect(); };
  }, []);

  // 2035 Cyber Neon Palette
  const colors = ['#00f0ff', '#39ff14', '#bc13fe', '#ff073a', '#fcd535'];

  return (
    <div className="bg-[#05070a] backdrop-blur-2xl rounded-xl border border-white/[0.05] overflow-hidden flex flex-col h-full relative shadow-[0_0_40px_rgba(0,0,0,0.5)]">
      
      {/* Background Decorative Gradient Elements */}
      <div className="absolute top-0 left-1/4 w-1/2 h-px bg-gradient-to-r from-transparent via-[#00f0ff]/50 to-transparent" />
      <div className="absolute bottom-[-50%] left-[-10%] w-[120%] h-[100%] bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-[#00f0ff]/5 via-transparent to-transparent pointer-events-none" />

      {/* Header HUD */}
      <div className="px-5 py-4 border-b border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded border border-[#00f0ff]/30 bg-[#00f0ff]/10 flex items-center justify-center relative inner-glow">
            <Activity className="w-4 h-4 text-[#00f0ff]" />
            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-[#00f0ff] animate-ping rounded-full" />
          </div>
          <div>
            <h2 className="text-[13px] font-black text-white tracking-[0.2em] uppercase">Tactical Analytics</h2>
            <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-0.5">SYS.NET.FLOW_OVERVIEW // V2.0</p>
          </div>
        </div>
        <button onClick={fetchAnalytics} className="flex items-center gap-2 px-3 py-1.5 rounded bg-white/[0.03] border border-white/[0.1] hover:bg-white/[0.1] hover:border-[#00f0ff]/50 transition-all group">
          <RefreshCw className={`w-3.5 h-3.5 text-gray-400 group-hover:text-[#00f0ff] ${loading ? 'animate-spin text-[#00f0ff]' : ''}`} />
          <span className="text-[10px] font-bold text-gray-400 group-hover:text-white uppercase tracking-widest hidden sm:block">Sync</span>
        </button>
      </div>

      {/* Top Statistic Modules */}
      <div className="grid grid-cols-2 md:grid-cols-4 border-b border-white/[0.05] divide-y md:divide-y-0 md:divide-x divide-white/[0.05] shrink-0">
        <StatModule icon={TrendingUp} label="Total Net Flow" value={stats.flow} prefix="$" color={stats.flow >= 0 ? 'text-[#39ff14]' : 'text-[#ff073a]'} />
        <StatModule icon={BarChart2} label="Total Traded Vol" value={stats.volume} prefix="$" color="text-white" />
        <StatModule icon={Layers} label="Executions" value={stats.trades} isInt color="text-[#00f0ff]" />
        <StatModule icon={Cpu} label="Active Nodes" value={stats.accounts} isInt color="text-[#bc13fe]" />
      </div>
      
      {/* Chart Canvas */}
      <div className="flex-1 w-full min-h-[250px] p-4 relative">
        {data.length === 0 && !loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Cpu className="w-8 h-8 text-white/10" />
              <span className="text-[11px] font-mono text-white/30 uppercase tracking-[0.3em]">Awaiting Execution Telemetry</span>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 30, bottom: 0, left: 10 }}>
              <defs>
                {slavesFound.map((id, idx) => (
                  <linearGradient key={`grad-${id}`} id={`color-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={colors[idx % colors.length]} stopOpacity={0.3}/>
                    <stop offset="95%" stopColor={colors[idx % colors.length]} stopOpacity={0}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
              <XAxis 
                dataKey="time" 
                stroke="#ffffff30" 
                fontSize={10} 
                tickMargin={12}
                tick={{ fill: '#ffffff60', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                stroke="#ffffff30" 
                fontSize={10} 
                tickFormatter={(val) => `$${val.toLocaleString()}`}
                tick={{ fill: '#ffffff60', fontFamily: 'monospace' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip colors={colors} />} cursor={{ stroke: '#ffffff30', strokeWidth: 1, strokeDasharray: '4 4' }} />
              
              {slavesFound.map((slaveId, idx) => (
                <Area 
                    key={slaveId}
                    type="monotone" 
                    dataKey={slaveId} 
                    stroke={colors[idx % colors.length]} 
                    strokeWidth={2}
                    fillOpacity={1}
                    fill={`url(#color-${idx})`}
                    activeDot={{ r: 5, stroke: '#05070a', strokeWidth: 2, fill: colors[idx % colors.length] }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// Sub-component for HUD stats
function StatModule({ icon: Icon, label, value, prefix = "", color, isInt = false }: { icon: any, label: string, value: number, prefix?: string, color: string, isInt?: boolean }) {
  return (
    <div className="p-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors relative group">
      <div className="p-2 rounded bg-white/[0.03] border border-white/[0.05] group-hover:border-white/[0.1] transition-colors">
        <Icon className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-1">{label}</span>
        <span className={`text-lg font-mono font-black tracking-tight ${color}`}>
          {prefix}{isInt ? value : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      </div>
    </div>
  );
}

// Advanced Glassmorphism Tooltip
const CustomTooltip = ({ active, payload, label, colors }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0a0d14]/90 backdrop-blur-md p-3 rounded-lg border border-white/[0.1] shadow-2xl relative">
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-[#00f0ff] to-transparent opacity-50" />
        <p className="text-[10px] text-gray-500 font-mono mb-2 pb-2 border-b border-white/[0.1]">TICK: {label}</p>
        <div className="flex flex-col gap-1.5">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-6">
              <span className="text-[11px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                {entry.name}
              </span>
              <span className={`text-[12px] font-mono font-bold ${entry.value >= 0 ? 'text-[#39ff14]' : 'text-[#ff073a]'}`}>
                {entry.value >= 0 ? '+' : ''}${entry.value.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

