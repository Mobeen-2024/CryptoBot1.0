import React, { useState } from 'react';
import { Play, CheckCircle2, AlertCircle, Terminal } from 'lucide-react';

interface ExecutionPayloadProps {
  payload: {
    type: string;
    label: string;
    params: Record<string, any>;
  };
  onDeploy?: (payload: any) => void;
}

export const ExecutionPayload: React.FC<ExecutionPayloadProps> = ({ payload, onDeploy }) => {
  const [status, setStatus] = useState<'idle' | 'executing' | 'success' | 'error'>('idle');

  const handleDeploy = () => {
    setStatus('executing');
    // Simulate deployment process
    setTimeout(() => {
      setStatus('success');
      if (onDeploy) onDeploy(payload);
    }, 2000);
  };

  const getStyle = () => {
    switch (status) {
      case 'success': return 'border-[var(--holo-cyan)]/50 bg-[var(--holo-cyan)]/10';
      case 'error': return 'border-red-500/50 bg-red-500/10';
      default: return 'border-white/[0.1] bg-white/[0.03]';
    }
  };

  return (
    <div className={`p-3 rounded-lg border transition-all duration-300 ${getStyle()}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="text-[10px] font-black text-white/40 tracking-[0.2em] uppercase block mb-1">
            Action_Payload // {payload.type}
          </span>
          <h4 className="text-[12px] font-bold text-white tracking-wide">{payload.label}</h4>
        </div>
        <Terminal className="w-3 h-3 text-white/20" />
      </div>

      {/* Params Code-Block Style */}
      <div className="bg-black/40 rounded p-2 mb-3 border border-white/5 font-mono text-[9px] leading-relaxed">
        {Object.entries(payload.params).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-gray-500">{key}:</span>
            <span className="text-[var(--holo-cyan)]">{typeof value === 'object' ? JSON.stringify(value) : value.toString()}</span>
          </div>
        ))}
      </div>

      {/* Action Button */}
      <button 
        onClick={handleDeploy}
        disabled={status !== 'idle'}
        className={`w-full py-2 rounded font-black text-[10px] tracking-widest uppercase flex items-center justify-center gap-2 transition-all 
          ${status === 'idle' ? 'bg-[var(--holo-cyan)]/20 border border-[var(--holo-cyan)]/40 text-[var(--holo-cyan)] hover:bg-[var(--holo-cyan)]/30' : 
            status === 'executing' ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 cursor-wait' : 
            status === 'success' ? 'bg-green-500/10 border border-green-500/30 text-green-500' :
            'bg-red-500/10 border border-red-500/30 text-red-500'}
        `}
      >
        {status === 'idle' && <><Play className="w-3 h-3" /> Execute Strategy</>}
        {status === 'executing' && <div className="w-3 h-3 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />}
        {status === 'success' && <><CheckCircle2 className="w-3 h-3" /> Transmitted</>}
        {status === 'error' && <><AlertCircle className="w-3 h-3" /> Failed</>}
      </button>

      {/* Decorative scan line */}
      {status === 'executing' && (
        <div className="h-px bg-[var(--holo-cyan)] w-full absolute left-0 overflow-hidden animate-pulse opacity-50" />
      )}
    </div>
  );
};
