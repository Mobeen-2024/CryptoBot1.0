import { useState, useEffect } from 'react';

export function useVoltronMath(
  currentPrice: number, 
  customAnchorPrice: number, 
  usePreviousDayAvg: boolean
) {
  const [riskAppetite, setRiskAppetite] = useState<number>(50);
  const [isShimmering, setIsShimmering] = useState(false);
  
  const [bullishSL, setBullishSL] = useState<number>(0);
  const [bullishTP, setBullishTP] = useState<number>(0);
  
  const [bearishSL, setBearishSL] = useState<number>(0);
  const [bearishTP, setBearishTP] = useState<number>(0);

  // Semantic Object Morphing: Triggers only on explicit Risk manipulation
  useEffect(() => {
    if (usePreviousDayAvg || customAnchorPrice === 0 || currentPrice === 0) return;
    
    setIsShimmering(true);
    const timer = setTimeout(() => setIsShimmering(false), 800);

    const anchor = customAnchorPrice;
    const distance = Math.abs(currentPrice - anchor);
    if (distance === 0) return;

    const riskMult = riskAppetite / 50;
    
    // Bullish Vector Math
    const bullOffset = distance * 0.5 * riskMult;
    setBullishSL(parseFloat((currentPrice - bullOffset).toFixed(4)));
    setBullishTP(parseFloat((currentPrice + (bullOffset * 3 * riskMult)).toFixed(4)));
    
    // Bearish Vector Math
    const bearOffset = distance * 2 * riskMult;
    setBearishSL(parseFloat((currentPrice + bearOffset).toFixed(4)));
    setBearishTP(parseFloat(anchor.toFixed(4)));

    return () => clearTimeout(timer);
  }, [riskAppetite]); // Explicitly excluding price ticks to avoid overwriting typed inputs

  return {
    riskAppetite, setRiskAppetite,
    isShimmering,
    bullishSL, setBullishSL,
    bullishTP, setBullishTP,
    bearishSL, setBearishSL,
    bearishTP, setBearishTP
  };
}
