export interface MarketNode {
  time: number | string;
  price: number;
  type: 'HH' | 'HL' | 'LH' | 'LL';
  isBreakOfStructure: boolean;
  isRoleReversal: boolean;
  index: number;
}

export function analyzeMarketStructure(data: any[], lb: number = 5): MarketNode[] {
  if (!data || data.length < lb * 2 + 1) return [];

  const nodes: MarketNode[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' = 'BULLISH';
  
  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  
  // Resistance = Peak, Support = Valley
  let lastResistance: number | null = null;
  let lastSupport: number | null = null;

  // Track if a BOS occurred on the current leg so we can tag the next valid pivot
  let pendingBullishBOS = false;
  let pendingBearishBOS = false;
  
  for (let i = lb; i < data.length - lb; i++) {
    const currentClose = data[i].close;

    // --- Break of Structure (BOS) Live Check ---
    // A single candle closing significantly past the last structural point flips the trend.
    if (currentTrend === 'BULLISH' && lastLow !== null && currentClose < lastLow) {
      currentTrend = 'BEARISH';
      pendingBearishBOS = true;
    } 
    else if (currentTrend === 'BEARISH' && lastHigh !== null && currentClose > lastHigh) {
      currentTrend = 'BULLISH';
      pendingBullishBOS = true;
    }

    // --- Pivot High Detection ---
    let isPH = true;
    for (let j = 1; j <= lb; j++) {
      if (data[i - j].high > data[i].high || data[i + j].high > data[i].high) {
        isPH = false;
        break;
      }
    }

    if (isPH) {
      const price = data[i].high;
      
      let type: 'HH' | 'LH' = 'HH';
      if (lastHigh === null) {
        type = currentTrend === 'BULLISH' ? 'HH' : 'LH';
      } else {
        type = price > lastHigh ? 'HH' : 'LH';
      }

      // Role Reversal: Does this LH bounce exactly on the last Support (old LL)?
      let isRoleReversal = false;
      if (type === 'LH' && lastSupport !== null) {
         const diff = Math.abs(price - lastSupport) / lastSupport;
         if (diff < 0.002) isRoleReversal = true; // 0.2% tolerance zone
      }

      nodes.push({
        time: data[i].time,
        price,
        type,
        isBreakOfStructure: pendingBullishBOS,
        isRoleReversal,
        index: i
      });
      
      // Reset BOS flag because we applied it to this peak
      if (pendingBullishBOS) pendingBullishBOS = false;
      
      lastResistance = price;
      lastHigh = price;
    }

    // --- Pivot Low Detection ---
    let isPL = true;
    for (let j = 1; j <= lb; j++) {
      if (data[i - j].low < data[i].low || data[i + j].low < data[i].low) {
        isPL = false;
        break;
      }
    }

    if (isPL) {
      const price = data[i].low;
      
      let type: 'LL' | 'HL' = 'LL';
      if (lastLow === null) {
        type = currentTrend === 'BEARISH' ? 'LL' : 'HL';
      } else {
        type = price < lastLow ? 'LL' : 'HL';
      }

      // Role Reversal: Does this HL bounce exactly on the last Resistance (old HH)?
      let isRoleReversal = false;
      if (type === 'HL' && lastResistance !== null) {
         const diff = Math.abs(price - lastResistance) / lastResistance;
         if (diff < 0.002) isRoleReversal = true;
      }

      nodes.push({
        time: data[i].time,
        price,
        type,
        isBreakOfStructure: pendingBearishBOS,
        isRoleReversal,
        index: i
      });
      
      if (pendingBearishBOS) pendingBearishBOS = false;

      lastSupport = price;
      lastLow = price;
    }
  }

  nodes.sort((a, b) => a.index - b.index);
  return nodes;
}
