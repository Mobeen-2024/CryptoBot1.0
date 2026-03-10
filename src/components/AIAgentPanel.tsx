import React, { useState, useEffect } from 'react';
import { Bot, Cpu, Zap, ShieldAlert, Network, Terminal, Activity } from 'lucide-react';

interface AIAgentPanelProps {
  marketData: any[];
  symbol: string;
}

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ symbol }) => {
  const [typedText, setTypedText] = useState('');
  const [pulse, setPulse] = useState(0);

  const fullText = `[SYS.AI_CORE] Initializing bidirectional delta-neutral market initiation protocol for ${symbol}...\n\nAnalyzing order book density and microstructure friction metrics. Current parameters dictate simultaneous LONG/SHORT execution with hyper-tight [1 USDT] risk parity.\n\nWARNING: Deploying discrete identical opposing orders across unauthorized multi-node architectures triggers high-probability compliance violation flags (Market Manipulation / Wash Trading). \n\nAlgorithmic friction detected: Volatility whipsaw events will compound taker-fee attrition. Recommend shifting to native hedge-mode or options-based synthetic straddle routing to mitigate spread slippage. \n\nCalculating re-entry matrix...\nStandby.`;

  useEffect(() => {
    let i = 0;
    setTypedText('');
    const typingInterval = setInterval(() => {
      if (i < fullText.length) {
        setTypedText(prev => prev + fullText.charAt(i));
        i++;
      } else {
        clearInterval(typingInterval);
      }
    }, 15);

    return () => clearInterval(typingInterval);
  }, [symbol]);

  useEffect(() => {
    const pulseInterval = setInterval(() => {
      setPulse(Math.random() * 100);
    }, 2000);
    return () => clearInterval(pulseInterval);
  }, []);

  return (
    <div className="bg-[#05070a] backdrop-blur-2xl p-4 rounded-xl border border-white/[0.05] flex flex-col h-full relative overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)]">
      
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#bc13fe]/5 rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[200px] h-[200px] bg-[#00f0ff]/5 rounded-full blur-[60px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0 border-b border-white/[0.05] pb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-8 h-8 rounded border border-[#bc13fe]/40 bg-[#bc13fe]/10 flex items-center justify-center inner-glow z-10 relative">
              <Bot className="text-[#bc13fe] w-4 h-4" />
            </div>
            {/* Spinning radar ring */}
            <div className="absolute inset-[-4px] border border-[#bc13fe]/20 rounded-full animate-[spin_4s_linear_infinite] border-t-[#bc13fe]" />
          </div>
          <div>
            <h2 className="text-[14px] font-black text-white tracking-[0.15em] uppercase flex items-center gap-2">
              Neural Agent
              <span className="px-1.5 py-0.5 rounded bg-[#39ff14]/10 border border-[#39ff14]/30 text-[#39ff14] text-[8px] tracking-widest animate-pulse">ONLINE</span>
            </h2>
            <p className="text-[9px] text-gray-500 font-mono tracking-widest mt-0.5">MODEL: QUANT-X 2035 // CORE: ACTIVE</p>
          </div>
        </div>
        
        {/* Network Status */}
        <div className="flex gap-1.5">
          {[1,2,3,4].map(i => (
            <div key={i} className="w-1.5 bg-[#bc13fe]/40 rounded-t" style={{ height: `${Math.max(20, Math.random() * 100)}%`, transition: 'height 0.2s' }} />
          ))}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
        
        {/* Left: Interactive Output Terminal */}
        <div className="flex-1 bg-[#0a0d14] border border-white/[0.05] rounded-lg p-3 flex flex-col relative group">
          <div className="absolute top-0 right-0 p-2 opacity-30 flex gap-2">
             <Terminal className="w-3 h-3 text-[#00f0ff]" />
             <span className="text-[8px] font-mono text-[#00f0ff]">STDOUT // LOG</span>
          </div>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[11px] leading-relaxed text-[#a0aab8] whitespace-pre-wrap mt-2 pr-2">
            {typedText}
            <span className="inline-block w-1.5 h-3 bg-[#00f0ff] ml-1 animate-pulse" />
          </div>
        </div>

        {/* Right: Modules & Metrics */}
        <div className="w-full md:w-[260px] flex flex-col gap-3 shrink-0 overflow-y-auto custom-scrollbar pr-1">
          
          {/* Engine Load */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded p-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[9px] font-bold text-gray-500 tracking-widest uppercase flex items-center gap-1.5"><Cpu className="w-3 h-3 text-yellow-500"/> Compute Load</span>
              <span className="text-[10px] font-mono text-yellow-400">{pulse.toFixed(1)}%</span>
            </div>
            <div className="h-1 bg-black rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-yellow-600 to-yellow-400 transition-all duration-500" style={{ width: `${pulse}%` }} />
            </div>
          </div>

          {/* Action Modules */}
          <div className="grid grid-cols-2 gap-2">
            <ActionModule icon={Zap} title="Optimize" color="#39ff14" active />
            <ActionModule icon={Network} title="Hedge Net" color="#00f0ff" />
            <ActionModule icon={ShieldAlert} title="Risk Audit" color="#ff073a" />
            <ActionModule icon={Activity} title="Simulate" color="#fcd535" />
          </div>

          {/* AI Confidence Score */}
          <div className="mt-auto bg-black border border-[#bc13fe]/20 rounded p-3 relative overflow-hidden group hover:border-[#bc13fe]/50 transition-colors cursor-pointer">
            <div className="absolute inset-0 bg-gradient-to-r from-[#bc13fe]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[9px] font-bold text-[#bc13fe] tracking-widest uppercase block mb-1">Strategy Confidence</span>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-black font-mono text-white leading-none">84<span className="text-lg text-gray-500">%</span></span>
              <span className="text-[9px] text-[#39ff14] font-mono pb-1">+2.4% vs benchmark</span>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

function ActionModule({ icon: Icon, title, color, active = false }: any) {
  return (
    <button className={`p-2 rounded border flex flex-col items-center justify-center gap-1.5 transition-all
      ${active ? 'bg-white/[0.05] border-white/[0.1]' : 'bg-black border-white/[0.02] hover:bg-white/[0.02] hover:border-white/[0.1]'}
    `}>
      <Icon className="w-4 h-4" style={{ color }} />
      <span className="text-[8px] font-bold text-gray-400 tracking-wider uppercase">{title}</span>
    </button>
  );
}

