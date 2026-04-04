import React, { useState } from 'react';
import axios from 'axios';
import { Bot, Key, Shield, AlertCircle, CheckCircle } from 'lucide-react';

interface BotPilotSetupProps {
  onArmed: () => void;
  onClose: () => void;
}

const BotPilotSetup: React.FC<BotPilotSetupProps> = ({ onArmed, onClose }) => {
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleArm = async () => {
    if (!apiKey.startsWith('AIza')) {
      setError('Invalid Gemini API Key format (must start with AIza)');
      setStatus('error');
      return;
    }

    setStatus('loading');
    try {
      await axios.post('http://localhost:3000/api/config/gemini-key', { key: apiKey });
      setStatus('success');
      setTimeout(() => {
        onArmed();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to arm reasoning kernel.');
      setStatus('error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-indigo-500/30 rounded-2xl p-6 w-full max-w-md shadow-2xl shadow-indigo-500/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-indigo-500/20 rounded-xl">
            <Bot className="text-indigo-400 w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Arm Reasoning Kernel</h2>
            <p className="text-sm text-slate-400 leading-tight">Activate Gemini-powered Bot Pilot</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="relative">
             <Key className="absolute left-3 top-3.5 text-slate-500 w-4 h-4" />
             <input 
               type="password"
               value={apiKey}
               onChange={(e) => setApiKey(e.target.value)}
               placeholder="Gemini API Key (AIza...)"
               className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white focus:border-indigo-500 outline-none transition-all placeholder:text-slate-600"
             />
          </div>

          <div className="flex gap-2 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
             <Shield className="text-emerald-400 w-4 h-4 shrink-0 mt-0.5" />
             <p className="text-[11px] text-slate-400 leading-snug">
               Your API key is injected directly into memory and is not persisted in `.env` or any cleartext storage for security.
             </p>
          </div>

          {status === 'error' && (
            <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-3 rounded-xl border border-red-400/20 text-xs">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 p-3 rounded-xl border border-emerald-400/20 text-xs font-bold">
              <CheckCircle className="w-4 h-4" />
              Kernel Armed Successfully!
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button 
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 font-bold transition-all"
            >
              Cancel
            </button>
            <button 
              onClick={handleArm}
              disabled={status === 'loading' || !apiKey}
              className="flex-3 px-6 py-3 bg-indigo-500 text-white rounded-xl hover:bg-indigo-400 disabled:opacity-50 font-bold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
            >
              {status === 'loading' ? 'Arming...' : 'Arm Kernel'}
              <Bot className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BotPilotSetup;
