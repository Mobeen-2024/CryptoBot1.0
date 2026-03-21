import React, { useState, useEffect } from 'react';
import { 
  Activity, ShieldCheck, Crosshair, Zap, Cpu, Terminal,
  Network, AlertTriangle, TrendingUp, Infinity, RotateCw,
  Clock, Sliders, Target, CheckCircle, XCircle, Radio
} from 'lucide-react';

interface BotState {
  isActive: boolean; symbol: string; qty: number; stopLossUSDT: number;
  takeProfitUSDT?: number; timeLimitMins?: number; useSmartTrailing?: boolean;
  masterEntryPrice: number; slaveEntryPrice: number;
  longStopTriggered: boolean; shortStopTriggered: boolean;
  cycles: number; totalCyclesCompleted?: number; statusText?: string;
  livePnL?: number; trailingSL?: number;
  phase?: 'ENTRY_PENDING' | 'HEDGED' | 'TRAILING_LONG' | 'TRAILING_SHORT' | 'CLOSED';
  preflightPass?: boolean; preflightDetails?: string;
}

interface DeltaNeutralPanelProps { symbol: string; }

const TabButton: React.FC<{label:string; active:boolean; onClick:()=>void; icon:React.ReactNode}> = ({label,active,onClick,icon}) => (
  <button onClick={onClick} className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition-all rounded-t-lg border-b-2
    ${active ? 'bg-[#00f0ff]/10 text-[#00f0ff] border-[#00f0ff]' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
    {icon}{label}
  </button>
);

export const DeltaNeutralPanel: React.FC<DeltaNeutralPanelProps> = ({ symbol }) => {
  // ── Tab State ──────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<'CORE'|'TRAILING'|'CYCLES'|'ENTRY'>('CORE');

  // ── Core Params ────────────────────────────────────────
  const [qty, setQty] = useState<string>('0.001');
  const [takeProfit, setTakeProfit] = useState<string>('2.00');
  const [stopLoss, setStopLoss] = useState<string>('1.00');
  const [timeLimit, setTimeLimit] = useState<string>('60');

  // ── Smart Trailing ─────────────────────────────────────
  const [useSmartTrailing, setUseSmartTrailing] = useState(false);
  const [trailingMode, setTrailingMode] = useState<'BREAKEVEN'|'PROGRESSIVE'>('BREAKEVEN');
  const [trailingStep, setTrailingStep] = useState<string>('0.5');
  const [rsiPeriod, setRsiPeriod] = useState<string>('14');
  const [rsiOverbought, setRsiOverbought] = useState<string>('70');
  const [rsiOversold, setRsiOversold] = useState<string>('30');
  const [wrPeriod, setWrPeriod] = useState<string>('14');
  const [wrOverbought, setWrOverbought] = useState<string>('-20');
  const [wrOversold, setWrOversold] = useState<string>('-80');

  // ── Multi-Cycle ────────────────────────────────────────
  const [enableMultiCycle, setEnableMultiCycle] = useState(false);
  const [maxCycles, setMaxCycles] = useState<string>('3');

  // ── Entry Mode ─────────────────────────────────────────
  const [entryMode, setEntryMode] = useState<'INSTANT'|'RSI_DIP'>('INSTANT');
  const [entryRsiThreshold, setEntryRsiThreshold] = useState<string>('40');
  const [useRiskPercent, setUseRiskPercent] = useState(false);
  const [riskPercent, setRiskPercent] = useState<string>('1');

  // ── System State ───────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<BotState>({
    isActive: false, symbol: '', qty: 0, stopLossUSDT: 1,
    masterEntryPrice: 0, slaveEntryPrice: 0,
    longStopTriggered: false, shortStopTriggered: false,
    cycles: 0, livePnL: 0, phase: 'CLOSED'
  });

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/bot/status');
        if (res.ok) setStatus(await res.json());
      } catch {}
    };
    fetchStatus();
    if ((window as any).socket) {
      (window as any).socket.on('delta_neutral_status', (data: BotState) => setStatus(data));
    }
  }, []);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol, qty, stopLossUSDT: stopLoss, takeProfitUSDT: takeProfit, timeLimitMins: timeLimit,
          useSmartTrailing, trailingMode, trailingStep,
          rsiPeriod, rsiOverbought, rsiOversold, wrPeriod, wrOverbought, wrOversold,
          enableMultiCycle, maxCycles, entryMode, entryRsiThreshold, useRiskPercent, riskPercent
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStatus(data.status);
    } catch (err: any) {
      alert('Engine Error: ' + err.message);
    } finally { setLoading(false); }
  };

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      setStatus((await res.json()).status);
    } catch (err: any) {
      alert('Abort Error: ' + err.message);
    } finally { setLoading(false); }
  };

  const rrRatio = ((parseFloat(takeProfit)||0) / (parseFloat(stopLoss)||1)).toFixed(2);
  const phaseColor: Record<string,string> = {
    ENTRY_PENDING: '#bc13fe', HEDGED: '#00f0ff',
    TRAILING_LONG: '#39ff14', TRAILING_SHORT: '#ff073a', CLOSED: '#555'
  };
  const currentPhaseColor = phaseColor[status.phase||'CLOSED'] || '#555';

  return (
    <div className="flex flex-col h-full bg-[#050505] text-white relative font-sans overflow-hidden">
      {/* Grid BG */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,240,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.025)_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative z-10 flex flex-col gap-5">

        {/* ─── HEADER ─────────────────────────────────────── */}
        <div className="flex justify-between items-end border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-[#00f0ff] animate-pulse drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]" />
            <div>
              <h2 className="text-[16px] font-black tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-r from-[#00f0ff] to-white">
                NEXUS STRADDLE ENGINE
              </h2>
              <p className="text-[9px] text-[#00f0ff]/50 tracking-[0.3em] uppercase">Delta-Neutral v5.0 // {symbol}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-right">
            <div style={{color: currentPhaseColor}} className="w-2.5 h-2.5 rounded-full bg-current animate-pulse shadow-md" />
            <div>
              <p style={{color:currentPhaseColor}} className="text-[10px] font-black tracking-widest uppercase">{status.phase || 'OFFLINE'}</p>
              <p className="text-[9px] text-gray-500">{status.statusText || '—'}</p>
            </div>
          </div>
        </div>

        {/* ─── LIVE PnL BAR ──────────────────────────────── */}
        {status.isActive && (
          <div className="bg-black/60 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4 ring-1 ring-inset ring-white/5">
            <div className="flex items-center gap-3">
              <Radio className="w-4 h-4 text-[#39ff14] animate-pulse" />
              <span className="text-[10px] uppercase tracking-widest text-gray-500">Live Combined PnL</span>
            </div>
            <span className={`text-[22px] font-black font-mono tracking-wider ${(status.livePnL||0)>=0?'text-[#39ff14]':'text-[#ff073a]'}`}
              style={{textShadow:`0 0 20px ${(status.livePnL||0)>=0?'#39ff14':'#ff073a'}`}}>
              {(status.livePnL||0)>=0?'+':''}{(status.livePnL||0).toFixed(4)} <span className="text-sm font-bold opacity-60">USDT</span>
            </span>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[9px] text-gray-600 uppercase">Cycles: {status.cycles} / Completed: {status.totalCyclesCompleted||0}</span>
              {status.trailingSL && <span className="text-[9px] text-[#bc13fe]">Trailing SL: {status.trailingSL.toFixed(2)}</span>}
            </div>
          </div>
        )}

        {/* ─── PREFLIGHT BADGE ──────────────────────────── */}
        {status.preflightDetails && (
          <div className={`flex items-center gap-3 rounded-lg px-4 py-2.5 border text-[10px] font-mono
            ${status.preflightPass ? 'bg-[#39ff14]/5 border-[#39ff14]/20 text-[#39ff14]' : 'bg-red-500/5 border-red-500/20 text-red-400'}`}>
            {status.preflightPass ? <CheckCircle className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {status.preflightDetails}
          </div>
        )}

        {/* ─── TAB NAV ───────────────────────────────────── */}
        <div className="flex gap-1 border-b border-white/10">
          <TabButton label="Core" active={activeTab==='CORE'} onClick={()=>setActiveTab('CORE')} icon={<Target className="w-3 h-3"/>} />
          <TabButton label="Trailing" active={activeTab==='TRAILING'} onClick={()=>setActiveTab('TRAILING')} icon={<Sliders className="w-3 h-3"/>} />
          <TabButton label="Cycles" active={activeTab==='CYCLES'} onClick={()=>setActiveTab('CYCLES')} icon={<RotateCw className="w-3 h-3"/>} />
          <TabButton label="Entry" active={activeTab==='ENTRY'} onClick={()=>setActiveTab('ENTRY')} icon={<Clock className="w-3 h-3"/>} />
        </div>

        {/* ─── TAB: CORE ──────────────────────────────────── */}
        {activeTab === 'CORE' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label:'Contract Size', icon:<Zap className="w-3 h-3"/>, val:qty, set:setQty, step:'0.001', color:'#00f0ff', suffix: symbol.split('/')[0] },
                { label:'Stop Loss', icon:<AlertTriangle className="w-3 h-3"/>, val:stopLoss, set:setStopLoss, step:'0.5', color:'#ff073a', suffix:'USDT' },
                { label:'Take Profit', icon:<TrendingUp className="w-3 h-3"/>, val:takeProfit, set:setTakeProfit, step:'0.5', color:'#39ff14', suffix:'USDT' },
                { label:'Time Limit', icon:<Clock className="w-3 h-3"/>, val:timeLimit, set:setTimeLimit, step:'1', color:'#bc13fe', suffix:'MINS' },
              ].map(({label,icon,val,set,step,color,suffix}) => (
                <div key={label} className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest font-bold text-gray-500" style={{color:`${color}80`}}>
                    {icon}{label}
                  </label>
                  <div className="relative">
                    <input type="number" value={val} onChange={e=>set(e.target.value)} disabled={status.isActive} step={step}
                      className="w-full bg-black/60 border border-white/10 rounded-lg px-3 py-2.5 font-mono text-[14px] font-bold outline-none disabled:opacity-40 transition-all"
                      style={{color, borderColor:`${color}30`, caretColor:color}}
                      onFocus={e=>e.target.style.borderColor=color}
                      onBlur={e=>e.target.style.borderColor=`${color}30`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold pointer-events-none" style={{color:`${color}40`}}>{suffix}</span>
                  </div>
                </div>
              ))}
            </div>
            {/* R/R Display */}
            <div className="flex items-center justify-between bg-[#00f0ff]/[0.03] border border-[#00f0ff]/10 rounded-lg px-4 py-2.5">
              <span className="text-[10px] text-gray-500 tracking-widest uppercase">AI Risk/Reward Ratio</span>
              <span className="text-[16px] font-black font-mono text-[#00f0ff]">1 : {rrRatio}</span>
            </div>
          </div>
        )}

        {/* ─── TAB: TRAILING ──────────────────────────────── */}
        {activeTab === 'TRAILING' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Toggle */}
            <label className="flex items-center justify-between cursor-pointer bg-black/40 border border-white/10 rounded-xl p-4 group">
              <div className="flex items-center gap-3">
                <Network className={`w-5 h-5 ${useSmartTrailing?'text-[#bc13fe] drop-shadow-[0_0_6px_#bc13fe]':'text-gray-500'} transition-all`} />
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-widest ${useSmartTrailing?'text-white':'text-gray-400'}`}>Algorithmic Trailing</p>
                  <p className="text-[9px] text-gray-600">Asymmetric Breakout Extraction Engine</p>
                </div>
              </div>
              <div className="relative">
                <input type="checkbox" checked={useSmartTrailing} onChange={e=>setUseSmartTrailing(e.target.checked)} disabled={status.isActive} className="sr-only peer" />
                <div className="w-12 h-6 bg-black rounded-full border border-white/10 peer-checked:border-[#bc13fe]/50 peer-checked:bg-[#bc13fe]/20 transition-all duration-300" />
                <div className="absolute top-1 left-1 w-4 h-4 bg-gray-600 rounded-full peer-checked:translate-x-6 peer-checked:bg-[#bc13fe] peer-checked:shadow-[0_0_10px_#bc13fe] transition-all duration-300" />
              </div>
            </label>

            {useSmartTrailing && (<>
              {/* Trailing Mode Toggle */}
              <div className="bg-black/30 border border-white/8 rounded-xl p-4">
                <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-3">Trailing SL Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['BREAKEVEN','PROGRESSIVE'] as const).map(m => (
                    <button key={m} onClick={()=>setTrailingMode(m)} disabled={status.isActive}
                      className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all
                        ${trailingMode===m?'bg-[#bc13fe]/20 border-[#bc13fe]/60 text-[#bc13fe] shadow-[0_0_15px_rgba(188,19,254,0.2)]':'border-white/10 text-gray-500 hover:border-white/20'}`}>
                      {m}
                    </button>
                  ))}
                </div>
                {trailingMode==='PROGRESSIVE' && (
                  <div className="mt-3 flex items-center gap-3">
                    <label className="text-[9px] text-gray-500 uppercase tracking-wider whitespace-nowrap">Step %</label>
                    <input type="number" value={trailingStep} onChange={e=>setTrailingStep(e.target.value)} disabled={status.isActive}
                      className="flex-1 bg-black/60 border border-[#bc13fe]/30 rounded px-3 py-1.5 text-[#bc13fe] font-mono text-[12px] font-bold outline-none focus:border-[#bc13fe]" step="0.1" />
                  </div>
                )}
              </div>

              {/* Indicator Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* RSI */}
                <div className="bg-black/40 border border-[#bc13fe]/20 rounded-xl p-3">
                  <h4 className="text-[9px] uppercase tracking-widest text-[#bc13fe] font-bold mb-3 border-b border-[#bc13fe]/10 pb-1">RSI</h4>
                  {[{l:'Period',v:rsiPeriod,s:setRsiPeriod,c:'white'},{l:'Overbought',v:rsiOverbought,s:setRsiOverbought,c:'#ff073a'},{l:'Oversold',v:rsiOversold,s:setRsiOversold,c:'#39ff14'}].map(({l,v,s,c})=>(
                    <div key={l} className="flex justify-between items-center bg-black rounded p-1.5 mb-1 border border-white/5">
                      <span className="text-[9px] uppercase" style={{color:`${c}80`}}>{l}</span>
                      <input type="number" value={v} onChange={e=>s(e.target.value)} disabled={status.isActive} className="w-12 bg-transparent font-mono text-[11px] font-bold text-right outline-none" style={{color:c}} />
                    </div>
                  ))}
                </div>
                {/* Williams %R */}
                <div className="bg-black/40 border border-[#bc13fe]/20 rounded-xl p-3">
                  <h4 className="text-[9px] uppercase tracking-widest text-[#bc13fe] font-bold mb-3 border-b border-[#bc13fe]/10 pb-1">Williams %R</h4>
                  {[{l:'Period',v:wrPeriod,s:setWrPeriod,c:'white'},{l:'Overbought',v:wrOverbought,s:setWrOverbought,c:'#ff073a'},{l:'Oversold',v:wrOversold,s:setWrOversold,c:'#39ff14'}].map(({l,v,s,c})=>(
                    <div key={l} className="flex justify-between items-center bg-black rounded p-1.5 mb-1 border border-white/5">
                      <span className="text-[9px] uppercase" style={{color:`${c}80`}}>{l}</span>
                      <input type="number" value={v} onChange={e=>s(e.target.value)} disabled={status.isActive} className="w-14 bg-transparent font-mono text-[11px] font-bold text-right outline-none" style={{color:c}} />
                    </div>
                  ))}
                </div>
              </div>
            </>)}
          </div>
        )}

        {/* ─── TAB: CYCLES ────────────────────────────────── */}
        {activeTab === 'CYCLES' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            <label className="flex items-center justify-between cursor-pointer bg-black/40 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <RotateCw className={`w-5 h-5 ${enableMultiCycle?'text-[#39ff14] animate-spin':'text-gray-500'} transition-all`} style={{animationDuration:'3s'}} />
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-widest ${enableMultiCycle?'text-white':'text-gray-400'}`}>Multi-Cycle Auto Re-Entry</p>
                  <p className="text-[9px] text-gray-600 mt-0.5">Automatically restart the straddle after each close</p>
                </div>
              </div>
              <div className="relative">
                <input type="checkbox" checked={enableMultiCycle} onChange={e=>setEnableMultiCycle(e.target.checked)} disabled={status.isActive} className="sr-only peer" />
                <div className="w-12 h-6 bg-black rounded-full border border-white/10 peer-checked:border-[#39ff14]/50 peer-checked:bg-[#39ff14]/20 transition-all duration-300" />
                <div className="absolute top-1 left-1 w-4 h-4 bg-gray-600 rounded-full peer-checked:translate-x-6 peer-checked:bg-[#39ff14] peer-checked:shadow-[0_0_10px_#39ff14] transition-all duration-300" />
              </div>
            </label>

            {enableMultiCycle && (
              <div className="bg-black/30 border border-[#39ff14]/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#39ff14] uppercase tracking-widest">Max Cycles</p>
                  <p className="text-[9px] text-gray-600 mt-0.5">Bot will stop after this many completed cycles</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={()=>setMaxCycles(String(Math.max(1,(parseInt(maxCycles)||1)-1)))} disabled={status.isActive} className="w-8 h-8 rounded-lg bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14] font-black text-lg flex items-center justify-center hover:bg-[#39ff14]/20">−</button>
                  <span className="w-12 text-center text-[22px] font-black font-mono text-[#39ff14]">{maxCycles}</span>
                  <button onClick={()=>setMaxCycles(String((parseInt(maxCycles)||1)+1))} disabled={status.isActive} className="w-8 h-8 rounded-lg bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14] font-black text-lg flex items-center justify-center hover:bg-[#39ff14]/20">+</button>
                </div>
              </div>
            )}
            {/* Cycle Progress Bar */}
            {status.isActive && enableMultiCycle && (
              <div className="bg-black/40 border border-white/10 rounded-xl p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">Cycle Progress</span>
                  <span className="text-[9px] text-[#39ff14] font-mono">{status.totalCyclesCompleted||0} / {maxCycles}</span>
                </div>
                <div className="w-full h-2 bg-black rounded-full overflow-hidden border border-white/5">
                  <div className="h-full bg-gradient-to-r from-[#39ff14] to-[#00f0ff] rounded-full transition-all duration-500"
                    style={{width:`${((status.totalCyclesCompleted||0)/parseInt(maxCycles||'1'))*100}%`,boxShadow:'0 0 8px #39ff14'}} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── TAB: ENTRY ─────────────────────────────────── */}
        {activeTab === 'ENTRY' && (
          <div className="flex flex-col gap-4 animate-fadeIn">
            {/* Entry Mode */}
            <div className="bg-black/30 border border-white/10 rounded-xl p-4">
              <p className="text-[9px] uppercase tracking-widest text-gray-500 mb-3">Entry Trigger Mode</p>
              <div className="grid grid-cols-2 gap-2">
                {(['INSTANT','RSI_DIP'] as const).map(m=>(
                  <button key={m} onClick={()=>setEntryMode(m)} disabled={status.isActive}
                    className={`py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all
                      ${entryMode===m?'bg-[#00f0ff]/20 border-[#00f0ff]/60 text-[#00f0ff] shadow-[0_0_15px_rgba(0,240,255,0.2)]':'border-white/10 text-gray-500 hover:border-white/20'}`}>
                    {m==='INSTANT'?'⚡ Instant Market':'📉 Wait RSI Dip'}
                  </button>
                ))}
              </div>
              {entryMode==='RSI_DIP' && (
                <div className="mt-3 flex items-center gap-3">
                  <label className="text-[9px] text-gray-500 uppercase tracking-wider whitespace-nowrap">Enter when RSI &lt;</label>
                  <input type="number" value={entryRsiThreshold} onChange={e=>setEntryRsiThreshold(e.target.value)} disabled={status.isActive}
                    className="flex-1 bg-black/60 border border-[#00f0ff]/30 rounded px-3 py-1.5 text-[#00f0ff] font-mono text-[14px] font-bold outline-none focus:border-[#00f0ff]" />
                </div>
              )}
              <p className="mt-3 text-[9px] text-gray-600 leading-relaxed">
                {entryMode==='INSTANT'
                  ? 'Both accounts will fire market orders at the next tick immediately upon activation.'
                  : `Bot will scan the 1m RSI every 5 seconds. Entry fires only when RSI drops below ${entryRsiThreshold}, signalling a potential momentum pullback.`}
              </p>
            </div>

            {/* Risk % Calculator */}
            <label className="flex items-center justify-between cursor-pointer bg-black/40 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Crosshair className={`w-5 h-5 ${useRiskPercent?'text-[#ff073a]':'text-gray-500'} transition-all`} />
                <div>
                  <p className={`text-[11px] font-black uppercase tracking-widest ${useRiskPercent?'text-white':'text-gray-400'}`}>Risk % Position Sizing</p>
                  <p className="text-[9px] text-gray-600">Auto-calculate qty from balance risk %</p>
                </div>
              </div>
              <div className="relative">
                <input type="checkbox" checked={useRiskPercent} onChange={e=>setUseRiskPercent(e.target.checked)} disabled={status.isActive} className="sr-only peer" />
                <div className="w-12 h-6 bg-black rounded-full border border-white/10 peer-checked:border-[#ff073a]/50 peer-checked:bg-[#ff073a]/20 transition-all duration-300" />
                <div className="absolute top-1 left-1 w-4 h-4 bg-gray-600 rounded-full peer-checked:translate-x-6 peer-checked:bg-[#ff073a] peer-checked:shadow-[0_0_10px_#ff073a] transition-all duration-300" />
              </div>
            </label>

            {useRiskPercent && (
              <div className="bg-[#ff073a]/5 border border-[#ff073a]/20 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-[#ff073a] uppercase tracking-widest">Risk Per Trade</p>
                  <p className="text-[9px] text-gray-600 mt-0.5">% of available balance to risk on each SL hit</p>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" value={riskPercent} onChange={e=>setRiskPercent(e.target.value)} disabled={status.isActive}
                    className="w-20 bg-black/60 border border-[#ff073a]/30 rounded-lg px-3 py-2 text-[#ff073a] font-mono text-[16px] font-black outline-none focus:border-[#ff073a] text-right" step="0.5" />
                  <span className="text-[#ff073a]/60 font-bold text-sm">%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ─── EXECUTE BUTTON ─────────────────────────────── */}
        <div className="mt-auto pt-4 border-t border-white/5">
          <button onClick={status.isActive ? handleStop : handleStart} disabled={loading}
            className={`w-full group relative overflow-hidden rounded-xl h-[64px] flex items-center justify-center gap-3 border-2 transition-all duration-500
              ${status.isActive
                ? 'bg-[#1a0205] border-[#ff073a]/50 hover:border-[#ff073a] hover:shadow-[0_0_40px_rgba(255,7,58,0.3)]'
                : 'bg-[#00080a] border-[#00f0ff]/40 hover:border-[#00f0ff] hover:shadow-[0_0_40px_rgba(0,240,255,0.3)]'}`}>
            <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] pointer-events-none" />
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity ${status.isActive?'bg-[#ff073a]':'bg-[#00f0ff]'}`} />
            {loading
              ? <Activity className={`w-5 h-5 animate-spin ${status.isActive?'text-[#ff073a]':'text-[#00f0ff]'}`} />
              : <Terminal className={`w-5 h-5 ${status.isActive?'text-[#ff073a]':'text-[#00f0ff]'} group-hover:scale-110 transition-transform`} />}
            <div className="z-10">
              <p className={`text-[14px] font-black tracking-[0.25em] uppercase ${status.isActive?'text-[#ff073a]':'text-[#00f0ff]'}`}>
                {loading ? 'PROCESSING...' : status.isActive ? 'ABORT SEQUENCE' : 'INITIATE ENGINE'}
              </p>
              <p className={`text-[8px] tracking-widest uppercase opacity-50 ${status.isActive?'text-[#ff073a]':'text-[#00f0ff]'}`}>
                {status.isActive ? 'Emergency Market Liquidation' : 'Delta-Neutral Straddle Deployment'}
              </p>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
};
