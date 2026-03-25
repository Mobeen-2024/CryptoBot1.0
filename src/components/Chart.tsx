import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, CandlestickSeries, AreaSeries, LineSeries, UTCTimestamp, IChartApi } from 'lightweight-charts';
import { ChartDrawingLayer, DrawingTool } from './ChartDrawingLayer';
import { ChartConfig } from '../types/chart';

interface ChartProps {
  data: any[];
  symbol: string;
  chartInterval: string;
  mainIndicator?: string | null;
  subIndicators?: string[];
  trades?: any[];
  openOrders?: any[];
  config?: ChartConfig;
}

export const Chart: React.FC<ChartProps> = ({ data, symbol, chartInterval, mainIndicator, subIndicators = [], trades = [], openOrders = [], config }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<any>(null);
  const mainLineSeriesRef = useRef<any>(null);
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
  const openOrderLinesRef = useRef<Map<string, any>>(new Map());

  const [avgPositions, setAvgPositions] = useState({ buy: -100, sell: -100, buyPrice: 0, sellPrice: 0 });
  const [customBuy, setCustomBuy] = useState<string>('');
  const [customSell, setCustomSell] = useState<string>('');
  const [activeTool, setActiveTool] = useState<DrawingTool>('none');
  const [showAvgLines, setShowAvgLines] = useState(false);
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
    priceY: number;
    price: number;
  } | null>(null);

  const [htmlMarkers, setHtmlMarkers] = useState<any[]>([]);
  const htmlMarkersRef = useRef<any[]>([]);

  const [visibleHighLow, setVisibleHighLow] = useState<{ high: any, low: any } | null>(null);
  const visibleHighLowRef = useRef<{ high: any, low: any } | null>(null);
  const dataRef = useRef<any[]>(data);

  useEffect(() => { dataRef.current = data; }, [data]);

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

  const getContrastColor = (hexcolor: string) => {
    // If it's rgba, assume dark for now or parse it. But we moved to hex.
    if (!hexcolor.startsWith('#')) return '#848e9c';
    const r = parseInt(hexcolor.slice(1, 3), 16);
    const g = parseInt(hexcolor.slice(3, 5), 16);
    const b = parseInt(hexcolor.slice(5, 7), 16);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#181a20' : '#848e9c';
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
        background: { 
          type: ColorType.Solid, 
          color: config?.global.background || '#0b1622', 
        },
        textColor: getContrastColor(config?.global.background || '#0b1622'),
      },
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
      grid: {
        vertLines: { color: config?.global.gridLines || 'rgba(255, 255, 255, 0.03)', style: 0, visible: true }, 
        horzLines: { color: config?.global.gridLines || 'rgba(255, 255, 255, 0.03)', style: 0, visible: true },
      },
      crosshair: {
        mode: 1, // CrosshairMode.Normal allows free horizontal tracking
        horzLine: {
          color: '#ffffff',
          labelBackgroundColor: '#2962FF', // Vivid accent for crosshair value
          labelVisible: true,
          style: 3, // Dotted
        },
        vertLine: {
          color: getContrastColor(config?.global.background || '#0b1622'),
          labelBackgroundColor: '#2962FF', // Vivid accent for time
          labelVisible: true, 
          style: 3, // Dotted
        },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
        borderColor: 'rgba(255, 255, 255, 0.05)', // Extremely subtle border
        rightOffset: 10,
      },
      localization: {
        timeFormatter: (businessDayOrTimestamp: any) => {
          try {
            if (typeof businessDayOrTimestamp === 'number') {
              const date = new Date(businessDayOrTimestamp * 1000);
              return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')} ${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
            }
            if (businessDayOrTimestamp && typeof businessDayOrTimestamp === 'object' && 'year' in businessDayOrTimestamp) {
              const { year, month, day } = businessDayOrTimestamp;
              return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            }
            return String(businessDayOrTimestamp);
          } catch (e) {
            return '';
          }
        },
      },
      rightPriceScale: {
        borderColor: 'rgba(255, 255, 255, 0.05)',
      },
    });

    chartRef.current = chart;

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: config?.candle.bull.style === 'solid' ? config.candle.bull.color : 'rgba(0,0,0,0)', 
      downColor: config?.candle.bear.style === 'solid' ? config.candle.bear.color : 'rgba(0,0,0,0)', 
      borderVisible: true, 
      wickVisible: true,
      borderColor: '#333',
      borderUpColor: config?.candle.bull.color || '#00E676',
      borderDownColor: config?.candle.bear.color || '#FF1744',
      wickUpColor: config?.candle.bull.color || '#00E676', 
      wickDownColor: config?.candle.bear.color || '#FF1744',
      lastValueVisible: false, 
      priceLineVisible: true, 
      visible: config?.style !== 'line',
    });

    seriesRef.current = candlestickSeries;
    candlestickSeries.setData(data);

    // Main Line Series (Price Line mode)
    const mainLineSeries = chart.addSeries(LineSeries, {
      color: config?.line.color || '#fcd535',
      lineWidth: config?.line.width || 2,
      crosshairMarkerVisible: true,
      lastValueVisible: false,
      priceLineVisible: true,
      visible: config?.style === 'line',
    });
    mainLineSeriesRef.current = mainLineSeries;
    mainLineSeries.setData(data.map((d: any) => ({ time: d.time, value: d.close })));

    // Dummy markers removed. Will be set by trades useEffect.

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
      color: '#00E676',
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
          lineColor: trend === 1 ? '#00E676' : '#FF1744',
          topColor: trend === 1 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 23, 68, 0.2)',
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
        color: '#00E676',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: false, // We will draw our own on the left
      });

      sellLineRef.current = candlestickSeries.createPriceLine({
        price: mockSellPrice,
        color: '#FF1744',
        lineWidth: 1,
        lineStyle: 2, // Dashed
        axisLabelVisible: false, // We will draw our own on the left
      });

      setAvgPositions(prev => ({ ...prev, buyPrice: mockBuyPrice, sellPrice: mockSellPrice }));
    }

    // Subscribe to visible range to calculate Recent High / Low
    chart.timeScale().subscribeVisibleTimeRangeChange((timeRange) => {
      if (timeRange && dataRef.current && dataRef.current.length > 0) {
        let maxItem = null;
        let minItem = null;
        for (let i = 0; i < dataRef.current.length; i++) {
          const d = dataRef.current[i];
          if (d.time >= timeRange.from && d.time <= timeRange.to) {
            if (!maxItem || d.high > maxItem.high) maxItem = d;
            if (!minItem || d.low < minItem.low) minItem = d;
          }
          if (d.time > timeRange.to) break;
        }
        if (maxItem && minItem) {
          const nextState = { high: maxItem, low: minItem };
          visibleHighLowRef.current = nextState;
          setVisibleHighLow(prev => {
            if (prev?.high.time !== nextState.high.time || prev?.low.time !== nextState.low.time) {
              return nextState;
            }
            return prev;
          });
        }
      }
    });

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

    let animationFrameId: number;
    const syncPills = () => {
      // Sync Price Average Lines
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

      // Sync High/Low Markers
      if (seriesRef.current && chartRef.current && visibleHighLowRef.current) {
        const timeScale = chartRef.current.timeScale();
        const { high, low } = visibleHighLowRef.current;
        const series = seriesRef.current;
        
        const topEl = document.getElementById('recent-top-marker');
        if (topEl && high) {
           const x = timeScale.timeToCoordinate(high.time);
           const y = series.priceToCoordinate(high.high);
           if (x !== null && y !== null) {
              topEl.style.transform = `translate(${x}px, ${y}px)`;
              topEl.style.opacity = '1';
           } else { topEl.style.opacity = '0'; }
        }
        
        const bottomEl = document.getElementById('recent-bottom-marker');
        if (bottomEl && low) {
           const x = timeScale.timeToCoordinate(low.time);
           const y = series.priceToCoordinate(low.low); // Pinned to the Low as requested
           if (x !== null && y !== null) {
              bottomEl.style.transform = `translate(${x}px, ${y}px)`;
              bottomEl.style.opacity = '1';
           } else { bottomEl.style.opacity = '0'; }
        }
      }

      // Sync HTML Trade Markers
      if (seriesRef.current && chartRef.current && htmlMarkersRef.current.length > 0) {
        const timeScale = chartRef.current.timeScale();
        const series = seriesRef.current;
        
        htmlMarkersRef.current.forEach(m => {
          const el = document.getElementById(`trade-marker-${m.id}`);
          if (el) {
            const x = timeScale.timeToCoordinate(m.time);
            // Buy marker goes below the candle Low, Sell marker goes above the High
            const y = series.priceToCoordinate(m.isBuy ? m.low : m.high);

            if (x !== null && y !== null) {
              const xPos = x - 10; // Center the 20px wide marker
              
              // Anchor logic (CRITICAL for pixel perfect alignment):
              // The main container div is `w-5 h-5` (20x20px).
              // The `y` coordinate is the Exact Pixel of the Candle Wick (High or Low).
              
              // BUY MARKER (Placed Below):
              // - The top of the CSS triangle pointer is geometrically at `-5px` from the top of the container.
              // - To make the pointer tip exactly touch `y`, we must translate the container's top boundary `+5px` DOWN away from `y`.
              // - Therefore: yPos = y + 5
              
              // SELL MARKER (Placed Above):
              // - The bottom of the CSS triangle pointer is geometrically at `+25px` from the top of the container (20px body + 5px pointer).
              // - To make the pointer tip exactly touch `y`, we must translate the container's top boundary `-25px` UP away from `y`.
              // - Therefore: yPos = y - 25
              
              const yPos = m.isBuy ? y + 5 : y - 25;

              el.style.transform = `translate(${xPos}px, ${yPos}px)`;
              el.style.opacity = '1';
              // Pointer events block scroll/zoom, so we use pointer-events-none inside the container anyway
            } else {
              el.style.opacity = '0';
            }
          }
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
            lineColor: trend === 1 ? '#00E676' : '#FF1744',
            topColor: trend === 1 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 23, 68, 0.2)',
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
            lineColor: trend === 1 ? '#00E676' : '#FF1744',
            topColor: trend === 1 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 23, 68, 0.2)',
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
            const hours = Math.floor(remaining / (60 * 60 * 1000));
            const formattedTime = hours > 0
              ? `${String(hours).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
              : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            // Compute Y position of current price on chart
            let priceY = -100;
            const closePrice = parseFloat(kline.c);
            if (seriesRef.current && chartRef.current) {
              try {
                const coord = seriesRef.current.priceToCoordinate(closePrice);
                if (coord !== null && coord !== undefined) priceY = coord;
              } catch(e) {}
            }

            setCandleCountdown({
              text: formattedTime,
              isUp: closePrice >= parseFloat(kline.o),
              priceY,
              price: closePrice,
            });
          }, 1000);
        } else {
          // Update direction & position on each tick
          const closePrice = parseFloat(kline.c);
          let priceY = -100;
          if (seriesRef.current && chartRef.current) {
            try {
              const coord = seriesRef.current.priceToCoordinate(closePrice);
              if (coord !== null && coord !== undefined) priceY = coord;
            } catch(e) {}
          }
          setCandleCountdown(prev => prev ? { ...prev, isUp: closePrice >= parseFloat(kline.o), priceY, price: closePrice } : null);
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

  // Handle Dynamic style config changes
  useEffect(() => {
    if (!chartRef.current) return;
    
    const isCandle = config?.style === 'candle';
    
    // 1. Global Updates
    const textColor = getContrastColor(config?.global.background || '#0b1622');
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: config?.global.background || '#0b1622' },
        textColor: textColor
      },
      grid: {
        vertLines: { color: config?.global.gridLines || 'rgba(255, 255, 255, 0.03)' },
        horzLines: { color: config?.global.gridLines || 'rgba(255, 255, 255, 0.03)' }
      },
      crosshair: {
        horzLine: { color: textColor },
        vertLine: { color: textColor }
      }
    });

    // 2. Series Visibility
    if (seriesRef.current) seriesRef.current.applyOptions({ visible: isCandle });
    if (mainLineSeriesRef.current) mainLineSeriesRef.current.applyOptions({ visible: !isCandle });

    // 3. Candle Styles
    if (seriesRef.current && config) {
      seriesRef.current.applyOptions({
        upColor: config.candle.bull.style === 'solid' ? config.candle.bull.color : 'rgba(0,0,0,0)',
        downColor: config.candle.bear.style === 'solid' ? config.candle.bear.color : 'rgba(0,0,0,0)',
        borderUpColor: config.candle.bull.color,
        borderDownColor: config.candle.bear.color,
        wickUpColor: config.candle.bull.color,
        wickDownColor: config.candle.bear.color,
      });
    }

    // 4. Line Styles
    if (mainLineSeriesRef.current && config) {
      mainLineSeriesRef.current.applyOptions({
        color: config.line.color,
        lineWidth: config.line.width,
      });
    }
  }, [config]);

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
            lineColor: trend === 1 ? '#00E676' : '#FF1744',
            topColor: trend === 1 ? 'rgba(0, 230, 118, 0.2)' : 'rgba(255, 23, 68, 0.2)',
            bottomColor: 'rgba(0, 0, 0, 0)',
          };
        });
        stDataRef.current = stData;
        supertrendSeriesRef.current.setData(stData);
      }

      if (mainLineSeriesRef.current) {
        mainLineSeriesRef.current.setData(data.map((d: any) => ({ time: d.time, value: d.close })));
      }

      // Price lines are now only created when showAvgLines is toggled on (see effect below)
      const currentPr = data[data.length - 1].close;
      setAvgPositions(prev => ({ ...prev, buyPrice: prev.buyPrice || currentPr * 0.99, sellPrice: prev.sellPrice || currentPr * 1.01 }));
    }
  }, [data]);

  // Create / remove price lines when toggle or prices change
  useEffect(() => {
    if (!seriesRef.current) return;

    if (showAvgLines) {
      const buyP = customBuy ? parseFloat(customBuy) : avgPositions.buyPrice;
      const sellP = customSell ? parseFloat(customSell) : avgPositions.sellPrice;

      if (!buyLineRef.current && buyP > 0) {
        buyLineRef.current = seriesRef.current.createPriceLine({
          price: buyP, color: '#00E676', lineWidth: 1, lineStyle: 2, axisLabelVisible: false,
        });
      } else if (buyLineRef.current && buyP > 0) {
        buyLineRef.current.applyOptions({ price: buyP });
      }

      if (!sellLineRef.current && sellP > 0) {
        sellLineRef.current = seriesRef.current.createPriceLine({
          price: sellP, color: '#FF1744', lineWidth: 1, lineStyle: 2, axisLabelVisible: false,
        });
      } else if (sellLineRef.current && sellP > 0) {
        sellLineRef.current.applyOptions({ price: sellP });
      }

      if (buyP > 0) setAvgPositions(prev => ({ ...prev, buyPrice: buyP }));
      if (sellP > 0) setAvgPositions(prev => ({ ...prev, sellPrice: sellP }));
    } else {
      // Remove lines when toggled off
      if (buyLineRef.current && seriesRef.current) {
        seriesRef.current.removePriceLine(buyLineRef.current);
        buyLineRef.current = null;
      }
      if (sellLineRef.current && seriesRef.current) {
        seriesRef.current.removePriceLine(sellLineRef.current);
        sellLineRef.current = null;
      }
    }
  }, [showAvgLines, customBuy, customSell, avgPositions.buyPrice, avgPositions.sellPrice]);

  // Calculate custom HTML markers
  useEffect(() => {
    if (!data || data.length === 0 || !trades || trades.length === 0) return;

    const uniqueMap = new Map();

    trades.forEach((trade) => {
      const tradeTimeSec = Math.floor(trade.timestamp / 1000);
      let closestBar = null;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i].time <= tradeTimeSec) {
          closestBar = data[i];
          break;
        }
      }

      if (closestBar) {
        const sideCln = trade.side?.trim().toUpperCase();
        if (sideCln !== 'BUY' && sideCln !== 'SELL') return; // Ensure we only map valid trades
        
        const isBuy = sideCln === 'BUY';
        const timeKey = `${String(closestBar.time)}_${isBuy ? 'BUY' : 'SELL'}`;
        
        const tradeDetail = {
          id: trade.master_trade_id,
          type: sideCln,
          price: trade.price,
          quantity: trade.quantity,
          total: trade.price * trade.quantity,
          fee: (trade.price * trade.quantity * 0.001) // mock 0.1% fee if absent
        };

        if (uniqueMap.has(timeKey)) {
          const ex = uniqueMap.get(timeKey);
          ex.trades.push(tradeDetail);
        } else {
          uniqueMap.set(timeKey, {
            id: `${trade.master_trade_id}_${trade.timestamp}_${sideCln}`,
            time: closestBar.time,
            isBuy: isBuy,
            high: closestBar.high,
            low: closestBar.low,
            text: isBuy ? 'B' : 'S',
            trades: [tradeDetail]
          });
        }
      }
    });

    const finalHtmlMarkers = Array.from(uniqueMap.values());
    htmlMarkersRef.current = finalHtmlMarkers;
    setHtmlMarkers(finalHtmlMarkers);

    // Ensure we unmount native markers if they existed
    if (seriesRef.current) {
      try { seriesRef.current.setMarkers([]); } catch(e) {}
    }
  }, [data, trades]);

  // Sync Open Orders to Price Lines
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const currentLineMap = openOrderLinesRef.current;
    const activeIds = new Set<string>();

    openOrders.forEach(order => {
      // Handle OCO orders having two targets: limitPrice and stopPrice
      if (order.type === 'oco') {
        const createLine = (price: number, label: string) => {
           const lineId = `${order.id}-${label}`;
           activeIds.add(lineId);
           if (!currentLineMap.has(lineId)) {
             const isBuy = order.side === 'buy';
             // For OCO: TP is limitPrice and SL is stopPrice. Direction flips based on side.
             const styleColor = (isBuy && label.includes('Buy')) || (!isBuy && label.includes('Profit')) ? '#00E676' : '#FF1744';

             const line = series.createPriceLine({
               price: price,
               color: styleColor,
               lineWidth: 2,
               lineStyle: 1, // Dotted
               axisLabelVisible: true,
               title: label,
             });
             currentLineMap.set(lineId, line);
           }
        };

        if (order.limitPrice) createLine(order.limitPrice, order.side === 'buy' ? 'Limit Buy' : 'Take Profit');
        if (order.stopPrice) createLine(order.stopPrice, order.side === 'buy' ? 'Stop Buy' : 'Stop Loss');

      } else {
        // Standard Limit / Stop Orders
        const targetPrice = order.limitPrice || order.stopPrice;
        if (targetPrice) {
          activeIds.add(order.id);
          if (!currentLineMap.has(order.id)) {
            const isBuy = order.side === 'buy';
            let labelTitle = isBuy ? 'Limit Buy' : 'Limit Sell';
            if (order.type.includes('stop')) labelTitle = isBuy ? 'Stop Buy' : 'Stop Sell';
            if (order.type.includes('take_profit')) labelTitle = 'Take Profit';

            const line = series.createPriceLine({
              price: targetPrice,
              color: isBuy ? '#00E676' : '#FF1744',
              lineWidth: 2,
              lineStyle: 1, // Dotted
              axisLabelVisible: true,
              title: labelTitle,
            });
            currentLineMap.set(order.id, line);
          }
        }
      }
    });

    // Remove filled or cancelled orders
    currentLineMap.forEach((line, key) => {
      if (!activeIds.has(key)) {
        try { series.removePriceLine(line); } catch (e) {}
        currentLineMap.delete(key);
      }
    });

  }, [openOrders, seriesRef.current]);

  return (
    <div className="flex flex-col w-full h-full bg-[#07090b] rounded-2xl overflow-hidden border border-white/5 relative z-0 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-3xl group/chart">
      
      {/* 2050 Gradient Overlay Glow */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover/chart:opacity-100 transition-opacity duration-1000" />
      
      {/* ═══════════════ CHART TOOLBAR ═══════════════ */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 border-b border-white/[0.03] bg-gradient-to-b from-white/[0.03] to-transparent relative z-10">

        {/* Avg Price Toggle + Inputs */}
        <div className="hidden md:flex items-center gap-3">
          <label className="flex items-center gap-2 cursor-pointer group select-none">
            <div className="relative">
              <input
                type="checkbox"
                checked={showAvgLines}
                onChange={e => setShowAvgLines(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-white/5 border border-white/10 rounded-full peer-checked:bg-[#2962FF]/20 peer-checked:border-[#2962FF]/50 transition-colors shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" />
              <div className="absolute top-[3px] left-[3px] w-[10px] h-[10px] bg-[#848e9c] rounded-full peer-checked:translate-x-4 peer-checked:bg-[#2962FF] peer-checked:shadow-[0_0_10px_rgba(41,98,255,0.8)] transition-all" />
            </div>
            <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-[#848e9c] group-hover:text-white transition-colors">Avg</span>
          </label>
          {showAvgLines && (
            <div className="flex items-center gap-2 animate-in slide-in-from-left-2 fade-in duration-300">
              <div className="flex items-center gap-2 bg-[#00E676]/5 border border-[#00E676]/20 shadow-[0_0_15px_rgba(0,230,118,0.05)_inset] rounded-lg px-2.5 py-1.5 focus-within:border-[#00E676]/50 focus-within:shadow-[0_0_20px_rgba(0,230,118,0.15)_inset] transition-all">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00E676] shadow-[0_0_8px_#00E676]" />
                <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-[#00E676]/80 flex-shrink-0">Buy</span>
                <input 
                  type="number" 
                  placeholder="—" 
                  className="bg-transparent w-[65px] outline-none text-[11px] text-[#00E676] font-mono font-bold placeholder:text-[#00E676]/30 text-right selection:bg-[#00E676]/30" 
                  value={customBuy} 
                  onChange={e => setCustomBuy(e.target.value)} 
                />
              </div>
              <div className="flex items-center gap-2 bg-[#FF1744]/5 border border-[#FF1744]/20 shadow-[0_0_15px_rgba(255,23,68,0.05)_inset] rounded-lg px-2.5 py-1.5 focus-within:border-[#FF1744]/50 focus-within:shadow-[0_0_20px_rgba(255,23,68,0.15)_inset] transition-all">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF1744] shadow-[0_0_8px_#FF1744]" />
                <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-[#FF1744]/80 flex-shrink-0">Sell</span>
                <input 
                  type="number" 
                  placeholder="—" 
                  className="bg-transparent w-[65px] outline-none text-[11px] text-[#FF1744] font-mono font-bold placeholder:text-[#FF1744]/30 text-right selection:bg-[#FF1744]/30" 
                  value={customSell} 
                  onChange={e => setCustomSell(e.target.value)} 
                />
              </div>
            </div>
          )}
        </div>

        {/* Center: Drawing Tools */}
        <div className="hidden md:flex items-center gap-1 bg-white/[0.02] border border-white/[0.05] shadow-[0_4px_24px_rgba(0,0,0,0.2)] rounded-xl p-1 backdrop-blur-md">
          {([
            { id: 'none',       icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5', title: 'Select',          color: '#ffffff' },
            { id: 'trendline',  icon: 'M5 19L19 5M9 19l-4-4M5 15l4-4',      title: 'Trendline',       color: '#fcd535' },
            { id: 'horizontal', icon: 'M5 12h14',                             title: 'Support/Resist',  color: '#00E676' },
            { id: 'annotation', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z', title: 'Note', color: '#2962FF' },
          ] as { id: DrawingTool; icon: string; title: string; color: string }[]).map(tool => (
            <button
              key={tool.id}
              title={tool.title}
              onClick={() => setActiveTool(prev => prev === tool.id ? 'none' : tool.id as DrawingTool)}
              className={`p-1.5 sm:p-2 rounded-lg transition-all duration-300 relative group/btn ${
                activeTool === tool.id
                  ? 'bg-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'hover:bg-white/5'
              }`}
            >
              {activeTool === tool.id && (
                <div className="absolute inset-0 rounded-lg shadow-[0_0_12px_currentColor] opacity-30" style={{ color: tool.color }} />
              )}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={activeTool === tool.id ? tool.color : '#848e9c'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="relative z-10 transition-colors group-hover/btn:drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                <path d={tool.icon}/>
              </svg>
            </button>
          ))}
          <div className="w-px h-4 bg-white/10 mx-1"/>
          <button
            title="Clear all drawings"
            onClick={() => {
              localStorage.removeItem(`chart_drawings_${symbol.replace('/', '')}`);
              setActiveTool('none');
              window.dispatchEvent(new CustomEvent('clearDrawings', { detail: { symbol } }));
            }}
            className="p-1.5 sm:p-2 rounded-lg text-[#848e9c] hover:text-[#FF1744] hover:bg-[#FF1744]/10 transition-all duration-300 group/clear"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="group-hover/clear:drop-shadow-[0_0_8px_#FF1744]">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            </svg>
          </button>
        </div>

        {/* Right: Utility Actions */}
        <div className="flex items-center gap-1.5">
          <button type="button" className="p-2 rounded-lg text-[#848e9c] hover:text-white hover:bg-white/5 transition-all duration-300" title="Grid Settings" onClick={(e) => e.preventDefault()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/>
            </svg>
          </button>
          <button type="button" className="p-2 rounded-lg text-[#848e9c] hover:text-white hover:bg-white/5 transition-all duration-300" title="Screenshot" onClick={(e) => e.preventDefault()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ═══════════════ CHART AREA ═══════════════ */}
      <div className="relative flex-1 w-full overflow-hidden">
        
        {/* Recent High/Low Markers Overlay Layer */}
        {visibleHighLow && (
          <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden">
            {/* Top Marker */}
            <div
              id="recent-top-marker"
              className="absolute top-0 left-0 flex flex-col items-center opacity-0 will-change-transform"
              style={{ transition: 'opacity 0.15s ease' }}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-[6px] flex flex-col items-center">
                <div className="px-1.5 py-0.5 rounded backdrop-blur-md bg-[#00E676]/10 border border-[#00E676]/40 shadow-[0_2px_8px_rgba(0,230,118,0.2)] flex items-center gap-1">
                  <span className="text-[10px] font-mono font-black text-[#00E676] tracking-tighter">
                    {visibleHighLow.high.high.toFixed(2)}
                  </span>
                </div>
                {/* Connecting Line */}
                <div className="w-px h-[6px] bg-gradient-to-b from-[#00E676]/60 to-[#00E676]/0" />
              </div>
            </div>

            {/* Bottom Marker */}
            <div
              id="recent-bottom-marker"
              className="absolute top-0 left-0 flex flex-col items-center opacity-0 will-change-transform"
              style={{ transition: 'opacity 0.15s ease' }}
            >
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-[6px] flex flex-col items-center">
                {/* Connecting Line */}
                <div className="w-px h-[6px] bg-gradient-to-t from-[#FF1744]/60 to-[#FF1744]/0" />
                <div className="px-1.5 py-0.5 rounded backdrop-blur-md bg-[#FF1744]/10 border border-[#FF1744]/40 shadow-[0_2px_8px_rgba(255,23,68,0.2)] flex items-center gap-1">
                  <span className="text-[10px] font-mono font-black text-[#FF1744] tracking-tighter">
                    {visibleHighLow.low.low.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* HTML Markers Overlay Layer */}
        <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
          {htmlMarkers.map((m) => (
            <div
              key={m.id}
              id={`trade-marker-${m.id}`}
              className="absolute top-0 left-0 w-5 h-5 flex justify-center items-center opacity-0 will-change-transform font-mono font-bold text-[10px] text-white pointer-events-auto group drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
              style={{ transition: 'opacity 0.15s ease' }}
            >
              {/* Sci-Fi Radar Ping Effect */}
              <div className={`absolute -inset-1 rounded-full animate-ping opacity-20 ${
                m.isBuy ? 'bg-[#00E676]' : 'bg-[#FF1744]'
              }`} style={{ animationDuration: '2s' }} />

              {/* Pointer Triangles */}
              {m.isBuy ? (
                <div className="absolute left-1/2 -top-[5px] -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-[#00E676] z-0" />
              ) : (
                <div className="absolute left-1/2 -bottom-[5px] -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-[#FF1744] z-0" />
              )}

              {/* Main Rounded Box Backend */}
              <div 
                className={`absolute inset-0 border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] backdrop-blur-2xl flex justify-center items-center z-10 transition-transform duration-300 group-hover:scale-110 ${
                  m.isBuy 
                    ? 'bg-gradient-to-br from-[#00E676] to-[#008f4c] rounded-md'
                    : 'bg-gradient-to-br from-[#FF1744] to-[#b30026] rounded-md'
                }`}
              >
                <div className="relative w-full h-full flex justify-center items-center">
                  {/* Core Letter */}
                  <span className="relative z-20 text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] text-[10px] font-black tracking-tighter">
                    {m.text}
                  </span>
                  
                  {/* Cyberpunk Core Highlight */}
                  <div className="absolute inset-[20%] bg-[radial-gradient(circle,rgba(255,255,255,0.6)_0%,transparent_70%)] mix-blend-overlay rounded-full blur-[1px] pointer-events-none z-10" />
                </div>
              </div>

              {/* Modern Tooltip Box (Rendered exactly adjacent) */}
              <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[100] w-64 max-h-[300px] overflow-y-auto custom-scrollbar">
                <div className="relative rounded-lg border border-white/20 bg-black/80 backdrop-blur-3xl p-3 shadow-[0_10px_30px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.1)] flex flex-col gap-2">
                  <div className="text-[11px] font-black text-white/50 border-b border-white/10 pb-1.5 uppercase tracking-widest">
                    {new Date(m.time * 1000).toLocaleString()}
                  </div>
                  {m.trades.map((t, idx) => (
                    <div key={idx} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className={t.type === 'BUY' ? 'text-[#00E676]' : 'text-[#FF1744]'}>{t.type} @ {Number(t.price).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-white/40">Amount</span>
                        <span className="text-white">{Number(t.quantity).toFixed(4)} <span className="text-white/40">{symbol.replace('USDT','')}</span></span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-white/40">Total</span>
                        <span className="text-white font-bold">{Number(t.total).toFixed(2)} <span className="text-white/40">USDT</span></span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-white/40">Fee</span>
                        <span className="text-white/60">{Number(t.fee).toFixed(4)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

      {/* ── OHLC Floating Hover HUD ──────────────────────────── */}
      {crosshairData && crosshairData.x !== undefined && (
        <div 
          className="absolute z-20 pointer-events-none select-none"
          style={{
            left: `${crosshairData.x > 150 ? crosshairData.x - 125 : crosshairData.x + 15}px`,
            top: `${Math.max(10, (seriesRef.current?.priceToCoordinate(crosshairData.high) || crosshairData.y) - 10)}px`,
          }}
        >
          {/* Cyberpunk Floating Card */}
          <div className="flex flex-col gap-1.5 bg-[#0b1622]/95 backdrop-blur-2xl rounded-lg p-2.5 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] w-[115px]">
            {/* Header / Date */}
            <div className="text-white/60 text-[9px] font-black tracking-widest uppercase border-b border-white/10 pb-1.5 mb-0.5 text-center">
              {(typeof crosshairData.time === 'number') 
                ? new Date(crosshairData.time * 1000).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace(',', '')
                : String(crosshairData.time)}
            </div>

            {/* OHLC Values */}
            {(['open', 'high', 'low', 'close'] as const).map((key) => {
              const val = crosshairData[key];
              const isUp = crosshairData.close >= crosshairData.open;
              const colorClass = isUp ? 'text-[#00E676] drop-shadow-[0_0_4px_rgba(0,230,118,0.4)]' : 'text-[#FF1744] drop-shadow-[0_0_4px_rgba(255,23,68,0.4)]';
              
              return (
                <div key={key} className="flex justify-between items-center text-[10px] font-mono leading-tight">
                  <span className="text-[#848e9c] font-bold tracking-wider capitalize">{key}</span>
                  <span className={`font-black ${key === 'close' ? colorClass : 'text-white'}`}>
                    {val.toFixed(2)}
                  </span>
                </div>
              );
            })}

            {/* Volume */}
            {crosshairData.volume !== undefined && (
               <div className="flex justify-between items-center text-[10px] font-mono leading-tight border-t border-white/5 pt-1.5 mt-0.5">
                 <span className="text-[#848e9c] font-bold tracking-wider capitalize">Vol</span>
                 <span className="font-bold text-[#fcd535]">{crosshairData.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
               </div>
            )}
            
            {/* Optional Sub-Indicators (if active and data exists) */}
            {subIndicators.includes('MACD') && crosshairData.macd && (
              <div className="flex justify-between items-center text-[10px] font-mono leading-tight pt-0.5">
                <span className="text-[#848e9c] font-bold tracking-wider">MACD</span>
                <span className={`font-bold ${crosshairData.macd.MACD >= 0 ? 'text-[#00E676]' : 'text-[#FF1744]'}`}>{crosshairData.macd.MACD.toFixed(2)}</span>
              </div>
            )}
            {subIndicators.includes('RSI') && crosshairData.rsi && (
              <div className="flex justify-between items-center text-[10px] font-mono leading-tight pt-0.5">
                <span className="text-[#848e9c] font-bold tracking-wider">RSI</span>
                <span className={`font-bold ${crosshairData.rsi >= 70 ? 'text-[#FF1744]' : crosshairData.rsi <= 30 ? 'text-[#00E676]' : 'text-[#fcd535]'}`}>{crosshairData.rsi.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Brand Watermark 2050 ─────────────────────────────── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-[1]">
        <div className="flex flex-col items-center gap-2">
          <span className="text-[72px] md:text-[110px] font-black tracking-[0.4em] uppercase bg-clip-text text-transparent bg-gradient-to-b from-white/[0.04] to-transparent">MOBEEN</span>
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-gradient-to-r from-transparent to-white/10" />
            <span className="text-[10px] md:text-[12px] font-bold text-white/[0.08] tracking-[0.8em] uppercase">CryptoBot Terminal</span>
            <div className="h-px w-8 bg-gradient-to-l from-transparent to-white/10" />
          </div>
        </div>
      </div>

      {/* ── Live Candle Countdown (attached to current price on right axis) ── */}
      {candleCountdown && candleCountdown.priceY > 0 && (
        <div 
          className="absolute right-[1px] z-20 pointer-events-none select-none transition-all duration-100 ease-out"
          style={{ top: candleCountdown.priceY, transform: 'translateY(-50%)' }}
        >
          {/* Price + Timer combined label with glassmorphism stack */}
          <div className={`flex flex-col items-end rounded-l-md overflow-hidden backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-r-0 ${candleCountdown.isUp ? 'bg-[#00E676]/15 border-[#00E676]/30 shadow-[#00E676]/20' : 'bg-[#FF1744]/15 border-[#FF1744]/30 shadow-[#FF1744]/20'}`}>
            
            {/* Price section */}
            <div className={`px-2 py-[2px] w-full text-right ${candleCountdown.isUp ? 'text-[#00E676]' : 'text-[#FF1744]'}`}>
              <span className="text-[10px] font-mono font-black tracking-widest drop-shadow-[0_0_8px_currentColor]">
                {candleCountdown.price.toFixed(2)}
              </span>
            </div>

            {/* Timer section with separator */}
            <div className={`flex items-center gap-1 px-2 py-[2px] w-full justify-end border-t ${candleCountdown.isUp ? 'border-[#00E676]/20 bg-[#00E676]/5' : 'border-[#FF1744]/20 bg-[#FF1744]/5'}`}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={candleCountdown.isUp ? '#00E676' : '#FF1744'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-90 drop-shadow-[0_0_4px_currentColor]">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span className={`text-[9px] font-mono font-bold tracking-widest drop-shadow-[0_0_4px_currentColor] ${candleCountdown.isUp ? 'text-[#00E676]' : 'text-[#FF1744]'}`}>
                {candleCountdown.text}
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ── Average Price Lines (Left Side Labels) — only when toggled on ── */}
      {showAvgLines && avgPositions.buy > 0 && (
        <div 
          className="absolute z-10 left-0 flex items-center gap-1.5 bg-[#00E676]/90 text-[#07090b] text-[10px] font-bold font-mono px-3 py-[4px] rounded-r-lg shadow-[4px_0_16px_rgba(0,230,118,0.4)] pointer-events-none transition-all duration-100 backdrop-blur-sm"
          style={{ top: avgPositions.buy, transform: 'translateY(-50%)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 17l9.2-9.2M7 7h10v10"/></svg>
          <span className="tracking-widest">BUY</span>
          <span>{avgPositions.buyPrice.toFixed(2)}</span>
        </div>
      )}
      {showAvgLines && avgPositions.sell > 0 && (
        <div 
          className="absolute z-10 left-0 flex items-center gap-1.5 bg-[#FF1744]/90 text-white text-[10px] font-bold font-mono px-3 py-[4px] rounded-r-lg shadow-[4px_0_16px_rgba(255,23,68,0.4)] pointer-events-none transition-all duration-100 backdrop-blur-sm"
          style={{ top: avgPositions.sell, transform: 'translateY(-50%)' }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-9.2 9.2M17 17H7V7"/></svg>
          <span className="tracking-widest">SELL</span>
          <span>{avgPositions.sellPrice.toFixed(2)}</span>
        </div>
      )}

      {/* Drawing Layer */}
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


