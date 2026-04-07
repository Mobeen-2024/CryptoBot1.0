import React, { useState } from 'react';
import axios from 'axios';
import { Play, Square, Activity, AlertTriangle, Zap, Wind } from 'lucide-react';

interface StressTestSuiteProps {
  symbol: string;
  onScenarioChange?: (scenario: string | null) => void;
}

const StressTestSuite: React.FC<StressTestSuiteProps> = ({ symbol, onScenarioChange }) => {
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const scenarios = [
    { id: 'V_REVERSAL', name: 'V-Reversal', icon: <Activity className="w-4 h-4" />, desc: 'Rapid drop and recovery' },
    { id: 'LIQUIDITY_SWEEP', name: 'Liquidity Sweep', icon: <Zap className="w-4 h-4" />, desc: 'High-frequency noise' },
    { id: 'SENTIMENT_SHOCK', name: 'Sentiment Shock', icon: <AlertTriangle className="w-4 h-4" />, desc: 'AI Bullish vs Market Crash' },
    { id: 'WHIPSAW', name: 'Whipsaw Stress', icon: <Wind className="w-4 h-4" />, desc: 'Fast +/- ATR oscillation' },
    { id: 'LIQUIDITY_HUNT', name: 'Liquidity Hunt', icon: <Zap className="w-4 h-4 text-red-500" />, desc: 'Aggressive Wick Spikes' },
    { id: 'AI_DISAGREEMENT', name: 'AI Conflict', icon: <AlertTriangle className="w-4 h-4 text-orange-500" />, desc: 'Research vs Execution' }
  ];

  const handleLatencyChange = async (ms: string) => {
    try {
      await axios.post('http://localhost:3000/api/simulation/latency', { ms, jitter: 0.2 });
    } catch (err) {
      console.error('Failed to set latency:', err);
    }
  };

  const runScenario = async (id: string) => {
    setLoading(true);
    try {
      await axios.post('http://localhost:3000/api/simulation/run', { scenario: id, symbol });
      setActiveScenario(id);
      if (onScenarioChange) onScenarioChange(id);
    } catch (err) {
      console.error('Failed to run scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  const stopScenario = async () => {
    setLoading(true);
    try {
      await axios.post('http://localhost:3000/api/simulation/stop');
      setActiveScenario(null);
      if (onScenarioChange) onScenarioChange(null);
    } catch (err) {
      console.error('Failed to stop scenario:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 backdrop-blur-md">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
          <Activity className="text-amber-400 w-4 h-4" />
          Institutional Stress Suite
        </h3>
        {activeScenario && (
          <button 
            onClick={stopScenario}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg text-xs hover:bg-red-500/30 transition-all font-bold"
          >
            <Square className="w-3 h-3 fill-current" />
            HALT SIM
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {scenarios.map((s) => (
          <button
            key={s.id}
            onClick={() => runScenario(s.id)}
            disabled={loading || activeScenario !== null}
            className={`flex flex-col items-start p-3 rounded-lg border transition-all text-left group ${
              activeScenario === s.id 
                ? 'bg-amber-500/20 border-amber-500/50' 
                : 'bg-slate-800/50 border-slate-700 hover:border-slate-500 disabled:opacity-50'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className={activeScenario === s.id ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}>
                {s.icon}
              </span>
              <span className="text-xs font-bold text-slate-200">{s.name}</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-tight">{s.desc}</p>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between mb-2">
          <label className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Synthetic Latency (ms)</label>
          <span className="text-[10px] font-mono text-amber-500 font-bold">100ms - 1000ms</span>
        </div>
        <input 
          type="range" 
          min="0" max="1000" step="50"
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
          onChange={(e) => handleLatencyChange(e.target.value)}
        />
      </div>

      {activeScenario && (
        <div className="mt-4 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg animate-pulse">
           <p className="text-[10px] text-amber-400 text-center font-bold tracking-widest uppercase">
             Synthetic Injection Active: {activeScenario}
           </p>
        </div>
      )}
    </div>
  );
};

export default StressTestSuite;
