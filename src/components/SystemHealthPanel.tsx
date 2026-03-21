import React, { useState, useEffect } from 'react';
import {
  Cpu, HardDrive, Wifi, Activity, Server, Clock,
  MemoryStick, Gauge, Bot, Layers, CheckCircle, XCircle
} from 'lucide-react';

interface SystemInfo {
  version: string;
  uptime: string;
  uptimeSeconds: number;
  memory: { heapUsed: number; heapTotal: number; rss: number; external: number };
  wsConnections: number;
  bot: { isActive: boolean; phase: string; symbol: string; cycles: number };
  copier: { isActive: boolean };
  os: { platform: string; arch: string; cpus: number; totalMemMB: number; freeMemMB: number };
}

const StatCard: React.FC<{ label: string; value: string | number; icon: React.ReactNode; color: string; sub?: string }> = ({ label, value, icon, color, sub }) => (
  <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3 flex flex-col gap-2 hover:border-[#3b4149] transition-colors">
    <div className="flex items-center gap-2">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>{icon}</div>
      <span className="text-[10px] text-[#5e6673] uppercase tracking-widest font-bold">{label}</span>
    </div>
    <span className="text-[18px] font-black font-mono tracking-tight" style={{ color }}>{value}</span>
    {sub && <span className="text-[9px] text-[#5e6673] font-mono -mt-1">{sub}</span>}
  </div>
);

const MiniGauge: React.FC<{ value: number; max: number; color: string; label: string }> = ({ value, max, color, label }) => {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between">
        <span className="text-[9px] text-[#5e6673] uppercase tracking-widest">{label}</span>
        <span className="text-[9px] font-mono font-bold" style={{ color }}>{pct}%</span>
      </div>
      <div className="w-full h-1.5 bg-[#181a20] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}` }} />
      </div>
    </div>
  );
};

export const SystemHealthPanel: React.FC = () => {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchInfo = async () => {
      try {
        const res = await fetch('/api/system/info');
        if (res.ok) { setInfo(await res.json()); setError(false); }
        else setError(true);
      } catch { setError(true); }
    };

    fetchInfo();
    const interval = setInterval(fetchInfo, 3000);
    return () => clearInterval(interval);
  }, []);

  if (error || !info) {
    return (
      <div className="h-full flex items-center justify-center text-[#5e6673] text-xs font-mono">
        {error ? '⚠ System Info Unavailable' : 'Loading system telemetry...'}
      </div>
    );
  }

  return (
    <div className="p-4 overflow-y-auto h-full custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#2b3139]">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-[#fcd535]" />
          <span className="text-[11px] font-bold text-[#eaecef] uppercase tracking-widest">System Health Monitor</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#0ecb81]/10 border border-[#0ecb81]/20 rounded-lg px-2 py-1">
          <div className="w-2 h-2 rounded-full bg-[#0ecb81] animate-pulse" />
          <span className="text-[9px] font-mono font-bold text-[#0ecb81]">v{info.version}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Uptime" value={info.uptime} icon={<Clock className="w-3.5 h-3.5" />} color="#fcd535" />
        <StatCard label="WebSocket" value={info.wsConnections} icon={<Wifi className="w-3.5 h-3.5" />} color="#0ecb81" sub="Active connections" />
        <StatCard label="CPU Cores" value={info.os.cpus} icon={<Cpu className="w-3.5 h-3.5" />} color="#2962FF" sub={`${info.os.platform} / ${info.os.arch}`} />
        <StatCard label="Heap Used" value={`${info.memory.heapUsed} MB`} icon={<HardDrive className="w-3.5 h-3.5" />} color="#bc13fe" sub={`/ ${info.memory.heapTotal} MB total`} />
      </div>

      {/* Memory Gauges */}
      <div className="bg-[#0b0e11] border border-[#2b3139] rounded-xl p-3 mb-4">
        <h4 className="text-[10px] text-[#5e6673] uppercase tracking-widest font-bold mb-3">Memory Allocation</h4>
        <div className="space-y-2.5">
          <MiniGauge label="Heap" value={info.memory.heapUsed} max={info.memory.heapTotal} color="#bc13fe" />
          <MiniGauge label="RSS" value={info.memory.rss} max={info.os.totalMemMB} color="#fcd535" />
          <MiniGauge label="System RAM" value={info.os.totalMemMB - info.os.freeMemMB} max={info.os.totalMemMB} color="#0ecb81" />
        </div>
      </div>

      {/* Service Status */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`rounded-xl p-3 border flex items-center gap-3 ${info.bot.isActive ? 'bg-[#0ecb81]/5 border-[#0ecb81]/20' : 'bg-[#0b0e11] border-[#2b3139]'}`}>
          <Bot className={`w-5 h-5 ${info.bot.isActive ? 'text-[#0ecb81]' : 'text-[#5e6673]'}`} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#eaecef]">Delta Bot</p>
            <p className={`text-[9px] font-mono ${info.bot.isActive ? 'text-[#0ecb81]' : 'text-[#5e6673]'}`}>
              {info.bot.isActive ? `${info.bot.phase} · ${info.bot.symbol}` : 'Offline'}
            </p>
          </div>
          {info.bot.isActive ? <CheckCircle className="w-4 h-4 text-[#0ecb81] ml-auto" /> : <XCircle className="w-4 h-4 text-[#5e6673] ml-auto" />}
        </div>

        <div className={`rounded-xl p-3 border flex items-center gap-3 ${info.copier.isActive ? 'bg-[#2962FF]/5 border-[#2962FF]/20' : 'bg-[#0b0e11] border-[#2b3139]'}`}>
          <Layers className={`w-5 h-5 ${info.copier.isActive ? 'text-[#2962FF]' : 'text-[#5e6673]'}`} />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[#eaecef]">Trade Copier</p>
            <p className={`text-[9px] font-mono ${info.copier.isActive ? 'text-[#2962FF]' : 'text-[#5e6673]'}`}>
              {info.copier.isActive ? 'Mirroring Active' : 'Standby'}
            </p>
          </div>
          {info.copier.isActive ? <CheckCircle className="w-4 h-4 text-[#2962FF] ml-auto" /> : <XCircle className="w-4 h-4 text-[#5e6673] ml-auto" />}
        </div>
      </div>
    </div>
  );
};
