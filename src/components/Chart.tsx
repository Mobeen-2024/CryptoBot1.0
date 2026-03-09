import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, AreaSeries, LineSeries, UTCTimestamp, IChartApi } from 'lightweight-charts';
import { ChartDrawingLayer, DrawingTool } from './ChartDrawingLayer';

interface ChartProps {
  data: any[];
  symbol: string;
  chartInterval: string;
  mainIndicator?: string | null;
  subIndicators?: string[];
}

export const Chart: React.FC<ChartProps> = ({ data, symbol, chartInterval, mainIndicator, subIndicators = [] }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const supertrendSeriesRef = useRef<any>(null);
  const emaSeriesRef = useRef<any>(null);
  const smaSeriesRef = useRef<any>(null);
  const sarSeriesRef = useRef<any>(null);
  const alligatorJawRef = useRef<any>(null);
  const alligatorTeethRef = useRef<any>(null);
  const alligatorLipsRef = useRef<any>(null);
  const bollUpperRef = useRef<any>(null);
  const bollMiddleRef = useRef<any>(null);
  const bollLowerRef = useRef<any>(null);
  const stDataRef = useRef<any[]>([]);

  const buyLineRef = useRef<any>(null);
  const sellLineRef = useRef<any>(null);

  const [avgPositions, setAvgPositions] = useState({ buy: -100, sell: -100, buyPrice: 0, sellPrice: 0 });
  const [customBuy, setCustomBuy] = useState<string>('');
  const [customSell, setCustomSell] = useState<string>('');
  const [activeTool, setActiveTool] = useState<DrawingTool>('none');
  const [crosshairData, setCrosshairData] = useState<{
    time: string | number;
    open: number;
    high: number;
    low: number;
    close: number;
    x: number;
    y: number;
    rsi?: number;
    macd?: { macd: number, signal: number, histogram: number };
    boll?: { upper: number, middle: number, lower: number };
    atr?: number;
    volume?: number;
    ema200?: number;
    sma?: number;
    sar?: number;
    wr?: number;
    obv?: number;
    stochRsi?: { stochRSI: number };
    kdj?: { k: number, d: number, j: number };
    alligator?: { jaw: number | null, teeth: number | null, lips: number | null };
  } | null>(null);

  const [candleCountdown, setCandleCountdown] = useState<{
    text: string;
    isUp: boolean;
  } | null>(null);

  // Helper to parse interval into ms
  const getIntervalMs = (interval: string) => {
    const value = parseInt(interval);
    const unit = interval.slice(-1);
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      default: return 60000; // Default to 1 minute if unknown
    }
  };

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const resizeObserver = new ResizeObserver(entries => {
      if (entries.length === 0 || entries[0].target !== chartContainerRef.current) return;
      const newRect = entries[0].contentRect;
      if (newRect.width > 0 && newRect.height > 0 && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: newRect.width, 
          height: newRect.height 
        });
      }
    });

    // Clear underlying DOM array to prevent Strict Mode from spawning duplicate overlapping grids
    chartContainerRef.current.innerHTML = '';

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#0B0E11' }, // Binance Dark Theme
        textColor: '#848e9c', // Standard gray text
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: '#2b3139', style: 3, visible: true }, // Faint dotted vertical
        horzLines: { color: '#2b3139', style: 3, visible: true }, // Faint dotted horizontal
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal allows free horizontal tracking
        horzLine: {
          color: '#848e9c',
          labelBackgroundColor: '#1e2329',
          labelVisible: true,
          style: 3, // Dotted
        },
        vertLine: {
          color: '#848e9c',
          labelBackgroundColor: '#1e2329', // Dark pill for active time
          labelVisible: true, // Show the exact timestamp/date pill on hover (X-Axis)
          style: 3, // Dotted
        },
      },
      timeScale: {
        timeVisible: true, // Show the native bottom axis Date instead
        secondsVisible: false,
        borderColor: '#2b3139', // Dark border
        rightOffset: 5, // A right-side margin is implicitly maintained by Lightweight Charts width, but this creates some breathing room
      },
      localization: {
        timeFormatter: (businessDayOrTimestamp: any) => {
          try {
            if (typeof businessDayOrTimestamp === 'number') {
              // Lightweight charts provides timestamps in seconds
              const date = new Date(businessDayOrTimestamp * 1000);
              return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
            }
            if (businessDayOrTimestamp && typeof businessDayOrTimestamp === 'object' && 'year' in businessDayOrTimestamp) {
              const { year, month, day } = businessDayOrTimestamp;
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
            return String(businessDayOrTimestamp);
          } catch (e) {
            return ''; // Prevent fatal React crash on formatter parse failure
          }
        },
      },
      rightPriceScale: {
        borderColor: '#2b3139', // Dark border
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#0ecb81', // Solid up fill (emerald green)
      downColor: '#f6465d', // Solid down fill (rose red)
      borderVisible: false, // Ensures no extra outlining, strictly solid bodies
      wickVisible: true,
      wickUpColor: '#0ecb81', // Thin vertical lines matching body
      wickDownColor: '#f6465d',
    });

    seriesRef.current = candlestickSeries;
    candlestickSeries.setData(data);

    // Add Dummy Buy/Sell Markers for demonstration
    if (data.length > 30) {
      const markers = [
        {
          time: data[data.length - 25].time,
          position: 'belowBar',
          color: '#10b981',
          shape: 'square',
          text: 'B',
        },
        {
          time: data[data.length - 10].time,
          position: 'aboveBar',
          color: '#f43f5e',
          shape: 'square',
          text: 'S',
        }
      ] as any[];
      try {
        (candlestickSeries as any).setMarkers(markers);
      } catch (err) {
        console.warn('Failed to set demonstration markers:', err);
      }
    }

    const supertrendSeries = chart.addSeries(AreaSeries, {
      lineType: 2, // LineType.WithSteps
      lineWidth: 2,
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: mainIndicator === 'SUPER',
    });
    supertrendSeriesRef.current = supertrendSeries;

    const emaSeries = chart.addSeries(LineSeries, {
      color: '#fcd535',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainIndicator === 'EMA',
    });
    emaSeriesRef.current = emaSeries;

    const smaSeries = chart.addSeries(LineSeries, {
      color: '#0ecb81',
      lineWidth: 2,
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainIndicator === 'MA',
    });
    smaSeriesRef.current = smaSeries;

    const sarSeries = chart.addSeries(LineSeries, {
      color: '#eaecef',
      lineWidth: 2,
      lineStyle: 3, // Dotted style for SAR
      crosshairMarkerVisible: false,
      lastValueVisible: false,
      priceLineVisible: false,
      visible: mainIndicator === 'SAR',
    });
    sarSeriesRef.current = sarSeries;

    const bollUpper = chart.addSeries(LineSeries, { color: '#848e9c', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'BOLL' });
    const bollMiddle = chart.addSeries(LineSeries, { color: '#fcd535', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'BOLL' });
    const bollLower = chart.addSeries(LineSeries, { color: '#848e9c', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'BOLL' });
    bollUpperRef.current = bollUpper;
    bollMiddleRef.current = bollMiddle;
    bollLowerRef.current = bollLower;

    const alligatorJaw = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'ALLIGATOR' });
    const alligatorTeeth = chart.addSeries(LineSeries, { color: '#E91E63', lineWidth: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'ALLIGATOR' });
    const alligatorLips = chart.addSeries(LineSeries, { color: '#00E676', lineWidth: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'ALLIGATOR' });
    alligatorJawRef.current = alligatorJaw;
    alligatorTeethRef.current = alligatorTeeth;
    alligatorLipsRef.current = alligatorLips;

    // Generate Dummy SuperTrend Data matching the input `data` length
    if (data.length > 0) {
      let trend = 1;
      let st = data[0]?.close || 0;
      const stData = data.map((d: any, i: number) => {
        if (i % 7 === 0) {
          if (d.close > st) { trend = 1; st = d.close * 0.985; }
          else { trend = -1; st = d.close * 1.015; }
        }
        return {
          time: d.time,
          value: st,
          lineColor: trend === 1 ? '#0ecb81' : '#f6465d',
          topColor: trend === 1 ? 'rgba(14, 203, 129, 0.15)' : 'rgba(246, 70, 93, 0.15)',
          bottomColor: 'rgba(0, 0, 0, 0)',
        };
      });
      stDataRef.current = stData;
      supertrendSeries.setData(stData);
      
      // Setup Average Price Lines (Dark Version)
      // Pick dynamic mock locations based on chart data
      const currentPr = data[data.length - 1].close;
      const mockBuyPrice = currentPr * 0.99;
      const mockSellPrice = currentPr * 1.01;
      
      buyLineRef.current = candlestickSeries.createPriceLine({
        price: mockBuyPrice,
        color: '#0ecb81',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: false, // We will draw our own on the left
      });

      sellLineRef.current = candlestickSeries.createPriceLine({
        price: mockSellPrice,
        color: '#f6465d',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: false, // We will draw our own on the left
      });

      setAvgPositions(prev => ({ ...prev, buyPrice: mockBuyPrice, sellPrice: mockSellPrice }));
    }

    // Subscribe to crosshair movement to update OHLC floating card
    chart.subscribeCrosshairMove((param) => {
      if (param.time && param.seriesData.size > 0 && candlestickSeries && param.point) {
        const hoveredData = param.seriesData.get(candlestickSeries) as any;
        const srcData = data.find(d => d.time === hoveredData?.time);
        
        setCrosshairData(hoveredData ? {
          ...hoveredData,
          x: param.point.x,
          y: param.point.y,
          rsi: srcData?.rsi,
          macd: srcData?.macd,
          boll: srcData?.boll,
          atr: srcData?.atr,
          volume: srcData?.volume,
          ema200: srcData?.ema200,
          sma: srcData?.sma,
          sar: srcData?.sar,
          wr: srcData?.wr,
          obv: srcData?.obv,
          stochRsi: srcData?.stochRsi,
          kdj: srcData?.kdj,
          alligator: srcData?.alligator
        } : null);
      } else {
        setCrosshairData(null);
      }
    });

    const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${chartInterval}`;
    const ws = new WebSocket(wsUrl);

    // Render loop for tracking Y-Coordinates of Price Lines on the left axis
    let animationFrameId: number;
    const syncPills = () => {
      if (seriesRef.current && buyLineRef.current && sellLineRef.current) {
        const series = seriesRef.current;
        setAvgPositions(prev => {
          const buyY = series.priceToCoordinate(prev.buyPrice);
          const sellY = series.priceToCoordinate(prev.sellPrice);
          
          const newBuy = buyY !== null ? buyY : -100;
          const newSell = sellY !== null ? sellY : -100;

          if (newBuy !== prev.buy || newSell !== prev.sell) {
             return { ...prev, buy: newBuy, sell: newSell };
          }
          return prev;
        });
      }
      animationFrameId = requestAnimationFrame(syncPills);
    };
    syncPills();

    let timerInterval: ReturnType<typeof setInterval>; // Declare timerInterval here

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      const kline = message.k;

      if (kline && kline.x) { // kline.x is true if the candle is closed
        // Update candlestick series with new closed candle
        const t = kline.t / 1000 as UTCTimestamp;
        seriesRef.current.update({
          time: t,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
        });

        // Extend trailing indicators for the new candle
        if (data.length > 0) {
          const lastValid = data[data.length - 1];
          if (emaSeriesRef.current && lastValid.ema200) emaSeriesRef.current.update({ time: t, value: lastValid.ema200 });
          if (smaSeriesRef.current && lastValid.sma) smaSeriesRef.current.update({ time: t, value: lastValid.sma });
          if (sarSeriesRef.current && lastValid.sar) sarSeriesRef.current.update({ time: t, value: lastValid.sar });
          if (bollUpperRef.current && lastValid.boll) {
            bollUpperRef.current.update({ time: t, value: lastValid.boll.upper });
            bollMiddleRef.current.update({ time: t, value: lastValid.boll.middle });
            bollLowerRef.current.update({ time: t, value: lastValid.boll.lower });
          }
        }

        // Update SuperTrend series (dummy logic)
        if (supertrendSeriesRef.current) {
          let trend = 1;
          let st = parseFloat(kline.c); // Use current close for new ST calculation
          // Simplified dummy logic for SuperTrend update
          if (stDataRef.current.length > 0) {
            const lastSt = stDataRef.current[stDataRef.current.length - 1];
            if (parseFloat(kline.c) > lastSt.value) { trend = 1; st = parseFloat(kline.c) * 0.985; }
            else { trend = -1; st = parseFloat(kline.c) * 1.015; }
          }
          const newStPoint = {
            time: t,
            value: st,
            lineColor: trend === 1 ? '#0ecb81' : '#f6465d',
            topColor: trend === 1 ? 'rgba(14, 203, 129, 0.15)' : 'rgba(246, 70, 93, 0.15)',
            bottomColor: 'rgba(0, 0, 0, 0)',
          };
          supertrendSeriesRef.current.update(newStPoint);
          stDataRef.current.push(newStPoint);
        }

        // Reset countdown for next candle
        clearInterval(timerInterval);
        setCandleCountdown(null);
      } else if (kline) {
        // Update candlestick series with current open candle
        const t = kline.t / 1000 as UTCTimestamp;
        seriesRef.current.update({
          time: t,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
        });

        // Realtime tick extension for overlays
        if (data.length > 0) {
          const lastValid = data[data.length - 1];
          if (emaSeriesRef.current && lastValid.ema200) emaSeriesRef.current.update({ time: t, value: lastValid.ema200 });
          if (smaSeriesRef.current && lastValid.sma) smaSeriesRef.current.update({ time: t, value: lastValid.sma });
          if (sarSeriesRef.current && lastValid.sar) sarSeriesRef.current.update({ time: t, value: lastValid.sar });
          if (bollUpperRef.current && lastValid.boll) {
            bollUpperRef.current.update({ time: t, value: lastValid.boll.upper });
            bollMiddleRef.current.update({ time: t, value: lastValid.boll.middle });
            bollLowerRef.current.update({ time: t, value: lastValid.boll.lower });
          }
        }

        // Update SuperTrend series (dummy logic)
        if (supertrendSeriesRef.current) {
          let trend = 1;
          let st = parseFloat(kline.c);
          if (stDataRef.current.length > 0) {
            const lastSt = stDataRef.current[stDataRef.current.length - 1];
            if (parseFloat(kline.c) > lastSt.value) { trend = 1; st = parseFloat(kline.c) * 0.985; }
            else { trend = -1; st = parseFloat(kline.c) * 1.015; }
          }
          supertrendSeriesRef.current.update({
            time: t,
            value: st,
            lineColor: trend === 1 ? '#0ecb81' : '#f6465d',
            topColor: trend === 1 ? 'rgba(14, 203, 129, 0.15)' : 'rgba(246, 70, 93, 0.15)',
            bottomColor: 'rgba(0, 0, 0, 0)',
          });
        }

        // Start/Update countdown for current candle
        if (!timerInterval) {
          const intervalMs = getIntervalMs(chartInterval);
          const startTime = kline.t;
          timerInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - startTime;
            const remaining = intervalMs - elapsed;

            if (remaining <= 0) {
              clearInterval(timerInterval);
              setCandleCountdown(null);
              return;
            }

            const minutes = Math.floor(remaining / (60 * 1000));
            const seconds = Math.floor((remaining % (60 * 1000)) / 1000);
            const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            setCandleCountdown({
              text: formattedTime,
              isUp: parseFloat(kline.c) >= parseFloat(kline.o),
            });
          }, 1000);
        } else {
          setCandleCountdown(prev => prev ? { ...prev, isUp: parseFloat(kline.c) >= parseFloat(kline.o) } : null);
        }
      }
    };

    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      ws.close();
      clearInterval(timerInterval);
      cancelAnimationFrame(animationFrameId);
    };
  }, [symbol, chartInterval]);

  // Toggle visibility of overlays instantly when prop changes
  useEffect(() => {
    if (supertrendSeriesRef.current) supertrendSeriesRef.current.applyOptions({ visible: mainIndicator === 'SUPER' });
    if (emaSeriesRef.current) emaSeriesRef.current.applyOptions({ visible: mainIndicator === 'EMA' });
    if (smaSeriesRef.current) smaSeriesRef.current.applyOptions({ visible: mainIndicator === 'MA' });
    if (sarSeriesRef.current) sarSeriesRef.current.applyOptions({ visible: mainIndicator === 'SAR' });
    if (bollUpperRef.current) {
      const isBoll = mainIndicator === 'BOLL';
      bollUpperRef.current.applyOptions({ visible: isBoll });
      bollMiddleRef.current.applyOptions({ visible: isBoll });
      bollLowerRef.current.applyOptions({ visible: isBoll });
    }
    const isAlligator = mainIndicator === 'ALLIGATOR';
    if (alligatorJawRef.current) alligatorJawRef.current.applyOptions({ visible: isAlligator });
    if (alligatorTeethRef.current) alligatorTeethRef.current.applyOptions({ visible: isAlligator });
    if (alligatorLipsRef.current) alligatorLipsRef.current.applyOptions({ visible: isAlligator });
  }, [mainIndicator]);

  // Update data without recreating the chart
  useEffect(() => {
    if (seriesRef.current && data.length > 0) {
      seriesRef.current.setData(data);

      if (emaSeriesRef.current) {
        const emaData = data.filter(d => d.ema200 !== undefined).map(d => ({ time: d.time, value: d.ema200 }));
        emaSeriesRef.current.setData(emaData);
      }

      if (smaSeriesRef.current) {
        const smaData = data.filter(d => d.sma !== undefined).map(d => ({ time: d.time, value: d.sma }));
        smaSeriesRef.current.setData(smaData);
      }

      if (sarSeriesRef.current) {
        const sarData = data.filter(d => d.sar !== undefined).map(d => ({ time: d.time, value: d.sar }));
        sarSeriesRef.current.setData(sarData);
      }

      if (bollUpperRef.current) {
        const bU = data.filter(d => d.boll?.upper !== undefined).map(d => ({ time: d.time, value: d.boll.upper }));
        const bM = data.filter(d => d.boll?.middle !== undefined).map(d => ({ time: d.time, value: d.boll.middle }));
        const bL = data.filter(d => d.boll?.lower !== undefined).map(d => ({ time: d.time, value: d.boll.lower }));
        bollUpperRef.current.setData(bU);
        bollMiddleRef.current.setData(bM);
        bollLowerRef.current.setData(bL);
      }

      if (alligatorJawRef.current) {
        const jawData = data.filter(d => d.alligator?.jaw != null).map(d => ({ time: d.time, value: d.alligator.jaw }));
        const teethData = data.filter(d => d.alligator?.teeth != null).map(d => ({ time: d.time, value: d.alligator.teeth }));
        const lipsData = data.filter(d => d.alligator?.lips != null).map(d => ({ time: d.time, value: d.alligator.lips }));
        alligatorJawRef.current.setData(jawData);
        alligatorTeethRef.current.setData(teethData);
        alligatorLipsRef.current.setData(lipsData);
      }

      if (supertrendSeriesRef.current) {
        let trend = 1;
        let st = data[0]?.close || 0;
        const stData = data.map((d: any, i: number) => {
          if (i % 7 === 0) {
            if (d.close > st) { trend = 1; st = d.close * 0.985; }
            else { trend = -1; st = d.close * 1.015; }
          }
          return {
            time: d.time,
            value: st,
            lineColor: trend === 1 ? '#0ecb81' : '#f6465d',
            topColor: trend === 1 ? 'rgba(14, 203, 129, 0.15)' : 'rgba(246, 70, 93, 0.15)',
            bottomColor: 'rgba(0, 0, 0, 0)',
          };
        });
        stDataRef.current = stData;
        supertrendSeriesRef.current.setData(stData);
      }

      const currentPr = data[data.length - 1].close;
      const mockBuyPrice = currentPr * 0.99;
      const mockSellPrice = currentPr * 1.01;

      if (!buyLineRef.current && seriesRef.current) {
        buyLineRef.current = seriesRef.current.createPriceLine({
          price: mockBuyPrice,
          color: '#0ecb81',
          lineWidth: 1,
          lineStyle: 2, 
          axisLabelVisible: false,
        });
      } else if (buyLineRef.current) {
         buyLineRef.current.applyOptions({ price: mockBuyPrice });
      }

      if (!sellLineRef.current && seriesRef.current) {
        sellLineRef.current = seriesRef.current.createPriceLine({
          price: mockSellPrice,
          color: '#f6465d',
          lineWidth: 1,
          lineStyle: 2, 
          axisLabelVisible: false,
        });
      } else if (sellLineRef.current) {
         sellLineRef.current.applyOptions({ price: mockSellPrice });
      }

      setAvgPositions(prev => ({ ...prev, buyPrice: mockBuyPrice, sellPrice: mockSellPrice }));
    }
  }, [data]);

  // Handle custom Buy/Sell Avg Inputs
  useEffect(() => {
    if (buyLineRef.current && customBuy !== '') {
      const p = parseFloat(customBuy);
      if (!isNaN(p)) {
        buyLineRef.current.applyOptions({ price: p });
        setAvgPositions(prev => ({ ...prev, buyPrice: p }));
      }
    }
  }, [customBuy]);

  useEffect(() => {
    if (sellLineRef.current && customSell !== '') {
      const p = parseFloat(customSell);
      if (!isNaN(p)) {
        sellLineRef.current.applyOptions({ price: p });
        setAvgPositions(prev => ({ ...prev, sellPrice: p }));
      }
    }
  }, [customSell]);

  return (
    <div className="flex flex-col w-full h-full bg-[#0B0E11] rounded-lg overflow-hidden border border-[#2b3139]">
      {/* Navigation & Toolbar (Top Row) */}
      <div className="flex items-center justify-end px-4 py-2 border-b border-[#2b3139]">

        <div className="hidden md:flex items-center gap-2 mr-6 opacity-80 hover:opacity-100 transition-opacity">
          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-gray-500">Buy Avg</span>
          <input 
            type="number" 
            placeholder="Price" 
            className="bg-black/50 border border-white/10 rounded px-2 py-0.5 text-[10px] w-20 outline-none focus:border-emerald-500 text-emerald-500 font-mono font-bold" 
            value={customBuy} 
            onChange={e => setCustomBuy(e.target.value)} 
          />
          <span className="text-[10px] uppercase font-mono tracking-wider font-bold text-gray-500 ml-2">Sell Avg</span>
          <input 
            type="number" 
            placeholder="Price" 
            className="bg-black/50 border border-white/10 rounded px-2 py-0.5 text-[10px] w-20 outline-none focus:border-rose-500 text-rose-500 font-mono font-bold" 
            value={customSell} 
            onChange={e => setCustomSell(e.target.value)} 
          />
        </div>

        {/* Drawing Toolbar */}
        <div className="hidden md:flex items-center gap-1 mr-4 border border-[#2b3139] rounded-lg p-1">
          {([
            { id: 'none',       icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5', title: 'Select / Move',    color: '#848e9c' },
            { id: 'trendline',  icon: 'M5 19L19 5M9 19l-4-4M5 15l4-4',      title: 'Trendline',       color: '#fcd535' },
            { id: 'horizontal', icon: 'M5 12h14',                             title: 'Horiz. S/R Line', color: '#0ecb81' },
            { id: 'annotation', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', title: 'Annotation', color: '#2962FF' },
          ] as { id: DrawingTool; icon: string; title: string; color: string }[]).map(tool => (
            <button
              key={tool.id}
              title={tool.title}
              onClick={() => setActiveTool(prev => prev === tool.id ? 'none' : tool.id as DrawingTool)}
              className={`p-1.5 rounded transition-colors ${
                activeTool === tool.id
                  ? 'bg-[#2b3139] text-white'
                  : 'text-[#5e6673] hover:text-[#eaecef] hover:bg-[#2b3139]/50'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={activeTool === tool.id ? tool.color : 'currentColor'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={tool.icon}/>
              </svg>
            </button>
          ))}
          {/* Divider + Clear All */}
          <div className="w-px h-4 bg-[#2b3139] mx-0.5"/>
          <button
            title="Clear all drawings"
            onClick={() => {
              localStorage.removeItem(`chart_drawings_${symbol.replace('/', '')}`);
              setActiveTool('none');
              // Force reload signal via a random key change is handled inside ChartDrawingLayer
              window.dispatchEvent(new CustomEvent('clearDrawings', { detail: { symbol } }));
            }}
            className="p-1.5 rounded text-[#5e6673] hover:text-[#f6465d] hover:bg-[#f6465d]/10 transition-colors"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        </div>

        {/* Action Icons (Right) */}
        <div className="flex items-center gap-3.5 text-gray-400">
          <button type="button" className="hover:text-[#1e2329] transition-colors cursor-pointer" title="Grid Settings" onClick={(e) => e.preventDefault()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="3" y1="15" x2="21" y2="15"></line>
              <line x1="9" y1="3" x2="9" y2="21"></line>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </button>
          <button type="button" className="hover:text-[#1e2329] transition-colors cursor-pointer" title="Take Screenshot" onClick={(e) => e.preventDefault()}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
              <circle cx="12" cy="13" r="4"></circle>
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex-1 w-full overflow-hidden">
      
      {/* Horizontal OHLC Data Strip (Dark Version) */}
      {crosshairData && crosshairData.x !== undefined && (
        <div className="absolute top-2 left-4 z-20 flex items-center gap-3 font-mono text-[11px] pointer-events-none select-none bg-transparent drop-shadow-md">
          <span className="text-white font-bold tracking-widest whitespace-nowrap">
            {(typeof crosshairData.time === 'number') 
              ? new Date(crosshairData.time * 1000).toLocaleDateString('en-CA').replace(/-/g, '/') 
              : String(crosshairData.time)}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Open:</span>
            <span className={`font-bold ${crosshairData.close >= crosshairData.open ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{crosshairData.open.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">High:</span>
            <span className={`font-bold ${crosshairData.close >= crosshairData.open ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{crosshairData.high.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Low:</span>
            <span className={`font-bold ${crosshairData.close >= crosshairData.open ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{crosshairData.low.toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-400">Close:</span>
            <span className={`font-bold ${crosshairData.close >= crosshairData.open ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>{crosshairData.close.toFixed(2)}</span>
          </div>

          <div className="w-px h-3 bg-white/20 mx-1"></div>

          {/* Dynamic Sub Indicators UI Map */}
          {subIndicators.includes('MACD') && crosshairData.macd && (
             <div className="flex items-center gap-1">
               <span className="text-gray-400">MACD(12,26,9):</span>
               <span className={`font-bold ${crosshairData.macd.MACD >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                 {crosshairData.macd.MACD.toFixed(2)}
               </span>
             </div>
          )}
          {subIndicators.includes('RSI') && crosshairData.rsi && (
             <div className="flex items-center gap-1">
               <span className="text-gray-400">RSI(14):</span>
               <span className={`font-bold ${crosshairData.rsi >= 70 ? 'text-[#f6465d]' : crosshairData.rsi <= 30 ? 'text-[#0ecb81]' : 'text-[#fcd535]'}`}>
                 {crosshairData.rsi.toFixed(2)}
               </span>
             </div>
          )}
          {subIndicators.includes('ATR') && crosshairData.atr && (
             <div className="flex items-center gap-1">
               <span className="text-gray-400">ATR(14):</span>
               <span className="font-bold text-[#848e9c]">
                 {crosshairData.atr.toFixed(2)}
               </span>
             </div>
          )}
          {subIndicators.includes('VOL') && crosshairData.volume !== undefined && (
             <div className="flex items-center gap-1">
               <span className="text-gray-400">VOL:</span>
               <span className="font-bold text-[#fcd535]">
                 {(crosshairData.volume).toLocaleString(undefined, { maximumFractionDigits: 2 })}
               </span>
             </div>
          )}
          {subIndicators.includes('KDJ') && crosshairData.kdj && (
             <div className="flex items-center gap-1">
               <span className="text-gray-400">KDJ(9,3,3):</span>
               <span className="font-bold text-[#fcd535]">{crosshairData.kdj.k.toFixed(2)}</span>
             </div>
          )}
          {subIndicators.includes('WR') && crosshairData.wr && (
             <div className="flex items-center gap-1">
               <span className="text-gray-400">WR(14):</span>
               <span className="font-bold text-[#f6465d]">{crosshairData.wr.toFixed(2)}</span>
             </div>
          )}
          {subIndicators.includes('OBV') && crosshairData.obv !== undefined && (
             <div className="flex items-center gap-1">
               <span className="text-gray-400">OBV:</span>
               <span className="font-bold text-[#848e9c]">{(crosshairData.obv / 1000).toFixed(1)}k</span>
             </div>
          )}
          {subIndicators.includes('StochRSI') && crosshairData.stochRsi && (
             <div className="flex items-center gap-1">
               <span className="text-gray-400">StRSI(14,14):</span>
               <span className="font-bold text-[#0ecb81]">{crosshairData.stochRsi.stochRSI.toFixed(2)}</span>
             </div>
          )}
        </div>
      )}

      {/* Watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-10">
        <span className="text-[80px] md:text-[120px] font-black text-white/[0.03] tracking-[0.2em] transform -translate-y-4">MOBEEN</span>
      </div>

      {/* Live Candle Countdown Overlay (pinned to right axis) */}
      {candleCountdown && (
        <div className="absolute right-[56px] bottom-[30px] z-20 pointer-events-none select-none flex flex-col items-end">
          <div className="flex items-center gap-1.5 bg-[#1e2329]/90 backdrop-blur-sm border border-[#2b3139] px-2 py-1 rounded shadow-lg">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500">
              <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span className={`text-[10px] font-mono font-bold ${candleCountdown.isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {candleCountdown.text}
            </span>
          </div>
        </div>
      )}

      {/* Average Price Lines (Left Side Pills) */}
      {avgPositions.buy > 0 && (
        <div 
          className="absolute z-10 left-0 bg-[#0ecb81] text-[#0b0e11] text-[10px] font-bold font-mono px-2 py-0.5 rounded-r-full shadow-lg pointer-events-none transition-all duration-75 block flex items-center gap-1"
          style={{ top: avgPositions.buy, transform: 'translateY(-50%)' }}
        >
          <span>BUY AVG</span>
          <span>{avgPositions.buyPrice.toFixed(2)}</span>
        </div>
      )}
      {avgPositions.sell > 0 && (
        <div 
          className="absolute z-10 left-0 bg-[#f6465d] text-[#0b0e11] text-[10px] font-bold font-mono px-2 py-0.5 rounded-r-full shadow-lg pointer-events-none transition-all duration-75 block flex items-center gap-1"
          style={{ top: avgPositions.sell, transform: 'translateY(-50%)' }}
        >
          <span>SELL AVG</span>
          <span>{avgPositions.sellPrice.toFixed(2)}</span>
        </div>
      )}

      {/* Drawing Layer (canvas overlay driven by ChartDrawingLayer) */}
      <ChartDrawingLayer
        chartApi={chartRef.current}
        candleSeries={seriesRef.current}
        symbol={symbol}
        activeTool={activeTool}
        onToolChange={setActiveTool}
      />

      {/* Chart Canvas */}
      <div ref={chartContainerRef} className="w-full h-full relative z-0" />
      </div>
    </div>
  );
};


