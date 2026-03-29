export interface MarketNode {
  time: number | string;
  price: number;
  type: 'HH' | 'HL' | 'LH' | 'LL';
  isBreakOfStructure: boolean;
  isRoleReversal: boolean;
  isExternal: boolean; 
  index: number;
}

export interface StructuralLevel {
  id: string;
  priceWick: number;
  priceBody: number;
  pricePOC: number; // Point of Control (where max volume occurred)
  startTime: number | string;
  type: 'support' | 'resistance';
  isBroken: boolean;
  brokenAtIdx?: number;
  intent: 'Stop Run / Sweep' | 'Aggressive Accumulation' | 'Standard Rejection';
  strengthScore: number; // 0-100
}

export interface Trendline {
  id: string;
  start: { time: number | string; price: number };
  end: { time: number | string; price: number };
  type: 'bullish' | 'bearish';
  isProven: boolean; 
}

export interface LiquidityGrab {
  time: number | string;
  price: number;
  type: 'sweep_high' | 'sweep_low';
  description: string;
}

export interface MarketStructureAnalysis {
  nodes: MarketNode[];
  levels: StructuralLevel[];
  trendlines: Trendline[];
  grabs: LiquidityGrab[];
}

function getSessionWeight(time: number | string): number {
  const date = new Date(typeof time === 'string' ? time : (time * 1000));
  const hour = date.getUTCHours();
  
  // London: 08:00 - 16:00 UTC
  // NY: 13:00 - 21:00 UTC
  // Overlap: 13:00 - 16:00 UTC
  if (hour >= 13 && hour <= 16) return 2.0; // Mega Weight
  if (hour >= 8 && hour < 13) return 1.5;   // London Heavy
  if (hour > 16 && hour <= 21) return 1.5;  // NY Heavy
  return 0.8; // Asian / Quiet hours
}

export function analyzeMarketStructure(data: any[], lb: number = 5): MarketStructureAnalysis {
  if (!data || data.length < lb * 2 + 1) return { nodes: [], levels: [], trendlines: [], grabs: [] };

  const nodes: MarketNode[] = [];
  const grabs: LiquidityGrab[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' = 'BULLISH';
  
  let lastHigh: number | null = null;
  let lastLow: number | null = null;

  const rawLevels: StructuralLevel[] = [];
  let pendingBullishBOS = false;
  let pendingBearishBOS = false;

  // Track the rolling mean volume for relative strength calculation
  const volBuffer = data.slice(-20).map(d => d.volume);
  const avgVol = (volBuffer.reduce((a, b) => a + b, 0) / (volBuffer.length || 1)) || 1;
  
  for (let i = lb; i < data.length - lb; i++) {
    const currentClose = data[i].close;
    const currentHigh = data[i].high;
    const currentLow = data[i].low;

    // --- Break of Structure (BOS) Live Check ---
    if (currentTrend === 'BULLISH' && lastLow !== null && currentClose < lastLow) {
      currentTrend = 'BEARISH';
      pendingBearishBOS = true;
    } 
    else if (currentTrend === 'BEARISH' && lastHigh !== null && currentClose > lastHigh) {
      currentTrend = 'BULLISH';
      pendingBullishBOS = true;
    }

    // --- Liquidity Grab (Sweep) Detection ---
    if (lastHigh !== null && currentHigh > lastHigh && currentClose < lastHigh) {
       grabs.push({ time: data[i].time, price: currentHigh, type: 'sweep_high', description: 'Liquidity Grab (Buy Stop Run)' });
    }
    if (lastLow !== null && currentLow < lastLow && currentClose > lastLow) {
       grabs.push({ time: data[i].time, price: currentLow, type: 'sweep_low', description: 'Liquidity Grab (Sell Stop Run)' });
    }

    const checkPH = (idx: number, look: number) => {
      if (idx - look < 0 || idx + look >= data.length) return false;
      for (let j = 1; j <= look; j++) if (data[idx-j].high > data[idx].high || data[idx+j].high > data[idx].high) return false;
      return true;
    };
    const checkPL = (idx: number, look: number) => {
      if (idx - look < 0 || idx + look >= data.length) return false;
      for (let j = 1; j <= look; j++) if (data[idx-j].low < data[idx].low || data[idx+j].low < data[idx].low) return false;
      return true;
    };

    const isPH_Ext = checkPH(i, lb * 3);
    const isPH_Int = checkPH(i, lb);
    const isPL_Ext = checkPL(i, lb * 3);
    const isPL_Int = checkPL(i, lb);

    if (isPH_Int) {
      const price = data[i].high;
      const body = Math.max(data[i].open, data[i].close);
      const sessionWeight = getSessionWeight(data[i].time);
      const rvol = (data[i].volume / avgVol) * sessionWeight;
      const strengthScore = Math.min(Math.round(rvol * 50), 100);

      // POC Alignment Logic
      const wickHeight = price - body;
      const bodyHeight = body - Math.min(data[i].open, data[i].close);
      const isWickPOC = wickHeight > bodyHeight; 
      
      // Phase 4: POC as Center of Mass (HLC3 approximation)
      const pricePOC = (data[i].high + data[i].low + data[i].close) / 3;

      rawLevels.push({
        id: `lvl_h_${data[i].time}`,
        priceWick: price,
        priceBody: body,
        pricePOC: pricePOC,
        startTime: data[i].time,
        type: 'resistance',
        isBroken: false,
        intent: isWickPOC ? 'Stop Run / Sweep' : 'Aggressive Accumulation',
        strengthScore
      });

      nodes.push({
        time: data[i].time,
        price,
        type: lastHigh === null || price > lastHigh ? 'HH' : 'LH',
        isBreakOfStructure: pendingBullishBOS,
        isRoleReversal: false,
        isExternal: isPH_Ext,
        index: i
      });
      lastHigh = price;
      if (pendingBullishBOS) pendingBullishBOS = false;
    }

    if (isPL_Int) {
      const price = data[i].low;
      const body = Math.min(data[i].open, data[i].close);
      const sessionWeight = getSessionWeight(data[i].time);
      const rvol = (data[i].volume / avgVol) * sessionWeight;
      const strengthScore = Math.min(Math.round(rvol * 50), 100);

      const wickHeight = body - price;
      const bodyHeight = Math.max(data[i].open, data[i].close) - body;
      const isWickPOC = wickHeight > bodyHeight;

      // Phase 4: POC as Center of Mass (HLC3 approximation)
      const pricePOC = (data[i].high + data[i].low + data[i].close) / 3;

      rawLevels.push({
        id: `lvl_l_${data[i].time}`,
        priceWick: price,
        priceBody: body,
        pricePOC: pricePOC,
        startTime: data[i].time,
        type: 'support',
        isBroken: false,
        intent: isWickPOC ? 'Stop Run / Sweep' : 'Aggressive Accumulation',
        strengthScore
      });

      nodes.push({
        time: data[i].time,
        price,
        type: lastLow === null || price < lastLow ? 'LL' : 'HL',
        isBreakOfStructure: pendingBearishBOS,
        isRoleReversal: false,
        isExternal: isPL_Ext,
        index: i
      });
      lastLow = price;
      if (pendingBearishBOS) pendingBearishBOS = false;
    }

    // 3. Dynamic Breaches with Institutional Hardening (BOS Logic)
    rawLevels.forEach(lvl => {
      if (!lvl.isBroken) {
        // High Probability: Requires 2 consecutive closes beyond the level OR 1 strong ATR-size break
        // For simplicity here: we check current and previous close
        const prevClose = data[i - 1]?.close || currentClose;
        if (lvl.type === 'resistance' && currentClose > lvl.priceWick && prevClose > lvl.priceWick) {
           lvl.isBroken = true;
           lvl.brokenAtIdx = i;
        }
        if (lvl.type === 'support' && currentClose < lvl.priceWick && prevClose < lvl.priceWick) {
           lvl.isBroken = true;
           lvl.brokenAtIdx = i;
        }
      }
    });
  }

  // --- Phase 3: Level Clustering (Institutional Confluence Zones) ---
  const clusteredLevels: StructuralLevel[] = [];
  const sortedRaw = [...rawLevels].sort((a, b) => a.priceWick - b.priceWick);
  
  for (let i = 0; i < sortedRaw.length; i++) {
    const current = sortedRaw[i];
    let merged = false;
    
    for (let j = 0; j < clusteredLevels.length; j++) {
      const existing = clusteredLevels[j];
      // Compare proximity (0.5% threshold)
      const priceDiff = Math.abs(current.priceWick - existing.priceWick) / existing.priceWick;
      if (priceDiff < 0.005 && current.type === existing.type) {
        // Merge! Average the prices, but take the highest strength
        existing.priceWick = (existing.priceWick + current.priceWick) / 2;
        existing.priceBody = (existing.priceBody + current.priceBody) / 2;
        existing.pricePOC = (existing.pricePOC + current.pricePOC) / 2;
        existing.strengthScore = Math.min(100, existing.strengthScore + current.strengthScore * 0.3);
        existing.startTime = Math.min(Number(existing.startTime), Number(current.startTime));
        merged = true;
        break;
      }
    }
    if (!merged) clusteredLevels.push(current);
  }

  const activeDataRangeStart = data.length - 100;
  const filteredLevels = clusteredLevels.filter(l => {
    if (!l.isBroken) return true;
    // Ghost Zones (Keep for 15 candles after break to allow for Breaker Block trade)
    return (data.length - 1 - (l.brokenAtIdx || 0)) <= 15;
  });

  const trendlines: Trendline[] = [];
  const hls = nodes.filter(n => n.type === 'HL' && n.isExternal);
  const lhs = nodes.filter(n => n.type === 'LH' && n.isExternal);
  
  const findValidRay = (points: MarketNode[], type: 'bullish' | 'bearish') => {
    if (points.length < 2) return;
    
    // We iterate backwards to find the most recent valid "Proven" or "Strong" anchor pair
    for (let i = points.length - 1; i >= 1; i--) {
      for (let j = i - 1; j >= 0; j--) {
        const p1 = points[j];
        const p2 = points[i];
        
        // 1. Slope Validation
        const slope = (p2.price - p1.price) / (p2.index - p1.index);
        if (type === 'bullish' && slope <= 0) continue; 
        if (type === 'bearish' && slope >= 0) continue;

        // 2. Intersection Protocol (Body Check)
        let isBroken = false;
        let touches = 2; // Start with the 2 anchors
        
        // Scan every candle from p1 index to the end of data
        for (let k = p1.index + 1; k < data.length; k++) {
          const expectedPrice = p1.price + slope * (k - p1.index);
          const close = data[k].close;
          const high = data[k].high;
          const low = data[k].low;

          // Discard if ANY candle CLOSES beyond the line
          if (type === 'bullish' && close < expectedPrice) { isBroken = true; break; }
          if (type === 'bearish' && close > expectedPrice) { isBroken = true; break; }

          // Proximity Scan for "Proven" touches (within 0.2%)
          const wickNear = type === 'bullish' ? 
            Math.abs(low - expectedPrice) / expectedPrice : 
            Math.abs(high - expectedPrice) / expectedPrice;
            
          if (k !== p2.index && wickNear < 0.002) touches++;
        }

        if (!isBroken) {
          // 3. Ray Extrapolation (Project 30 days into the future)
          // Rough estimate: candles * interval = 30 days. 
          // For simplicity, we just project +500 logical bars
          const futureIndex = data.length + 500;
          const futurePrice = p1.price + slope * (futureIndex - p1.index);
          const futureTime = (data[data.length - 1].time + (30 * 24 * 60 * 60)) as number; // ~30 days

          trendlines.push({
            id: `trnd_${type}_${p1.time}`,
            start: { time: p1.time, price: p1.price },
            end: { time: futureTime, price: futurePrice },
            type,
            isProven: touches >= 3
          });
          return; // Found the best valid line for this type
        }
      }
    }
  };

  findValidRay(hls, 'bullish');
  findValidRay(lhs, 'bearish');

  return {
    nodes: nodes.sort((a, b) => a.index - b.index),
    levels: filteredLevels.slice(-15),
    trendlines: trendlines.slice(-4),
    grabs: grabs.slice(-10)
  };
}



