import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { Cpu, Network, Zap, Crosshair, Box, ShieldCheck, Activity, Terminal, X, Play, Square, Settings2, Trash2, Plus, Database, Server, BrainCircuit } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type BotType = 'DCA' | 'GRID';
type BotStrategy = 'LONG' | 'SHORT';
type BotSignal = 'NONE' | 'MACD' | 'RSI' | 'BOLLINGER';
type BotStatus = 'running' | 'stopped' | 'paused' | 'error';

interface AccessPoint {
  id: string;
  name: string;
  exchange: string;
  apiKey: string;
  balance: number;
  status: 'connected' | 'disconnected' | 'error';
}

interface BotConfig {
  id: string; name: string; type: BotType; strategy: BotStrategy;
  accessPointId: string; pair: string; status: BotStatus;
  orderVolume: number; takeProfit: number; stopLoss: number; maxOrderPrice: number; maxCycles: number;
  extraOrderStep: number; maxExtraOrders: number; martingale: number;
  signal: BotSignal;
  createdAt: number; currentCycle: number; realizedProfit: number; unrealizedPnl: number; position: number; unsoldVolume: number;
}

const defaultBot = (): Omit<BotConfig, 'id' | 'createdAt'> => ({
  name: 'Alpha Node', type: 'DCA', strategy: 'LONG', accessPointId: '', pair: 'BTCUSDT', status: 'stopped',
  orderVolume: 50, takeProfit: 2, stopLoss: 5, maxOrderPrice: 999999, maxCycles: 0,
  extraOrderStep: 1.5, maxExtraOrders: 5, martingale: 1.0, signal: 'NONE',
  currentCycle: 0, realizedProfit: 0, unrealizedPnl: 0, position: 0, unsoldVolume: 0,
});

// â”€â”€â”€ Storage Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const loadBots = (): BotConfig[] => { try { return JSON.parse(localStorage.getItem('bot_configs') || '[]'); } catch { return []; } };
const saveBots = (bots: BotConfig[]) => { try { localStorage.setItem('bot_configs', JSON.stringify(bots)); } catch {} };
const loadAPs = (): AccessPoint[] => { try { return JSON.parse(localStorage.getItem('access_points') || '[]'); } catch { return []; } };
const saveAPs = (aps: AccessPoint[]) => { try { localStorage.setItem('access_points', JSON.stringify(aps)); } catch {} };
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// â”€â”€â”€ Cyber Status Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StatusBadge: React.FC<{ status: BotStatus | 'connected' | 'disconnected' | 'error' }> = ({ status }) => {
  const map: Record<string, { text: string; cls: string; dot: string }> = {
    running:      { text: 'ONLINE',      cls: 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/30', dot: 'bg-[var(--holo-cyan)] animate-pulse' },
    stopped:      { text: 'STANDBY',     cls: 'bg-[#848e9c]/10 text-[#848e9c] border-[#848e9c]/30', dot: 'bg-[#848e9c]' },
    paused:       { text: 'SUSPENDED',   cls: 'bg-[var(--holo-gold)]/10 text-[var(--holo-gold)] border-[var(--holo-gold)]/30', dot: 'bg-[var(--holo-gold)]' },
    error:        { text: 'FAIL',        cls: 'bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] border-[var(--holo-magenta)]/30', dot: 'bg-[var(--holo-magenta)] animate-pulse' },
    connected:    { text: 'LINKED',      cls: 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/30', dot: 'bg-[var(--holo-cyan)] animate-pulse' },
    disconnected: { text: 'SEVERED',     cls: 'bg-[#848e9c]/10 text-[#848e9c] border-[#848e9c]/30', dot: 'bg-[#848e9c]' },
  };
  const s = map[status] || map.stopped;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[9px] font-black tracking-[0.2em] px-2 py-0.5 rounded border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} shadow-[0_0_10px_currentColor]`} />
      {s.text}
    </span>
  );
};

// â”€â”€â”€ Diagnostics Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: string; color?: string; highlight?: boolean }> = ({ label, value, sub, color = '#eaecef', highlight }) => (
  <div className="bg-black/40 backdrop-blur-sm border border-white/[0.05] rounded-xl p-3 relative overflow-hidden group">
    {highlight && <div className="absolute top-0 right-0 w-16 h-16 bg-[var(--holo-cyan)]/10 blur-2xl rounded-full" />}
    <span className="text-[9px] text-gray-500 uppercase tracking-widest font-black block mb-1 z-10 relative">{label}</span>
    <span className="text-sm font-black font-mono block z-10 relative" style={{ color }}>{value}</span>
    {sub && <span className="text-[9px] text-gray-600 mt-0.5 block font-mono z-10 relative lowercase">{sub}</span>}
  </div>
);

// â”€â”€â”€ Fields â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Field: React.FC<{ label: string; children: React.ReactNode; icon?: any }> = ({ label, children, icon: Icon }) => (
  <div className="relative group">
    <div className="flex items-center gap-1.5 mb-1.5">
      {Icon && <Icon className="w-3 h-3 text-gray-500 group-focus-within:text-[var(--holo-cyan)] transition-colors" />}
      <label className="text-[9px] text-gray-400 uppercase tracking-widest font-bold group-focus-within:text-[var(--holo-cyan)] transition-colors">{label}</label>
    </div>
    {children}
  </div>
);
const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`w-full bg-black/50 border border-white/[0.1] focus:border-[var(--holo-cyan)] focus:shadow-[0_0_15px_rgba(0,240,255,0.1)] rounded-lg px-3 py-2 text-white text-[13px] outline-none font-mono font-bold transition-all ${props.className || ''}`} />
);
const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} className={`w-full bg-black/50 border border-white/[0.1] focus:border-[var(--holo-cyan)] focus:shadow-[0_0_15px_rgba(0,240,255,0.1)] rounded-lg px-3 py-2 text-white text-[13px] outline-none font-mono font-bold transition-all appearance-none ${props.className || ''}`} />
);

// â”€â”€â”€ Cyber Access Point Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const APModal: React.FC<{ onClose: () => void; onSave: (ap: AccessPoint) => void }> = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ name: '', exchange: 'Binance', apiKey: '', apiSecret: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-[200] bg-black/40/90 backdrop-blur-md flex items-center justify-center p-4 custom-scrollbar overflow-y-auto" onClick={onClose}>
      <div className="glass-panel border border-[var(--holo-cyan)]/30 rounded-2xl shadow-[0_0_50px_rgba(0,240,255,0.1)] w-full max-w-md p-6 relative overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="absolute top-0 right-[-10%] w-40 h-40 bg-[var(--holo-cyan)]/10 blur-3xl rounded-full" />
        <div className="flex justify-between items-center mb-6 relative z-10 border-b border-white/[0.05] pb-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-[var(--holo-cyan)]/10 rounded border border-[var(--holo-cyan)]/20 text-[var(--holo-cyan)]"><Network className="w-5 h-5" /></div>
             <h3 className="text-white font-black tracking-[0.2em] uppercase text-sm">Uplink Gateway</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-[var(--holo-magenta)] transition-colors"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4 relative z-10">
          <Field label="Node Designation" icon={Terminal}><Input placeholder="BINANCE_ALPHA" value={form.name} onChange={e => set('name', e.target.value.toUpperCase())} /></Field>
          <Field label="Exchange Network" icon={Database}>
            <Select value={form.exchange} onChange={e => set('exchange', e.target.value)}>
              {['Binance', 'Bybit', 'OKX', 'Kraken'].map(ex => <option key={ex}>{ex}</option>)}
            </Select>
          </Field>
          <Field label="Public Key" icon={Zap}><Input type="password" placeholder="[ENCRYPTED_KEY_STRING]" value={form.apiKey} onChange={e => set('apiKey', e.target.value)} /></Field>
          <Field label="Private Secret" icon={ShieldCheck}><Input type="password" placeholder="[CLASSIFIED_SECRET]" value={form.apiSecret} onChange={e => set('apiSecret', e.target.value)} /></Field>
          
          <div className="bg-[var(--holo-gold)]/10 border border-[var(--holo-gold)]/20 rounded-lg p-3 text-[10px] text-[var(--holo-gold)] flex gap-2 mt-4 font-mono uppercase tracking-widest">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Restrict API tokens to READ/TRADE execution only. Vault transfers explicitly denied.</span>
          </div>
        </div>
        <div className="flex gap-3 mt-6 relative z-10">
          <button onClick={onClose} className="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 border border-white/[0.1] text-[11px] font-black tracking-widest uppercase rounded">Abort</button>
          <button
            onClick={() => {
              if (!form.name || !form.apiKey) return toast.error('Node Designation & Key required', { style: { background: '#0a0d14', color: 'var(--holo-magenta)', border: '1px solid rgba(255,7,58,0.2)' } });
              onSave({ id: uid(), name: form.name, exchange: form.exchange, apiKey: form.apiKey.slice(0, 8) + 'â€¢â€¢â€¢â€¢', balance: 0, status: 'connected' });
              onClose();
              toast.success('Uplink Established', { iconTheme: { primary: 'var(--holo-cyan)', secondary: '#0a0d14' }, style: { background: '#0a0d14', color: 'var(--holo-cyan)', border: '1px solid rgba(0,240,255,0.2)' } });
            }}
            className="flex-1 py-3 bg-[var(--holo-cyan)]/10 hover:bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/30 hover:border-[var(--holo-cyan)] text-[11px] font-black tracking-widest uppercase rounded box-glow transition-all"
          >Establish Link</button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€â”€ Cyber Bot Configuration Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BotModal: React.FC<{ existing?: BotConfig; accessPoints: AccessPoint[]; onClose: () => void; onSave: (bot: BotConfig) => void }> = ({ existing, accessPoints, onClose, onSave }) => {
  const [cfg, setCfg] = useState<Omit<BotConfig, 'id' | 'createdAt'>>(existing ? { ...existing } : defaultBot());
  const set = <K extends keyof typeof cfg>(k: K, v: (typeof cfg)[K]) => setCfg(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-[200] bg-black/40/90 backdrop-blur-md flex items-center justify-center p-4 overflow-auto py-10" onClick={onClose}>
      <div className="glass-panel border border-[#bc13fe]/30 rounded-2xl shadow-[0_0_50px_rgba(188,19,254,0.1)] w-full max-w-3xl relative overflow-hidden flex flex-col max-h-full" onClick={e => e.stopPropagation()}>
        
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#bc13fe]/10 blur-3xl rounded-full pointer-events-none" />
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-white/[0.05] relative z-10 shrink-0 bg-black/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-[#bc13fe]/10 rounded border border-[#bc13fe]/20 text-[#bc13fe]"><Cpu className="w-5 h-5" /></div>
             <div>
               <h3 className="text-white font-black tracking-[0.2em] uppercase text-sm">{existing ? 'Reconfigure Node' : 'Initialize Autonomous Node'}</h3>
               <p className="text-[#bc13fe]/60 text-[9px] font-mono tracking-widest mt-0.5">ALGO_STRATEGY // SYS_BUILDER</p>
             </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-[var(--holo-magenta)] transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-8 overflow-y-auto custom-scrollbar relative z-10 flex-1">

          {/* Core Routing */}
          <section className="bg-black/40 border border-white/[0.05] rounded-xl p-4">
            <h4 className="text-[10px] text-[#bc13fe] font-black lowercase tracking-widest mb-4 flex items-center gap-2 font-mono">
               <span className="w-2 h-2 bg-[#bc13fe] animate-pulse" /> [01] core_routing
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Node Alias"><Input placeholder="ALPHA_NODE_01" value={cfg.name} onChange={e => set('name', e.target.value.toUpperCase())} /></Field>
              <Field label="Uplink Gateway">
                <Select value={cfg.accessPointId} onChange={e => set('accessPointId', e.target.value)}>
                  <option value="">â€” UNAVAILABLE â€”</option>
                  {accessPoints.map(ap => <option key={ap.id} value={ap.id}>{ap.name} ({ap.exchange})</option>)}
                </Select>
              </Field>
              <Field label="Asset Matrix"><Input placeholder="BTCUSDT" value={cfg.pair} onChange={e => set('pair', e.target.value.toUpperCase())} /></Field>
              <Field label="Directional Bias">
                <div className="grid grid-cols-2 gap-2">
                  {(['LONG', 'SHORT'] as BotStrategy[]).map(s => (
                    <button key={s} onClick={() => set('strategy', s)}
                      className={`py-2 rounded font-black text-[10px] tracking-widest uppercase transition-all ${cfg.strategy === s ? (s === 'LONG' ? 'bg-[var(--holo-cyan)]/15 border border-[var(--holo-cyan)]/50 text-[var(--holo-cyan)] shadow-[0_0_10px_rgba(57,255,20,0.2)]' : 'bg-[var(--holo-magenta)]/15 border border-[var(--holo-magenta)]/50 text-[var(--holo-magenta)] shadow-[0_0_10px_rgba(255,7,58,0.2)]') : 'bg-black border border-white/[0.1] text-gray-500 hover:text-gray-300'}`}>{s}</button>
                  ))}
                </div>
              </Field>
            </div>
          </section>

          {/* Engine Arch */}
          <section className="bg-black/40 border border-white/[0.05] rounded-xl p-4">
            <h4 className="text-[10px] text-[var(--holo-cyan)] font-black lowercase tracking-widest mb-4 flex items-center gap-2 font-mono">
               <span className="w-2 h-2 bg-[var(--holo-cyan)] animate-pulse" /> [02] engine_architecture
            </h4>
            <div className="grid grid-cols-2 gap-4">
              {[
                { type: 'DCA' as BotType, label: 'DCA MATRIX', desc: 'Dynamic cost-averaging array with composite macro-exits.' },
                { type: 'GRID' as BotType, label: 'GRID ARRAY', desc: 'High-frequency micro-oscillatory netting system.' },
              ].map(t => (
                <button key={t.type} onClick={() => set('type', t.type)}
                  className={`p-4 rounded-xl border text-left transition-all ${cfg.type === t.type ? 'bg-[var(--holo-cyan)]/10 border-[var(--holo-cyan)]/50 shadow-[0_0_15px_rgba(0,240,255,0.1)]' : 'bg-black/50 border-white/[0.05] hover:border-white/[0.2]'}`}>
                  <div className={`text-[12px] font-black tracking-widest uppercase mb-1 flex items-center gap-2 ${cfg.type === t.type ? 'text-[var(--holo-cyan)]' : 'text-gray-400'}`}>
                    <Box className="w-4 h-4" /> {t.label}
                  </div>
                  <p className="text-[10px] text-gray-500 font-mono leading-relaxed">{t.desc}</p>
                </button>
              ))}
            </div>
          </section>

          {/* Variables */}
          <section className="bg-black/40 border border-white/[0.05] rounded-xl p-4">
             <h4 className="text-[10px] text-[var(--holo-gold)] font-black lowercase tracking-widest mb-4 flex items-center gap-2 font-mono">
               <span className="w-2 h-2 bg-[var(--holo-gold)] animate-pulse" /> [03] execution_variables
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Field label="Vol (USDT)"><Input type="number" value={cfg.orderVolume} onChange={e => set('orderVolume', +e.target.value)} /></Field>
              <Field label="Take Profit %"><Input type="number" value={cfg.takeProfit} onChange={e => set('takeProfit', +e.target.value)} step="0.1" /></Field>
              <Field label="Stop Loss %"><Input type="number" value={cfg.stopLoss} onChange={e => set('stopLoss', +e.target.value)} step="0.1" /></Field>
              <Field label="Max Cycles (0=INF)"><Input type="number" value={cfg.maxCycles} onChange={e => set('maxCycles', +e.target.value)} min={0} /></Field>
            </div>
            
            {cfg.type === 'DCA' && (
              <div className="mt-4 pt-4 border-t border-white/[0.05] grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Dev. Step %"><Input type="number" value={cfg.extraOrderStep} onChange={e => set('extraOrderStep', +e.target.value)} step="0.1" /></Field>
                <Field label="Max Safety Orders"><Input type="number" value={cfg.maxExtraOrders} onChange={e => set('maxExtraOrders', +e.target.value)} min={1} max={20} /></Field>
                <Field label="Martingale Coef."><Input type="number" value={cfg.martingale} onChange={e => set('martingale', +e.target.value)} step="0.05" min={1.0} max={2.0} /></Field>
              </div>
            )}
          </section>

          {/* Trigger */}
          <section className="bg-black/40 border border-white/[0.05] rounded-xl p-4">
             <h4 className="text-[10px] text-[var(--holo-cyan)] font-black lowercase tracking-widest mb-4 flex items-center gap-2 font-mono">
               <span className="w-2 h-2 bg-[var(--holo-cyan)] animate-pulse" /> [04] neural_triggers
            </h4>
             <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[ { id: 'NONE', l: 'IMMEDIATE' }, { id: 'MACD', l: 'MACD_CROSS' }, { id: 'RSI', l: 'RSI_EXTREME' }, { id: 'BOLLINGER', l: 'BB_TOUCH' } ].map(sig => (
                <button key={sig.id} onClick={() => set('signal', sig.id as BotSignal)}
                  className={`p-2.5 rounded border text-center font-mono text-[10px] font-black tracking-widest transition-all ${cfg.signal === sig.id ? 'bg-[var(--holo-cyan)]/15 border-[var(--holo-cyan)]/50 text-[var(--holo-cyan)] shadow-[0_0_10px_rgba(57,255,20,0.1)]' : 'bg-black border-white/[0.1] text-gray-600 hover:border-white/[0.3]'}`}>
                  {sig.l}
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-white/[0.05] flex gap-3 bg-black/50 shrink-0">
          <button onClick={onClose} className="w-1/3 py-3 bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 border border-white/[0.1] text-[11px] font-black tracking-widest uppercase rounded focus:outline-none">Abort Setup</button>
          <button
            onClick={() => {
              if (!cfg.name.trim()) return toast.error('Node Alias required');
              if (!cfg.accessPointId) return toast.error('Uplink Gateway required');
              onSave({ ...cfg, id: existing?.id || uid(), createdAt: existing?.createdAt || Date.now() });
              onClose();
            }}
            className="flex-1 py-3 bg-[#bc13fe]/10 hover:bg-[#bc13fe]/20 text-[#bc13fe] border border-[#bc13fe]/30 hover:border-[#bc13fe] text-[11px] font-black tracking-widest uppercase rounded focus:outline-none transition-all box-glow-purple"
          >{existing ? 'Commit Alterations' : 'Initialize Node'}</button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€â”€ Cyber Bot Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const BotCard: React.FC<{
  bot: BotConfig; ap?: AccessPoint;
  onToggle: (id: string) => void; onEdit: (bot: BotConfig) => void; onDelete: (id: string) => void;
}> = ({ bot, ap, onToggle, onEdit, onDelete }) => {
  const isRunning = bot.status === 'running';
  return (
    <div className={`bg-black/60 backdrop-blur-md rounded-xl p-1 relative overflow-hidden transition-all duration-500 ${isRunning ? 'shadow-[0_0_30px_rgba(57,255,20,0.1)] border border-[var(--holo-cyan)]/30' : 'border border-white/[0.05]'}`}>
      
      {isRunning && (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(57,255,20,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(57,255,20,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
      )}

      <div className="bg-black/40 rounded-lg h-full p-4 relative z-10 flex flex-col">
        
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <h3 className="text-white font-black text-sm tracking-widest uppercase">{bot.name}</h3>
              <StatusBadge status={bot.status} />
            </div>
            <div className="flex items-center gap-2 text-[9px] font-mono tracking-widest text-[var(--holo-cyan)]/70 font-black">
               <Network className="w-3 h-3 text-[var(--holo-cyan)]" /> {ap?.name || 'NO_GATEWAY'} <span className="text-gray-600">//</span> {bot.pair}
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onEdit(bot)} className="p-1.5 text-gray-500 hover:text-[var(--holo-cyan)] bg-white/[0.02] border border-white/[0.05] hover:border-[var(--holo-cyan)]/30 rounded transition-all"><Settings2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => { if (confirm(`DEAUTHORIZE NODE: ${bot.name}?`)) onDelete(bot.id); }} className="p-1.5 text-gray-500 hover:text-[var(--holo-magenta)] bg-white/[0.02] border border-white/[0.05] hover:border-[var(--holo-magenta)]/30 rounded transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Tactical Config Tags */}
        <div className="flex gap-2 mb-4">
           <span className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-[9px] font-mono text-gray-400 font-bold">{bot.type}_{bot.strategy}</span>
           <span className="px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.05] text-[9px] font-mono text-gray-400 font-bold">TP:{bot.takeProfit}% SL:{bot.stopLoss}%</span>
           {bot.signal !== 'NONE' && <span className="px-2 py-0.5 rounded bg-[#bc13fe]/10 border border-[#bc13fe]/20 text-[#bc13fe] text-[9px] font-mono font-bold">{bot.signal}_TRIG</span>}
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <Stat label="NET YIELD" value={`${bot.realizedProfit >= 0 ? '+' : ''}${bot.realizedProfit.toFixed(2)}`} color={bot.realizedProfit > 0 ? 'var(--holo-cyan)' : bot.realizedProfit < 0 ? 'var(--holo-magenta)' : '#848e9c'} sub="USDT" />
          <Stat label="FLOAT PNL" value={`${bot.unrealizedPnl >= 0 ? '+' : ''}${bot.unrealizedPnl.toFixed(2)}`} color={bot.unrealizedPnl > 0 ? 'var(--holo-cyan)' : bot.unrealizedPnl < 0 ? 'var(--holo-magenta)' : '#848e9c'} sub="USDT" />
          <Stat label="PHASE CYCLES" value={bot.currentCycle} color="#bc13fe" sub="EXECUTIONS" />
        </div>

        {/* Neural Activity Sparkline */}
        <div className="h-10 mb-4 bg-black/50 rounded-lg border border-white/[0.02] flex items-center justify-center overflow-hidden relative group cursor-crosshair">
          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 bg-[var(--holo-cyan)]/5 transition-opacity pointer-events-none" />
          <ResponsiveContainer width="100%" height="100%">
             <AreaChart data={Array.from({ length: 20 }, (_, i) => ({ v: isRunning ? Math.sin(Date.now() / 1000 + i) * 10 + 20 : 10 }))}>
                <defs>
                   <linearGradient id={`grad-${bot.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isRunning ? 'var(--holo-cyan)' : '#848e9c'} stopOpacity={0.3} />
                      <stop offset="100%" stopColor={isRunning ? 'var(--holo-cyan)' : '#848e9c'} stopOpacity={0} />
                   </linearGradient>
                </defs>
                <Area type="monotone" dataKey="v" stroke={isRunning ? 'var(--holo-cyan)' : '#848e9c'} strokeWidth={1} fill={`url(#grad-${bot.id})`} isAnimationActive={false} />
             </AreaChart>
          </ResponsiveContainer>
          <div className="absolute top-1 left-2 text-[7px] font-mono text-gray-600 tracking-widest pointer-events-none">PERFORMANCE_MATRIX</div>
        </div>

        {/* Action Button */}
        <div className="mt-auto pt-4 border-t border-white/[0.05]">
          <button
            onClick={() => onToggle(bot.id)}
            className={`w-full py-2.5 rounded font-black text-[11px] tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-2 border group relative overflow-hidden ${
              isRunning ? 'bg-[var(--holo-magenta)]/10 hover:bg-[var(--holo-magenta)]/20 border-[var(--holo-magenta)]/30 text-[var(--holo-magenta)] box-glow-red' : 'bg-[var(--holo-cyan)]/10 hover:bg-[var(--holo-cyan)]/20 border-[var(--holo-cyan)]/30 text-[var(--holo-cyan)] box-glow-green'
            }`}
             >
            {isRunning && <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[var(--holo-magenta)]/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />}
            {!isRunning && <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/5 to-transparent -translate-x-full group-hover:animate-[shimmer_1s_infinite]" />}
            
            {isRunning ? <Square className="w-3.5 h-3.5 relative z-10" fill="currentColor" /> : <Play className="w-3.5 h-3.5 relative z-10" fill="currentColor" />}
            <span className="relative z-10">{isRunning ? 'Halt Execution' : 'Engage Node'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// â”€â”€â”€ Command Center Root â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export const BotPanel: React.FC = () => {
  const [view, setView] = useState<'bots' | 'access'>('bots');
  const [bots, setBots] = useState<BotConfig[]>(loadBots());
  const [accessPoints, setAccessPoints] = useState<AccessPoint[]>(loadAPs());
  const [showBotModal, setShowBotModal] = useState(false);
  const [showAPModal, setShowAPModal] = useState(false);
  const [editingBot, setEditingBot] = useState<BotConfig | undefined>();

  useEffect(() => { saveBots(bots); }, [bots]);
  useEffect(() => { saveAPs(accessPoints); }, [accessPoints]);

  const saveBot = (bot: BotConfig) => {
    setBots(prev => { const idx = prev.findIndex(b => b.id === bot.id); return idx >= 0 ? [ ...prev.slice(0, idx), bot, ...prev.slice(idx+1) ] : [...prev, bot]; });
    toast.success('Node Data Compiled', { style: { background: '#0a0d14', color: '#bc13fe', border: '1px solid rgba(188,19,254,0.2)' } });
  };

  const toggleBot = (id: string) => {
    setBots(prev => prev.map(b => {
      if (b.id !== id) return b;
      if (b.status === 'running') { 
        toast('Execution Suspended', { style: { background: '#0a0d14', color: '#fcd535', border: '1px solid rgba(252,213,53,0.2)' } }); 
        return { ...b, status: 'stopped' }; 
      }
      if (!accessPoints.find(ap => ap.id === b.accessPointId)) {
        toast.error('UPLINK FAILURE: Gateway missing', { style: { background: '#0a0d14', color: 'var(--holo-magenta)', border: '1px solid rgba(255,7,58,0.2)' } });
        return b;
      }
      toast.success(`${b.name} ENGAGED`, { iconTheme: {primary: 'var(--holo-cyan)', secondary: '#0a0d14'}, style: { background: '#0a0d14', color: 'var(--holo-cyan)', border: '1px solid rgba(57,255,20,0.2)' } });
      return { ...b, status: 'running' };
    }));
  };

  const runningCount = bots.filter(b => b.status === 'running').length;
  const totalPnl = bots.reduce((s, b) => s + b.realizedProfit, 0);

  return (
    <div className="h-full flex flex-col pt-4 px-4 overflow-hidden relative">
      
      <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      {/* CommandCenter Header */}
      <div className="shrink-0 mb-6 relative z-10">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
             <div className="relative">
               <div className="p-3 bg-black border border-[#bc13fe]/30 rounded-xl inner-glow text-[#bc13fe]">
                 <Terminal className="w-6 h-6" />
               </div>
               {runningCount > 0 && <span className="absolute -bottom-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--holo-cyan)] opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--holo-cyan)] border border-black"></span></span>}
             </div>
             <div>
               <h2 className="text-white font-black text-lg tracking-[0.2em] uppercase">Swarm Matrix</h2>
               <p className="text-[#bc13fe]/60 text-[10px] font-mono tracking-widest mt-1">
                 ACTIVE_NODES: {runningCount} <span className="text-gray-600">//</span> GATEWAYS: {accessPoints.length}
               </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
            {view === 'bots' ? (
              <div className="flex gap-2">
                <button onClick={() => {
                  const genBot = { ...defaultBot(), id: uid(), name: 'AI_OPTIMIZED_' + Math.floor(Math.random()*999), type: 'GRID' as any, strategy: 'LONG' as any, pair: 'ETHUSDT', orderVolume: 250, takeProfit: 3.5, signal: 'MACD' as any, createdAt: Date.now() };
                  if (accessPoints.length > 0) genBot.accessPointId = accessPoints[0].id;
                  setEditingBot(genBot); setShowBotModal(true);
                  toast.success('AI Synergy Config Synthesized', { iconTheme: {primary: 'var(--holo-cyan)', secondary: '#0a0d14'}, style: { background: '#0a0d14', color: 'var(--holo-cyan)', border: '1px solid rgba(0,240,255,0.2)' } });
                }}
                  className="bg-[var(--holo-cyan)]/10 hover:bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/30 hover:border-[var(--holo-cyan)] text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded box-glow flex items-center gap-2 transition-all overflow-hidden group relative">
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  <BrainCircuit className="w-4 h-4 animate-pulse" /> Auto-Deploy AI
                </button>
                <button onClick={() => { setEditingBot(undefined); setShowBotModal(true); }}
                  className="bg-[#bc13fe]/10 hover:bg-[#bc13fe]/20 text-[#bc13fe] border border-[#bc13fe]/30 hover:border-[#bc13fe] text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded box-glow-purple flex items-center gap-2 transition-all">
                  <Plus className="w-4 h-4" /> Initialize Node
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAPModal(true)}
                className="bg-[var(--holo-cyan)]/10 hover:bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/30 hover:border-[var(--holo-cyan)] text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded box-glow flex items-center gap-2 transition-all">
                <Plus className="w-4 h-4" /> Link Gateway
              </button>
            )}
          </div>
        </div>

        {/* Neural Tabs */}
        <div className="flex gap-2 border-b border-white/[0.05]">
          {([['bots', 'Alpha Nodes'], ['access', 'Uplink Gateways']] as [string, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setView(id as any)}
              className={`px-6 py-2.5 text-[10px] uppercase font-black tracking-widest rounded-t-lg transition-all border-b-2 relative ${view === id ? 'text-[#bc13fe] border-[#bc13fe] bg-gradient-to-t from-[#bc13fe]/10 to-transparent' : 'text-gray-500 border-transparent hover:text-gray-300 hover:bg-white/[0.02]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pb-6 relative z-10 w-full">

        {view === 'bots' && (
          <>
            {bots.length > 0 && (
              <div className="grid grid-cols-3 gap-3 mb-6">
                <Stat label="Total Extracted" value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`} color={totalPnl > 0 ? 'var(--holo-cyan)' : '#eaecef'} sub="USDT_PROFIT" highlight={totalPnl > 0} />
                <Stat label="Engaged Protocols" value={runningCount} color={runningCount > 0 ? '#bc13fe' : '#eaecef'} sub={`/ ${bots.length} TOTAL`} />
                <Stat label="Network Integrity" value="100%" color="var(--holo-cyan)" sub="OPTIMAL" />
              </div>
            )}
            
            {bots.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-48 border border-white/[0.05] border-dashed rounded-xl bg-black/20 text-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                 <Cpu className="w-10 h-10 text-gray-700 mb-4" />
                 <h3 className="text-white font-black tracking-widest uppercase text-sm mb-2">Matrix Empty</h3>
                 <p className="text-gray-500 font-mono text-[10px] tracking-widest mb-6">AWAITING_INITIAL_NODE_CONSTRUCTION</p>
                 <button onClick={() => { setEditingBot(undefined); setShowBotModal(true); }} className="px-6 py-2 border border-[#bc13fe]/50 text-[#bc13fe] text-[10px] tracking-widest uppercase font-black rounded box-glow-purple hover:bg-[#bc13fe]/10 transition-all">Construct Node</button>
               </div>
            ) : (
               <>
                 <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 mb-6">
                   {bots.map(b => (
                      <BotCard key={b.id} bot={b} ap={accessPoints.find(a => a.id === b.accessPointId)} onToggle={toggleBot} onEdit={b => {setEditingBot(b); setShowBotModal(true)}} onDelete={id => setBots(p => p.filter(x => x.id !== id))} />
                   ))}
                 </div>
               
               {/* Terminal Event Log */}
               <div className="bg-black/40 border border-[var(--holo-cyan)]/20 rounded-xl p-4 relative overflow-hidden h-40 flex flex-col pointer-events-none">
                 <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--holo-cyan)]/5 blur-3xl rounded-full" />
                 <h4 className="flex items-center gap-2 text-[10px] font-mono text-[var(--holo-cyan)] uppercase tracking-[0.2em] mb-3 shrink-0"><Terminal className="w-3.5 h-3.5" /> Neural Execution Feed</h4>
                 <div className="flex-1 overflow-hidden relative flex flex-col justify-end">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#05070a] via-transparent to-transparent z-10 pointer-events-none" />
                    <div className="space-y-1 font-mono text-[10px] sm:text-[11px] font-bold text-[#848e9c]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                          <span className="text-[#5e6673]">[{new Date(Date.now() - i * 15000).toISOString().split('T')[1].slice(0,8)}]</span>
                          <span className={`${i === 0 ? 'text-[var(--holo-cyan)]' : i === 1 ? 'text-[var(--holo-cyan)]' : ''}`}>
                            {i % 3 === 0 ? '> SYNC_PING OK: LATENCY 14ms (OPTIMAL)' : i % 2 === 0 ? '> ARRAY_SWEEP: 0 ANOMALIES DETECTED' : '> ANALYZING MARKET DEVIATION VECTORS...'}
                          </span>
                        </div>
                      ))}
                    </div>
                 </div>
               </div>
               </>
            )}
          </>
        )}

        {view === 'access' && (
           accessPoints.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-48 border border-white/[0.05] border-dashed rounded-xl bg-black/20 text-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                 <Network className="w-10 h-10 text-gray-700 mb-4" />
                 <h3 className="text-white font-black tracking-widest uppercase text-sm mb-2">No Uplinks</h3>
                 <p className="text-gray-500 font-mono text-[10px] tracking-widest mb-6">EXCHANGE_GATEWAYS_DISCONNECTED</p>
                 <button onClick={() => setShowAPModal(true)} className="px-6 py-2 border border-[var(--holo-cyan)]/50 text-[var(--holo-cyan)] text-[10px] tracking-widest uppercase font-black rounded box-glow hover:bg-[var(--holo-cyan)]/10 transition-all">Establish Gateway</button>
               </div>
           ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                 {accessPoints.map(ap => (
                    <div key={ap.id} className="bg-black/40 backdrop-blur-sm border border-white/[0.05] rounded-xl p-4">
                       <div className="flex justify-between items-start mb-4 border-b border-white/[0.05] pb-3">
                         <div>
                            <h3 className="text-white font-black text-xs uppercase tracking-widest">{ap.name}</h3>
                            <p className="text-[var(--holo-cyan)]/60 text-[9px] font-mono tracking-widest mt-1">EXT_NET // {ap.exchange.toUpperCase()}</p>
                         </div>
                         <div className="flex items-center gap-2">
                           <StatusBadge status={ap.status} />
                           <button onClick={() => setAccessPoints(p => p.filter(x => x.id !== ap.id))} className="p-1 hover:bg-white/[0.1] rounded text-gray-500 hover:text-[var(--holo-magenta)] transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                         </div>
                       </div>
                       
                       <div className="space-y-3 font-mono text-[10px]">
                         <div className="flex justify-between">
                            <span className="text-gray-500 font-bold tracking-widest">ENCRYPTION_KEY</span>
                            <span className="text-gray-300">{ap.apiKey}</span>
                         </div>
                         <div className="flex justify-between">
                            <span className="text-gray-500 font-bold tracking-widest">ASSIGNED_NODES</span>
                            <span className="text-[var(--holo-cyan)] font-black">{bots.filter(b => b.accessPointId === ap.id).length}</span>
                         </div>
                       </div>
                    </div>
                 ))}
               </div>
           )
        )}

      </div>
      
      {showAPModal && <APModal onClose={() => setShowAPModal(false)} onSave={ap => setAccessPoints(prev => [...prev, ap])} />}
      {showBotModal && <BotModal existing={editingBot} accessPoints={accessPoints} onClose={() => { setShowBotModal(false); setEditingBot(undefined); }} onSave={saveBot} />}
    </div>
  );
};

