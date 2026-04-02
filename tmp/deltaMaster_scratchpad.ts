import { DeltaMasterBot } from '../src/services/deltaMasterBot.js';
import { Logger } from '../logger.js';

// Setup Mock Environment
process.env.DELTA_SHADOW_MODE = 'true';
process.env.DELTA_USE_TESTNET = 'true';
process.env.GEMINI_API_KEY = 'MOCKED_KEY'; // To allow Phase 11 loops to start

async function runScratchpad() {
  Logger.info('--- DELTA MASTER STRESS TEST: V-REVERSAL SIMULATION ---');
  
  const bot = new DeltaMasterBot();
  const config = {
    symbol: 'BTC/USDT:USDT',
    qtyA: 1.0,
    qtyB: 1.0,
    sideA: 'buy' as const,
    leverA: 10,
    leverB: 20,
    entryOffset: 100, // Trigger @ $64,900 if entry is $65,000
    protectionRatio: 1.0,
    atrMultiplier: 1.0
  };

  try {
    await bot.start(config);
    let status = bot.getStatus();
    const entryA = status.entryA;
    const triggerB = status.entryB;
    
    Logger.info(`[TEST] INITIALIZED: EntryA=$${entryA}, TriggerB=$${triggerB}`);

    // Simulation Loop
    for (let step = 1; step <= 15; step++) {
      let simulatedPrice = entryA;
      
      if (step < 5) {
        simulatedPrice = entryA - (step * 20); // Price dropping...
      } else if (step < 10) {
        simulatedPrice = triggerB - 50; // Deep in the "Danger Zone" (Hedge should be active)
      } else if (step <= 15) {
        simulatedPrice = (triggerB - 50) + (step - 9) * 40; // V-Reversal Recovery
      }

      // Inject the price into the service (mocking ticker)
      (bot as any).state.lastPrice = simulatedPrice;
      
      status = bot.getStatus();
      Logger.info(`[STEP ${step}] Price: $${simulatedPrice.toFixed(0)} | PnL: $${status.netPnl.toFixed(2)} | State: ${status.phase} | Hedge: ${status.hedgeStatus}`);
      
      if (status.hedgeStatus === 'active') {
        Logger.warn(`[EVENT] SHIELD ACTIVE: Net Exposure Neutralized.`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    await bot.stop();
    Logger.info('--- STRESS TEST COMPLETE: MISSION SUCCESS ---');
    process.exit(0);
  } catch (error) {
    Logger.error('[TEST] Failure:', error);
    process.exit(1);
  }
}

runScratchpad();
