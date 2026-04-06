import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { TacticalStrike } from '../utils/tacticalConfluence';

interface BotPilotState {
  status: 'IDLE' | 'HUNTING' | 'EXECUTING' | 'POSITION_OPEN';
  lastExecutionId: string | null;
  lastExecutionTime: number;
}

export const useBotPilot = (
  symbol: string, 
  isArmed: boolean, 
  analysis: TacticalStrike | null,
  addLog: (agent: string, text: string) => void
) => {
  const [pilotState, setPilotState] = useState<BotPilotState>({
    status: 'IDLE',
    lastExecutionId: null,
    lastExecutionTime: 0
  });

  const pilotRef = useRef(pilotState);

  // Sync ref with state
  useEffect(() => {
    pilotRef.current = pilotState;
  }, [pilotState]);

  // Refactor: extract only stable primitives for execution dependencies
  const executeTrade = useCallback(async (side: 'buy' | 'sell', qty: number, reason: string) => {
    try {
      setPilotState(prev => {
        if (prev.status === 'EXECUTING') return prev;
        return { ...prev, status: 'EXECUTING' };
      });
      
      addLog('System', `🤖 [AI_PILOT] MISSION INITIATED: ${side.toUpperCase()} ${qty} ${symbol}`);
      
      const response = await axios.post('/api/bot/ai-execute', {
        symbol,
        side,
        qty,
        reason
      });

      if (response.data.success) {
        const result = response.data.result;
        setPilotState(prev => ({
          ...prev,
          status: 'POSITION_OPEN',
          lastExecutionId: result.id,
          lastExecutionTime: Date.now()
        }));
        
        addLog('System', `🤖 [AI_PILOT] EXECUTION SUCCESS: ${result.id} (${result.simulated ? 'SIMULATED' : 'LIVE'})`);
      } else {
        throw new Error(response.data.error || 'Execution failed without error message');
      }
    } catch (err: any) {
      setPilotState(prev => {
        if (prev.status === 'IDLE') return prev;
        return { ...prev, status: 'IDLE' };
      });
      addLog('System', `🛑 [AI_PILOT] EXECUTION FAILED: ${err.response?.data?.error || err.message}`);
    }
  }, [symbol, addLog]);

  useEffect(() => {
    // 1. Guard Mission Scopes
    if (!isArmed || !analysis) {
      if (pilotRef.current.status === 'HUNTING') {
         setPilotState(prev => ({ ...prev, status: 'IDLE' }));
      }
      return;
    }

    // 2. Mission Persistence (HUNTING status guard)
    if (pilotRef.current.status === 'IDLE') {
       setPilotState(prev => ({ ...prev, status: 'HUNTING' }));
       return;
    }

    // 3. Mission Decision (Threshold Logic)
    const now = Date.now();
    const canTrade = now - pilotRef.current.lastExecutionTime > 300000; // 5 Minute Cooldown

    if (pilotRef.current.status === 'HUNTING' && 
        analysis.probability >= 88 && 
        analysis.signal !== 'NEUTRAL' && 
        canTrade) {
      
      const side = analysis.signal === 'STRONG_BUY' ? 'buy' : 'sell';
      const qty = 0.05; // Default AI Cluster quantity
      const reason = analysis.reasoning.join(' // ');
      
      executeTrade(side, qty, reason);
    }
  }, [isArmed, analysis, executeTrade]); // Removed pilotState dependency to prevent logic-driven loops

  return { pilotState };
};
