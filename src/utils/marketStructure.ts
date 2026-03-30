export interface MarketNode {
  time: number | string;
  price: number;
  type: 'HH' | 'HL' | 'LH' | 'LL';
  isBreakOfStructure: boolean;
  isCHoCH: boolean;
  isRoleReversal: boolean;
  isExternal: boolean;
  strength: 'STRONG' | 'WEAK' | 'NEUTRAL';
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
  start: { time: number | string; price: number; index: number };
  end: { time: number | string; price: number };
  type: 'bullish' | 'bearish';
  isProven: boolean;
  slope: number;
}

export interface LiquidityGrab {
  time: number | string;
  price: number;
  type: 'sweep_high' | 'sweep_low';
  description: string;
}

export interface Imbalance {
  id: string;
  top: number;
  bottom: number;
  startTime: number | string;
  type: 'BULLISH_FVG' | 'BEARISH_FVG';
  isMitigated: boolean;
  mitigatedAtIdx?: number;
  strength: number; // 0-100 based on expansion size
}

export interface OrderBlock {
  id: string;
  top: number;
  bottom: number;
  startTime: number | string;
  type: 'BULLISH_OB' | 'BEARISH_OB';
  isMitigated: boolean;
  mitigatedAtIdx?: number;
  strength: number;
}

export interface MarketStructureAnalysis {
  nodes: MarketNode[];
  internalNodes: MarketNode[];
  levels: StructuralLevel[];
  trendlines: Trendline[];
  grabs: LiquidityGrab[];
  imbalances: Imbalance[]; 
  orderBlocks: OrderBlock[]; // Master 2100 Edition Addition
  currentTrend: 'BULLISH' | 'BEARISH'; 
  lastActionType: 'CHoCH' | 'BOS' | 'NONE';
  atr: number; 
  isNewsProtection: boolean; 
}

function calculateATR(data: any[], period: number = 14): number {
  if (data.length < period + 1) return 0;
  let trs: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const high = data[i].high;
    const low = data[i].low;
    const prevClose = data[i - 1].close;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return trs.slice(-period).reduce((a, b) => a + b, 0) / period;
}

function getSessionWeight(time: number | string, currentVol?: number, avgVol?: number): number {
  const date = new Date(typeof time === 'string' ? time : (time * 1000));
  const hour = date.getUTCHours();
  
  // 2100 Master Edition: Dynamic Liquidity Time Warping
  if (currentVol !== undefined && avgVol !== undefined && avgVol > 0) {
    const relativeVolume = currentVol / avgVol;
    if (relativeVolume > 2.0) {
      return 3.0; // Extreme Liquidity Cluster overrides static session time
    }
  }

  // London: 08:00 - 16:00 UTC
  // NY: 13:00 - 21:00 UTC
  // Overlap: 13:00 - 16:00 UTC
  if (hour >= 13 && hour <= 16) return 2.0; // Mega Weight
  if (hour >= 8 && hour < 13) return 1.5;   // London Heavy
  if (hour > 16 && hour <= 21) return 1.5;  // NY Heavy
  return 0.8; // Asian / Quiet hours
}

export function analyzeMarketStructure(data: any[], lb: number = 5): MarketStructureAnalysis {
  if (!data || data.length < lb * 2 + 1) return { 
    nodes: [], internalNodes: [], levels: [], trendlines: [], grabs: [], imbalances: [], orderBlocks: [],
    currentTrend: 'BULLISH', lastActionType: 'NONE', atr: 0, isNewsProtection: false
  };

  const nodes: MarketNode[] = [];
  const internalNodes: MarketNode[] = [];
  const grabs: LiquidityGrab[] = [];
  const imbalances: Imbalance[] = [];
  const orderBlocks: OrderBlock[] = [];
  let currentTrend: 'BULLISH' | 'BEARISH' = 'BULLISH';
  let lastActionType: 'CHoCH' | 'BOS' | 'NONE' = 'NONE';
  let isNewsProtection = false;

  const atr = calculateATR(data);
  const gammaGuardThreshold = atr * 1.5; // Institutional Displacement Requirement

  // Phase 3: Separate Macro from Internal
  let macroLastHigh: number | null = null;
  let macroLastLow: number | null = null;

  // Phase 1: SMC Sequencing (CHoCH vs BOS)
  let lastBreakDirection: 'BULLISH' | 'BEARISH' | null = null;

  const rawLevels: StructuralLevel[] = [];
  let pendingBOS = false;
  let pendingCHoCH = false;

  // Track the rolling mean volume for relative strength calculation
  const volBuffer = data.slice(-20).map(d => d.volume);
  const avgVol = (volBuffer.reduce((a, b) => a + b, 0) / (volBuffer.length || 1)) || 1;

  for (let i = lb; i < data.length - lb; i++) {
    const currentClose = data[i].close;
    const currentHigh = data[i].high;
    const currentLow = data[i].low;

    // --- Dynamic Rolling ATR (Gamma-Guard Perfection) ---
    // Recalculating ATR dynamically for the current historical context
    const currentAtr = calculateATR(data.slice(0, i + 1));

    // --- Phase 1: SMC Sequencing (CHoCH vs BOS) with Gamma-Guard Displacement ---
    if (currentTrend === 'BULLISH' && macroLastLow !== null && currentClose < macroLastLow) {
      // Gamma-Guard: Ensure the break is decisive (Institutional Displacement)
      const displacement = macroLastLow - currentClose;
      if (displacement > (currentAtr * 0.5)) {
        currentTrend = 'BEARISH';
        if (lastBreakDirection === 'BULLISH') { pendingCHoCH = true; lastActionType = 'CHoCH'; }
        else { pendingBOS = true; lastActionType = 'BOS'; }
        lastBreakDirection = 'BEARISH';
      }
    }
    else if (currentTrend === 'BEARISH' && macroLastHigh !== null && currentClose > macroLastHigh) {
      const displacement = currentClose - macroLastHigh;
      if (displacement > (currentAtr * 0.5)) {
        currentTrend = 'BULLISH';
        if (lastBreakDirection === 'BEARISH') { pendingCHoCH = true; lastActionType = 'CHoCH'; }
        else { pendingBOS = true; lastActionType = 'BOS'; }
        lastBreakDirection = 'BULLISH';
      }
    }

    // --- Fair Value Gap (FVG) / Imbalance Engine with Displacement Constraint ---
    if (i >= 2) {
      const p2 = data[i - 2];
      const p1 = data[i - 1]; // The Displacement Candle
      const cur = data[i];

      const p1BodySize = Math.abs(p1.close - p1.open);
      // Rolling mean body size for displacement validation (10 periods)
      const recentBodies = data.slice(Math.max(0, i - 11), i - 1).map(d => Math.abs(d.close - d.open));
      const avgBody = recentBodies.length > 0 ? recentBodies.reduce((a, b) => a + b, 0) / recentBodies.length : 0;

      const isInstitutionalDisplacement = p1BodySize > (avgBody * 1.5);

      // Bullish FVG: Low of candle 3 > High of candle 1 AND Institutional Displacement
      if (cur.low > p2.high && isInstitutionalDisplacement) {
        imbalances.push({
          id: `fvg_bull_${cur.time}`,
          top: cur.low,
          bottom: p2.high,
          startTime: cur.time,
          type: 'BULLISH_FVG',
          isMitigated: false,
          strength: Math.min(100, Math.round(((cur.low - p2.high) / (currentAtr || 1)) * 100))
        });
      }
      // Bearish FVG: High of candle 3 < Low of candle 1 AND Institutional Displacement
      if (cur.high < p2.low && isInstitutionalDisplacement) {
        imbalances.push({
          id: `fvg_bear_${cur.time}`,
          top: p2.low,
          bottom: cur.high,
          startTime: cur.time,
          type: 'BEARISH_FVG',
          isMitigated: false,
          strength: Math.min(100, Math.round(((p2.low - cur.high) / (currentAtr || 1)) * 100))
        });
      }

      // --- 2100 MASTER EDITION: Order Block Detection Engine ---
      // Bullish OB: The final opposing candle before a massive displacement impulse
      if (cur.low > p2.high && isInstitutionalDisplacement && p2.close < p2.open) {
        orderBlocks.push({
          id: `ob_bull_${p2.time}`,
          top: p2.high,
          bottom: p2.low,
          startTime: p2.time,
          type: 'BULLISH_OB',
          isMitigated: false,
          strength: 100
        });
      }
      // Bearish OB: The final opposing candle before a massive displacement impulse
      if (cur.high < p2.low && isInstitutionalDisplacement && p2.close > p2.open) {
        orderBlocks.push({
          id: `ob_bear_${p2.time}`,
          top: p2.high,
          bottom: p2.low,
          startTime: p2.time,
          type: 'BEARISH_OB',
          isMitigated: false,
          strength: 100
        });
      }
    }

    // --- FVG Mitigation Logic ---
    imbalances.forEach(fvg => {
      if (!fvg.isMitigated) {
        if (fvg.type === 'BULLISH_FVG' && data[i].low <= fvg.bottom) {
          fvg.isMitigated = true;
          fvg.mitigatedAtIdx = i;
        }
        if (fvg.type === 'BEARISH_FVG' && data[i].high >= fvg.top) {
          fvg.isMitigated = true;
          fvg.mitigatedAtIdx = i;
        }
      }
    });

    // --- OB Mitigation Logic (Master 2100) ---
    orderBlocks.forEach(ob => {
      if (!ob.isMitigated) {
        if (ob.type === 'BULLISH_OB' && data[i].low <= ob.bottom) ob.isMitigated = true;
        if (ob.type === 'BEARISH_OB' && data[i].high >= ob.top) ob.isMitigated = true;
      }
    });

    // --- Liquidity Grab (Sweep) Detection ---
    if (macroLastHigh !== null && currentHigh > macroLastHigh && currentClose < macroLastHigh) {
      grabs.push({ time: data[i].time, price: currentHigh, type: 'sweep_high', description: 'Liquidity Grab (Buy Stop Run)' });
    }
    if (macroLastLow !== null && currentLow < macroLastLow && currentClose > macroLastLow) {
      grabs.push({ time: data[i].time, price: currentLow, type: 'sweep_low', description: 'Liquidity Grab (Sell Stop Run)' });
    }

    const checkPH = (idx: number, look: number) => {
      if (idx - look < 0 || idx + look >= data.length) return false;
      for (let j = 1; j <= look; j++) if (data[idx - j].high > data[idx].high || data[idx + j].high > data[idx].high) return false;
      return true;
    };
    const checkPL = (idx: number, look: number) => {
      if (idx - look < 0 || idx + look >= data.length) return false;
      for (let j = 1; j <= look; j++) if (data[idx - j].low < data[idx].low || data[idx + j].low < data[idx].low) return false;
      return true;
    };

    const isPH_Ext = checkPH(i, lb * 3);
    const isPH_Int = checkPH(i, lb);
    const isPL_Ext = checkPL(i, lb * 3);
    const isPL_Int = checkPL(i, lb);

    if (isPH_Int) {
      const price = data[i].high;
      const body = Math.max(data[i].open, data[i].close);
      const sessionWeight = getSessionWeight(data[i].time, data[i].volume, avgVol);
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

      // --- Phase 1: Inside Bar Filter (Institutional Noise Rejection) ---
      const prev = data[i - 1];
      const isInsideBar = data[i].high <= prev.high && data[i].low >= prev.low;

      if (!isInsideBar) {
        const node: MarketNode = {
          time: data[i].time,
          price,
          type: macroLastHigh === null || price > macroLastHigh ? 'HH' : 'LH',
          isBreakOfStructure: pendingBOS && currentTrend === 'BULLISH',
          isCHoCH: pendingCHoCH && currentTrend === 'BULLISH',
          isRoleReversal: false,
          isExternal: isPH_Ext,
          strength: 'NEUTRAL',
          index: i
        };

        if (isPH_Ext) nodes.push(node);
        else internalNodes.push(node); // Sub-fractal Trace Point
      }

      macroLastHigh = price;
      pendingBOS = false;
      pendingCHoCH = false;
    }

    if (isPL_Int) {
      const price = data[i].low;
      const body = Math.min(data[i].open, data[i].close);
      const sessionWeight = getSessionWeight(data[i].time, data[i].volume, avgVol);
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

      // --- Phase 1: Inside Bar Filter (Institutional Noise Rejection) ---
      const prev = data[i - 1];
      const isInsideBar = data[i].high <= prev.high && data[i].low >= prev.low;

      if (!isInsideBar) {
        const node: MarketNode = {
          time: data[i].time,
          price,
          type: macroLastLow === null || price < macroLastLow ? 'LL' : 'HL',
          isBreakOfStructure: pendingBOS && currentTrend === 'BEARISH',
          isCHoCH: pendingCHoCH && currentTrend === 'BEARISH',
          isRoleReversal: false,
          isExternal: isPL_Ext,
          strength: 'NEUTRAL',
          index: i
        };

        if (isPL_Ext) nodes.push(node);
        else internalNodes.push(node); // Sub-fractal Trace Point
      }

      macroLastLow = price;
      pendingBOS = false;
      pendingCHoCH = false;
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

    // NEWS PROTECTION / VOLATILITY VELOCITY FILTER (2050 Perfection)
    const prevAtrs = data.slice(Math.max(0, i - 10), i).map((_, idx) => calculateATR(data.slice(0, Math.max(0, i - 10) + idx + 1)));
    const avgVelocity = prevAtrs.length > 0 ? prevAtrs.reduce((a, b) => a + b, 0) / prevAtrs.length : currentAtr;
    isNewsProtection = currentAtr > (avgVelocity * 3);
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
            start: { time: p1.time, price: p1.price, index: p1.index },
            end: { time: futureTime, price: futurePrice },
            type,
            isProven: touches >= 3,
            slope
          });
          return; // Found the best valid line for this type
        }
      }
    }
  };

  findValidRay(hls, 'bullish');
  findValidRay(lhs, 'bearish');

  // --- Phase 2: STRONG vs WEAK Classification ---
  nodes.forEach((node, idx) => {
    if (!node.isExternal) return;

    // A Strong node is one that actually caused a BOS on the opposite side
    const nextNodes = nodes.slice(idx + 1);
    const causedBreak = nextNodes.some(n => n.isBreakOfStructure || n.isCHoCH);

    if (causedBreak) {
      node.strength = 'STRONG';
    } else {
      // If a node was formed but price reversed before it could cause a BOS, it is WEAK
      node.strength = 'WEAK';
    }
  });

  return {
    nodes: nodes.sort((a, b) => a.index - b.index),
    internalNodes: internalNodes.sort((a, b) => a.index - b.index),
    levels: filteredLevels.slice(-15),
    trendlines: trendlines.slice(-4),
    grabs: grabs.slice(-10),
    imbalances: imbalances.filter(f => !f.isMitigated).slice(-8), 
    orderBlocks: orderBlocks.filter(ob => !ob.isMitigated).slice(-5), // Active OBs (2100)
    currentTrend,
    lastActionType,
    atr,
    isNewsProtection
  };
}



