export interface MarketNode {
  time: number | string;
  price: number;
  type: 'HH' | 'HL' | 'LH' | 'LL';
  isBreakOfStructure: boolean;
  isRoleReversal: boolean;
  index: number;
}

export interface StructuralLevel {
  id: string;
  price: number;
  startTime: number | string;
  type: 'support' | 'resistance';
  isBroken: boolean;
  isFlipped: boolean; // Role Reversal indicator
}

export interface Trendline {
  id: string;
  start: { time: number | string; price: number };
  end: { time: number | string; price: number };
  type: 'bullish' | 'bearish';
  isProven: boolean; // 3+ touches
}

export interface MarketStructureAnalysis {
  nodes: MarketNode[];
  levels: StructuralLevel[];
  trendlines: Trendline[];
}

export function analyzeMarketStructure(data: any[], lb: number = 5): MarketStructureAnalysis {
  if (!data || data.length < lb * 2 + 1) return { nodes: [], levels: [], trendlines: [] };

  const nodes: MarketNode[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' = 'BULLISH';
  
  let lastHigh: number | null = null;
  let lastLow: number | null = null;
  
  // Track Resistance = Peak, Support = Valley
  let lastResistance: number | null = null;
  let lastSupport: number | null = null;

  const rawLevels: StructuralLevel[] = [];
  
  // Track if a BOS occurred on the current leg
  let pendingBullishBOS = false;
  let pendingBearishBOS = false;
  
  for (let i = lb; i < data.length - lb; i++) {
    const currentClose = data[i].close;

    // --- Break of Structure (BOS) Live Check ---
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
      let type: 'HH' | 'LH' = lastHigh === null ? (currentTrend === 'BULLISH' ? 'HH' : 'LH') : (price > lastHigh ? 'HH' : 'LH');

      // Role Reversal Logic
      let isRoleReversal = false;
      if (type === 'LH' && lastSupport !== null) {
         if (Math.abs(price - lastSupport) / lastSupport < 0.002) isRoleReversal = true;
      }

      nodes.push({
        time: data[i].time,
        price,
        type,
        isBreakOfStructure: pendingBullishBOS,
        isRoleReversal,
        index: i
      });

      // Register level
      rawLevels.push({
        id: `lvl_h_${data[i].time}`,
        price,
        startTime: data[i].time,
        type: 'resistance',
        isBroken: false,
        isFlipped: isRoleReversal
      });
      
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
      let type: 'LL' | 'HL' = lastLow === null ? (currentTrend === 'BEARISH' ? 'LL' : 'HL') : (price < lastLow ? 'LL' : 'HL');

      let isRoleReversal = false;
      if (type === 'HL' && lastResistance !== null) {
         if (Math.abs(price - lastResistance) / lastResistance < 0.002) isRoleReversal = true;
      }

      nodes.push({
        time: data[i].time,
        price,
        type,
        isBreakOfStructure: pendingBearishBOS,
        isRoleReversal,
        index: i
      });

      // Register level
      rawLevels.push({
        id: `lvl_l_${data[i].time}`,
        price,
        startTime: data[i].time,
        type: 'support',
        isBroken: false,
        isFlipped: isRoleReversal
      });
      
      if (pendingBearishBOS) pendingBearishBOS = false;
      lastLow = price;
      lastSupport = price;
    }

    // Dynamic Level Maintenance: Check for Breaches
    const lastPrice = data[i].close;
    rawLevels.forEach(lvl => {
      if (!lvl.isBroken) {
        if (lvl.type === 'resistance' && lastPrice > lvl.price) {
          lvl.isBroken = true;
          // When Resistance breaks, it becomes Support (Potential Role Reversal)
          lvl.type = 'support';
          lvl.isFlipped = true;
        } else if (lvl.type === 'support' && lastPrice < lvl.price) {
          lvl.isBroken = true;
          // When Support breaks, it becomes Resistance
          lvl.type = 'resistance';
          lvl.isFlipped = true;
        }
      }
    });
  }

  // Final Filtering: Only return the most significant levels
  const activeLevels = rawLevels.filter(l => !l.isBroken).slice(-10); // Last 10 unbroken
  const brokenLevels = rawLevels.filter(l => l.isBroken).slice(-5);   // Last 5 recently broken

  // Trendline Logic (Simple 3-touch bridge)
  const trendlines: Trendline[] = [];
  const hls = nodes.filter(n => n.type === 'HL');
  const lhs = nodes.filter(n => n.type === 'LH');

  const generateLine = (points: MarketNode[], type: 'bullish' | 'bearish') => {
    if (points.length < 2) return;
    for (let startIdx = 0; startIdx < points.length - 1; startIdx++) {
      const p1 = points[startIdx];
      const p2 = points[points.length - 1]; // Connect to the most recent HL/LH
      
      trendlines.push({
        id: `trnd_${type}_${p1.time}`,
        start: { time: p1.time, price: p1.price },
        end: { time: p2.time, price: p2.price },
        type,
        isProven: points.length >= 3
      });
    }
  };

  generateLine(hls.slice(-3), 'bullish');
  generateLine(lhs.slice(-3), 'bearish');

  nodes.sort((a, b) => a.index - b.index);

  return {
    nodes,
    levels: [...activeLevels, ...brokenLevels],
    trendlines: trendlines.slice(-4)
  };
}

