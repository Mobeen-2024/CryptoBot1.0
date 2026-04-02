import axios from 'axios';

async function runTest() {
  const BASE_URL = 'http://localhost:3000/api';
  const symbol = 'BTCUSDT';

  try {
    console.log('--- Phase 10: State-Based Recovery Validation ---');
    
    // 1. Start Delta Master
    console.log('[1/4] Deploying Delta Master Agent...');
    await axios.post(`${BASE_URL}/delta-master/start`, {
      symbol,
      qtyA: 0.1,
      qtyB: 0.1,
      sideA: 'buy',
      leverA: 10,
      leverB: 20,
      entryOffset: 5,
      atrMultiplier: 1.0
    });
    console.log('Bot Active.');

    // 2. Wait for stabilization
    await new Promise(r => setTimeout(r, 2000));

    // 3. Trigger V_REVERSAL Simulation (ATR Friction Test)
    console.log('[2/4] Injecting V_REVERSAL Scenario...');
    await axios.post(`${BASE_URL}/simulation/run`, {
      scenario: 'V_REVERSAL',
      symbol
    });

    // 4. Monitor logs (Implicitly, the server will log)
    console.log('[3/4] Simulation running... Waiting for state sync...');
    await new Promise(r => setTimeout(r, 10000));

    // 5. Check Status
    console.log('[4/4] Fetching final state result...');
    const res = await axios.get(`${BASE_URL}/delta-master/status`);
    console.log('FINAL STATE:', JSON.stringify(res.data, null, 2));
    
    if (Math.abs(res.data.netExposureDelta) < 0.01) {
      console.log('SUCCESS: Portfolio Neutralization Verified.');
    } else {
      console.warn('WARNING: Exposure Delta detected. Checking logs...');
    }

  } catch (err: any) {
    console.error('Test Execution Error:', err.response?.data || err.message);
  }
}

runTest();
