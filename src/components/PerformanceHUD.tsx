import React from 'react';
import { Activity, Zap, Cpu, Gauge, ShieldAlert, Coins } from 'lucide-react';
import { cn } from '../utils/cn';

interface LatencyBreakdown {
  exchangeFetch: number;
  logicProcessing: number;
  orderExecution: number;
}

interface PerformanceHUDProps {
  telemetry?: {
    avgLatency: number;
    executionSpeed: number;
    heartbeat: number;
    latencyBreakdown?: LatencyBreakdown;
  };
  netExposureDelta: number;
  accumulatedFees?: number;
  atr?: number;
  dynamicFriction?: number;
}

export const PerformanceHUD = React.memo(({ 
  telemetry, 
  netExposureDelta, 
  accumulatedFees = 0,
  atr,
  dynamicFriction
}: PerformanceHUDProps) => {
  const breakdown = telemetry?.latencyBreakdown || {
    exchangeFetch: telemetry?.avgLatency || 0,
    logicProcessing: 0,
    orderExecution: telemetry?.executionSpeed || 0
  };

  const total = Math.max(breakdown.exchangeFetch + breakdown.logicProcessing + breakdown.orderExecution, 1);
  const hz = total > 0 ? (1000 / total).toFixed(1) : '0.0';
  
  const getWidth = (val: number) => `${Math.max((val / total) * 100, 2)}%`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {/* Telemetry Card */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Institutional Telemetry</h3>
          </div>
          <span className="text-[10px] font-mono text-slate-500">
            Hz: {hz}
          </span>
        </div>

        <div className="space-y-4">
          {/* Latency Pipeline */}
          <div>
            <div className="flex justify-between text-[10px] font-mono mb-1">
              <span className="text-slate-400">Execution Pipeline (Latency)</span>
              <span className="text-cyan-400">{total.toFixed(1)}ms</span>
            </div>
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex">
              <div 
                className="h-full bg-blue-500 transition-all duration-500" 
                style={{ width: getWidth(breakdown.exchangeFetch) }}
                title={`Exchange Fetch: ${breakdown.exchangeFetch.toFixed(1)}ms`}
              />
              <div 
                className="h-full bg-purple-500 transition-all duration-500" 
                style={{ width: getWidth(breakdown.logicProcessing) }}
                title={`Logic Processing: ${breakdown.logicProcessing.toFixed(1)}ms`}
              />
              <div 
                className="h-full bg-emerald-500 transition-all duration-500" 
                style={{ width: getWidth(breakdown.orderExecution) }}
                title={`Order Execution: ${breakdown.orderExecution.toFixed(1)}ms`}
              />
            </div>
            <div className="flex justify-between text-[8px] font-mono mt-1 text-slate-500">
              <span className="text-blue-400">Fetch</span>
              <span className="text-purple-400">Logic</span>
              <span className="text-emerald-400">Exec</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
              <div className="text-[8px] text-slate-500 uppercase">Avg Ping</div>
              <div className="text-xs font-mono text-blue-400">{(breakdown.exchangeFetch).toFixed(0)}<span className="text-[10px]">ms</span></div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
              <div className="text-[8px] text-slate-500 uppercase">Exec</div>
              <div className="text-xs font-mono text-emerald-400">{(breakdown.orderExecution).toFixed(0)}<span className="text-[10px]">ms</span></div>
            </div>
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700/30">
              <div className="text-[8px] text-slate-500 uppercase">Audit</div>
              <div className="text-xs font-mono text-purple-400">{(breakdown.logicProcessing).toFixed(1)}<span className="text-[10px]">ms</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Exposure & Fees Card */}
      <div className="bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 backdrop-blur-md">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Exposure Control</h3>
          </div>
          <div className="flex items-center gap-1">
             <div className={cn("w-2 h-2 rounded-full animate-pulse", Math.abs(netExposureDelta) < 0.1 ? "bg-emerald-500" : "bg-amber-500")} />
             <span className="text-[10px] font-mono text-slate-500">Precision</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Zap className="w-3 h-3" /> Net Delta
              </div>
              <div className={cn(
                "text-lg font-mono font-bold transition-colors",
                Math.abs(netExposureDelta) < 0.05 ? "text-emerald-400" : "text-amber-400"
              )}>
                {netExposureDelta > 0 ? '+' : ''}{netExposureDelta.toFixed(3)}
              </div>
            </div>
            
            <div>
              <div className="text-[10px] text-slate-500 uppercase flex items-center gap-1">
                <Gauge className="w-3 h-3" /> ATR Friction
              </div>
              <div className="text-sm font-mono text-slate-300">
                {dynamicFriction ? `${dynamicFriction.toFixed(2)}` : '0.00'} <span className="text-[10px] text-slate-500">pts</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 rounded-xl p-3 border border-slate-700/50 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 grayscale opacity-70">
              <Coins className="w-3 h-3 text-yellow-500" />
              <span className="text-[9px] font-bold uppercase tracking-tighter text-slate-400">Acc. Fees</span>
            </div>
            <div className="mt-2">
              <div className="text-xl font-mono text-slate-100 tabular-nums">
                <span className="text-sm text-slate-500">$</span>
                {accumulatedFees.toFixed(4)}
              </div>
              <div className="text-[8px] text-slate-500 mt-1 uppercase tracking-widest font-bold">
                Institutional Audit
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
