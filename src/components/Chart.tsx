import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import TacticalToggle from './TacticalToggle';
import { Activity, Zap, Shield, Database, Layers, Box, TrendingUp, Network, Cpu, Info, X, Trash2, SlidersHorizontal, Target, Globe } from 'lucide-react';
import { createChart, ColorType, UTCTimestamp, IChartApi, CandlestickSeries, LineSeries, HistogramSeries, AreaSeries, createSeriesMarkers } from 'lightweight-charts';
import { ChartDrawingLayer, DrawingTool, Drawing, PositionDrawing } from './ChartDrawingLayer';
import { ChartConfig } from '../types/chart';
import { detectPatterns, Pattern as CandlestickPattern } from '../utils/candlestickPatterns';
import { analyzeMarketStructure } from '../utils/marketStructure';
import { calculateTacticalConfluence } from '../utils/tacticalConfluence';
import { ChartHUD } from './ChartHUD';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Utility for Tailwind class merging */
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Utility to normalize interval strings to Binance-canonical format
const canonicalInterval = (interval: string): string => {
  if (!interval) return '1h';
  const match = interval.match(/^(\d+)([a-zA-Z])$/);
  if (!match) return interval.toLowerCase();
  const val = match[1];
  const unit = match[2];
  if (unit === 'M') return val + 'M';
  return val + unit.toLowerCase();
};

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
  const markersPluginRef = useRef<any>(null);
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

  // Sub-Indicator Series Refs
  const volumeSeriesRef = useRef<any>(null);
  const rsiSeriesRef = useRef<any>(null);
  const macdSeriesRef = useRef<any>(null);
  const macdSignalRef = useRef<any>(null);
  const macdHistRef = useRef<any>(null);
  const atrSeriesRef = useRef<any>(null);
  const wrSeriesRef = useRef<any>(null);
  const obvSeriesRef = useRef<any>(null);
  const stochKRef = useRef<any>(null);
  const stochDRef = useRef<any>(null);
  const kdjKRef = useRef<any>(null);
  const kdjDRef = useRef<any>(null);
  const kdjJRef = useRef<any>(null);

  const openOrderLinesRef = useRef<Map<string, any>>(new Map());
  const structuralLevelsRef = useRef<Map<string, any[]>>(new Map()); // Now maps to [shell, core, wickLine, dataStatics]
  const backgroundPoolRef = useRef<any[]>([]);
  const userPositionsPoolRef = useRef<any[]>([]); // Dedicated pool for user-placed Long/Short background zones
  const trendlineSeriesRef = useRef<any[]>([]);
  const subFractalSeriesRef = useRef<any | null>(null);
  const [avgPositions, setAvgPositions] = useState({ buy: -100, sell: -100, buyPrice: 0, sellPrice: 0 });
  const [activeTool, setActiveTool] = useState<DrawingTool>('none');
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [showAvgLines, setShowAvgLines] = useState(false);
  const [showEngulfing, setShowEngulfing] = useState(false);
  const [showPatternBox, setShowPatternBox] = useState(false);
  const [showStructure, setShowStructure] = useState(false);
  const [showStructuralLevels, setShowStructuralLevels] = useState(false);
  const [showTrendlines, setShowTrendlines] = useState(false);
  const [showGoldenZone, setShowGoldenZone] = useState(false);
  const [showInternalStructure, setShowInternalStructure] = useState(false);
  const [showOrderBlocks, setShowOrderBlocks] = useState(true); // Default ON for 2100 Edition
  const [pulseTick, setPulseTick] = useState(0); // For heartbeat animations
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

  // Phase 2: Ultra 2050 Enhancements State
  const [crosshairPos, setCrosshairPos] = useState<{ x: number, y: number } | null>(null);
  const [hoveredCandleX, setHoveredCandleX] = useState<number | null>(null);

  // Phase 1: Tactical HUD State
  const [hudData, setHudData] = useState<{
    trend: 'BULLISH' | 'BEARISH';
    lastAction: 'CHoCH' | 'BOS' | 'NONE';
    nearestShield: { type: string, price: number } | null;
    nearestMagnet: { type: string, price: number } | null;
    isConfluence: boolean;
    strikeProbability?: number;
    reasoning?: string[];
    signal?: 'STRONG_BUY' | 'STRONG_SELL' | 'NEUTRAL';
    isNewsProtection?: boolean;
    adaptiveLb?: number;
    session?: string;
  }>({
    trend: 'BULLISH',
    lastAction: 'NONE',
    nearestShield: null,
    nearestMagnet: null,
    isConfluence: false,
    strikeProbability: 0,
    reasoning: [],
    signal: 'NEUTRAL',
    isNewsProtection: false,
    adaptiveLb: 5,
    session: 'ASIA'
  });

  const [isMobileMatrixOpen, setIsMobileMatrixOpen] = useState(false);

  const [htmlMarkers, setHtmlMarkers] = useState<any[]>([]);
  const htmlMarkersRef = useRef<any[]>([]);

  const [patternMarkers, setPatternMarkers] = useState<any[]>([]);
  const patternMarkersRef = useRef<any[]>([]);

  const [visibleHighLow, setVisibleHighLow] = useState<{ high: any, low: any } | null>(null);
  const visibleHighLowRef = useRef<{ high: any, low: any } | null>(null);
  const dataRef = useRef<any[]>(data);

  useEffect(() => { dataRef.current = data; }, [data]);

  // Helper to parse interval into ms
  const canonicalInterval = (interval: string): string => {
    if (!interval) return '1h';
    const match = interval.match(/^(\d+)([a-zA-Z])$/);
    if (!match) return interval.toLowerCase();
    const val = match[1];
    const unit = match[2];
    if (unit === 'M') return val + 'M';
    return val + unit.toLowerCase();
  };

  const getIntervalMs = (interval: string) => {
    const canonical = canonicalInterval(interval);
    const value = parseInt(canonical);
    const unit = canonical.slice(-1);
    switch (unit) {
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      case 'w': return value * 7 * 24 * 60 * 60 * 1000;
      case 'M': return value * 30 * 24 * 60 * 60 * 1000; // Approximate month for countdown
      default: return 60000;
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

    try {
      console.log("[Chart] Initializing createChart...");
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: {
            type: ColorType.Solid,
            color: 'transparent',
          },
          textColor: 'rgba(255,255,255,0.7)',
        },
        width: chartContainerRef.current.clientWidth,
        height: chartContainerRef.current.clientHeight,
        grid: {
          vertLines: { color: config?.global.gridLines || 'rgba(255, 255, 255, 0.03)', style: 0, visible: true },
          horzLines: { color: config?.global.gridLines || 'rgba(255, 255, 255, 0.03)', style: 0, visible: true },
        },
        crosshair: {
          mode: 1,
          horzLine: {
            color: 'rgba(0, 229, 255, 0.8)',
            labelBackgroundColor: '#00E5FF',
            labelVisible: true,
            style: 3,
          },
          vertLine: {
            color: 'rgba(0, 229, 255, 0.8)',
            labelBackgroundColor: '#00E5FF',
            labelVisible: true,
            style: 3,
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

      // --- Pre-allocate Background Series Pool (AI-ALPHA BENEATH CANDLES) ---
      // We create these BEFORE the candlestick series to ensure they render underneath
      for (let i = 0; i < 40; i++) {
        const bgSeries = chart.addSeries(AreaSeries, {
          visible: false,
          lineVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: () => null,
        });
        backgroundPoolRef.current.push(bgSeries);
      }

      // --- Dedicated Pool for User Positions (BENEATH CANDLES) ---
      for (let i = 0; i < 20; i++) {
        const upSeries = chart.addSeries(AreaSeries, {
          visible: false,
          lineVisible: false,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
          autoscaleInfoProvider: () => null,
        });
        userPositionsPoolRef.current.push(upSeries);
      }

      console.log("[Chart] Creating series...");
      const candlestickSeries = chart.addSeries(CandlestickSeries, {
        upColor: '#00E5FF',
        downColor: '#FF007F',
        borderVisible: true,
        wickVisible: true,
        borderColor: '#333',
        borderUpColor: '#00E5FF',
        borderDownColor: '#FF007F',
        wickUpColor: '#00E5FF',
        wickDownColor: '#FF007F',
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
      mainLineSeries.setData(data.filter(d => d.close != null).map((d: any) => ({ time: d.time, value: d.close })));

      // Initialize v5 Markers Plugin
      const msPlugin = createSeriesMarkers(candlestickSeries);
      markersPluginRef.current = msPlugin;

      const supertrendSeries = chart.addSeries(AreaSeries, {
        lineType: 2, // LineType.WithSteps
        lineColor: '#00E5FF',
        topColor: 'rgba(0, 229, 255, 0.4)',
        bottomColor: 'rgba(0, 229, 255, 0.0)',
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
        color: '#fcd535',
        lineWidth: 2,
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: mainIndicator === 'MA',
      });
      smaSeriesRef.current = smaSeries;

      const sarSeries = chart.addSeries(LineSeries, {
        color: '#FF007F',
        lineWidth: 2,
        lineStyle: 3, // Dotted style for SAR
        crosshairMarkerVisible: false,
        lastValueVisible: false,
        priceLineVisible: false,
        visible: mainIndicator === 'SAR',
      });
      sarSeriesRef.current = sarSeries;

      const bollUpper = chart.addSeries(LineSeries, { color: '#00E5FF', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'BOLL' });
      const bollMiddle = chart.addSeries(LineSeries, { color: '#fcd535', lineWidth: 1, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'BOLL' });
      const bollLower = chart.addSeries(LineSeries, { color: '#FF007F', lineWidth: 1, lineStyle: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'BOLL' });
      bollUpperRef.current = bollUpper;
      bollMiddleRef.current = bollMiddle;
      bollLowerRef.current = bollLower;

      const alligatorJaw = chart.addSeries(LineSeries, { color: '#00E5FF', lineWidth: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'ALLIGATOR' });
      const alligatorTeeth = chart.addSeries(LineSeries, { color: '#FF007F', lineWidth: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'ALLIGATOR' });
      const alligatorLips = chart.addSeries(LineSeries, { color: '#fcd535', lineWidth: 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false, visible: mainIndicator === 'ALLIGATOR' });
      alligatorJawRef.current = alligatorJaw;
      alligatorTeethRef.current = alligatorTeeth;
      alligatorLipsRef.current = alligatorLips;

      // --- Sub-Chart Oscillators Initialization ---
      // Note: We use dedicated price scales (rsi, macd, etc.) so they can be layered/stacked.

      // Volume
      const volumeSeries = chart.addSeries(HistogramSeries, {
        color: '#26a69a',
        priceFormat: { type: 'volume' },
        priceScaleId: 'volume',
        visible: subIndicators.includes('VOL'),
      });
      volumeSeriesRef.current = volumeSeries;

      // RSI
      const rsiSeries = chart.addSeries(LineSeries, {
        color: '#00E5FF',
        lineWidth: 2,
        priceScaleId: 'rsi',
        visible: subIndicators.includes('RSI'),
      });
      rsiSeriesRef.current = rsiSeries;
      rsiSeries.createPriceLine({ price: 70, color: 'rgba(255, 82, 82, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '70' });
      rsiSeries.createPriceLine({ price: 30, color: 'rgba(0, 230, 118, 0.5)', lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: '30' });

      // MACD
      const mHist = chart.addSeries(HistogramSeries, { priceScaleId: 'macd', visible: subIndicators.includes('MACD') });
      const mLine = chart.addSeries(LineSeries, { color: '#00E5FF', lineWidth: 2, priceScaleId: 'macd', visible: subIndicators.includes('MACD') });
      const mSignal = chart.addSeries(LineSeries, { color: '#FF007F', lineWidth: 2, priceScaleId: 'macd', visible: subIndicators.includes('MACD') });
      macdHistRef.current = mHist;
      macdSeriesRef.current = mLine;
      macdSignalRef.current = mSignal;

      // ATR
      const atrSeries = chart.addSeries(LineSeries, { color: '#fcd535', lineWidth: 2, priceScaleId: 'atr', visible: subIndicators.includes('ATR') });
      atrSeriesRef.current = atrSeries;

      // WR (Williams %R)
      const wrSeries = chart.addSeries(LineSeries, { color: '#FF007F', lineWidth: 2, priceScaleId: 'wr', visible: subIndicators.includes('WR') });
      wrSeriesRef.current = wrSeries;

      // OBV
      const obvSeries = chart.addSeries(LineSeries, { color: '#00E5FF', lineWidth: 2, priceScaleId: 'obv', visible: subIndicators.includes('OBV') });
      obvSeriesRef.current = obvSeries;

      // STOCH
      const stochK = chart.addSeries(LineSeries, { color: '#00E5FF', lineWidth: 2, priceScaleId: 'stoch', visible: subIndicators.includes('STOCH') });
      const stochD = chart.addSeries(LineSeries, { color: '#FF007F', lineWidth: 2, priceScaleId: 'stoch', visible: subIndicators.includes('STOCH') });
      stochKRef.current = stochK;
      stochDRef.current = stochD;

      // KDJ
      const kdjK = chart.addSeries(LineSeries, { color: '#00E5FF', lineWidth: 2, priceScaleId: 'kdj', visible: subIndicators.includes('KDJ') });
      const kdjD = chart.addSeries(LineSeries, { color: '#FF007F', lineWidth: 2, priceScaleId: 'kdj', visible: subIndicators.includes('KDJ') });
      const kdjJ = chart.addSeries(LineSeries, { color: '#fcd535', lineWidth: 2, priceScaleId: 'kdj', visible: subIndicators.includes('KDJ') });
      kdjKRef.current = kdjK;
      kdjDRef.current = kdjD;
      kdjJRef.current = kdjJ;

      console.log("[Chart] Series created successfully.");

      // Generate Dummy SuperTrend Data matching the input `data` length
      if (data.length > 0) {
        // Map existing historical data for indicators
        const emaData = data.filter(d => d.ema200 != null).map(d => ({ time: d.time, value: d.ema200 }));
        if (emaData.length > 0) emaSeries.setData(emaData);

        const smaData = data.filter(d => d.sma != null).map(d => ({ time: d.time, value: d.sma }));
        if (smaData.length > 0) smaSeries.setData(smaData);

        const sarData = data.filter(d => d.sar != null).map(d => ({ time: d.time, value: d.sar }));
        if (sarData.length > 0) sarSeries.setData(sarData);

        const bollUp = data.filter(d => d.boll?.upper != null).map(d => ({ time: d.time, value: d.boll.upper }));
        const bollMid = data.filter(d => d.boll?.middle != null).map(d => ({ time: d.time, value: d.boll.middle }));
        const bollLow = data.filter(d => d.boll?.lower != null).map(d => ({ time: d.time, value: d.boll.lower }));
        if (bollUp.length > 0) {
          bollUpper.setData(bollUp);
          bollMiddle.setData(bollMid);
          bollLower.setData(bollLow);
        }

        const jaw = data.filter(d => d.alligator?.jaw != null).map(d => ({ time: d.time, value: d.alligator.jaw }));
        const teeth = data.filter(d => d.alligator?.teeth != null).map(d => ({ time: d.time, value: d.alligator.teeth }));
        const lips = data.filter(d => d.alligator?.lips != null).map(d => ({ time: d.time, value: d.alligator.lips }));
        if (jaw.length > 0) {
          alligatorJaw.setData(jaw);
          alligatorTeeth.setData(teeth);
          alligatorLips.setData(lips);
        }

        // Populate historical data for Sub-indicators
        if (volumeSeriesRef.current) {
          const volData = data.map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(0, 229, 255, 0.4)' : 'rgba(255, 0, 127, 0.4)'
          }));
          volumeSeriesRef.current.setData(volData);
        }

        if (rsiSeriesRef.current) {
          const rsiD = data.filter(d => d.rsi != null).map(d => ({ time: d.time, value: d.rsi }));
          rsiSeriesRef.current.setData(rsiD);
        }

        if (macdSeriesRef.current && macdSignalRef.current && macdHistRef.current) {
          const mD = data.filter(d => d.macd?.macd != null).map(d => ({ time: d.time, value: d.macd.macd }));
          const sD = data.filter(d => d.macd?.signal != null).map(d => ({ time: d.time, value: d.macd.signal }));
          const hD = data.filter(d => d.macd?.histogram != null).map(d => ({
            time: d.time,
            value: d.macd.histogram,
            color: d.macd.histogram >= 0 ? 'rgba(0, 229, 255, 0.5)' : 'rgba(255, 0, 127, 0.5)'
          }));
          macdSeriesRef.current.setData(mD);
          macdSignalRef.current.setData(sD);
          macdHistRef.current.setData(hD);
        }

        if (atrSeriesRef.current) {
          const atrD = data.filter(d => d.atr != null).map(d => ({ time: d.time, value: d.atr }));
          atrSeriesRef.current.setData(atrD);
        }

        if (wrSeriesRef.current) {
          const wrD = data.filter(d => d.wr != null).map(d => ({ time: d.time, value: d.wr }));
          wrSeriesRef.current.setData(wrD);
        }

        if (obvSeriesRef.current) {
          const obvD = data.filter(d => d.obv != null).map(d => ({ time: d.time, value: d.obv }));
          obvSeriesRef.current.setData(obvD);
        }

        if (stochKRef.current && stochDRef.current) {
          const skD = data.filter(d => d.stochRsi?.stochRSI != null).map(d => ({ time: d.time, value: d.stochRsi.stochRSI }));
          // Dummy D for stochRsi if not provided (mapping stochRsi to stoch)
          stochKRef.current.setData(skD);
        }

        if (kdjKRef.current && kdjDRef.current && kdjJRef.current) {
          const kD = data.filter(d => d.kdj?.k != null).map(d => ({ time: d.time, value: d.kdj.k }));
          const dD = data.filter(d => d.kdj?.d != null).map(d => ({ time: d.time, value: d.kdj.d }));
          const jD = data.filter(d => d.kdj?.j != null).map(d => ({ time: d.time, value: d.kdj.j }));
          kdjKRef.current.setData(kD);
          kdjDRef.current.setData(dD);
          kdjJRef.current.setData(jD);
        }

        // Average Price Lines and High/Low markers moved to data-dependent effect to prevent race conditions on startup
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
        // For Crosshair Intersection Dot & Active Candle Highlight
        if (param.point && param.time) {
          setCrosshairPos({ x: param.point.x, y: param.point.y });
          const xCoord = chart.timeScale().timeToCoordinate(param.time);
          setHoveredCandleX(xCoord);
        } else {
          setCrosshairPos(null);
          setHoveredCandleX(null);
        }

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

      const interval = canonicalInterval(chartInterval);
      const wsUrl = `wss://stream.binance.com:9443/ws/${symbol.toLowerCase()}@kline_${interval}`;
      const ws = new WebSocket(wsUrl);

      let animationFrameId: number;
      const syncPills = () => {
        // Sync Price Average Lines
        if (seriesRef.current) {
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

        // Sync Pattern Markers (Intelligence Upgrade)
        if (seriesRef.current && chartRef.current && patternMarkersRef.current.length > 0 && config?.patternOverlay !== false) {
          const timeScale = chartRef.current.timeScale();
          const series = seriesRef.current;

          patternMarkersRef.current.forEach(m => {
            const el = document.getElementById(`pattern-marker-${m.id}`);
            const boxEl = document.getElementById(`engulf-box-${m.id}`);

            if (el) {
              const x = timeScale.timeToCoordinate(m.time);
              const yHigh = series.priceToCoordinate(m.high);
              const yLow = series.priceToCoordinate(m.low);

              if (x !== null && yHigh !== null && yLow !== null) {
                const xPos = x - 10; // Center 20px wide marker
                // Adjust Y-axis Vertical Zone: Icons always 10px below the candle
                const yIconPos = yLow + 10;
                el.style.transform = `translate(${xPos}px, ${yIconPos}px)`;
                el.style.opacity = '1';

                // Position Label at the High of the candle (relative to parent)
                const labelEl = document.getElementById(`pattern-label-${m.id}`);
                if (labelEl) {
                  // Parent is at yIconPos. We want label bottom at yHigh (with exactly 5px gap).
                  const relativeY = yHigh - yIconPos;
                  // Center relative to parent and position above High (5px gap)
                  labelEl.style.transform = `translate(-50%, ${relativeY}px) translateY(-100%) translateY(-5px)`;
                }
              } else {
                el.style.opacity = '0';
              }
            }

            // Sync the Encapsulating Box
            if (boxEl) {
              const x1 = timeScale.timeToCoordinate(m.prevTime);
              const x2 = timeScale.timeToCoordinate(m.time);

              // Box should cover both candles' high/low range
              const pHigh = Math.max(m.high, m.prevCandle.high);
              const pLow = Math.min(m.low, m.prevCandle.low);

              const y1 = series.priceToCoordinate(pHigh);
              const y2 = series.priceToCoordinate(pLow);

              if (x1 !== null && x2 !== null && y1 !== null && y2 !== null) {
                const width = (x2 - x1) + 20; // Cover both candles plus margin
                const height = (y2 - y1) + 10;
                boxEl.style.transform = `translate(${x1 - 10}px, ${y1 - 5}px)`;
                boxEl.style.width = `${width}px`;
                boxEl.style.height = `${height}px`;
                boxEl.style.opacity = '1';
              } else {
                boxEl.style.opacity = '0';
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

          if (mainLineSeriesRef.current) {
            mainLineSeriesRef.current.update({ time: t, value: parseFloat(kline.c) });
          }

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
            if (alligatorJawRef.current && lastValid.alligator) {
              if (lastValid.alligator.jaw !== null) alligatorJawRef.current.update({ time: t, value: lastValid.alligator.jaw });
              if (lastValid.alligator.teeth !== null) alligatorTeethRef.current.update({ time: t, value: lastValid.alligator.teeth });
              if (lastValid.alligator.lips !== null) alligatorLipsRef.current.update({ time: t, value: lastValid.alligator.lips });
            }
            // Closed candle sub-indicator updates
            if (volumeSeriesRef.current && lastValid.volume) {
              volumeSeriesRef.current.update({ time: t, value: lastValid.volume, color: parseFloat(kline.c) >= parseFloat(kline.o) ? 'rgba(38, 166, 154, 0.5)' : 'rgba(255, 82, 82, 0.5)' });
            }
            if (rsiSeriesRef.current && lastValid.rsi) rsiSeriesRef.current.update({ time: t, value: lastValid.rsi });
            if (macdSeriesRef.current && lastValid.macd) {
              macdSeriesRef.current.update({ time: t, value: lastValid.macd.macd });
              macdSignalRef.current.update({ time: t, value: lastValid.macd.signal });
              macdHistRef.current.update({ time: t, value: lastValid.macd.histogram, color: lastValid.macd.histogram >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(255, 82, 82, 0.5)' });
            }
            if (atrSeriesRef.current && lastValid.atr) atrSeriesRef.current.update({ time: t, value: lastValid.atr });
            if (wrSeriesRef.current && lastValid.wr) wrSeriesRef.current.update({ time: t, value: lastValid.wr });
            if (obvSeriesRef.current && lastValid.obv) obvSeriesRef.current.update({ time: t, value: lastValid.obv });
            if (stochKRef.current && lastValid.stochRsi) stochKRef.current.update({ time: t, value: lastValid.stochRsi.stochRSI });
            if (kdjKRef.current && lastValid.kdj) {
              kdjKRef.current.update({ time: t, value: lastValid.kdj.k });
              kdjDRef.current.update({ time: t, value: lastValid.kdj.d });
              kdjJRef.current.update({ time: t, value: lastValid.kdj.j });
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
              lineColor: trend === 1 ? '#00E5FF' : '#FF007F',
              topColor: trend === 1 ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 0, 127, 0.2)',
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

          if (mainLineSeriesRef.current) {
            mainLineSeriesRef.current.update({ time: t, value: parseFloat(kline.c) });
          }

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
            // Realtime tick extension for Sub-indicators
            if (volumeSeriesRef.current && lastValid.volume) {
              volumeSeriesRef.current.update({
                time: t,
                value: lastValid.volume,
                color: parseFloat(kline.c) >= parseFloat(kline.o) ? 'rgba(38, 166, 154, 0.5)' : 'rgba(255, 82, 82, 0.5)'
              });
            }
            if (rsiSeriesRef.current && lastValid.rsi) rsiSeriesRef.current.update({ time: t, value: lastValid.rsi });
            if (macdSeriesRef.current && lastValid.macd) {
              macdSeriesRef.current.update({ time: t, value: lastValid.macd.macd });
              macdSignalRef.current.update({ time: t, value: lastValid.macd.signal });
              macdHistRef.current.update({
                time: t,
                value: lastValid.macd.histogram,
                color: lastValid.macd.histogram >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(255, 82, 82, 0.5)'
              });
            }
            if (atrSeriesRef.current && lastValid.atr) atrSeriesRef.current.update({ time: t, value: lastValid.atr });
            if (wrSeriesRef.current && lastValid.wr) wrSeriesRef.current.update({ time: t, value: lastValid.wr });
            if (obvSeriesRef.current && lastValid.obv) obvSeriesRef.current.update({ time: t, value: lastValid.obv });
            if (stochKRef.current && lastValid.stochRsi) {
              stochKRef.current.update({ time: t, value: lastValid.stochRsi.stochRSI });
            }
            if (kdjKRef.current && lastValid.kdj) {
              kdjKRef.current.update({ time: t, value: lastValid.kdj.k });
              kdjDRef.current.update({ time: t, value: lastValid.kdj.d });
              kdjJRef.current.update({ time: t, value: lastValid.kdj.j });
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
              lineColor: trend === 1 ? '#00E5FF' : '#FF007F',
              topColor: trend === 1 ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 0, 127, 0.2)',
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
              const activeSeries = seriesRef.current?.options().visible ? seriesRef.current : mainLineSeriesRef.current;
              if (activeSeries && chartRef.current) {
                try {
                  const coord = activeSeries.priceToCoordinate(closePrice);
                  if (coord !== null && coord !== undefined) priceY = coord;
                } catch (e) { }
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
            const activeSeries = seriesRef.current?.options().visible ? seriesRef.current : mainLineSeriesRef.current;
            if (activeSeries && chartRef.current) {
              try {
                const coord = activeSeries.priceToCoordinate(closePrice);
                if (coord !== null && coord !== undefined) priceY = coord;
              } catch (e) { }
            }
            setCandleCountdown(prev => prev ? { ...prev, isUp: closePrice >= parseFloat(kline.o), priceY, price: closePrice } : null);
          }
        }
      };

      resizeObserver.observe(chartContainerRef.current);

      return () => {
        resizeObserver.disconnect();
        if (chart) chart.remove();
        ws.close();
        if (timerInterval) clearInterval(timerInterval);
        cancelAnimationFrame(animationFrameId);
      };
    } catch (err) {
      console.error("[Chart] Error during chart initialization:", err);
    }
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
    if (alligatorLipsRef.current) alligatorLipsRef.current.applyOptions({ visible: isAlligator });
  }, [mainIndicator]);

  // Handle Sub-Indicator Visibility and Scale Margins
  useEffect(() => {
    if (!chartRef.current) return;

    // 1. Toggle Visibility
    const has = (id: string) => subIndicators.includes(id);
    if (volumeSeriesRef.current) volumeSeriesRef.current.applyOptions({ visible: has('VOL') });
    if (rsiSeriesRef.current) rsiSeriesRef.current.applyOptions({ visible: has('RSI') });
    if (macdSeriesRef.current) {
      macdSeriesRef.current.applyOptions({ visible: has('MACD') });
      macdSignalRef.current.applyOptions({ visible: has('MACD') });
      macdHistRef.current.applyOptions({ visible: has('MACD') });
    }
    if (atrSeriesRef.current) atrSeriesRef.current.applyOptions({ visible: has('ATR') });
    if (wrSeriesRef.current) wrSeriesRef.current.applyOptions({ visible: has('WR') });
    if (obvSeriesRef.current) obvSeriesRef.current.applyOptions({ visible: has('OBV') });
    if (stochKRef.current) {
      stochKRef.current.applyOptions({ visible: has('STOCH') });
      stochDRef.current.applyOptions({ visible: has('STOCH') });
    }
    if (kdjKRef.current) {
      kdjKRef.current.applyOptions({ visible: has('KDJ') });
      kdjDRef.current.applyOptions({ visible: has('KDJ') });
      kdjJRef.current.applyOptions({ visible: has('KDJ') });
    }

    // 2. Dynamically allocate vertical space
    const numSub = subIndicators.length;
    if (numSub === 0) {
      chartRef.current.priceScale('right').applyOptions({ scaleMargins: { top: 0.1, bottom: 0.02 } });
      return;
    }

    const subHeight = 0.16; // 16% height per indicator
    const totalSubHeight = numSub * subHeight;
    const gap = 0.02;

    // Shrink main chart from bottom
    chartRef.current.priceScale('right').applyOptions({
      scaleMargins: { top: 0.05, bottom: totalSubHeight + gap }
    });

    // Positions for each sub-scale
    subIndicators.forEach((id, i) => {
      let scaleId = 'volume';
      if (id === 'VOL') scaleId = 'volume';
      else if (id === 'RSI') scaleId = 'rsi';
      else if (id === 'MACD') scaleId = 'macd';
      else if (id === 'ATR') scaleId = 'atr';
      else if (id === 'WR') scaleId = 'wr';
      else if (id === 'OBV') scaleId = 'obv';
      else if (id === 'STOCH') scaleId = 'stoch';
      else if (id === 'KDJ') scaleId = 'kdj';

      const sTop = 1 - totalSubHeight + (i * subHeight) + gap;
      const sBottom = 1 - (1 - totalSubHeight + ((i + 1) * subHeight));

      try {
        chartRef.current.priceScale(scaleId).applyOptions({
          scaleMargins: { top: sTop, bottom: sBottom },
          visible: true,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        });
      } catch (e) { }
    });
  }, [subIndicators]);

  // Handle Dynamic style config changes
  useEffect(() => {
    if (!chartRef.current) return;

    const isCandle = config?.style === 'candle';

    // 1. Global Updates
    const textColor = getContrastColor(config?.global.background || '#0b1622');
    chartRef.current.applyOptions({
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
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
    try {
      if (seriesRef.current && data.length > 0) {
        seriesRef.current.setData(data);
        if (mainLineSeriesRef.current) {
          mainLineSeriesRef.current.setData(data.filter(d => d.close != null).map((d: any) => ({ time: d.time, value: d.close })));
        }

        if (emaSeriesRef.current) {
          const emaData = data.filter(d => d.ema200 != null).map(d => ({ time: d.time, value: d.ema200 }));
          emaSeriesRef.current.setData(emaData);
        }

        if (smaSeriesRef.current) {
          const smaData = data.filter(d => d.sma != null).map(d => ({ time: d.time, value: d.sma }));
          smaSeriesRef.current.setData(smaData);
        }

        if (sarSeriesRef.current) {
          const sarData = data.filter(d => d.sar != null).map(d => ({ time: d.time, value: d.sar }));
          sarSeriesRef.current.setData(sarData);
        }

        if (bollUpperRef.current) {
          const bU = data.filter(d => d.boll?.upper != null).map(d => ({ time: d.time, value: d.boll.upper }));
          const bM = data.filter(d => d.boll?.middle != null).map(d => ({ time: d.time, value: d.boll.middle }));
          const bL = data.filter(d => d.boll?.lower != null).map(d => ({ time: d.time, value: d.boll.lower }));
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

        if (volumeSeriesRef.current) {
          volumeSeriesRef.current.setData(data.filter(d => d.volume != null).map(d => ({
            time: d.time,
            value: d.volume,
            color: d.close >= d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(255, 82, 82, 0.5)'
          })));
        }
        if (rsiSeriesRef.current) {
          const rsiD = data.filter(d => d.rsi != null).map(d => ({ time: d.time, value: d.rsi }));
          rsiSeriesRef.current.setData(rsiD);
        }
        if (macdSeriesRef.current && macdSignalRef.current && macdHistRef.current) {
          const mD = data.filter(d => d.macd?.macd != null).map(d => ({ time: d.time, value: d.macd.macd }));
          const sD = data.filter(d => d.macd?.signal != null).map(d => ({ time: d.time, value: d.macd.signal }));
          const hD = data.filter(d => d.macd?.histogram != null).map(d => ({
            time: d.time,
            value: d.macd.histogram,
            color: d.macd.histogram >= 0 ? 'rgba(38, 166, 154, 0.5)' : 'rgba(255, 82, 82, 0.5)'
          }));
          macdSeriesRef.current.setData(mD);
          macdSignalRef.current.setData(sD);
          macdHistRef.current.setData(hD);
        }
        if (atrSeriesRef.current) {
          const atrD = data.filter(d => d.atr != null).map(d => ({ time: d.time, value: d.atr }));
          atrSeriesRef.current.setData(atrD);
        }
        if (wrSeriesRef.current) {
          const wrD = data.filter(d => d.wr != null).map(d => ({ time: d.time, value: d.wr }));
          wrSeriesRef.current.setData(wrD);
        }
        if (obvSeriesRef.current) {
          const obvD = data.filter(d => d.obv != null).map(d => ({ time: d.time, value: d.obv }));
          obvSeriesRef.current.setData(obvD);
        }
        if (stochKRef.current && stochDRef.current) {
          const skD = data.filter(d => d.stochRsi?.stochRSI != null).map(d => ({ time: d.time, value: d.stochRsi.stochRSI }));
          stochKRef.current.setData(skD);
        }
        if (kdjKRef.current && kdjDRef.current && kdjJRef.current) {
          const kD = data.filter(d => d.kdj?.k != null).map(d => ({ time: d.time, value: d.kdj.k }));
          const dD = data.filter(d => d.kdj?.d != null).map(d => ({ time: d.time, value: d.kdj.d }));
          const jD = data.filter(d => d.kdj?.j != null).map(d => ({ time: d.time, value: d.kdj.j }));
          kdjKRef.current.setData(kD);
          kdjDRef.current.setData(dD);
          kdjJRef.current.setData(jD);
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
              lineColor: trend === 1 ? '#00E5FF' : '#FF007F',
              topColor: trend === 1 ? 'rgba(0, 229, 255, 0.2)' : 'rgba(255, 0, 127, 0.2)',
              bottomColor: 'rgba(0, 0, 0, 0)',
            };
          });
          stDataRef.current = stData;
          supertrendSeriesRef.current.setData(stData);
        }

        // --- Initialization Fix: Ensure AVG and High/Low markers are primed ---

        // 1. Initial High/Low Calculation (if not already set)
        if (!visibleHighLowRef.current && data.length > 0) {
          let maxItem = data[0];
          let minItem = data[0];
          // Scan initial data for a reasonable starting high/low
          const scanCount = Math.min(data.length, 100);
          for (let i = data.length - scanCount; i < data.length; i++) {
            if (data[i].high > maxItem.high) maxItem = data[i];
            if (data[i].low < minItem.low) minItem = data[i];
          }
          const initialHl = { high: maxItem, low: minItem };
          visibleHighLowRef.current = initialHl;
          setVisibleHighLow(initialHl);
        }

      }
    } catch (err) {
      console.error("[Chart] Error during data update:", err);
    }
  }, [data]);


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
      try { seriesRef.current.setMarkers([]); } catch (e) { }
    }
  }, [data, trades]);

  // Calculate pattern markers (Intelligence Upgrade)
  useEffect(() => {
    if (!data || data.length === 0 || config?.patternOverlay === false || !showEngulfing) {
      setPatternMarkers([]);
      patternMarkersRef.current = [];
      return;
    }

    // 1. Calculate SMA 10 (Trend Context)
    const maPeriod = 10;
    const ma10 = data.map((_, idx) => {
      if (idx < maPeriod - 1) return null;
      let sum = 0;
      for (let j = 0; j < maPeriod; j++) sum += data[idx - j].close;
      return sum / maPeriod;
    });

    const newPatternMarkers = [];
    const lookback = config?.patternLookback || 200;
    const startIdx = Math.max(2, data.length - lookback);

    for (let i = startIdx; i < data.length; i++) {
      const patterns = detectPatterns(data, i);

      patterns.forEach((p, idx) => {
        const isBullish = p.sentiment === 'bullish';
        const isBearish = p.sentiment === 'bearish';
        const isNeutral = p.sentiment === 'neutral';

        // Volume Imbalance calculation (Pro-level Confirmation)
        const avgVol3 = (data[i - 1].volume + (data[i - 2]?.volume || data[i - 1].volume) + (data[i - 3]?.volume || data[i - 1].volume)) / 3;
        const hasHighVolume = data[i].volume > (avgVol3 * 1.3);

        newPatternMarkers.push({
          id: `${data[i].time}_${p.type}_${idx}`,
          time: data[i].time,
          prevTime: data[i - 1].time,
          type: p.sentiment === 'bullish' ? 'BULLISH' : (p.sentiment === 'bearish' ? 'BEARISH' : 'NEUTRAL'),
          patternType: p.type,
          label: p.label,
          color: p.color,
          description: p.description,
          context: isBullish ? 'BULLISH' : (isBearish ? 'BEARISH' : 'NEUTRAL'),
          strength: (isBullish || isBearish) && hasHighVolume ? 'HIGH' : 'STANDARD',
          hasHighVolume: hasHighVolume,
          low: data[i].low,
          high: data[i].high,
          open: data[i].open,
          close: data[i].close,
          prevCandle: {
            open: data[i - 1].open,
            close: data[i - 1].close,
            high: data[i - 1].high,
            low: data[i - 1].low
          }
        });
      });
    }
    patternMarkersRef.current = newPatternMarkers;
    setPatternMarkers(newPatternMarkers);
  }, [data, config?.patternOverlay, showEngulfing]);

  // --- Heartbeat Animation Engine (AI-ALPHA) ---
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseTick(t => (t + 1) % 100);
    }, 100); // 100ms step for smooth pulsing
    return () => clearInterval(interval);
  }, []);

  // Execute Market Structure Kernel (Injects Natively via setMarkers)
  useEffect(() => {
    if (!data || data.length === 0) return;

    try {
      const analysis = analyzeMarketStructure(data, 5);
      const { nodes, levels, currentTrend, lastActionType } = analysis;
      const latestPrice = data[data.length - 1].close;

      // --- UPDATED Phase 1: Institutional Radar (Fixed SCANNING Bug) ---

      // 1. Find Nearest Shield (Supply/Demand Levels > 40 Strength)
      let nearestShield: any = null;
      let minShieldDist = Infinity;

      levels.forEach(l => {
        if (l.strengthScore < 40) return;
        const price = (l.priceWick + l.priceBody) / 2;
        const dist = Math.abs(price - latestPrice);

        // Logical Alignment: Support below price, Resistance above
        const isSupport = price < latestPrice;
        if (dist < minShieldDist) {
          minShieldDist = dist;
          nearestShield = { type: l.type === 'support' ? 'SUP' : 'RES', price };
        }
      });

      // 2. Find Nearest Magnet (Weak/Unmitigated Nodes)
      let nearestMagnet: any = null;
      let minMagnetDist = Infinity;
      nodes.forEach(node => {
        if (node.strength !== 'WEAK') return;
        const dist = Math.abs(node.price - latestPrice);
        if (dist < minMagnetDist) {
          minMagnetDist = dist;
          nearestMagnet = { type: node.type, price: node.price };
        }
      });

      const isNearZone = levels.some(l => {
        const upper = Math.max(l.priceWick, l.priceBody);
        const lower = Math.min(l.priceWick, l.priceBody);
        const mid = (upper + lower) / 2;
        return Math.abs(latestPrice - mid) / latestPrice < 0.01;
      });

      // 3. Calculate 2050 Tactical Confluence Strike Score
      const latestPatterns = detectPatterns(data, data.length - 1);
      const currentTime = data[data.length - 1].time;
      const strike = calculateTacticalConfluence(analysis, latestPatterns, latestPrice, currentTime);

      // Session Calculation for HUD
      const date = new Date(typeof currentTime === 'string' ? currentTime : (Number(currentTime) * 1000));
      const hour = date.getUTCHours();
      let sessionName = 'ASIA';
      if (hour >= 8 && hour < 14) sessionName = 'LONDON';
      if (hour >= 14 && hour < 21) sessionName = 'NEW YORK';
      if (hour >= 13 && hour <= 16) sessionName = 'LND/NY OV';

      setHudData({
        trend: currentTrend,
        lastAction: lastActionType,
        nearestShield,
        nearestMagnet,
        isConfluence: isNearZone,
        strikeProbability: strike.probability,
        reasoning: strike.reasoning,
        signal: strike.signal,
        isNewsProtection: analysis.isNewsProtection,
        adaptiveLb: analysis.adaptiveLb,
        session: sessionName
      });
    } catch (e) {
      console.error("[Chart] HUD Engine Sync Error:", e);
    }
  }, [data]);

  // Execute Market Structure Visual Artifacts (Price Lines, Markers)
  useEffect(() => {
    try {
      const series = seriesRef.current;
      const markersPlugin = markersPluginRef.current;
      const chart = chartRef.current;
      if (!series || !markersPlugin || !chart) return;

      // Clean old structural artifacts (Reset pool and remove markers)
      structuralLevelsRef.current.forEach(artifacts => {
        const [, , wickLine] = artifacts;
        if (wickLine) {
          try { series.removePriceLine(wickLine); } catch (e) { }
        }
      });
      structuralLevelsRef.current.clear();
      backgroundPoolRef.current.forEach(s => s.applyOptions({ visible: false }));
      if (subFractalSeriesRef.current) {
        try { chart.removeSeries(subFractalSeriesRef.current); } catch (e) { }
        subFractalSeriesRef.current = null;
      }
      trendlineSeriesRef.current.forEach(s => chart.removeSeries(s));
      trendlineSeriesRef.current = [];

      if (data && data.length > 0) {
        const analysis = analyzeMarketStructure(data, 5);
        const { nodes, levels, trendlines: tlData, grabs, currentTrend, lastActionType, orderBlocks } = analysis;

        const chartMarkers: any[] = [];

        // ONLY render visual artifacts if toggled ON
        if (showStructure || showStructuralLevels || showTrendlines || showGoldenZone || showOrderBlocks) {
          // 4. Trace Mapping (Internal Structure)
          if (showInternalStructure && analysis.internalNodes.length > 1) {
            const sfSeries = chart.addSeries(LineSeries, {
              color: '#34d399',
              lineWidth: 1,
              lineStyle: 2,
              crosshairMarkerVisible: false,
              lastValueVisible: false,
              priceLineVisible: false,
            });
            sfSeries.setData(analysis.internalNodes.map(n => ({ time: n.time as UTCTimestamp, value: n.price })));
            subFractalSeriesRef.current = sfSeries;
          }

          // 5. Structure Nodes
          if (showStructure) {
            nodes.forEach(node => {
              if (!node.isExternal && !node.isBreakOfStructure && !node.isCHoCH) return;
              const isBullish = node.type === 'HH' || node.type === 'HL';
              const isPeak = node.type === 'HH' || node.type === 'LH';
              let structuralLabel = node.type as string;
              let markerColor = isBullish ? '#34d399' : '#f43f5e';
              if (node.isCHoCH) {
                structuralLabel = `CHoCH [${node.type}]`;
                markerColor = '#fcd535';
              } else if (node.isBreakOfStructure) structuralLabel = `BOS [${node.type}]`;
              if (node.strength === 'STRONG') structuralLabel = `🛡️ STRG ${structuralLabel}`;
              else if (node.strength === 'WEAK') structuralLabel = `🎯 WEAK ${structuralLabel}`;
              chartMarkers.push({
                time: node.time,
                position: isPeak ? 'aboveBar' : 'belowBar',
                color: markerColor,
                shape: isPeak ? 'arrowDown' : 'arrowUp',
                text: structuralLabel,
                size: 2
              });
            });
          }

          // 6. Golden Zone
          if (showGoldenZone) {
            const patterns = patternMarkersRef.current || [];
            patterns.forEach(pm => {
              const isBullishSignal = pm.type === 'BULLISH';
              const isBearishSignal = pm.type === 'BEARISH';
              if (!isBullishSignal && !isBearishSignal) return;
              const patternPrice = isBullishSignal ? pm.low : pm.high;
              const markerTime = Number(pm.time);
              const structuralConfluence = levels.find(l => {
                if (Number(l.startTime) > markerTime) return false;
                const isEffectiveSupport = (l.type === 'support' && !l.isBroken) || (l.type === 'resistance' && l.isBroken);
                const isEffectiveResistance = (l.type === 'resistance' && !l.isBroken) || (l.type === 'support' && l.isBroken);
                if (isBullishSignal && !isEffectiveSupport) return false;
                if (isBearishSignal && !isEffectiveResistance) return false;
                const upper = Math.max(l.priceWick, l.priceBody);
                const lower = Math.min(l.priceWick, l.priceBody);
                return patternPrice >= lower && patternPrice <= upper;
              });

              if (structuralConfluence) {
                let hasTrendlineConfluence = false;
                if (showTrendlines) {
                  const currentIndex = data.findIndex(d => d.time === pm.time);
                  if (currentIndex !== -1) {
                    hasTrendlineConfluence = tlData.some(tl => {
                      if (tl.type !== (isBullishSignal ? 'bullish' : 'bearish')) return false;
                      if (Number(tl.start.time) > markerTime) return false;
                      const expectedPrice = tl.start.price + tl.slope * (currentIndex - tl.start.index);
                      const proximity = Math.abs(patternPrice - expectedPrice) / expectedPrice;
                      return proximity < 0.003;
                    });
                  }
                }
                const label = hasTrendlineConfluence ? '💎 GOLDEN [LEVEL+TREND]' : '💎 GOLDEN [LEVEL]';
                chartMarkers.push({
                  time: pm.time,
                  position: isBullishSignal ? 'belowBar' : 'aboveBar',
                  color: isBullishSignal ? '#00ffff' : '#ff00ff',
                  shape: 'diamond',
                  text: label,
                  size: 2
                });
              }
            });
          }

          // Sweeps
          grabs.forEach(grab => {
            chartMarkers.push({
              time: grab.time,
              position: grab.type === 'sweep_high' ? 'aboveBar' : 'belowBar',
              color: '#fcd535',
              shape: 'circle',
              text: '⚡ SWEEP',
              size: 2
            });
          });

          // --- 2100 MASTER: Order Block Visual Rendering ---
          if (showOrderBlocks) {
            orderBlocks.filter(ob => !ob.isMitigated).forEach((ob, idx) => {
              const isBull = ob.type === 'BULLISH_OB';
              const color = isBull ? 'rgba(52, 211, 153, 0.15)' : 'rgba(244, 63, 94, 0.15)';
              const borderColor = isBull ? 'rgba(52, 211, 153, 0.4)' : 'rgba(244, 63, 94, 0.4)';

              // We use the background pool for unmitigated OBs
              const rect = backgroundPoolRef.current[idx + levels.length]; // Offset by levels
              if (rect) {
                rect.applyOptions({
                  visible: true,
                  topFillColor: color,
                  bottomFillColor: color,
                  topLineColor: borderColor,
                  bottomLineColor: borderColor,
                  lineWidth: 1,
                  lineStyle: 0,
                  autoscaleInfoProvider: () => ({
                    priceRange: { minValue: ob.bottom, maxValue: ob.top },
                  }),
                });
                rect.setData([
                  { time: ob.startTime as UTCTimestamp, price: ob.top },
                  { time: data[data.length - 1].time as UTCTimestamp, price: ob.top },
                  { time: ob.startTime as UTCTimestamp, price: ob.bottom },
                  { time: data[data.length - 1].time as UTCTimestamp, price: ob.bottom },
                ]);
              }
            });
          }

          // Supply/Demand Clouds
          if (showStructuralLevels) {
            levels.forEach((lvl, idx) => {
              const poolIdx = idx * 2;
              if (poolIdx + 1 >= backgroundPoolRef.current.length) return;
              const shell = backgroundPoolRef.current[poolIdx];
              const core = backgroundPoolRef.current[poolIdx + 1];
              const effectiveType = lvl.isBroken ? (lvl.type === 'support' ? 'resistance' : 'support') : lvl.type;
              const baseColor = effectiveType === 'support' ? '52, 211, 153' : '244, 63, 94';
              shell.applyOptions({ visible: true, topColor: `rgba(${baseColor}, ${lvl.isBroken ? 0.04 : 0.08})`, bottomColor: `rgba(${baseColor}, 0.01)` });
              const historicalPoints = data.filter(d => d.time >= lvl.startTime).map(d => ({ time: d.time, value: Math.max(lvl.priceWick, lvl.priceBody) }));
              if (historicalPoints.length > 0) {
                historicalPoints.push({ time: (historicalPoints[historicalPoints.length - 1].time + 31536000) as UTCTimestamp, value: Math.max(lvl.priceWick, lvl.priceBody) });
                shell.setData(historicalPoints);
              }
              core.applyOptions({ visible: true, topColor: `rgba(${baseColor}, ${lvl.isBroken ? 0.06 : 0.2})`, bottomColor: `rgba(${baseColor}, 0.1)` });
              const coreHeight = Math.abs(lvl.priceWick - lvl.priceBody) * 0.4;
              const corePoints = data.filter(d => d.time >= lvl.startTime).map(d => ({ time: d.time, value: lvl.pricePOC + coreHeight / 2 }));
              if (corePoints.length > 0) {
                corePoints.push({ time: (corePoints[corePoints.length - 1].time + 31536000) as UTCTimestamp, value: lvl.pricePOC + coreHeight / 2 });
                core.setData(corePoints);
              }
              const labelPrefix = lvl.isBroken ? `BREAKER ${lvl.type === 'support' ? 'RES' : 'SUP'}` : lvl.type.toUpperCase();
              const wickLine = series.createPriceLine({ price: lvl.priceWick, color: `rgba(${baseColor}, ${lvl.isBroken ? 0.3 : 0.8})`, lineWidth: 1, lineStyle: lvl.isBroken ? 2 : 0, axisLabelVisible: true, title: `${labelPrefix} [STR: ${lvl.strengthScore}%]` });
              structuralLevelsRef.current.set(lvl.id, [shell, core, wickLine, lvl]);
            });
          }

          // Trendlines
          if (showTrendlines) {
            tlData.forEach(tl => {
              const tlSeries = chart.addSeries(LineSeries, { color: tl.type === 'bullish' ? '#34d399' : '#f43f5e', lineWidth: tl.isProven ? 2 : 1.5, lineStyle: tl.isProven ? 0 : 2, crosshairMarkerVisible: false, lastValueVisible: false, priceLineVisible: false });
              tlSeries.setData([{ time: tl.start.time as UTCTimestamp, value: tl.start.price }, { time: tl.end.time as UTCTimestamp, value: tl.end.price }]);
              trendlineSeriesRef.current.push(tlSeries);
            });
          }
        } // End visual checks

        const deduplicated = chartMarkers.filter((m, i, arr) => i === 0 || m.time !== arr[i - 1].time);
        markersPlugin.setMarkers(deduplicated);
      } else if (markersPlugin) {
        markersPlugin.setMarkers([]);
      }
    } catch (err) { console.error("[Chart] Market Structure Engine crashed:", err); }
  }, [data, showStructure, showStructuralLevels, showTrendlines, showGoldenZone, showInternalStructure]);

  // --- Drawing Persistence Logic (AI-ALPHA) ---
  const storageKey = symbol.replace('/', '');

  // Load drawings on symbol change
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`chart_drawings_${storageKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Migration: Ensure all position drawings have targetTime
        const migrated = parsed.map((d: any) => {
          if ((d.type === 'long_position' || d.type === 'short_position') && !d.targetTime) {
            return { ...d, targetTime: d.entryTime + 36000 };
          }
          return d;
        });
        setDrawings(migrated);
      } else {
        setDrawings([]);
      }
    } catch (e) {
      console.error("[Chart] Failed to load drawings:", e);
      setDrawings([]);
    }
  }, [symbol]);

  // Save drawings on change with small delay (Auto-Save)
  useEffect(() => {
    if (drawings.length === 0 && !localStorage.getItem(`chart_drawings_${storageKey}`)) return;
    const timer = setTimeout(() => {
      localStorage.setItem(`chart_drawings_${storageKey}`, JSON.stringify(drawings));
    }, 1000); // 1s throttle
    return () => clearTimeout(timer);
  }, [drawings, storageKey]);

  // --- Background Position "Zone" Rendering (BENEATH CANDLES) ---
  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Reset pool (Clear visibility and data for unused slots)
    userPositionsPoolRef.current.forEach(s => {
      s.applyOptions({ visible: false });
      s.setData([]);
    });

    const positions = drawings.filter(d => d.type === 'long_position' || d.type === 'short_position') as PositionDrawing[];

    positions.forEach((pos, idx) => {
      if (idx >= userPositionsPoolRef.current.length / 2) return;

      const isLong = pos.type === 'long_position';
      const tpPoolIdx = idx * 2;
      const slPoolIdx = idx * 2 + 1;

      const tpSeries = userPositionsPoolRef.current[tpPoolIdx];
      const slSeries = userPositionsPoolRef.current[slPoolIdx];

      const startTime = pos.entryTime as UTCTimestamp;
      const endTime = (pos.targetTime || (pos.entryTime + 36000)) as UTCTimestamp;

      // --- PRO RENDERING FIX: Use synthetic points to ensure future projection works ---
      // AreaSeries needs at least 2 points to render width. 
      // We provide exactly 2 points at the target price for the TP and SL zones.
      // This ensures the zone appears regardless of whether data exists in the gap.

      const tpZoneData = [
        { time: startTime, value: pos.tpPrice },
        { time: endTime, value: pos.tpPrice }
      ];

      tpSeries.applyOptions({
        visible: true,
        topColor: isLong ? 'rgba(0, 255, 157, 0.12)' : 'rgba(128, 128, 128, 0.05)',
        bottomColor: isLong ? 'rgba(0, 255, 157, 0.02)' : 'rgba(0, 255, 157, 0.01)',
        lineVisible: false,
      });
      tpSeries.setData(tpZoneData as any);

      const slZoneData = [
        { time: startTime, value: pos.slPrice },
        { time: endTime, value: pos.slPrice }
      ];

      slSeries.applyOptions({
        visible: true,
        topColor: isLong ? 'rgba(128, 128, 128, 0.05)' : 'rgba(255, 0, 127, 0.12)',
        bottomColor: isLong ? 'rgba(255, 0, 127, 0.01)' : 'rgba(255, 0, 127, 0.02)',
        lineVisible: false,
      });
      slSeries.setData(slZoneData as any);
    });
  }, [drawings, data, symbol]);

  // --- High Frequency Animation Loop (Heartbeat Pulse) ---
  useEffect(() => {
    if (!showStructuralLevels || !data || data.length === 0) return;
    const latestPrice = data[data.length - 1].close;

    // Check if Golden Zone fast pulse is active
    let fastPulseActive = false;
    if (showGoldenZone) {
      const lastTime = data[data.length - 1].time;
      fastPulseActive = (patternMarkersRef.current || []).some(pm => pm.time === lastTime);
    }

    structuralLevelsRef.current.forEach((artifacts) => {
      const [shell, core, wickLine, lvl] = artifacts;
      if (!shell || !core || !lvl) return;
      if (lvl.isBroken) return; // Ghosts don't pulse

      const isSup = lvl.type === 'support';
      const isActive = Math.abs(latestPrice - lvl.priceWick) / lvl.priceWick < 0.005;
      const baseColor = isSup ? '52, 211, 153' : '244, 63, 94';

      let opacityCoeff = 1.0;
      if (isActive) {
        const period = fastPulseActive ? 5 : 20;
        opacityCoeff = 0.5 + Math.sin((pulseTick / period) * 2 * Math.PI) * 0.3;
      }

      shell.applyOptions({
        topColor: `rgba(${baseColor}, ${0.08 * opacityCoeff})`,
        bottomColor: `rgba(${baseColor}, 0.01)`,
      });
      core.applyOptions({
        topColor: `rgba(${baseColor}, ${0.2 * opacityCoeff})`,
        bottomColor: `rgba(${baseColor}, ${0.1 * opacityCoeff})`,
      });
    });
  }, [pulseTick, showStructuralLevels, showGoldenZone]);


  // Sync Open Orders to Price Lines
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const currentLineMap = openOrderLinesRef.current;
    const activeIds = new Set<string>();

    openOrders.forEach(order => {
      // If AVG toggle is off, we skip creating any price lines
      if (!showAvgLines) return;

      // Handle OCO orders having two targets: limitPrice and stopPrice
      if (order.type === 'oco') {
        const createLine = (price: number, label: string) => {
          const lineId = `${order.id}-${label}`;
          activeIds.add(lineId);
          if (!currentLineMap.has(lineId)) {
            const isBuy = order.side === 'buy';
            // For OCO: TP is limitPrice and SL is stopPrice. Direction flips based on side.
            const styleColor = (isBuy && label.includes('Buy')) || (!isBuy && label.includes('Profit')) ? '#00E5FF' : '#FF007F';

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
              color: isBuy ? '#00E5FF' : '#FF007F',
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
        try { series.removePriceLine(line); } catch (e) { }
        currentLineMap.delete(key);
      }
    });

  }, [openOrders, seriesRef.current, showAvgLines]);

  return (
    <div className="flex flex-col w-full h-full bg-[#07090b] rounded-2xl overflow-hidden border border-white/5 relative z-0 shadow-[0_0_60px_rgba(0,0,0,0.6)] backdrop-blur-3xl group/chart">

      {/* 2050 Gradient Overlay Glow */}
      <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover/chart:opacity-100 transition-opacity duration-1000" />

      {/* ═══════════════ TACTICAL MATRIX: DESKTOP CUBE HOVER (md:flex) ═══════════════ */}
      <div className="hidden md:flex absolute right-0 top-0 bottom-0 z-50 pointer-events-none group/matrix flex-col items-end">
        {/* The Animated Cube Trigger */}
        <div className="p-4 pointer-events-auto">
          <div className="w-12 h-12 glass-panel-modern border border-[var(--holo-cyan)]/30 rounded-xl flex items-center justify-center cursor-pointer shadow-[0_0_20px_rgba(0,229,255,0.15)] group-hover/matrix:opacity-0 transition-opacity duration-300">
            <Activity className="w-6 h-6 text-[var(--holo-cyan)] animate-pulse" />
          </div>
        </div>

        {/* The Sliding Panel */}
        <div className={cn(
          "absolute right-0 top-0 bottom-0 w-80 glass-panel-modern shadow-[0_0_50px_rgba(0,0,0,0.8)] border border-[var(--holo-cyan)]/20 flex flex-col pointer-events-auto transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]",
          "opacity-0 scale-95 translate-x-10 pointer-events-none group-hover/matrix:opacity-100 group-hover/matrix:scale-100 group-hover/matrix:translate-x-0 group-hover/matrix:pointer-events-auto"
        )}>
          {/* Edge Glowing Handle */}
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-transparent via-[var(--holo-cyan)]/30 to-transparent" />

          {/* Header */}
          <div className="p-6 border-b border-white/5 bg-[var(--holo-cyan)]/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-1 opacity-20">
              <Cpu className="w-12 h-12 text-[var(--holo-cyan)]" />
            </div>
            <h3 className="text-xs uppercase tracking-[0.4em] font-black text-white flex items-center gap-3 relative z-10">
              <Activity className="w-4 h-4 text-[var(--holo-cyan)]" />
              Tactical Matrix
            </h3>
            <p className="text-[9px] text-[var(--holo-cyan)]/50 uppercase tracking-[0.3em] font-mono mt-2 pl-7 relative z-10">Neural_Link // Active</p>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-1 rounded-full bg-[var(--holo-cyan)]" />
                <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.2em]">Alpha Constraints</p>
              </div>
              <div className="space-y-1">
                <TacticalToggle label="Engulfing" icon={<Activity className="w-3.5 h-3.5" />} active={showEngulfing} onToggle={setShowEngulfing} subtitle="Pattern detection" />
                <TacticalToggle label="Box Over" icon={<Box className="w-3.5 h-3.5" />} active={showPatternBox} onToggle={setShowPatternBox} subtitle="Price action range" />
                <TacticalToggle label="S-Levels" icon={<Layers className="w-3.5 h-3.5" />} active={showStructuralLevels} onToggle={setShowStructuralLevels} subtitle="Inst. levels" />
                <TacticalToggle label="Trendlines" icon={<TrendingUp className="w-3.5 h-3.5" />} active={showTrendlines} onToggle={setShowTrendlines} subtitle="Projected flow" />
                <TacticalToggle label="Golden Zone" icon={<Zap className="w-3.5 h-3.5" />} active={showGoldenZone} onToggle={setShowGoldenZone} subtitle="Fib anchors" />
                <TacticalToggle label="Order Blocks" icon={<Database className="w-3.5 h-3.5" />} active={showOrderBlocks} onToggle={setShowOrderBlocks} subtitle="Inst. Zones" />
                <TacticalToggle label="SL / TP & Orders" icon={<Target className="w-3.5 h-3.5" />} active={showAvgLines} onToggle={setShowAvgLines} subtitle="Active execution" />
              </div>
            </section>

            <div className="h-[1px] bg-gradient-to-r from-transparent via-white/5 to-transparent" />

            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-1 rounded-full bg-[var(--holo-magenta)]" />
                <p className="text-[10px] text-white/30 uppercase font-black tracking-[0.2em]">Market Topology</p>
              </div>
              <div className="space-y-1">
                <TacticalToggle label="Nodes" icon={<Cpu className="w-3.5 h-3.5" />} active={showStructure} onToggle={setShowStructure} subtitle="Swing anchors" />
                <TacticalToggle label="Internal" icon={<Network className="w-3.5 h-3.5" />} active={showInternalStructure} onToggle={setShowInternalStructure} subtitle="Sub-structure" />
              </div>
            </section>
          </div>

          {/* Status Diagnostic Footer */}
          <div className="p-6 bg-black/40 border-t border-white/5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--holo-cyan)] animate-ping" />
                <span className="text-[9px] font-black text-white/40 uppercase tracking-widest">Neural Link</span>
              </div>
              <span className="text-[9px] font-mono text-[var(--holo-cyan)]">99%</span>
            </div>
            <div className="flex gap-1">
              {[1, 1, 1, 1, 1, 1, 1, 1, 1, 0].map((v, i) => (
                <div key={i} className={cn(
                  "h-1 flex-1 rounded-full transition-all duration-1000",
                  v ? "bg-[var(--holo-cyan)]/40 shadow-[0_0_5px_var(--holo-cyan-glow)]" : "bg-white/5"
                )} />
              ))}
            </div>
          </div>
        </div>
      </div>


      {/* ═══════════════ PHANTOM MOBILE DOCK (md:hidden) ═══════════════ */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-[150] h-16 phantom-dock-glass flex items-center justify-around px-4 pb-safe">
        {/* Drawing Tools Trigger */}
        <button
          onClick={() => setIsMobileMatrixOpen(false)} // Just a placeholder for now, maybe we toggle a sub-strip
          className="flex flex-col items-center gap-1 text-white/40 active:text-[var(--holo-cyan)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3zM18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /></svg>
          <span className="text-[8px] font-black uppercase tracking-widest">Tools</span>
        </button>

        {/* Tactical Matrix Trigger */}
        <button
          onClick={() => setIsMobileMatrixOpen(true)}
          className={cn(
            "w-14 h-14 -mt-8 rounded-full bg-black border-2 flex items-center justify-center shadow-2xl transition-all active:scale-90",
            isMobileMatrixOpen ? "border-[var(--holo-cyan)] text-[var(--holo-cyan)]" : "border-white/10 text-white/40"
          )}
        >
          <Activity className="w-6 h-6" />
        </button>

        {/* System Override Trigger (External Event for now or passed from App) */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggleStyleModal'))}
          className="flex flex-col items-center gap-1 text-white/40 active:text-[var(--holo-magenta)] transition-colors"
        >
          <Zap className="w-18 h-18" />
          <span className="text-[8px] font-black uppercase tracking-widest">Override</span>
        </button>
      </div>

      {/* ═══════════════ TACTICAL MATRIX: MOBILE MODAL (Integrated with Dock) ═══════════════ */}
      {isMobileMatrixOpen && createPortal(
        <div className="md:hidden fixed inset-0 z-[1000] flex items-end justify-center">
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMatrixOpen(false)} />

          {/* Bottom Sheet Style Modal */}
          <div className="relative w-full glass-panel-modern rounded-t-[2.5rem] overflow-hidden flex flex-col max-h-[70vh] animate-in slide-in-from-bottom duration-500 pb-12">
            <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mt-3 mb-1" />
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div className="flex flex-col">
                <h3 className="text-xs uppercase tracking-[0.3em] font-black text-white">Tactical Matrix</h3>
                <p className="text-[8px] text-[var(--holo-cyan)] font-mono mt-1 tracking-widest uppercase">System Control Unit</p>
              </div>
              <button
                onClick={() => setIsMobileMatrixOpen(false)}
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 active:scale-95 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar pb-16">
              <section>
                <p className="text-[10px] text-white/20 uppercase mb-4 font-black tracking-[0.2em]">Alpha Intelligence</p>
                <div className="space-y-2">
                  <TacticalToggle label="Engulfing" icon={<Activity className="w-5 h-5" />} active={showEngulfing} onToggle={setShowEngulfing} subtitle="Pattern detection" />
                  <TacticalToggle label="Box Over" icon={<Box className="w-5 h-5" />} active={showPatternBox} onToggle={setShowPatternBox} subtitle="Price action range" />
                  <TacticalToggle label="S-Levels" icon={<Layers className="w-5 h-5" />} active={showStructuralLevels} onToggle={setShowStructuralLevels} subtitle="Inst. levels" />
                  <TacticalToggle label="Trendlines" icon={<TrendingUp className="w-5 h-5" />} active={showTrendlines} onToggle={setShowTrendlines} subtitle="Projected flow" />
                  <TacticalToggle label="Golden Zone" icon={<Zap className="w-5 h-5" />} active={showGoldenZone} onToggle={setShowGoldenZone} subtitle="Fib anchors" />
                  <TacticalToggle label="Order Blocks" icon={<Database className="w-5 h-5" />} active={showOrderBlocks} onToggle={setShowOrderBlocks} subtitle="Inst. Zones" />
                  <TacticalToggle label="SL / TP & Orders" icon={<Target className="w-5 h-5" />} active={showAvgLines} onToggle={setShowAvgLines} subtitle="Active execution" />
                </div>
              </section>

              <section>
                <p className="text-[10px] text-white/20 uppercase mb-4 font-black tracking-[0.2em]">Topology Engine</p>
                <div className="space-y-2">
                  <TacticalToggle label="Nodes" icon={<Cpu className="w-5 h-5" />} active={showStructure} onToggle={setShowStructure} subtitle="Swing anchors" />
                  <TacticalToggle label="Internal" icon={<Network className="w-5 h-5" />} active={showInternalStructure} onToggle={setShowInternalStructure} subtitle="Sub-structure" />
                </div>
              </section>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* ═══════════════ PHANTOM MAGNETIC DRAWING DOCK (Desktop Stealth) ═══════════════ */}
      <div className="hidden md:flex absolute left-0 inset-y-0 w-8 z-[200] group/tools-trigger items-center justify-start pointer-events-auto">
        {/* Visual Edge Handle (Subtle hint) */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-24 rounded-r-full bg-gradient-to-b from-transparent via-[var(--holo-cyan)]/20 to-transparent group-hover/tools-trigger:opacity-0 transition-opacity" />

        <div className="flex flex-col items-center gap-4 p-2.5 glass-panel rounded-r-3xl shadow-2xl transition-all duration-700 opacity-0 -translate-x-full scale-90 group-hover/tools-trigger:opacity-100 group-hover/tools-trigger:translate-x-0 group-hover/tools-trigger:scale-100 pointer-events-auto ml-1 border-y border-r border-[var(--holo-cyan)]/20">
          <div className="flex flex-col gap-2">
            {([
              { id: 'none', icon: 'M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5', title: 'Select', color: '#ffffff' },
              { id: 'trendline', icon: 'M5 19L19 5M9 19l-4-4M5 15l4-4', title: 'Trendline', color: '#00E5FF' },
              { id: 'horizontal', icon: 'M5 12h14', title: 'Support/Resist', color: '#fcd535' },
              { id: 'long_position', icon: 'M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7 M12 18v-6 M9 15h6', title: 'Long Position', color: '#00FF9D' },
              { id: 'short_position', icon: 'M13 18v-6 M9 15h6 M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z M13 2v7h7', title: 'Short Position', color: '#FF007F' },
            ] as { id: DrawingTool; icon: string; title: string; color: string }[]).map(tool => (
              <button
                key={tool.id}
                title={tool.title}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveTool(prev => prev === tool.id ? 'none' : tool.id as DrawingTool);
                }}
                className={cn(
                  "magnetic-dock-item p-3 rounded-2xl relative transition-all",
                  activeTool === tool.id ? "bg-white/10 ring-1 ring-white/20" : "hover:bg-white/5"
                )}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke={activeTool === tool.id ? tool.color : 'rgba(255,255,255,0.4)'}
                  strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d={tool.icon} />
                </svg>
                {activeTool === tool.id && (
                  <div className="absolute inset-2 blur-md opacity-40 animate-pulse" style={{ backgroundColor: tool.color }} />
                )}
              </button>
            ))}
          </div>
          <div className="w-8 h-[1px] bg-white/10" />
          <button
            title="Clear Terminal Drawings"
            className="p-3 rounded-2xl text-white/20 hover:text-[var(--holo-magenta)] hover:bg-[var(--holo-magenta)]/10 transition-all active:scale-90"
            onClick={() => {
              localStorage.removeItem(`chart_drawings_${symbol.replace('/', '')}`);
              setActiveTool('none');
              window.dispatchEvent(new CustomEvent('clearDrawings', { detail: { symbol } }));
            }}
          >
            <Trash2 className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>


      {/* ═══════════════ CHART AREA ═══════════════ */}
      <div className="relative flex-1 w-full overflow-hidden">
        {/* 💎 AI-ALPHA TACTICAL HUD 💎 */}
        <ChartHUD
          symbol={symbol}
          trend={hudData.trend}
          lastAction={hudData.lastAction}
          nearestShield={hudData.nearestShield}
          nearestMagnet={hudData.nearestMagnet}
          isConfluence={hudData.isConfluence}
          strikeProbability={hudData.strikeProbability}
          reasoning={hudData.reasoning}
          signal={hudData.signal}
          isNewsProtection={hudData.isNewsProtection}
          session={hudData.session}
        />

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
                <div className="px-1.5 py-0.5 rounded backdrop-blur-md bg-[#00E5FF]/10 border border-[#00E5FF]/40 shadow-[0_2px_8px_rgba(0,229,255,0.2)] flex items-center gap-1">
                  <span className="text-[10px] font-mono font-black text-[#00E5FF] tracking-tighter">
                    {visibleHighLow.high.high.toFixed(2)}
                  </span>
                </div>
                {/* Connecting Line */}
                <div className="w-px h-[6px] bg-gradient-to-b from-[#00E5FF]/60 to-[#00E5FF]/0" />
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
                <div className="w-px h-[6px] bg-gradient-to-t from-[#FF007F]/60 to-[#FF007F]/0" />
                <div className="px-1.5 py-0.5 rounded backdrop-blur-md bg-[#FF007F]/10 border border-[#FF007F]/40 shadow-[0_2px_8px_rgba(255,0,127,0.2)] flex items-center gap-1">
                  <span className="text-[10px] font-mono font-black text-[#FF007F] tracking-tighter">
                    {visibleHighLow.low.low.toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-gray-400">Institutional Load:</span>
                  <span className="text-[#00E5FF] font-medium font-mono">{(hudData.adaptiveLb || 5).toFixed(0)} PIVOT</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Pattern Markers Overlay Layer (Intelligence Upgrade) */}
        {config?.patternOverlay !== false && showEngulfing && (
          <div className="absolute inset-0 z-[45] pointer-events-none overflow-hidden">
            {patternMarkers.map((m, idx) => {
              const isBullish = m.type === 'BULLISH';
              const isMostRecent = idx === patternMarkers.length - 1;
              const shouldGlow = isMostRecent || m.hasHighVolume;

              return (
                <React.Fragment key={m.id}>
                  {/* The "Engulf" Box (Improved visibility & Toggle) */}
                  {showPatternBox && (
                    <div
                      id={`engulf-box-${m.id}`}
                      className="absolute pointer-events-none border rounded-md transition-opacity duration-300 opacity-0"
                      style={{
                        borderColor: `${m.color}80`, // 50% opacity border
                        backgroundColor: `${m.color}0D` // ~5% opacity fill
                      }}
                    />
                  )}

                  {/* Primary Pattern Marker (Zoned 10px below/above candle) */}
                  <div
                    id={`pattern-marker-${m.id}`}
                    className="absolute w-5 h-5 flex justify-center items-start opacity-0 will-change-transform pointer-events-auto group/pattern"
                    style={{ transition: 'opacity 0.2s ease' }}
                  >
                    <div className="relative flex flex-col items-center">
                      {/* UI Marker Logic: Primary Small Icons */}
                      {m.type === 'BULLISH' ? (
                        <div className="flex flex-col items-center">
                          <div
                            className={`w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] relative z-10 ${shouldGlow ? 'animate-float-glow' : ''}`}
                            style={{ borderBottomColor: m.color, filter: shouldGlow ? `drop-shadow(0 0 8px ${m.color})` : 'none' }}
                          />
                          {shouldGlow && <div className="absolute -bottom-1 w-6 h-6 bg-[currentColor]/10 blur-xl rounded-full" style={{ color: m.color }} />}
                        </div>
                      ) : m.type === 'BEARISH' ? (
                        <div className="flex flex-col items-center">
                          <div
                            className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-t-[8px] relative z-10"
                            style={{ borderTopColor: m.color }}
                          />
                        </div>
                      ) : (
                        <div className="w-2.5 h-2.5 rounded-full border-2 border-white/20" style={{ backgroundColor: m.color }} />
                      )}

                      {/* Scaled Down Confluence Star ⭐ */}
                      {m.hasHighVolume && (
                        <span className="absolute -top-2 -right-1.5 text-[7px] animate-pulse drop-shadow-[0_0_5px_#fcd535]">⭐</span>
                      )}

                      {/* Vertical Growing Label (Moved to High via syncPills) */}
                      <div
                        id={`pattern-label-${m.id}`}
                        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none opacity-0 group-hover/pattern:opacity-100 transition-opacity"
                      >
                        <div
                          className="text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap"
                          style={{
                            writingMode: 'vertical-lr',
                            transform: 'rotate(180deg)',
                            color: m.color,
                            textShadow: `0 0 10px ${m.color}`
                          }}
                        >
                          {m.label}
                        </div>
                      </div>
                    </div>

                    {/* Enhanced Educational Tooltip */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 opacity-0 group-hover/pattern:opacity-100 pointer-events-none transition-all duration-300 z-[100] w-60 translate-y-2 group-hover/pattern:translate-y-0 text-left">
                      <div className="relative rounded-xl border border-white/10 bg-black/95 backdrop-blur-3xl p-3 shadow-[0_20px_50px_rgba(0,0,0,1),inset_0_1px_0_rgba(255,255,255,0.05)] flex flex-col gap-2">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className={`text-[10px] font-black uppercase tracking-[0.2em]`} style={{ color: m.color }}>
                            {m.label}
                          </span>
                          {m.hasHighVolume && <span className="text-[10px] text-[var(--holo-gold)] font-bold">⭐ Volume Spike</span>}
                        </div>

                        <div className="text-[9px] text-white/80 font-medium leading-relaxed italic">
                          {m.description}
                        </div>

                        <div className="flex flex-col gap-1.5 mt-1 border-t border-white/5 pt-2">
                          <div className="flex justify-between items-center text-[10px] font-mono">
                            <span className="text-white/40">Market Context</span>
                            <span className={`${m.strength === 'HIGH' ? 'text-[var(--holo-gold)]' : 'text-white/60'} font-bold`}>
                              {m.type === 'NEUTRAL' ? 'Neutral' : (m.strength === 'HIGH' ? 'High Probability' : 'Standard')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
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
              <div className={`absolute -inset-1 rounded-full animate-ping opacity-20 ${m.isBuy ? 'bg-[#00E5FF]' : 'bg-[#FF007F]'
                }`} style={{ animationDuration: '2s' }} />

              {/* Pointer Triangles */}
              {m.isBuy ? (
                <div className="absolute left-1/2 -top-[5px] -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-[#00E5FF] z-0" />
              ) : (
                <div className="absolute left-1/2 -bottom-[5px] -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[6px] border-t-[#FF007F] z-0" />
              )}

              {/* Main Rounded Box Backend */}
              <div
                className={`absolute inset-0 border border-white/60 shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] backdrop-blur-2xl flex justify-center items-center z-10 transition-transform duration-300 group-hover:scale-110 ${m.isBuy
                  ? 'bg-gradient-to-br from-[#00E5FF] to-[#00aaee] rounded-md'
                  : 'bg-gradient-to-br from-[#FF007F] to-[#ee0070] rounded-md'
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
                        <span className={t.type === 'BUY' ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]'}>{t.type} @ {Number(t.price).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-mono">
                        <span className="text-white/40">Amount</span>
                        <span className="text-white">{Number(t.quantity).toFixed(4)} <span className="text-white/40">{symbol.replace('USDT', '')}</span></span>
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
              left: `clamp(4px, ${crosshairData.x > 150 ? crosshairData.x - 125 : crosshairData.x + 15}px, calc(100% - 130px))`,
              top: `${Math.max(10, crosshairData.y - 120)}px`,
            }}
          >
            {/* Cyberpunk Floating Card */}
            <div className="flex flex-col gap-1.5 glass-panel p-2.5 w-[115px] animate-float-glow rounded-xl">
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
                const colorClass = key === 'close'
                  ? (isUp ? 'neon-text-cyan' : 'neon-text-magenta')
                  : 'text-white';

                return (
                  <div key={key} className="flex justify-between items-center text-[10px] font-mono leading-tight">
                    <span className="text-[#848e9c] font-bold tracking-wider capitalize">{key}</span>
                    <span className={`font-black ${colorClass}`}>
                      {val.toFixed(2)}
                    </span>
                  </div>
                );
              })}

              {/* Volume */}
              {crosshairData.volume !== undefined && (
                <div className="flex justify-between items-center text-[10px] font-mono leading-tight border-t border-white/5 pt-1.5 mt-0.5">
                  <span className="text-[#848e9c] font-bold tracking-wider capitalize">Vol</span>
                  <span className="font-bold text-[var(--holo-gold)]">{crosshairData.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              )}

              {/* Optional Sub-Indicators (if active and data exists) */}
              {subIndicators.includes('MACD') && crosshairData.macd && (
                <div className="flex justify-between items-center text-[10px] font-mono leading-tight pt-0.5">
                  <span className="text-[#848e9c] font-bold tracking-wider">MACD</span>
                  <span className={`font-bold ${crosshairData.macd.MACD >= 0 ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]'}`}>{crosshairData.macd.MACD.toFixed(2)}</span>
                </div>
              )}
              {subIndicators.includes('RSI') && crosshairData.rsi && (
                <div className="flex justify-between items-center text-[10px] font-mono leading-tight pt-0.5">
                  <span className="text-[#848e9c] font-bold tracking-wider">RSI</span>
                  <span className={`font-bold ${crosshairData.rsi >= 70 ? 'text-[var(--holo-magenta)]' : crosshairData.rsi <= 30 ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-gold)]'}`}>{crosshairData.rsi.toFixed(1)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Brand Watermark 2050 ─────────────────────────────── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 overflow-hidden w-full h-full">
          <div className="flex flex-col items-center gap-2 max-w-full px-4">
            <span
              className="text-[12vw] sm:text-[10vw] md:text-[110px] font-black tracking-[0.4em] uppercase text-transparent bg-clip-text animate-pulse opacity-[0.05] whitespace-nowrap"
              style={{ backgroundImage: 'linear-gradient(45deg, var(--holo-cyan), var(--holo-magenta))' }}
            >
              MOBEEN
            </span>
            <div className="flex items-center gap-3">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-[var(--holo-cyan)]" />
              <span className="text-[10px] md:text-[12px] font-bold text-[var(--holo-cyan)] opacity-40 tracking-[0.8em] uppercase">CryptoBot Terminal</span>
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-[var(--holo-magenta)]" />
            </div>
          </div>
        </div>

        {/* ── Recent Top & Bottom Price Tags handled by Overlay Layer above ── */}

        {/* ── Average Price Lines (Left Side Labels) — only when toggled on ── */}
        {showAvgLines && avgPositions.buyPrice > 0 && (
          <div
            className="absolute z-10 left-0 flex items-center gap-2 bg-black/60 backdrop-blur-xl border-y border-r border-[var(--holo-cyan)]/40 text-white text-[9px] font-bold font-mono px-3 py-1.5 rounded-r-xl shadow-[4px_0_20px_rgba(0,229,255,0.2)] pointer-events-none transition-all duration-100"
            style={{ top: avgPositions.buyPrice, transform: 'translateY(-50%)' }}
          >
            <div className="flex items-center gap-1.5 text-[var(--holo-cyan)] pr-2 border-r border-white/10">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M7 17l9.2-9.2M7 7h10v10" /></svg>
              <span className="tracking-[0.2em]">BUY</span>
            </div>
            <span className="text-[10px]">{avgPositions.buyPrice.toFixed(2)}</span>
            {data.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] ${data[data.length - 1].close > avgPositions.buyPrice ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#FF007F]/20 text-[#FF007F]'}`}>
                {(((data[data.length - 1].close - avgPositions.buyPrice) / avgPositions.buyPrice) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        )}
        {showAvgLines && avgPositions.sellPrice > 0 && (
          <div
            className="absolute z-10 left-0 flex items-center gap-2 bg-black/60 backdrop-blur-xl border-y border-r border-[var(--holo-magenta)]/40 text-white text-[9px] font-bold font-mono px-3 py-1.5 rounded-r-xl shadow-[4px_0_20px_rgba(255,0,127,0.2)] pointer-events-none transition-all duration-100"
            style={{ top: avgPositions.sellPrice, transform: 'translateY(-50%)' }}
          >
            <div className="flex items-center gap-1.5 text-[var(--holo-magenta)] pr-2 border-r border-white/10">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M17 7l-9.2 9.2M17 17H7V7" /></svg>
              <span className="tracking-[0.2em]">SELL</span>
            </div>
            <span className="text-[10px]">{avgPositions.sellPrice.toFixed(2)}</span>
            {data.length > 0 && (
              <span className={`ml-1 px-1.5 py-0.5 rounded text-[8px] ${avgPositions.sellPrice > data[data.length - 1].close ? 'bg-[#00E5FF]/20 text-[#00E5FF]' : 'bg-[#FF007F]/20 text-[#FF007F]'}`}>
                {(((avgPositions.sellPrice - data[data.length - 1].close) / avgPositions.sellPrice) * 100).toFixed(2)}%
              </span>
            )}
          </div>
        )}

        {/* Drawing Layer */}
        <ChartDrawingLayer
          chartApi={chartRef.current}
          candleSeries={seriesRef.current}
          symbol={symbol}
          interval={chartInterval}
          activeTool={activeTool}
          onToolChange={setActiveTool}
          drawings={drawings}
          setDrawings={setDrawings}
          data={data}
        />

        {/* ── Active Candle Highlight Aura ── */}
        {hoveredCandleX !== null && (
          <div
            className="absolute top-0 bottom-0 z-[5] pointer-events-none bg-gradient-to-b from-transparent via-[var(--holo-cyan)]/10 to-transparent w-[12px]"
            style={{ left: hoveredCandleX - 6 }}
          />
        )}

        {/* ── Holographic Crosshair Intersection ── */}
        {crosshairPos !== null && (
          <div
            className="absolute z-[21] pointer-events-none w-3 h-3 rounded-full bg-[var(--holo-cyan)] shadow-[0_0_15px_var(--holo-cyan),inset_0_0_4px_white] -translate-x-1/2 -translate-y-1/2 transition-transform duration-75"
            style={{ left: crosshairPos.x, top: crosshairPos.y }}
          >
            <div className="absolute inset-0 rounded-full animate-ping bg-[var(--holo-cyan)] opacity-20" />
          </div>
        )}

        {/* ── Floating Candle Countdown HUD (Pinned to Price) ── */}
        {candleCountdown && candleCountdown.priceY > 0 && (
          <div
            className="absolute z-30 right-0 pointer-events-none pr-1 transition-all duration-100 ease-linear"
            style={{ top: candleCountdown.priceY, transform: 'translateY(-50%)' }}
          >
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-l-lg border-y border-l backdrop-blur-md shadow-lg ${candleCountdown.isUp
              ? 'bg-[var(--holo-cyan)]/10 border-[var(--holo-cyan)]/30 text-[var(--holo-cyan)]'
              : 'bg-[var(--holo-magenta)]/10 border-[var(--holo-magenta)]/30 text-[var(--holo-magenta)]'
              }`}>
              <div className={`w-1 h-1 rounded-full animate-pulse ${candleCountdown.isUp ? 'bg-[var(--holo-cyan)] shadow-[0_0_8px_var(--holo-cyan)]' : 'bg-[var(--holo-magenta)] shadow-[0_0_8px_var(--holo-magenta)]'}`} />
              <span className="text-[10px] font-mono font-black tracking-widest">{candleCountdown.text}</span>
            </div>
          </div>
        )}

        {/* Chart Canvas */}
        <div ref={chartContainerRef} className="w-full h-full relative z-0" />
      </div>
    </div>
  );
};
