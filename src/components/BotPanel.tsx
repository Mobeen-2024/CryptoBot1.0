import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  id: string;
  name: string;
  type: BotType;
  strategy: BotStrategy;
  accessPointId: string;
  pair: string;
  status: BotStatus;
  // Core Settings
  orderVolume: number;
  takeProfit: number;
  stopLoss: number;
  maxOrderPrice: number;
  maxCycles: number;
  // DCA Specific
  extraOrderStep: number;
  maxExtraOrders: number;
  martingale: number;
  // Signal
  signal: BotSignal;
  // Runtime stats
  createdAt: number;
  currentCycle: number;
  realizedProfit: number;
  unrealizedPnl: number;
  position: number;
  unsoldVolume: number;
}

const defaultBot = (): Omit<BotConfig, 'id' | 'createdAt'> => ({
  name: 'New Bot',
  type: 'DCA',
  strategy: 'LONG',
  accessPointId: '',
  pair: 'BTCUSDT',
  status: 'stopped',
  orderVolume: 50,
  takeProfit: 2,
  stopLoss: 5,
  maxOrderPrice: 999999,
  maxCycles: 0,
  extraOrderStep: 1.5,
  maxExtraOrders: 5,
  martingale: 1.0,
  signal: 'NONE',
  currentCycle: 0,
  realizedProfit: 0,
  unrealizedPnl: 0,
  position: 0,
  unsoldVolume: 0,
});

// ─── Storage Helpers ────────────────────────────────────────────────────────

const loadBots = (): BotConfig[] => {
  try { return JSON.parse(localStorage.getItem('bot_configs') || '[]'); } catch { return []; }
};
const saveBots = (bots: BotConfig[]) => {
  try { localStorage.setItem('bot_configs', JSON.stringify(bots)); } catch {}
};
const loadAPs = (): AccessPoint[] => {
  try { return JSON.parse(localStorage.getItem('access_points') || '[]'); } catch { return []; }
};
const saveAPs = (aps: AccessPoint[]) => {
  try { localStorage.setItem('access_points', JSON.stringify(aps)); } catch {}
};
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

// ─── Status Badge ────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: BotStatus | 'connected' | 'disconnected' | 'error' }> = ({ status }) => {
  const map: Record<string, { text: string; cls: string; dot: string }> = {
    running:      { text: 'Running',      cls: 'bg-[#0ecb81]/15 text-[#0ecb81] border-[#0ecb81]/30', dot: 'bg-[#0ecb81]' },
    stopped:      { text: 'Stopped',      cls: 'bg-[#848e9c]/15 text-[#848e9c] border-[#848e9c]/30', dot: 'bg-[#848e9c]' },
    paused:       { text: 'Paused',       cls: 'bg-[#fcd535]/15 text-[#fcd535] border-[#fcd535]/30', dot: 'bg-[#fcd535]' },
    error:        { text: 'Error',        cls: 'bg-[#f6465d]/15 text-[#f6465d] border-[#f6465d]/30', dot: 'bg-[#f6465d]' },
    connected:    { text: 'Connected',    cls: 'bg-[#0ecb81]/15 text-[#0ecb81] border-[#0ecb81]/30', dot: 'bg-[#0ecb81] animate-pulse' },
    disconnected: { text: 'Disconnected', cls: 'bg-[#848e9c]/15 text-[#848e9c] border-[#848e9c]/30', dot: 'bg-[#848e9c]' },
  };
  const s = map[status] || map.stopped;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border ${s.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.text}
    </span>
  );
};

// ─── Stat Card ───────────────────────────────────────────────────────────────

const Stat: React.FC<{ label: string; value: React.ReactNode; sub?: string; green?: boolean; red?: boolean }> = ({ label, value, sub, green, red }) => (
  <div className="bg-[#0b0e11] rounded-xl p-3 border border-[#2b3139]">
    <span className="text-[10px] text-[#848e9c] uppercase tracking-wider font-bold block mb-1">{label}</span>
    <span className={`text-sm font-bold font-mono block ${green ? 'text-[#0ecb81]' : red ? 'text-[#f6465d]' : 'text-[#eaecef]'}`}>{value}</span>
    {sub && <span className="text-[10px] text-[#5e6673] mt-0.5 block">{sub}</span>}
  </div>
);

// ─── Field ───────────────────────────────────────────────────────────────────

const Field: React.FC<{
  label: string; help?: string; children: React.ReactNode;
}> = ({ label, help, children }) => (
  <div>
    <div className="flex items-center gap-1 mb-1">
      <label className="text-xs text-[#eaecef] font-bold">{label}</label>
      {help && (
        <span title={help} className="text-[#5e6673] hover:text-[#848e9c] cursor-help">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        </span>
      )}
    </div>
    {children}
  </div>
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => (
  <input {...props} className={`w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#fcd535] rounded-lg px-3 py-2 text-[#eaecef] text-sm outline-none font-mono transition-colors ${props.className || ''}`} />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = (props) => (
  <select {...props} className={`w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#fcd535] rounded-lg px-3 py-2 text-[#eaecef] text-sm outline-none font-mono transition-colors appearance-none ${props.className || ''}`} />
);

// ─── Access Point Modal ───────────────────────────────────────────────────────

const APModal: React.FC<{ onClose: () => void; onSave: (ap: AccessPoint) => void }> = ({ onClose, onSave }) => {
  const [form, setForm] = useState({ name: '', exchange: 'Binance', apiKey: '', apiSecret: '' });
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#181a20] border border-[#2b3139] rounded-2xl shadow-2xl w-full max-w-md p-6 font-sans" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-[#eaecef] font-bold text-base">New Access Point</h3>
          <button onClick={onClose} className="text-[#848e9c] hover:text-white"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div className="space-y-4">
          <Field label="Name" help="A friendly label for this exchange connection">
            <Input placeholder="e.g. Binance Main" value={form.name} onChange={e => set('name', e.target.value)} />
          </Field>
          <Field label="Exchange">
            <Select value={form.exchange} onChange={e => set('exchange', e.target.value)}>
              {['Binance', 'Bybit', 'OKX', 'Kraken', 'KuCoin', 'Gate.io'].map(ex => <option key={ex}>{ex}</option>)}
            </Select>
          </Field>
          <Field label="API Key" help="The unique identifier generated by your exchange">
            <Input type="password" placeholder="Paste your API key…" value={form.apiKey} onChange={e => set('apiKey', e.target.value)} />
          </Field>
          <Field label="API Secret" help="Keep this private — it is never stored in plaintext">
            <Input type="password" placeholder="Paste your API secret…" value={form.apiSecret} onChange={e => set('apiSecret', e.target.value)} />
          </Field>
          <div className="bg-[#fcd535]/8 border border-[#fcd535]/20 rounded-lg p-3 text-[10px] text-[#fcd535]">
            ⚠ Only grant <strong>Trade</strong> and <strong>Read</strong> permissions on the exchange. Never enable withdrawal permissions.
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 bg-[#2b3139] hover:bg-[#3b4351] text-[#eaecef] text-sm font-bold rounded-xl transition-colors">Cancel</button>
          <button
            onClick={() => {
              if (!form.name || !form.apiKey) return toast.error('Name and API Key are required');
              onSave({ id: uid(), name: form.name, exchange: form.exchange, apiKey: form.apiKey.slice(0, 8) + '••••', balance: 0, status: 'connected' });
              onClose();
              toast.success('Access point created');
            }}
            className="flex-1 py-2.5 bg-[#fcd535] hover:bg-[#fcba03] text-[#0b0e11] text-sm font-bold rounded-xl transition-colors"
          >Connect Exchange</button>
        </div>
      </div>
    </div>
  );
};

// ─── Bot Create / Edit Modal ──────────────────────────────────────────────────

const BotModal: React.FC<{ existing?: BotConfig; accessPoints: AccessPoint[]; onClose: () => void; onSave: (bot: BotConfig) => void }> = ({ existing, accessPoints, onClose, onSave }) => {
  const [cfg, setCfg] = useState<Omit<BotConfig, 'id' | 'createdAt'>>(existing ? { ...existing } : defaultBot());
  const set = <K extends keyof typeof cfg>(k: K, v: (typeof cfg)[K]) => setCfg(f => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto" onClick={onClose}>
      <div className="bg-[#181a20] border border-[#2b3139] rounded-2xl shadow-2xl w-full max-w-2xl my-6 font-sans" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-[#2b3139]">
          <div>
            <h3 className="text-[#eaecef] font-bold text-base">{existing ? 'Edit Bot' : 'Create New Bot'}</h3>
            <p className="text-[#848e9c] text-xs mt-0.5">Configure your automated trading strategy</p>
          </div>
          <button onClick={onClose} className="text-[#848e9c] hover:text-white p-1.5 bg-[#2b3139] rounded-full"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>

        <div className="p-5 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">

          {/* Basic Setup */}
          <div>
            <h4 className="text-[10px] text-[#fcd535] uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-4 h-px bg-[#fcd535]"/>Basic Setup</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Bot Name"><Input placeholder="My DCA Bot" value={cfg.name} onChange={e => set('name', e.target.value)} /></Field>
              <Field label="Access Point" help="The exchange account this bot will trade on">
                <Select value={cfg.accessPointId} onChange={e => set('accessPointId', e.target.value)}>
                  <option value="">— Select Access Point —</option>
                  {accessPoints.map(ap => <option key={ap.id} value={ap.id}>{ap.name} ({ap.exchange})</option>)}
                </Select>
              </Field>
              <Field label="Trading Pair"><Input placeholder="BTCUSDT" value={cfg.pair} onChange={e => set('pair', e.target.value.toUpperCase())} /></Field>
              <Field label="Strategy">
                <div className="grid grid-cols-2 gap-2">
                  {(['LONG', 'SHORT'] as BotStrategy[]).map(s => (
                    <button key={s} onClick={() => set('strategy', s)}
                      className={`py-2 rounded-lg text-xs font-bold border transition-all ${cfg.strategy === s ? (s === 'LONG' ? 'bg-[#0ecb81]/15 border-[#0ecb81] text-[#0ecb81]' : 'bg-[#f6465d]/15 border-[#f6465d] text-[#f6465d]') : 'bg-[#2b3139] border-transparent text-[#848e9c] hover:text-[#eaecef]'}`}>{s}</button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* Bot Type */}
          <div>
            <h4 className="text-[10px] text-[#fcd535] uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-4 h-px bg-[#fcd535]"/>Bot Type</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'DCA' as BotType, title: 'DCA Bot', icon: 'M12 20V10M18 20V4M6 20v-4', desc: 'One TP for all orders. Extra orders trigger on adverse moves.' },
                { type: 'GRID' as BotType, title: 'Grid Bot', icon: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18M15 3v18', desc: 'Individual sell per buy order. Profits from range oscillation.' },
              ].map(t => (
                <button key={t.type} onClick={() => set('type', t.type)}
                  className={`p-4 rounded-xl border text-left transition-all ${cfg.type === t.type ? 'bg-[#fcd535]/10 border-[#fcd535]' : 'bg-[#0b0e11] border-[#2b3139] hover:border-[#474d57]'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={cfg.type === t.type ? '#fcd535' : '#848e9c'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={t.icon}/></svg>
                    <span className={`text-sm font-bold ${cfg.type === t.type ? 'text-[#fcd535]' : 'text-[#eaecef]'}`}>{t.title}</span>
                  </div>
                  <p className="text-[10px] text-[#848e9c] leading-relaxed">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Order Settings */}
          <div>
            <h4 className="text-[10px] text-[#fcd535] uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-4 h-px bg-[#fcd535]"/>Order Settings</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Field label="Order Volume (USDT)" help="Initial position size in quote currency">
                <Input type="number" value={cfg.orderVolume} onChange={e => set('orderVolume', +e.target.value)} />
              </Field>
              <Field label="Take Profit (%)" help="Profit target as % of order volume">
                <Input type="number" value={cfg.takeProfit} onChange={e => set('takeProfit', +e.target.value)} step="0.1" />
              </Field>
              <Field label="Stop Loss (%)" help="Maximum loss threshold before closing the cycle">
                <Input type="number" value={cfg.stopLoss} onChange={e => set('stopLoss', +e.target.value)} step="0.1" />
              </Field>
              <Field label="Max Order Price" help="Bot will not open a new cycle above this price">
                <Input type="number" value={cfg.maxOrderPrice} onChange={e => set('maxOrderPrice', +e.target.value)} />
              </Field>
              <Field label="Max Cycles" help="0 = unlimited. Bot stops after this many completed cycles">
                <Input type="number" value={cfg.maxCycles} onChange={e => set('maxCycles', +e.target.value)} min={0} />
              </Field>
            </div>
          </div>

          {/* DCA Settings */}
          {cfg.type === 'DCA' && (
            <div>
              <h4 className="text-[10px] text-[#fcd535] uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-4 h-px bg-[#fcd535]"/>DCA Extra Order Settings</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <Field label="Extra Order Step (%)" help="Price must move this % against strategy to trigger an extra order">
                  <Input type="number" value={cfg.extraOrderStep} onChange={e => set('extraOrderStep', +e.target.value)} step="0.1" />
                </Field>
                <Field label="Max Extra Orders" help="Maximum number of safety orders per cycle">
                  <Input type="number" value={cfg.maxExtraOrders} onChange={e => set('maxExtraOrders', +e.target.value)} min={1} max={20} />
                </Field>
                <Field label="Martingale (×)" help="Multiply next extra order volume by this factor (1.0 = disabled). High risk!">
                  <Input type="number" value={cfg.martingale} onChange={e => set('martingale', +e.target.value)} step="0.05" min={1.0} max={2.0} />
                </Field>
              </div>
              {cfg.martingale > 1.3 && (
                <div className="mt-3 bg-[#f6465d]/10 border border-[#f6465d]/30 rounded-lg p-3 text-[11px] text-[#f6465d] flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  High martingale coefficient ({cfg.martingale}×) is highly risky. For experienced traders only.
                </div>
              )}
            </div>
          )}

          {/* Signal */}
          <div>
            <h4 className="text-[10px] text-[#fcd535] uppercase tracking-widest font-bold mb-3 flex items-center gap-2"><span className="w-4 h-px bg-[#fcd535]"/>Entry Signal</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                { id: 'NONE',     label: 'No Signal',  desc: 'Manual / Immediate entry' },
                { id: 'MACD',     label: 'MACD',       desc: 'Entry on MACD crossover (100 min)' },
                { id: 'RSI',      label: 'RSI',        desc: 'Entry on oversold/overbought RSI (100 min)' },
                { id: 'BOLLINGER',label: 'Bollinger',  desc: 'Entry on Bollinger band touch (5 min, 1.5h)' },
              ] as { id: BotSignal; label: string; desc: string }[]).map(sig => (
                <button key={sig.id} onClick={() => set('signal', sig.id)} title={sig.desc}
                  className={`p-2.5 rounded-lg border text-left transition-all ${cfg.signal === sig.id ? 'bg-[#2962FF]/15 border-[#2962FF] text-[#2962FF]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c] hover:border-[#474d57]'}`}>
                  <span className="text-xs font-bold block">{sig.label}</span>
                  <span className="text-[9px] mt-0.5 block leading-relaxed opacity-70">{sig.desc}</span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#2b3139] flex gap-3">
          <button onClick={onClose} className="w-1/3 py-3 bg-[#2b3139] hover:bg-[#3b4351] text-[#eaecef] text-sm font-bold rounded-xl transition-colors">Cancel</button>
          <button
            onClick={() => {
              if (!cfg.name.trim()) return toast.error('Bot name is required');
              if (!cfg.accessPointId) return toast.error('Select an access point');
              onSave({ ...cfg, id: existing?.id || uid(), createdAt: existing?.createdAt || Date.now() });
              onClose();
            }}
            className="flex-1 py-3 bg-[#fcd535] hover:bg-[#fcba03] text-[#0b0e11] text-sm font-bold rounded-xl transition-colors"
          >{existing ? 'Save Changes' : 'Create Bot'}</button>
        </div>
      </div>
    </div>
  );
};

// ─── Bot Card ────────────────────────────────────────────────────────────────

const BotCard: React.FC<{
  bot: BotConfig;
  ap?: AccessPoint;
  onToggle: (id: string) => void;
  onEdit: (bot: BotConfig) => void;
  onDelete: (id: string) => void;
}> = ({ bot, ap, onToggle, onEdit, onDelete }) => {
  const isRunning = bot.status === 'running';
  return (
    <div className={`bg-[#1e2329] border rounded-xl overflow-hidden transition-all ${isRunning ? 'border-[#0ecb81]/40 shadow-[0_0_20px_rgba(14,203,129,0.06)]' : 'border-[#2b3139]'}`}>
      {/* Card Header */}
      <div className="flex justify-between items-start p-4 gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#eaecef] font-bold text-sm truncate">{bot.name}</span>
            <StatusBadge status={bot.status} />
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${bot.type === 'DCA' ? 'bg-[#fcd535]/10 text-[#fcd535]' : 'bg-[#2962FF]/10 text-[#2962FF]'}`}>{bot.type}</span>
            <span className={`text-[10px] font-bold ${bot.strategy === 'LONG' ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{bot.strategy}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-[#5e6673] font-mono">
            <span>{bot.pair}</span>
            {ap && <span>{ap.exchange} · {ap.name}</span>}
            <span>Cycle #{bot.currentCycle}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button onClick={() => onEdit(bot)} className="p-1.5 text-[#848e9c] hover:text-[#eaecef] bg-[#2b3139] hover:bg-[#3b4351] rounded-lg transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={() => { if (confirm(`Delete "${bot.name}"?`)) onDelete(bot.id); }} className="p-1.5 text-[#848e9c] hover:text-[#f6465d] bg-[#2b3139] hover:bg-[#f6465d]/10 rounded-lg transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 px-4 pb-4">
        <Stat label="Realized P&amp;L" value={`${bot.realizedProfit >= 0 ? '+' : ''}${bot.realizedProfit.toFixed(2)} USDT`} green={bot.realizedProfit > 0} red={bot.realizedProfit < 0} />
        <Stat label="Unrealized P&amp;L" value={`${bot.unrealizedPnl >= 0 ? '+' : ''}${bot.unrealizedPnl.toFixed(2)} USDT`} green={bot.unrealizedPnl > 0} red={bot.unrealizedPnl < 0} />
        <Stat label="Position" value={`${bot.position.toFixed(4)}`} sub={bot.pair.replace('USDT', '')} />
        <Stat label="Config" value={`TP ${bot.takeProfit}% · SL ${bot.stopLoss}%`} sub={`Vol: $${bot.orderVolume}`} />
      </div>

      {/* Footer / Controls */}
      <div className="px-4 pb-4">
        <button
          onClick={() => onToggle(bot.id)}
          className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            isRunning
              ? 'bg-[#f6465d]/15 hover:bg-[#f6465d]/25 border border-[#f6465d]/40 text-[#f6465d]'
              : 'bg-[#0ecb81]/15 hover:bg-[#0ecb81]/25 border border-[#0ecb81]/40 text-[#0ecb81]'
          }`}
        >
          {isRunning ? (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>Stop Bot</>
          ) : (
            <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>Start Bot</>
          )}
        </button>
      </div>
    </div>
  );
};

// ─── Main Panel ──────────────────────────────────────────────────────────────

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
    setBots(prev => {
      const idx = prev.findIndex(b => b.id === bot.id);
      if (idx >= 0) { const n = [...prev]; n[idx] = bot; return n; }
      return [...prev, bot];
    });
  };

  const toggleBot = (id: string) => {
    setBots(prev => prev.map(b => {
      if (b.id !== id) return b;
      if (b.status === 'running') { toast('Bot paused', { icon: '⏸' }); return { ...b, status: 'stopped' }; }
      if (!accessPoints.find(ap => ap.id === b.accessPointId)) {
        toast.error('No access point connected. Link an exchange first.');
        return b;
      }
      toast.success(`${b.name} is now running`, { icon: '🤖' });
      return { ...b, status: 'running' };
    }));
  };

  const runningCount = bots.filter(b => b.status === 'running').length;
  const totalPnl = bots.reduce((s, b) => s + b.realizedProfit, 0);

  return (
    <div className="h-full flex flex-col bg-[#0b0e11] text-[#eaecef] font-sans overflow-hidden">

      {/* Top Bar */}
      <div className="shrink-0 border-b border-[#2b3139] px-5 pt-4 pb-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-[#eaecef] flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fcd535" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 10.5C7 9.12 8.12 8 9.5 8S12 9.12 12 10.5 10.88 13 9.5 13 7 11.88 7 10.5z"/><path d="M14.5 8h3"/><path d="M14.5 11h3"/><path d="M14.5 13.5h2"/></svg>
              Bot Manager
            </h2>
            <p className="text-[#848e9c] text-[11px] mt-0.5">{runningCount} running · {bots.length} total · {accessPoints.length} exchange(s)</p>
          </div>
          <div className="flex items-center gap-2">
            {view === 'bots' && (
              <button onClick={() => { setEditingBot(undefined); setShowBotModal(true); }}
                className="bg-[#fcd535] hover:bg-[#fcba03] text-[#0b0e11] text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                New Bot
              </button>
            )}
            {view === 'access' && (
              <button onClick={() => setShowAPModal(true)}
                className="bg-[#fcd535] hover:bg-[#fcba03] text-[#0b0e11] text-xs font-bold px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Add Exchange
              </button>
            )}
          </div>
        </div>

        {/* Tab Pills */}
        <div className="flex gap-1">
          {([['bots', 'My Bots'], ['access', 'Access Points']] as [string, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setView(id as any)}
              className={`px-4 py-2 text-xs font-bold rounded-t-lg border-b-2 transition-all ${view === id ? 'text-[#fcd535] border-[#fcd535] bg-[#fcd535]/5' : 'text-[#848e9c] border-transparent hover:text-[#eaecef]'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">

        {/* Summary Strip */}
        {view === 'bots' && bots.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            <Stat label="Running Bots" value={runningCount} green={runningCount > 0} />
            <Stat label="Total Realized P&L" value={`${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} USDT`} green={totalPnl > 0} red={totalPnl < 0} />
            <Stat label="Access Points" value={accessPoints.filter(a => a.status === 'connected').length} sub={`of ${accessPoints.length} linked`} />
          </div>
        )}

        {/* Bot List */}
        {view === 'bots' && (
          bots.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1e2329] border border-[#2b3139] flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5e6673" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M7 10.5C7 9.12 8.12 8 9.5 8S12 9.12 12 10.5 10.88 13 9.5 13 7 11.88 7 10.5z"/><path d="M14.5 8h3M14.5 11h3"/></svg>
              </div>
              <p className="text-[#848e9c] text-sm font-bold">No bots configured</p>
              <p className="text-[#5e6673] text-xs mt-1 mb-4">Create a DCA or Grid bot to start automating your trades</p>
              <button onClick={() => { setEditingBot(undefined); setShowBotModal(true); }}
                className="bg-[#fcd535] hover:bg-[#fcba03] text-[#0b0e11] text-xs font-bold px-4 py-2 rounded-lg">
                Create First Bot
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {bots.map(bot => (
                <BotCard key={bot.id} bot={bot} ap={accessPoints.find(a => a.id === bot.accessPointId)}
                  onToggle={toggleBot} onEdit={b => { setEditingBot(b); setShowBotModal(true); }}
                  onDelete={id => setBots(prev => prev.filter(b => b.id !== id))} />
              ))}
            </div>
          )
        )}

        {/* Access Points */}
        {view === 'access' && (
          accessPoints.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1e2329] border border-[#2b3139] flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5e6673" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              </div>
              <p className="text-[#848e9c] text-sm font-bold">No exchanges linked</p>
              <p className="text-[#5e6673] text-xs mt-1 mb-4">Connect your exchange API keys to create an access point for bots</p>
              <button onClick={() => setShowAPModal(true)} className="bg-[#fcd535] hover:bg-[#fcba03] text-[#0b0e11] text-xs font-bold px-4 py-2 rounded-lg">
                Connect Exchange
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {accessPoints.map(ap => (
                <div key={ap.id} className="bg-[#1e2329] border border-[#2b3139] rounded-xl p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="text-[#eaecef] font-bold text-sm">{ap.name}</p>
                      <p className="text-[#848e9c] text-xs mt-0.5">{ap.exchange}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={ap.status} />
                      <button onClick={() => setAccessPoints(prev => prev.filter(a => a.id !== ap.id))} className="p-1 text-[#848e9c] hover:text-[#f6465d] transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/></svg>
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#848e9c]">API Key</span>
                      <span className="text-[#eaecef] font-mono">{ap.apiKey}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-[#848e9c]">Bots using</span>
                      <span className="text-[#eaecef]">{bots.filter(b => b.accessPointId === ap.id).length}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modals */}
      {showAPModal && <APModal onClose={() => setShowAPModal(false)} onSave={ap => setAccessPoints(prev => [...prev, ap])} />}
      {showBotModal && (
        <BotModal
          existing={editingBot}
          accessPoints={accessPoints}
          onClose={() => { setShowBotModal(false); setEditingBot(undefined); }}
          onSave={saveBot}
        />
      )}
    </div>
  );
};
