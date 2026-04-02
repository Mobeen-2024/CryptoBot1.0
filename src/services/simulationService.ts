import { IntelligenceService } from './intelligenceService.js';
import { Logger } from '../../logger.js';
import EventEmitter from 'events';

export type SimulationScenario = 'V_REVERSAL' | 'LIQUIDITY_SWEEP' | 'CONNECTION_FAILURE' | 'STABLE_TREND';

export class SimulationService extends EventEmitter {
  private static instance: SimulationService;
  private intelligenceService: IntelligenceService;
  private activeScenario: SimulationScenario | null = null;
  private simulationInterval: NodeJS.Timeout | null = null;
  private basePrice: number = 65000;

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

  public stopSimulation() {
    if (this.simulationInterval) clearInterval(this.simulationInterval);
    this.activeScenario = null;
    Logger.info(`[SIMULATION] Simulation Stopped.`);
  }

  public getActiveScenario() { return this.activeScenario; }
}
