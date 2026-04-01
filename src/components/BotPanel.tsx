import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Cpu, Network, Zap, Crosshair, Box, ShieldCheck, Activity, Terminal, X, Play, Square, Settings2, Trash2, Plus, Database, Server, BrainCircuit, ArrowRight } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type BotStrategyType = 'RANGE_BOUND' | 'BREAKOUT' | 'PULLBACK';
type MarketCondition = 'TRENDING' | 'RANGING' | 'CHOPPY';
type MarketDirection = 'BULLISH' | 'BEARISH' | 'SIDEWAYS';
type BotStatus = 'running' | 'stopped' | 'paused' | 'error';
type PrimaryTimeframe = '1H' | '4H' | 'Daily';

interface AccessPoint {
  id: string;
  name: string;
  exchange: string;
  apiKey: string;
  balance: number;
  status: 'connected' | 'disconnected' | 'error';
}

interface TopDownLevel {
  timeframe: 'Weekly' | 'Daily' | '4H' | '1H';
  levelType: 'Support' | 'Resistance' | 'OB' | 'FVG';
  price: number;
  strength: number; // 0-100
}

interface BotConfig {
  id: string; 
  name: string; 
  strategyType: BotStrategyType;
  marketCondition: MarketCondition;
  direction: MarketDirection;
  accessPointId: string; 
  pair: string; 
  status: BotStatus;
  orderVolume: number; 
  takeProfit: number; 
  stopLoss: number;
  
  // Top-Down Analysis Data
  weeklyBias: MarketDirection;
  dailyBias: MarketDirection;
  primaryTimeframe: PrimaryTimeframe;
  keyLevels: TopDownLevel[];
  
  createdAt: number; 
  realizedProfit: number; 
  unrealizedPnl: number; 
  tradesCount: number;
}

const defaultBot = (): Omit<BotConfig, 'id' | 'createdAt'> => ({
  name: 'Alpha Node', 
  strategyType: 'RANGE_BOUND',
  marketCondition: 'RANGING',
  direction: 'SIDEWAYS',
  accessPointId: '', 
  pair: 'BTCUSDT', 
  status: 'stopped',
  orderVolume: 100, 
  takeProfit: 2, 
  stopLoss: 1,
  weeklyBias: 'SIDEWAYS',
  dailyBias: 'SIDEWAYS',
  primaryTimeframe: '4H',
  keyLevels: [],
  realizedProfit: 0, 
  unrealizedPnl: 0, 
  tradesCount: 0,
});

// â”€â”€â”€ Storage Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const loadBots = (): BotConfig[] => { try { return JSON.parse(localStorage.getItem('bot_configs') || '[]'); } catch { return []; } };
const saveBots = (bots: BotConfig[]) => { try { localStorage.setItem('bot_configs', JSON.stringify(bots)); } catch {} };
const loadAPs = (): AccessPoint[] => { try { return JSON.parse(localStorage.getItem('access_points') || '[]'); } catch { return []; } };
const saveAPs = (aps: AccessPoint[]) => { try { localStorage.setItem('access_points', JSON.stringify(aps)); } catch {} };
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// â”€â”€â”€ Cyber Status Badge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StatusBadge: React.FC<{ status: BotStatus | 'connected' | 'disconnected' | 'error' | MarketCondition }> = ({ status }) => {
  const map: Record<string, { text: string; cls: string; dot: string }> = {
    running:      { text: 'ACTIVE',      cls: 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/30', dot: 'bg-[var(--holo-cyan)] animate-pulse' },
    stopped:      { text: 'STANDBY',     cls: 'bg-[#848e9c]/10 text-[#848e9c] border-[#848e9c]/30', dot: 'bg-[#848e9c]' },
    paused:       { text: 'SUSPENDED',   cls: 'bg-[var(--holo-gold)]/10 text-[var(--holo-gold)] border-[var(--holo-gold)]/30', dot: 'bg-[var(--holo-gold)]' },
    error:        { text: 'ALERT',       cls: 'bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] border-[var(--holo-magenta)]/30', dot: 'bg-[var(--holo-magenta)] animate-pulse' },
    connected:    { text: 'LINKED',      cls: 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/30', dot: 'bg-[var(--holo-cyan)] animate-pulse' },
    disconnected: { text: 'OFFLINE',     cls: 'bg-[#848e9c]/10 text-[#848e9c] border-[#848e9c]/30', dot: 'bg-[#848e9c]' },
    // Market States
    TRENDING:     { text: 'TRENDING',    cls: 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/30', dot: 'bg-[var(--holo-cyan)] animate-pulse' },
    RANGING:      { text: 'RANGING',     cls: 'bg-[#bc13fe]/10 text-[#bc13fe] border-[#bc13fe]/30', dot: 'bg-[#bc13fe]' },
    CHOPPY:       { text: 'CHOPPY',      cls: 'bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] border-[var(--holo-magenta)]/30', dot: 'bg-[var(--holo-magenta)] animate-pulse' },
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
  const [step, setStep] = useState(1);
  const set = <K extends keyof typeof cfg>(k: K, v: (typeof cfg)[K]) => setCfg(f => ({ ...f, [k]: v }));

  const biases: MarketDirection[] = ['BULLISH', 'BEARISH', 'SIDEWAYS'];
  const strategies: BotStrategyType[] = ['RANGE_BOUND', 'BREAKOUT', 'PULLBACK'];

  return (
    <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 overflow-auto py-10" onClick={onClose}>
      <div className="glass-panel-modern border border-white/10 rounded-[2rem] shadow-[0_0_100px_rgba(188,19,254,0.15)] w-full max-w-2xl relative overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        
        {/* Advanced Background Elements */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#bc13fe]/5 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[var(--holo-cyan)]/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />
        
        {/* Header Section */}
        <div className="flex justify-between items-center p-8 border-b border-white/5 relative z-10 shrink-0">
          <div className="flex items-center gap-5">
             <div className="p-3 bg-gradient-to-br from-[#bc13fe]/20 to-transparent rounded-2xl border border-[#bc13fe]/30 text-[#bc13fe] shadow-[0_0_20px_rgba(188,19,254,0.2)]">
               <BrainCircuit className="w-6 h-6 animate-pulse" />
             </div>
             <div>
               <h3 className="text-white font-black tracking-[0.3em] uppercase text-base mb-1">Structural Analysis Engine</h3>
               <div className="flex items-center gap-2">
                 <div className="flex gap-1">
                   {[1, 2, 3].map(i => (
                     <div key={i} className={cn("h-1 rounded-full transition-all duration-500", i === step ? "w-4 bg-[var(--holo-cyan)] shadow-[0_0_8px_var(--holo-cyan)]" : "w-1.5 bg-white/10")} />
                   ))}
                 </div>
                 <p className="text-white/30 text-[9px] font-mono tracking-[0.2em] uppercase ml-2">Phase_0{step} // Logic_Compilation</p>
               </div>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-white/30 hover:text-[var(--holo-magenta)] transition-all duration-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-8 space-y-8 overflow-y-auto tactical-scrollbar relative z-10 flex-1">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-4 bg-[#bc13fe] rounded-full" />
                  <h4 className="text-[11px] text-white/40 font-black uppercase tracking-[0.2em]">01_Identity_&_Routing</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <Field label="Node Alias"><Input placeholder="ALPHA_NODE_01" value={cfg.name} onChange={e => set('name', e.target.value.toUpperCase())} /></Field>
                  <Field label="Uplink Gateway">
                    <Select value={cfg.accessPointId} onChange={e => set('accessPointId', e.target.value)}>
                      <option value="">— SELECT GATEWAY —</option>
                      {accessPoints.map(ap => <option key={ap.id} value={ap.id}>{ap.name} ({ap.exchange})</option>)}
                    </Select>
                  </Field>
                  <Field label="Asset Matrix"><Input placeholder="BTCUSDT" value={cfg.pair} onChange={e => set('pair', e.target.value.toUpperCase())} /></Field>
                  <Field label="Execution Interval">
                    <Select value={cfg.primaryTimeframe} onChange={e => set('primaryTimeframe', e.target.value as PrimaryTimeframe)}>
                      {['1H', '4H', 'Daily'].map(tf => <option key={tf} value={tf}>{tf} CHART</option>)}
                    </Select>
                  </Field>
                </div>
              </section>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-4 bg-[var(--holo-cyan)] rounded-full" />
                  <h4 className="text-[11px] text-white/40 font-black uppercase tracking-[0.2em]">02_Top_Down_Convergence</h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <Field label="Weekly Bias (Macro)">
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                      {biases.map(b => (
                        <button key={b} onClick={() => set('weeklyBias', b)}
                          className={cn(
                            "flex-1 py-3 rounded-lg text-[10px] font-black tracking-widest transition-all duration-300",
                            cfg.weeklyBias === b ? "bg-[var(--holo-cyan)] text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]" : "text-white/40 hover:text-white/80 hover:bg-white/5"
                          )}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="Daily Bias (Swing)">
                    <div className="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5">
                      {biases.map(b => (
                        <button key={b} onClick={() => set('dailyBias', b)}
                          className={cn(
                            "flex-1 py-3 rounded-lg text-[10px] font-black tracking-widest transition-all duration-300",
                            cfg.dailyBias === b ? "bg-[var(--holo-cyan)] text-black shadow-[0_0_15px_rgba(0,229,255,0.4)]" : "text-white/40 hover:text-white/80 hover:bg-white/5"
                          )}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
                <div className="bg-gradient-to-r from-[var(--holo-gold)]/10 to-transparent border-l-2 border-[var(--holo-gold)] rounded-r-2xl p-5 flex gap-4">
                  <div className="p-2 bg-[var(--holo-gold)]/20 rounded-lg h-fit text-[var(--holo-gold)]">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-[var(--holo-gold)]/90 font-mono leading-relaxed uppercase tracking-wider">
                    Confluence filter active. Strategy will only engage when both Weekly and Daily biases align with the primary timeframe setup. Risk parameters enforced.
                  </p>
                </div>
              </section>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-700">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-1 h-4 bg-[var(--holo-gold)] rounded-full" />
                  <h4 className="text-[11px] text-white/40 font-black uppercase tracking-[0.2em]">03_Operational_Parameters</h4>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {strategies.map(s => (
                    <button key={s} onClick={() => set('strategyType', s)}
                      className={cn(
                        "p-5 rounded-2xl border text-left transition-all duration-300 relative group overflow-hidden",
                        cfg.strategyType === s ? "bg-[#bc13fe]/10 border-[#bc13fe]/40 shadow-[0_0_20px_rgba(188,19,254,0.1)]" : "bg-white/5 border-white/5 hover:border-white/10 hover:bg-white/[0.08]"
                      )}>
                      <div className="flex justify-between items-center mb-2">
                        <span className={cn("text-xs font-black tracking-[0.2em] uppercase", cfg.strategyType === s ? "text-white" : "text-white/40")}>
                          {s.replace('_', ' ')}
                        </span>
                        {cfg.strategyType === s && <Zap className="w-4 h-4 text-[#bc13fe] animate-pulse" />}
                      </div>
                      <p className="text-[10px] text-white/30 font-mono leading-relaxed max-w-sm">
                        {s === 'RANGE_BOUND' && 'Neural filter prioritizes horizontal liquidity sweeps. Buy at discount, sell at premium levels.'}
                        {s === 'BREAKOUT' && 'Momentum-based execution. Filters for institutional displacement beyond critical S/R zones.'}
                        {s === 'PULLBACK' && 'Optimized RR entry. Waits for trend confirmation followed by a retest of structural value.'}
                      </p>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-6 pt-4">
                  <Field label="Base Volume"><Input type="number" value={cfg.orderVolume} onChange={e => set('orderVolume', +e.target.value)} /></Field>
                  <Field label="Profit Target %"><Input type="number" value={cfg.takeProfit} onChange={e => set('takeProfit', +e.target.value)} step="0.1" /></Field>
                  <Field label="Stop Threshold %"><Input type="number" value={cfg.stopLoss} onChange={e => set('stopLoss', +e.target.value)} step="0.1" /></Field>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="p-8 border-t border-white/5 flex gap-4 bg-black/40 backdrop-blur-xl shrink-0">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)} 
                    className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-white/40 border border-white/10 text-[11px] font-black tracking-[0.2em] uppercase rounded-2xl transition-all duration-300">
              Prev_Module
            </button>
          )}
          <button onClick={onClose} 
                  className="flex-1 py-4 bg-white/2 hover:bg-white/5 text-white/20 border border-white/5 text-[11px] font-black tracking-[0.2em] uppercase rounded-2xl transition-all duration-300">
            Terminate
          </button>
          {step < 3 ? (
            <button onClick={() => {
              if (step === 1 && (!cfg.name || !cfg.accessPointId)) return toast.error('Identity & Gateway Required');
              setStep(s => s + 1);
            }} className="flex-[2] py-4 bg-[var(--holo-cyan)] hover:bg-cyan-400 text-black text-[11px] font-black tracking-[0.2em] uppercase rounded-2xl shadow-[0_0_25px_rgba(0,229,255,0.3)] transition-all duration-300 active:scale-95 flex items-center justify-center gap-3">
              Load_Next_Matrix <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                onSave({ ...cfg, id: existing?.id || uid(), createdAt: existing?.createdAt || Date.now() });
                onClose();
              }}
              className="flex-[2] py-4 bg-gradient-to-r from-[#bc13fe] to-[#bc13fe]/80 hover:brightness-110 text-white text-[11px] font-black tracking-[0.2em] uppercase rounded-2xl shadow-[0_0_25px_rgba(188,19,254,0.3)] transition-all duration-300 active:scale-95"
            >
              Initialize_Node_Alpha
            </button>
          )}
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
  const isChoppy = bot.marketCondition === 'CHOPPY';
  const isError = bot.status === 'error';
  const isPaused = bot.status === 'paused';

  const accentColor = isRunning ? 'var(--holo-cyan)'
    : isError ? 'var(--holo-magenta)'
    : isPaused ? 'var(--holo-gold)'
    : '#3a3f4b';

  const hexId = `#${bot.id.slice(0, 4).toUpperCase()}`;

  return (
    <div className={`relative overflow-hidden rounded-xl transition-all duration-500 node-scan ${
      isRunning
        ? 'shadow-[0_0_20px_rgba(0,229,255,0.10)] border border-[var(--holo-cyan)]/25'
        : isError ? 'border border-[var(--holo-magenta)]/25'
        : 'border border-white/[0.06]'
    }`}>
      {/* Left status accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl z-10"
        style={{ background: accentColor, boxShadow: `0 0 10px ${accentColor}88` }} />

      {/* Choppy lockout overlay */}
      {isChoppy && (
        <div className="absolute inset-0 z-20 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6 text-center">
          <div className="space-y-2">
            <ShieldCheck className="w-8 h-8 text-[var(--holo-magenta)] mx-auto animate-pulse" />
            <h4 className="text-[var(--holo-magenta)] font-black text-[10px] tracking-widest uppercase">Choppy Market Lockout</h4>
            <p className="text-gray-400 text-[8px] font-mono leading-relaxed uppercase">Neural filters detected low-probability noise. Execution halted.</p>
          </div>
        </div>
      )}

      <div className="bg-[#070b10]/90 backdrop-blur-md rounded-xl h-full pl-4 pr-4 pt-4 pb-4 flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1 min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[8px] font-mono text-white/20 font-black tracking-widest shrink-0">{hexId}</span>
              <h3 className="text-white font-black text-[13px] tracking-widest uppercase truncate">{bot.name}</h3>
              <StatusBadge status={bot.status} />
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-mono tracking-wider text-[var(--holo-cyan)]/60 font-black">
              <Network className="w-2.5 h-2.5 text-[var(--holo-cyan)] shrink-0" />
              <span className="truncate">{ap?.name || 'NO_GATEWAY'}</span>
              <span className="text-gray-600">·</span>
              <span>{bot.pair}</span>
              {isRunning && <span className="ml-1 text-[var(--holo-cyan)]/50 tabular-nums">~{Math.floor(Math.random() * 20 + 5)}ms</span>}
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <button onClick={() => onEdit(bot)} className="p-1.5 text-gray-500 hover:text-[var(--holo-cyan)] bg-white/[0.02] border border-white/[0.05] hover:border-[var(--holo-cyan)]/30 rounded-lg transition-all"><Settings2 className="w-3.5 h-3.5" /></button>
            <button onClick={() => { if (confirm(`DEAUTHORIZE NODE: ${bot.name}?`)) onDelete(bot.id); }} className="p-1.5 text-gray-500 hover:text-[var(--holo-magenta)] bg-white/[0.02] border border-white/[0.05] hover:border-[var(--holo-magenta)]/30 rounded-lg transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>

        {/* Strategy Tags */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] text-[8px] font-mono text-gray-400 font-bold uppercase">{bot.strategyType.replace('_', ' ')}</span>
          <span className="px-2 py-0.5 rounded-md bg-white/[0.03] border border-white/[0.05] text-[8px] font-mono text-gray-400 font-bold uppercase">{bot.primaryTimeframe}</span>
          <span className={`px-2 py-0.5 rounded-md border text-[8px] font-mono font-bold uppercase ${bot.weeklyBias === 'BULLISH' ? 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/20' : bot.weeklyBias === 'BEARISH' ? 'bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] border-[var(--holo-magenta)]/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>W:{bot.weeklyBias}</span>
          <span className={`px-2 py-0.5 rounded-md border text-[8px] font-mono font-bold uppercase ${bot.dailyBias === 'BULLISH' ? 'bg-[var(--holo-cyan)]/10 text-[var(--holo-cyan)] border-[var(--holo-cyan)]/20' : bot.dailyBias === 'BEARISH' ? 'bg-[var(--holo-magenta)]/10 text-[var(--holo-magenta)] border-[var(--holo-magenta)]/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>D:{bot.dailyBias}</span>
        </div>

        {/* Data Grid with Terminal Ticker Effect */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-black/40 backdrop-blur-sm border border-white/[0.05] rounded-xl p-2.5 relative overflow-hidden group">
            <span className="text-[7px] text-gray-500 uppercase tracking-widest font-black block mb-1">Yield_Extract</span>
            <div className="flex items-baseline gap-1">
              <span className={cn("text-[13px] font-black font-mono tracking-tighter", bot.realizedProfit >= 0 ? "text-[var(--holo-cyan)]" : "text-[var(--holo-magenta)]")}>
                {bot.realizedProfit >= 0 ? 'â–²' : 'â–¼'} {Math.abs(bot.realizedProfit).toFixed(2)}
              </span>
              <span className="text-[8px] text-white/20 font-mono">USDT</span>
            </div>
            <div className="absolute bottom-0 left-0 h-[1px] bg-[var(--holo-cyan)]/30 w-full scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
          </div>
          <Stat label="Neural_State" value={bot.marketCondition} color="#bc13fe" sub="CONDITION" />
          <Stat label="Matrix_Hits" value={bot.tradesCount} color="var(--holo-gold)" sub="EXECUTED" />
        </div>


        {/* Signal sparkline */}
        <div className="h-8 mb-3 bg-black/50 rounded-lg border border-white/[0.02] overflow-hidden relative">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={Array.from({ length: 20 }, (_, i) => ({ v: isRunning ? Math.sin(Date.now() / 800 + i * 0.5) * 10 + 20 : 7 }))}>
              <defs>
                <linearGradient id={`grad-${bot.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={accentColor} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={accentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={accentColor} strokeWidth={isRunning ? 1.5 : 1} fill={`url(#grad-${bot.id})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="absolute top-0.5 left-2 text-[7px] font-mono text-gray-600 tracking-widest pointer-events-none">SIGNAL_MAP</div>
        </div>

        {/* Execute button */}
        <div className="mt-auto pt-3 border-t border-white/[0.04]">
          <button
            onClick={() => onToggle(bot.id)}
            disabled={isChoppy}
            className={`w-full py-2 rounded-lg font-black text-[10px] tracking-[0.2em] uppercase transition-all flex items-center justify-center gap-1.5 border ${
              isRunning ? 'bg-[var(--holo-magenta)]/10 hover:bg-[var(--holo-magenta)]/20 border-[var(--holo-magenta)]/30 text-[var(--holo-magenta)]'
              : isChoppy ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed'
              : 'bg-[var(--holo-cyan)]/10 hover:bg-[var(--holo-cyan)]/20 border-[var(--holo-cyan)]/30 text-[var(--holo-cyan)]'
            }`}
          >
            {isRunning ? <Square className="w-3 h-3" fill="currentColor" /> : <Play className="w-3 h-3" fill="currentColor" />}
            {isRunning ? 'Halt Execution' : isChoppy ? 'LOCKED: CHOPPY' : 'Engage Strategy'}
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
        toast('Strategy Deactivated', { style: { background: '#0a0d14', color: '#fcd535', border: '1px solid rgba(252,213,53,0.2)' } }); 
        return { ...b, status: 'stopped' }; 
      }
      if (b.marketCondition === 'CHOPPY') {
        toast.error('EXECUTION DENIED: High Noise detected.', { style: { background: '#0a0d14', color: 'var(--holo-magenta)', border: '1px solid rgba(255,7,58,0.2)' } });
        return b;
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
               <h2 className="text-white font-black text-lg tracking-[0.2em] uppercase">Market Structure Engine</h2>
               <p className="text-[#bc13fe]/60 text-[10px] font-mono tracking-widest mt-1">
                 MARKET_STATE: <span className="text-[var(--holo-cyan)]">ACTIVE</span> <span className="text-gray-600">//</span> ALIGNMENT: <span className="text-[var(--holo-cyan)]">MULTI-TF</span>
               </p>
             </div>
          </div>
          <div className="flex items-center gap-3">
            {view === 'bots' ? (
              <div className="flex gap-2">
                <button onClick={() => {
                  const genBot: any = { ...defaultBot(), id: uid(), name: 'STRUCT_ALPHA_' + Math.floor(Math.random()*999), strategyType: 'PULLBACK', marketCondition: 'TRENDING', pair: 'ETHUSDT', weeklyBias: 'BULLISH', dailyBias: 'BULLISH', createdAt: Date.now() };
                  if (accessPoints.length > 0) genBot.accessPointId = accessPoints[0].id;
                  setEditingBot(genBot); setShowBotModal(true);
                  toast.success('Top-Down Analysis Synthesized', { iconTheme: {primary: 'var(--holo-cyan)', secondary: '#0a0d14'}, style: { background: '#0a0d14', color: 'var(--holo-cyan)', border: '1px solid rgba(0,240,255,0.2)' } });
                }}
                  className="bg-[var(--holo-cyan)]/10 hover:bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/30 hover:border-[var(--holo-cyan)] text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded box-glow flex items-center gap-2 transition-all overflow-hidden group relative">
                  <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-[var(--holo-cyan)]/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                  <BrainCircuit className="w-4 h-4 animate-pulse" /> Auto-Align AI
                </button>
                <button onClick={() => { setEditingBot(undefined); setShowBotModal(true); }}
                  className="bg-[#bc13fe]/10 hover:bg-[#bc13fe]/20 text-[#bc13fe] border border-[#bc13fe]/30 hover:border-[#bc13fe] text-[11px] font-black uppercase tracking-widest px-4 py-2.5 rounded box-glow-purple flex items-center gap-2 transition-all">
                  <Plus className="w-4 h-4" /> Initialize Strategy
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
          {([['bots', 'Alpha Strategies'], ['access', 'Uplink Gateways']] as [string, string][]).map(([id, label]) => (
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
                <Stat label="Active Strategies" value={runningCount} color={runningCount > 0 ? '#bc13fe' : '#eaecef'} sub={`/ ${bots.length} TOTAL`} />
                <Stat label="Market Condition" value={bots.length > 0 ? bots[0].marketCondition : 'N/A'} color="var(--holo-cyan)" sub="REAL_TIME_STATUS" />
              </div>
            )}
            
            {bots.length === 0 ? (
               <div className="flex flex-col items-center justify-center h-48 border border-white/[0.05] border-dashed rounded-xl bg-black/20 text-center relative overflow-hidden">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,240,255,0.05)_0%,transparent_70%)] pointer-events-none" />
                 <BrainCircuit className="w-10 h-10 text-gray-700 mb-4" />
                 <h3 className="text-white font-black tracking-widest uppercase text-sm mb-2">Engine Offline</h3>
                 <p className="text-gray-500 font-mono text-[10px] tracking-widest mb-6">AWAITING_INITIAL_STRATEGY_ALIGNMENT</p>
                 <button onClick={() => { setEditingBot(undefined); setShowBotModal(true); }} className="px-6 py-2 border border-[#bc13fe]/50 text-[#bc13fe] text-[10px] tracking-widest uppercase font-black rounded box-glow-purple hover:bg-[#bc13fe]/10 transition-all">Initialize Strategy</button>
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
                 <h4 className="flex items-center gap-2 text-[10px] font-mono text-[var(--holo-cyan)] uppercase tracking-[0.2em] mb-3 shrink-0"><Terminal className="w-3.5 h-3.5" /> Structure Analysis Feed</h4>
                 <div className="flex-1 overflow-hidden relative flex flex-col justify-end">
                    <div className="absolute inset-0 bg-gradient-to-b from-[#05070a] via-transparent to-transparent z-10 pointer-events-none" />
                    <div className="space-y-1 font-mono text-[10px] sm:text-[11px] font-bold text-[#848e9c]">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex gap-4">
                          <span className="text-[#5e6673]">[{new Date(Date.now() - i * 15000).toISOString().split('T')[1].slice(0,8)}]</span>
                          <span className={`${i === 0 ? 'text-[var(--holo-cyan)]' : i === 1 ? 'text-[var(--holo-cyan)]' : ''}`}>
                            {i % 3 === 0 ? '> SMC_ALIGNMENT: TREND CONFIRMED HH/HL' : i % 2 === 0 ? '> STRUCTURE_SCAN: RANGE BOUNDARY IDENTIFIED' : '> ANALYZING TOP-DOWN BIAS CONFLUENCE...'}
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
              {accessPoints.map(ap => {
                const isConnected = ap.status === 'connected';
                const exchangeInitial = ap.exchange.slice(0, 2).toUpperCase();
                const assignedNodes = bots.filter(b => b.accessPointId === ap.id).length;
                const latencyMs = Math.floor(Math.random() * 20 + 5);
                return (
                  <div key={ap.id} className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#06090e]/90 backdrop-blur-md transition-all hover:border-[var(--holo-cyan)]/20 node-scan">
                    <div className="p-5">
                      {/* Gateway Header */}
                      <div className="flex justify-between items-start mb-5">
                        <div className="flex items-center gap-4">
                          {/* Connection Strength Indicator (Animated Ring) */}
                          <div className="relative shrink-0">
                            <div className={cn(
                              "w-12 h-12 rounded-full border-2 flex items-center justify-center font-black text-[10px] tracking-tighter transition-all duration-700",
                              isConnected 
                                ? "border-[var(--holo-cyan)]/30 text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/5 shadow-[0_0_20px_rgba(0,229,255,0.1)]" 
                                : "border-white/10 text-white/20 bg-white/5"
                            )}>
                              {exchangeInitial}
                              {isConnected && (
                                <div className="absolute inset-[-4px] border border-[var(--holo-cyan)]/20 rounded-full animate-[ping_3s_infinite]" />
                              )}
                            </div>
                          </div>
                          <div>
                            <h3 className="text-white font-black text-xs uppercase tracking-[0.2em]">{ap.name}</h3>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[var(--holo-cyan)]/40 text-[7px] font-mono tracking-widest uppercase">{ap.exchange} // UPLINK_STABLE</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                           <StatusBadge status={ap.status} />
                           <span className="text-[7px] font-mono text-white/20 uppercase tracking-widest">v2.10.4</span>
                        </div>
                      </div>

                      {/* Technical Specs Grid */}
                      <div className="grid grid-cols-2 gap-3 mb-5">
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                          <span className="text-[7px] text-white/20 font-black uppercase tracking-widest">Public_Key</span>
                          <span className="text-[10px] font-mono text-white/60 truncate">{ap.apiKey}</span>
                        </div>
                        <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3 flex flex-col gap-1">
                          <span className="text-[7px] text-white/20 font-black uppercase tracking-widest">Node_Latency</span>
                          <span className={cn("text-[10px] font-mono font-black", isConnected ? "text-emerald-400" : "text-white/20")}>
                            {isConnected ? `${latencyMs}ms` : '---'}
                          </span>
                        </div>
                      </div>

                      {/* Control Strip */}
                      <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2">
                          <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-emerald-400 animate-pulse" : "bg-gray-700")} />
                          <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">{assignedNodes} ACTIVE_NODES</span>
                        </div>
                        <button onClick={() => { if(confirm('TERMINATE_UPLINK?')) setAccessPoints(p => p.filter(x => x.id !== ap.id)); }} 
                                className="p-2 text-white/20 hover:text-[var(--holo-magenta)] hover:bg-[var(--holo-magenta)]/10 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          )
        )}

      </div>
      
      {showAPModal && <APModal onClose={() => setShowAPModal(false)} onSave={ap => setAccessPoints(prev => [...prev, ap])} />}
      {showBotModal && <BotModal existing={editingBot} accessPoints={accessPoints} onClose={() => { setShowBotModal(false); setEditingBot(undefined); }} onSave={saveBot} />}
    </div>
  );
};

