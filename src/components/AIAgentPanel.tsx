import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, Cpu, Zap, ShieldAlert, Network, Terminal, Activity, 
  ChevronRight, MessageSquare, ShieldCheck, Target, TrendingUp, 
  Mic, MicOff, Sliders, Database
} from 'lucide-react';
import { AgentVisualizer } from './AgentVisualizer';
import { ExecutionPayload } from './ExecutionPayload';

interface Message {
  id: string;
  agent: 'Risk Sentinel' | 'Apex Aggressor' | 'Market Neutral' | 'System';
  text: string;
  timestamp: number;
}

interface AIAgentPanelProps {
  marketData: any[];
  symbol: string;
}

export const AIAgentPanel: React.FC<AIAgentPanelProps> = ({ symbol }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [consensusScore, setConsensusScore] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeAgent, setActiveAgent] = useState<'risk' | 'momentum' | 'neutral'>('neutral');
  const [inputText, setInputText] = useState('');
  const [payload, setPayload] = useState<any>(null);
  
  // Advanced Features State
  const [weights, setWeights] = useState({ risk: 30, momentum: 60, neutral: 10 });
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [dataStream, setDataStream] = useState<string[]>([]);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const streamEndRef = useRef<HTMLDivElement>(null);

  // Initial Boot Sequence
  useEffect(() => {
    const bootSequence = async () => {
      setIsAnalyzing(true);
      const initialLogs = [
        { id: '1', agent: 'System' as const, text: `[CORE] Initializing Neural Link: ${symbol}`, timestamp: Date.now() },
        { id: '2', agent: 'Risk Sentinel' as const, text: 'Scanning localized volatility matrices...', timestamp: Date.now() + 500 },
        { id: '3', agent: 'Apex Aggressor' as const, text: 'Identifying breakout liquidity pools...', timestamp: Date.now() + 1000 },
      ];

      for (const log of initialLogs) {
        setMessages(prev => [...prev, log]);
        await new Promise(r => setTimeout(r, 800));
      }

      await fetchAnalysis();
    };

    bootSequence();
  }, [symbol]);

  const fetchAnalysis = async () => {
    setIsAnalyzing(true);
    setPayload(null);
    try {
      const mockResponse = {
        consensus: { score: 84, sentiment: 'Strong Bullish' },
        debate: [
          { agent: 'Risk Sentinel', message: 'Downside protection active. SL at $64.2k recommended.' },
          { agent: 'Apex Aggressor', message: 'Momentum confirmed. RSI divergence suggests 2% upside.' },
          { agent: 'Market Neutral', message: 'Delta exposure is within nominal limits. No immediate hedge required.' }
        ],
        payload: {
          type: 'OPTIMIZE',
          label: 'Scale-In: Momentum Entry',
          params: { symbol, amount: 1.5, entry: 'Market', sl: '64200' }
        }
      };

      setConsensusScore(mockResponse.consensus.score);
      
      for (const item of mockResponse.debate) {
        setActiveAgent(item.agent === 'Risk Sentinel' ? 'risk' : item.agent === 'Apex Aggressor' ? 'momentum' : 'neutral');
        setMessages(prev => [...prev, { 
          id: Math.random().toString(), 
          agent: item.agent as any, 
          text: item.message, 
          timestamp: Date.now() 
        }]);
        await new Promise(r => setTimeout(r, 1500));
      }

      setPayload(mockResponse.payload);
      setIsAnalyzing(false);
    } catch (error) {
      console.error(error);
      setIsAnalyzing(false);
    }
  };

  // Matrix Waterfall Data Stream
  useEffect(() => {
    const dataSources = [
      '[L2] Binance Ask Wall $66,000',
      '[Whale] 500 BTC Transferred out of Coinbase',
      '[OnChain] Gas fees spiking +25%',
      '[Liquidity] Sweep detected on Bybit',
      '[OrderBook] Bids stacking at $64.2k',
      `[Sys] Parsing ${symbol} delta decay...`,
      '[Options] Open Interest rising'
    ];

    const streamInterval = setInterval(() => {
      const newItem = dataSources[Math.floor(Math.random() * dataSources.length)];
      setDataStream(prev => {
        const next = [...prev, `${new Date().toISOString().split('T')[1].slice(0,-1)} // ${newItem}`];
        return next.length > 30 ? next.slice(next.length - 30) : next;
      });
    }, 400);

    return () => clearInterval(streamInterval);
  }, [symbol]);

  useEffect(() => {
    if (chatEndRef.current && chatEndRef.current.parentElement) {
      chatEndRef.current.parentElement.scrollTop = chatEndRef.current.parentElement.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (streamEndRef.current && streamEndRef.current.parentElement) {
      streamEndRef.current.parentElement.scrollTop = streamEndRef.current.parentElement.scrollHeight;
    }
  }, [dataStream]);

  const handleCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    
    setMessages(prev => [...prev, { 
      id: Date.now().toString(), 
      agent: 'System', 
      text: `> User: ${inputText}`, 
      timestamp: Date.now() 
    }]);
    
    setInputText('');
    setTimeout(() => {
      setMessages(prev => [...prev, { 
        id: Date.now().toString() + 'r', 
        agent: 'Market Neutral', 
        text: `Analysis complete for: "${inputText}". Adjusted bias matrices accordingly.`, 
        timestamp: Date.now() 
      }]);
    }, 1000);
  };

  const handleVoiceToggle = () => {
    setIsVoiceActive(!isVoiceActive);
    if (!isVoiceActive) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        agent: 'System', 
        text: `[SYS] Voice Command Protocol Activated. Listening...`, 
        timestamp: Date.now() 
      }]);
    } else {
       setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        agent: 'System', 
        text: `[SYS] Voice Command Protocol Deactivated.`, 
        timestamp: Date.now() 
      }]);
    }
  };

  const updateWeight = (agent: 'risk'|'momentum'|'neutral', value: number) => {
     setWeights(prev => ({ ...prev, [agent]: value }));
  };

  return (
    <div className="glass-panel backdrop-blur-2xl p-4 rounded-xl border border-white/[0.05] flex flex-col h-full relative overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.8)] animate-hologram">
      
      {/* Background Decor & Scan Line */}
      <div className="animate-neural-scan" />
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#bc13fe]/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[var(--holo-cyan)]/5 rounded-full blur-[80px] pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0 border-b border-white/[0.05] pb-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-lg border border-[#bc13fe]/40 bg-black flex items-center justify-center inner-glow z-10 relative">
              <Bot className="text-[#bc13fe] w-5 h-5" />
            </div>
            <div className="absolute inset-[-4px] border-2 border-[#bc13fe]/20 rounded-full animate-[spin_8s_linear_infinite] border-t-[#bc13fe]" />
          </div>
          <div>
            <h2 className="text-[16px] font-black text-white tracking-[0.2em] uppercase flex items-center gap-2">
              Neural Agent
              <span className={`px-2 py-0.5 rounded-full border text-[9px] tracking-widest flex items-center gap-1.5 ${isAnalyzing ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-[var(--holo-cyan)]/10 border-[var(--holo-cyan)]/30 text-[var(--holo-cyan)]'}`}>
                <Activity className={`w-3 h-3 ${isAnalyzing ? 'animate-pulse' : ''}`} />
                {isAnalyzing ? 'REASONING...' : 'SYNCED'}
              </span>
            </h2>
            <p className="text-[10px] text-gray-500 font-mono tracking-widest mt-0.5">MODEL: HIVE_MIND_v5.0 // UPTIME: 99.9%</p>
          </div>
        </div>

        {/* Global Consensus Score */}
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold text-gray-500 tracking-[0.2em] uppercase mb-1">Final Consensus</span>
          <div className="flex items-center gap-3">
             <div className="text-right">
                <div className={`text-2xl font-black font-mono leading-none ${consensusScore > 75 ? 'text-[var(--holo-cyan)]' : 'text-yellow-500'}`}>
                  {consensusScore}%
                </div>
                <div className="text-[8px] text-gray-600 font-mono tracking-tighter">BULLISH CONFIDENCE</div>
             </div>
             <div className="w-[60px] h-1.5 bg-black rounded-full overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-[var(--holo-cyan)] to-[#bc13fe] transition-all duration-1000" style={{ width: `${consensusScore}%` }} />
             </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-5 flex-1 min-h-0 relative z-10">
        
        {/* Left: Agent Network Visualizer & Bias Tuning */}
        <div className="w-full md:w-[280px] flex flex-col gap-4 shrink-0 overflow-y-auto custom-scrollbar pr-1">
          <div className="h-[200px] shrink-0 bg-black/40 border border-white/[0.05] rounded-xl overflow-hidden relative group">
             <div className="absolute inset-0 bg-gradient-to-b from-[#bc13fe]/5 to-transparent pointer-events-none" />
             <AgentVisualizer activeAgent={activeAgent} intensity={isAnalyzing ? 90 : 40} weights={weights} />
             
             {/* Dynamic Status Badges */}
             <div className="absolute top-3 left-3 flex flex-col gap-2">
                <StatusBadge icon={ShieldCheck} label="Risk" status={activeAgent === 'risk' ? 'active' : 'idle'} color="#FF007F" />
                <StatusBadge icon={Target} label="Apex" status={activeAgent === 'momentum' ? 'active' : 'idle'} color="#00E5FF" />
                <StatusBadge icon={TrendingUp} label="Neutral" status={activeAgent === 'neutral' ? 'active' : 'idle'} color="#bc13fe" />
             </div>
          </div>
          
          {/* Agent Bias Tuning Panel */}
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-3 shrink-0">
             <div className="flex items-center gap-2 mb-3">
                <Sliders className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[9px] font-black text-gray-400 tracking-[0.2em] uppercase">Synapse Tuning</span>
             </div>
             <div className="space-y-3">
                <WeightSlider label="Risk Bias" value={weights.risk} onChange={(v) => updateWeight('risk', v)} color="var(--holo-magenta)" />
                <WeightSlider label="Momentum Bias" value={weights.momentum} onChange={(v) => updateWeight('momentum', v)} color="var(--holo-cyan)" />
                <WeightSlider label="Neutral Bias" value={weights.neutral} onChange={(v) => updateWeight('neutral', v)} color="#bc13fe" />
             </div>
          </div>
        </div>

        {/* Center: Consensus Terminal */}
        <div className="flex-1 flex flex-col min-w-0 bg-black/20 border border-white/[0.05] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-white/[0.05] bg-white/[0.02]">
             <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-[var(--holo-cyan)]" />
                <span className="text-[10px] font-black text-white/60 tracking-widest uppercase">Multi-Agent Consensus Thread</span>
             </div>
             <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500/40 animate-pulse" />
                <div className="w-2 h-2 rounded-full bg-blue-500/40 animate-pulse" style={{ animationDelay: '0.2s' }} />
             </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4 font-mono text-[11px] leading-relaxed">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 animate-in fade-in slide-in-from-left-2 duration-500 ${msg.agent==='System'?'opacity-60':''}`}>
                <span className={`shrink-0 font-black uppercase text-[9px] w-24 tracking-tighter
                  ${msg.agent === 'Risk Sentinel' ? 'text-[var(--holo-magenta)]' : 
                    msg.agent === 'Apex Aggressor' ? 'text-[var(--holo-cyan)]' : 
                    msg.agent === 'Market Neutral' ? 'text-[#bc13fe]' : 'text-gray-500'}
                `}>
                  [{msg.agent}]
                </span>
                <span className="text-gray-300 overflow-wrap-anywhere">{msg.text}</span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Interactive NLP Terminal Input */}
          <form onSubmit={handleCommand} className="p-3 border-t border-white/[0.05] bg-black/40 flex items-center gap-2">
            <div className="relative flex-1 flex items-center">
              <ChevronRight className={`absolute left-2 w-4 h-4 ${isVoiceActive ? 'text-red-500 animate-pulse' : 'text-[var(--holo-cyan)]'}`} />
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={isVoiceActive ? "LISTENING..." : "QUERY HIVE MIND..."}
                className="w-full bg-transparent border-none text-[12px] font-mono text-[var(--holo-cyan)] pl-8 focus:ring-0 placeholder-white/10 uppercase tracking-widest"
              />
            </div>
            {/* Voice Toggle */}
            <button 
              type="button" 
              onClick={handleVoiceToggle}
              className={`p-2 rounded-md transition-all ${isVoiceActive ? 'bg-red-500/20 text-red-500 border border-red-500/40' : 'bg-white/5 text-gray-500 border border-white/5 hover:text-white'}`}
            >
              {isVoiceActive ? <Mic className="w-4 h-4 animate-pulse" /> : <MicOff className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {/* Right: Actions, Metrics & Data Stream */}
        <div className="w-full md:w-[300px] flex flex-col gap-4 shrink-0">
          
          <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-4 shrink-0">
             <h3 className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase mb-4 flex items-center gap-2">
                <Zap className="w-3 h-3 text-yellow-500" /> Actionable Strategies
             </h3>
             
             {payload ? (
               <ExecutionPayload payload={payload} />
             ) : (
               <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 border-2 border-dashed border-white/5 rounded-lg p-6">
                  <Activity className="w-8 h-8 mb-3 animate-pulse" />
                  <p className="text-[10px] font-mono uppercase tracking-widest">Synthesizing<br/>Optimal Execution...</p>
               </div>
             )}
          </div>

          {/* The Matrix Waterfall Stream */}
          <div className="bg-black/60 border border-white/[0.05] rounded-xl flex-1 min-h-[150px] flex flex-col overflow-hidden relative">
             <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/80 pointer-events-none z-10" />
             <div className="p-2 border-b border-white/[0.05] bg-white/[0.02] flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2">
                  <Database className="w-3 h-3 text-gray-500" />
                  <span className="text-[8px] font-black text-gray-500 tracking-widest uppercase">Data Flow</span>
               </div>
               <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
             </div>
             <div className="flex-1 overflow-y-auto custom-scrollbar p-2 font-mono text-[8px] leading-tight flex flex-col gap-1 pb-6">
                {dataStream.map((log, i) => (
                  <div key={i} className="text-gray-500 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <span className="text-gray-600 mr-1">{'>'}</span> 
                    {log}
                  </div>
                ))}
                <div ref={streamEndRef} />
             </div>
          </div>

        </div>

      </div>
    </div>
  );
};

// Subcomponents

function StatusBadge({ icon: Icon, label, status, color }: any) {
  return (
    <div className={`flex items-center gap-2 px-2 py-1 rounded border transition-all duration-500 ${status === 'active' ? 'bg-white/10 border-white/20' : 'bg-black/40 border-transparent opacity-40'}`}>
      <Icon className="w-3 h-3" style={{ color: status === 'active' ? color : 'gray' }} />
      <span className="text-[8px] font-black tracking-widest uppercase text-white">{label}</span>
      {status === 'active' && <div className="w-1 h-1 rounded-full animate-ping" style={{ backgroundColor: color }} />}
    </div>
  );
}

function MetricBox({ label, value, icon: Icon }: any) {
  return (
    <div className="bg-black/40 border border-white/[0.05] rounded-lg p-2.5">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3 h-3 text-gray-500" />
        <span className="text-[8px] font-bold text-gray-500 tracking-widest uppercase">{label}</span>
      </div>
      <div className="text-[11px] font-mono text-white font-bold">{value}</div>
    </div>
  );
}

function WeightSlider({ label, value, onChange, color }: { label: string, value: number, onChange: (v: number) => void, color: string }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
         <span className="text-[8px] tracking-widest text-gray-400 uppercase font-black" style={{ color }}>{label}</span>
         <span className="text-[8px] font-mono text-gray-500">{value}%</span>
      </div>
      <input 
        type="range" 
        min="0" max="100" 
        value={value} 
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1 bg-black rounded-lg appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${value}%, #111 ${value}%)`
        }}
      />
    </div>
  );
}
