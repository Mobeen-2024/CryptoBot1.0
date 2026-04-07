import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';
import EventEmitter from 'events';

export type SimulationScenario = 'V_REVERSAL' | 'LIQUIDITY_SWEEP' | 'CONNECTION_FAILURE' | 'SENTIMENT_SHOCK' | 'WHIPSAW' | 'STABLE_TREND' | 'LIQUIDITY_HUNT' | 'AI_DISAGREEMENT';

export class SimulationService extends EventEmitter {
  private static instance: SimulationService;
  private intelligenceService: IntelligenceService;
  private activeScenario: SimulationScenario | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;
  private basePrice: number = 65000;
  private latency: number = 0;
  private jitter: number = 0.2; // 20% randomized jitter

  private constructor() {
    super();
    this.intelligenceService = IntelligenceService.getInstance();
  }

  public static getInstance(): SimulationService {
    if (!SimulationService.instance) {
      SimulationService.instance = new SimulationService();
    }
    return SimulationService.instance;
  }

  public setLatency(ms: number, jitter: number = 0.2) {
    this.latency = ms;
    this.jitter = jitter;
    Logger.info(`[SIMULATION] Latency set to ${ms}ms (Jitter: ${jitter * 100}%)`);
  }

  public getLatency(): number {
    if (this.latency === 0) return 0;
    const variancy = this.latency * this.jitter;
    return this.latency + (Math.random() * variancy * 2 - variancy);
  }

  public async runScenario(scenario: SimulationScenario, symbol: string) {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    this.activeScenario = scenario;
    Logger.info(`[SIMULATION] Starting Scenario: ${scenario} for ${symbol}`);

    switch (scenario) {
      case 'V_REVERSAL':
        await this.simulateVReversal(symbol);
        break;
      case 'LIQUIDITY_SWEEP':
        await this.simulateLiquiditySweep(symbol);
        break;
      case 'CONNECTION_FAILURE':
        await this.simulateConnectionFailure(symbol);
        break;
      case 'SENTIMENT_SHOCK':
        await this.simulateSentimentShock(symbol);
        break;
      case 'WHIPSAW':
        await this.simulateWhipsaw(symbol);
        break;
      case 'LIQUIDITY_HUNT':
        await this.simulateLiquidityHunt(symbol);
        break;
      case 'AI_DISAGREEMENT':
        await this.simulateAIDisagreement(symbol);
        break;
      default:
        this.activeScenario = null;
    }
  }

  private async simulateVReversal(symbol: string) {
    let step = 0;
    const initialPrice = 65000;
    
    this.simulationInterval = setInterval(() => {
      step++;
      let currentPrice = initialPrice;
      
      if (step < 5) {
        // Price drops to trigger hedge (assuming Buy A)
        currentPrice -= step * 2; // -2, -4, -6, -8 (Trigger at -5)
      } else if (step < 10) {
        // Price lingers in danger zone
        currentPrice = initialPrice - 10;
      } else if (step < 15) {
        // V-Reversal back to break-even (EntryB + Friction)
        currentPrice = (initialPrice - 10) + (step - 9) * 3; // -7, -4, -1, +2, +5
      } else {
        clearInterval(this.simulationInterval!);
        Logger.info(`[SIMULATION] V_REVERSAL Scenario Completed.`);
      }

      this.emit('price_update', { symbol, price: currentPrice });
      this.intelligenceService.analyzeSymbol(symbol, currentPrice, 1);
    }, 1000);
  }

  private async simulateLiquiditySweep(symbol: string) {
    const initialPrice = 65000;
    let step = 0;

    this.simulationInterval = setInterval(() => {
      step++;
      // Inject high volatility
      const volatility = 50 + Math.sin(step) * 40; 
      const priceNoise = (Math.random() - 0.5) * volatility;
      const currentPrice = initialPrice - 5 + priceNoise; // Hovering around trigger

      // Update ATR synthetically
      const mockOhlcv = Array.from({ length: 20 }, (_, i) => [
        Date.now(), 
        currentPrice, 
        currentPrice + volatility/2, 
        currentPrice - volatility/2, 
        currentPrice
      ]);
      this.intelligenceService.updateATR(symbol, mockOhlcv);
      
      this.emit('price_update', { symbol, price: currentPrice });
      this.intelligenceService.analyzeSymbol(symbol, currentPrice, 10);
      
      if (step > 30) {
        clearInterval(this.simulationInterval!);
        Logger.info(`[SIMULATION] LIQUIDITY_SWEEP Scenario Completed.`);
      }
    }, 500);
  }

  private async simulateConnectionFailure(symbol: string) {
    Logger.warn(`[SIMULATION] CONNECTION FAILURE TRIGGERED. Simulating Heartbeat Stop...`);
    this.emit('connection_lost', { symbol });
    
    // In a real system, the bots would stop their intervals here.
    // We'll simulate the "Purge" after 5 seconds
    setTimeout(() => {
      Logger.info(`[SIMULATION] Dead Man's Switch Activated. Latent orders purged.`);
      this.emit('dms_purged', { symbol });
    }, 5000);
  }

  /**
   * Scenario E: Sentiment Shock
   * Verifies the "Always Protected" mission when AI sentiment is high-conviction
   * but market dynamics (ATR) suggest a sudden reversal or crash.
   */
  private async simulateSentimentShock(symbol: string) {
    const initialPrice = 65000;
    let step = 0;

    // 1. Initially set extreme Bullish sentiment
    this.intelligenceService.applyAgenticConsensus(symbol, JSON.stringify({
      sentiment: 0.9,
      confidence: 0.95,
      reasoningSnippet: "Extreme institutional inflows detected. Breaking resistance @ 66k likely.",
      isHighRisk: false
    }));

    this.simulationInterval = setInterval(() => {
      step++;
      let currentPrice = initialPrice;

      if (step < 5) {
        // Price is stable/rising slightly
        currentPrice += step * 0.5;
      } else if (step < 10) {
        // Sudden Flash Crash starts
        currentPrice = initialPrice - (step - 4) * 5; // -5, -10, -15...
      } else {
        clearInterval(this.simulationInterval!);
        Logger.info(`[SIMULATION] SENTIMENT_SHOCK Scenario Completed.`);
      }

      // Inject high ATR during crash to trigger mathematical override
      if (step >= 5) {
        const volatility = (step - 4) * 20;
        const mockOhlcv = Array.from({ length: 20 }, () => [
          Date.now(), currentPrice, currentPrice + volatility, currentPrice - volatility, currentPrice
        ]);
        this.intelligenceService.updateATR(symbol, mockOhlcv);
      }

      this.emit('price_update', { symbol, price: currentPrice });
      this.intelligenceService.analyzeSymbol(symbol, currentPrice, step >= 5 ? 20 : 1);
    }, 1000);
  }

  /**
   * Scenario G: Whipsaw Oscillation
   * Rapidly oscillates price around EntryB (+/- ATR) to test friction and re-entry.
   */
  private async simulateWhipsaw(symbol: string) {
    const initialPrice = 65000;
    const triggerPrice = 64995; // 5 USDT offset
    let step = 0;

    this.simulationInterval = setInterval(() => {
      step++;
      // Oscillate price around the trigger
      const noise = Math.sin(step * 1.5) * 4; // +/- 4 USDT
      const currentPrice = triggerPrice + noise;

      this.emit('price_update', { symbol, price: currentPrice });
      this.intelligenceService.analyzeSymbol(symbol, currentPrice, 2);

      if (step > 40) {
        clearInterval(this.simulationInterval!);
        Logger.info(`[SIMULATION] WHIPSAW Scenario Completed.`);
      }
    }, 400); // Fast 400ms interval for whipsaw stress
  }

  private async simulateLiquidityHunt(symbol: string) {
    const initialPrice = 65000;
    let step = 0;
    Logger.warn(`[SIMULATION] LIQUIDITY HUNT (Wick Spike) - Price Spike Incoming.`);

    this.simulationInterval = setInterval(() => {
      step++;
      let currentPrice = initialPrice;

      if (step === 3) {
        currentPrice -= 50; // Massively deep spike (-0.07% or more depending on logic)
      } else if (step === 4) {
        currentPrice -= 2; // Rapid partial recovery
      } else if (step > 4) {
        currentPrice = initialPrice; // Full reversal
      }

      this.emit('price_update', { symbol, price: currentPrice });
      this.intelligenceService.analyzeSymbol(symbol, currentPrice, 5);

      if (step > 10) {
        clearInterval(this.simulationInterval!);
        Logger.info(`[SIMULATION] LIQUIDITY_HUNT Scenario Completed.`);
      }
    }, 1000);
  }

  private async simulateAIDisagreement(symbol: string) {
    const initialPrice = 65000;
    let step = 0;
    Logger.warn(`[SIMULATION] AI DISAGREEMENT ACTIVATED - Tension between Research & Execution.`);

    this.simulationInterval = setInterval(() => {
      step++;
      const currentPrice = initialPrice - (step * 0.5); // Slow bleed to raise tension

      // Force conflict in intelligence
      this.intelligenceService.setSentiment(symbol, -1); // Execution says BEARISH
      this.intelligenceService.applyAgenticConsensus(symbol, JSON.stringify({
         sentiment: 0.8, // Research says BULLISH
         confidence: 0.9,
         reasoningSnippet: "Bullish divergence on Weekly but local pressure is down.",
         isHighRisk: true
      }));

      this.emit('price_update', { symbol, price: currentPrice });
      this.intelligenceService.analyzeSymbol(symbol, currentPrice, 2);

      if (step > 15) {
        clearInterval(this.simulationInterval!);
        Logger.info(`[SIMULATION] AI_DISAGREEMENT Scenario Completed.`);
      }
    }, 1000);
  }

  public stopScenario() {
    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
    this.activeScenario = null;
    Logger.info(`[SIMULATION] Simulation Stopped.`);
  }

  public getActiveScenario() { return this.activeScenario; }
}
