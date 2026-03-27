import React, { useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { Chart } from './components/Chart';
import { OrderPanel } from './components/OrderPanel';
import { AIAgentPanel } from './components/AIAgentPanel';
import { OrderBook } from './components/OrderBook';
import { RecentTrades } from './components/RecentTrades';
import { CoinSelector } from './components/CoinSelector';
import { CoinInfo } from './components/CoinInfo';
import { PerformanceChart } from './components/PerformanceChart';
import { CurrentPositions } from './components/CurrentPositions';
import { CopierControls } from './components/CopierControls';
import { DatabasePanel } from './components/DatabasePanel';
import { DeltaNeutralPanel } from './components/DeltaNeutralPanel';
import { BotPanel } from './components/BotPanel';
import { MarketWatchlist } from './components/MarketWatchlist';
import { OpenOrdersPanel } from './components/OpenOrdersPanel';
import { Menu, X, Bell, User, Search, LayoutGrid, ChevronDown, ChevronRight, Globe, Settings, Wallet, LineChart, CandlestickChart, Layout, Play, History, Shield, TrendingUp, TrendingDown, Clock, Maximize2, Palette, Eye, EyeOff, Trash2, SlidersHorizontal, RefreshCw, Briefcase, Bot, Database } from 'lucide-react';
import { placeOrder, fetchBalance as fetchBinanceBalance } from './services/api';
import { ChartStyleModal } from './components/ChartStyleModal';
import { ChartConfig, DEFAULT_CHART_CONFIG } from './types/chart';
import toast, { Toaster } from 'react-hot-toast';

// Utility to normalize interval strings to Binance-canonical format
const canonicalInterval = (interval: string): string => {
  if (!interval) return '1h';
  const match = interval.match(/^(\d+)([a-zA-Z])$/);
  if (!match) return interval.toLowerCase();
  const val = match[1];
  const unit = match[2];
  // Binance: 'm' for minute, 'M' for month. Everything else lowercase.
  if (unit === 'M') return val + 'M';
  return val + unit.toLowerCase();
};

// Advanced, high-precision candle countdown with session status
const CandleCountdown: React.FC<{ interval: string; onChange?: (val: string) => void }> = ({ interval, onChange }) => {
  const [timeLeft, setTimeLeft] = useState<string>('--:--');
  const [progress, setProgress] = useState<number>(0);
  const [session, setSession] = useState<{ name: string, color: string } | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const msSinceEpoch = now.getTime();

      const match = interval.match(/^(\d+)([a-zA-Z])$/);
      const val = match ? parseInt(match[1]) : 1;
      let unit = match ? match[2] : 'm';

      if (unit.toLowerCase() === 'h') unit = 'h';
      if (unit.toLowerCase() === 'd') unit = 'd';
      if (unit.toLowerCase() === 'w') unit = 'w';

      let msPerInterval = 60000;
      let nextTick: number;

      if (unit === 'M') {
        // Precise month boundary: 1st of next month at 00:00:00 UTC
        const currentMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + val, 1));
        nextTick = nextMonth.getTime();
        msPerInterval = nextTick - currentMonth.getTime();
      } else {
        if (unit === 'm') msPerInterval = val * 60 * 1000;
        else if (unit === 'h') msPerInterval = val * 60 * 60 * 1000;
        else if (unit === 'd') msPerInterval = val * 24 * 60 * 60 * 1000;
        else if (unit === 'w') msPerInterval = val * 7 * 24 * 60 * 60 * 1000;

        const offset = unit === 'w' ? 4 * 24 * 60 * 60 * 1000 : 0;
        nextTick = Math.ceil((msSinceEpoch - offset) / msPerInterval) * msPerInterval + offset;
      }

      const remains = Math.max(0, nextTick - msSinceEpoch);
      const h = Math.floor(remains / (1000 * 60 * 60));
      const m = Math.floor((remains % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((remains % (1000 * 60)) / 1000);

      setTimeLeft(h > 0
        ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
        : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
      setProgress((remains / msPerInterval) * 100);

      // Session Logic (UTC)
      const hour = now.getUTCHours();
      if (hour >= 8 && hour < 16) setSession({ name: 'London', color: '#00E5FF' });
      else if (hour >= 13 && hour < 21) setSession({ name: 'New York', color: '#FF007F' });
      else if (hour >= 0 && hour < 8) setSession({ name: 'Tokyo', color: '#FCD535' });
      else setSession(null);

    }, 1000);
    return () => clearInterval(timer);
  }, [interval]);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => onChange?.('OPEN_SELECTOR')}
        className="flex items-center gap-2.5 bg-[#05070a]/80 backdrop-blur-2xl border border-white/5 shadow-[0_0_20px_rgba(0,0,0,0.4)] rounded-full px-3 py-1.5 transition-all hover:border-[var(--holo-cyan)]/30 cursor-pointer group/time"
      >
        <div className="relative w-4 h-4 flex items-center justify-center shrink-0">
          <svg className="w-full h-full -rotate-90">
            <circle cx="50%" cy="50%" r="6" className="stroke-white/5 fill-none" strokeWidth="2" />
            <circle
              cx="50%" cy="50%" r="6"
              className="stroke-[var(--holo-cyan)] fill-none transition-all duration-1000 ease-linear"
              strokeWidth="2"
              strokeDasharray="37.7"
              strokeDashoffset={37.7 * (1 - progress / 100)}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1 h-1 rounded-full bg-[var(--holo-cyan)] shadow-[0_0_8px_var(--holo-cyan)]" />
          </div>
        </div>

        <div className="flex flex-col min-w-[42px]">
          <span className="text-[11px] font-mono font-black text-white leading-none tracking-tighter group-hover:text-[var(--holo-cyan)] transition-colors">
            {timeLeft}
          </span>
          {session && (
            <span className="text-[7px] font-black uppercase tracking-[0.2em] leading-none mt-1 flex items-center gap-1" style={{ color: session.color }}>
              <span className="w-1 h-1 rounded-full bg-current animate-pulse" />
              {session.name}
            </span>
          )}
        </div>

        <div className="w-px h-5 bg-white/5 mx-0.5 hidden sm:block" />
        <div className="hidden sm:flex flex-col items-start">
          <span className="text-[8px] font-black text-white/40 uppercase tracking-widest leading-none">UTC Clock</span>
          <span className="text-[10px] font-mono font-bold text-white/60 leading-none mt-1">
            {new Date().getUTCHours().toString().padStart(2, '0')}:{new Date().getUTCMinutes().toString().padStart(2, '0')}
          </span>
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-[#0a0f1a]/95 backdrop-blur-3xl border border-[var(--holo-cyan)]/20 shadow-[0_10px_50px_rgba(0,0,0,0.8)] rounded-xl z-[100] py-2 animate-in fade-in zoom-in-95 duration-200">
          <div className="px-3 py-1.5 text-[9px] font-bold text-[#5e6673] uppercase tracking-widest border-b border-white/5 mb-2">Interval Target</div>
          <div className="grid grid-cols-3 gap-1 px-2">
            {['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'].map(tf => (
              <button
                key={tf}
                onClick={() => {
                  onChange?.(tf);
                  setIsOpen(false);
                }}
                className={`px-2 py-1.5 text-[10px] font-bold rounded-lg transition-colors uppercase ${canonicalInterval(interval) === canonicalInterval(tf)
                    ? 'bg-[var(--holo-cyan)]/20 text-[var(--holo-cyan)] border border-[var(--holo-cyan)]/30 shadow-[inset_0_0_8px_rgba(0,229,255,0.2)]'
                    : 'text-[#848e9c] hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [activeMode, setActiveMode] = useState<'SPOT' | 'DELTA'>('SPOT');
  const [chartInterval, setChartInterval] = useState('1h');
  const [marketData, setMarketData] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [balance, setBalance] = useState<string>('0.00');
  const [baseBalance, setBaseBalance] = useState<string>('0.00');
  const [userTrades, setUserTrades] = useState<any[]>([]);
  const [openOrders, setOpenOrders] = useState<any[]>([]);

  // Secondary Account State (Mocked or Future implementation)
  const [slaveBalance, setSlaveBalance] = useState<string>('1500.00');
  const [slaveBaseBalance, setSlaveBaseBalance] = useState<string>('0.00');

  const [lastClosedCandle, setLastClosedCandle] = useState<{ price: number, time: number } | null>(null);

  const [ticker24h, setTicker24h] = useState<any>(null);
  const [orderBook, setOrderBook] = useState<{ bids: [string, string][], asks: [string, string][] }>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [error, setError] = useState<{ message: string, details?: string, code?: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'positions' | 'analytics' | 'history' | 'ai' | 'database' | 'delta' | 'bot'>('positions');

  // Chart & Indicator Management State
  const [mainIndicator, setMainIndicator] = useState<string | null>('SUPER');
  const [subIndicators, setSubIndicators] = useState<string[]>(['VOL', 'RSI']);
  const [isStyleModalOpen, setIsStyleModalOpen] = useState(false);
  const [chartConfig, setChartConfig] = useState<ChartConfig>(DEFAULT_CHART_CONFIG);
  const [chartView, setChartView] = useState<'price' | 'depth'>('price');
  const [visibleTimeframes, setVisibleTimeframes] = useState(['5m', '15m', '30m', '1h', '8h']);
  const [isTimeSelectorOpen, setIsTimeSelectorOpen] = useState(false);
  const [isIndicatorLegendVisible, setIsIndicatorLegendVisible] = useState(true);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Check environment on mount
    fetch('/api/health')
      .then(res => {
        if (!res.ok) throw new Error('Health check failed');
        return res.json();
      })
      .then(data => setIsSandbox(data.sandbox))
      .catch(err => {
        console.error('Failed to check health:', err);
        // Fallback to env variable if API fails
        setIsSandbox((import.meta as any).env.VITE_BINANCE_USE_TESTNET === 'true');
      });

    // Refetch data when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setLastRefreshed(Date.now());
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const refreshBalance = async () => {
    try {
      const data = await fetchBinanceBalance();
      const usdtBalance = data.balances?.find((b: any) => b.asset === 'USDT');
      if (usdtBalance) {
        setBalance(parseFloat(usdtBalance.free).toFixed(2));
      }
      const baseAsset = symbol.replace('USDT', '');
      const bBalance = data.balances?.find((b: any) => b.asset === baseAsset);
      if (bBalance) {
        setBaseBalance(parseFloat(bBalance.free).toFixed(4));
      } else {
        setBaseBalance('0.00');
      }
      // Clear error if balance fetch succeeds
      if (error?.code === 'INVALID_API_KEY') setError(null);
    } catch (err: any) {
      console.error('Failed to fetch balance:', err);
      if (err.code === 'INVALID_API_KEY') {
        setError({
          message: err.message,
          details: err.details,
          code: err.code
        });
      }
    }
  };

  useEffect(() => {
    refreshBalance();

    // Fetch historical user trades
    fetch('/api/backend/trades')
      .then(res => res.json())
      .then(data => setUserTrades(data || []))
      .catch(err => console.error('Failed to fetch user trades:', err));

    const fetchOpenOrders = () => {
      fetch('/api/backend/openOrders')
        .then(res => res.json())
        .then(data => setOpenOrders(data || []))
        .catch(err => console.error('Failed to fetch open orders:', err));
    };

    fetchOpenOrders();
    // Poll open orders every 5 seconds to keep chart lines updated when orders fill
    const openOrdersInterval = setInterval(fetchOpenOrders, 5000);

    // Replace HTTP Polling with WebSockets for real-time portfolio updates
    const socket = io();

    socket.on('connect', () => {
      console.log('UI WebSockets Connected to Backend');
    });

    socket.on('balance_update', () => {
      console.log('Real-time balance update received');
      refreshBalance();
    });

    return () => {
      socket.disconnect();
      clearInterval(openOrdersInterval);
    };
  }, [symbol]);

  useEffect(() => {
    setOrderBook({ bids: [], asks: [] });
    setRecentTrades([]);
    setMarketData([]);
    setTicker24h(null);
    setCurrentPrice(0);
    setPriceChange(0);
  }, [symbol]);

  // Clear market data on interval change to show loading state
  useEffect(() => {
    setMarketData([]);
  }, [chartInterval]);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      try {
        const interval = canonicalInterval(chartInterval);
        const response = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${interval}&limit=1000`);
        const result = await response.json();

        // Handle both old and new backend responses gracefully
        const data = result.klines || result;
        const ind = result.indicators || {};

        if (!Array.isArray(data)) {
          console.error('Historical data format error:', data);
          return;
        }

        const emaOffset = data.length - (ind.ema200?.length || 0);
        const rsiOffset = data.length - (ind.rsi?.length || 0);
        const macdOffset = data.length - (ind.macd?.length || 0);
        const bollOffset = data.length - (ind.boll?.length || 0);
        const atrOffset = data.length - (ind.atr?.length || 0);
        const smaOffset = data.length - (ind.sma?.length || 0);
        const sarOffset = data.length - (ind.sar?.length || 0);
        const wrOffset = data.length - (ind.wr?.length || 0);
        const obvOffset = data.length - (ind.obv?.length || 0);
        const stochRsiOffset = data.length - (ind.stochRsi?.length || 0);
        const kdjOffset = data.length - (ind.kdj?.length || 0);

        const formattedData = data.map((d: any, i: number) => ({
          time: d[0] / 1000,
          open: parseFloat(d[1]),
          high: parseFloat(d[2]),
          low: parseFloat(d[3]),
          close: parseFloat(d[4]),
          volume: parseFloat(d[5] || 0),
          ema200: i >= emaOffset ? ind.ema200[i - emaOffset] : undefined,
          rsi: i >= rsiOffset ? ind.rsi[i - rsiOffset] : undefined,
          macd: i >= macdOffset ? ind.macd[i - macdOffset] : undefined,
          boll: i >= bollOffset ? ind.boll[i - bollOffset] : undefined,
          atr: i >= atrOffset ? ind.atr[i - atrOffset] : undefined,
          sma: i >= smaOffset ? ind.sma[i - smaOffset] : undefined,
          sar: i >= sarOffset ? ind.sar[i - sarOffset] : undefined,
          wr: i >= wrOffset ? ind.wr[i - wrOffset] : undefined,
          obv: i >= obvOffset ? ind.obv[i - obvOffset] : undefined,
          stochRsi: i >= stochRsiOffset ? ind.stochRsi[i - stochRsiOffset] : undefined,
          kdj: i >= kdjOffset ? ind.kdj[i - kdjOffset] : undefined,
          // Alligator is already index-aligned to klines (same length)
          alligator: ind.alligator ? ind.alligator[i] : undefined,
        }));

        setMarketData(formattedData);
        if (formattedData.length > 0) {
          setCurrentPrice(formattedData[formattedData.length - 1].close);
          const openPrice = formattedData[0].open;
          setPriceChange(((formattedData[formattedData.length - 1].close - openPrice) / openPrice) * 100);
        }
      } catch (error) {
        console.error('Failed to fetch historical data:', error);
      }
    };

    fetchHistoricalData();

    if (wsRef.current) {
      wsRef.current.close();
    }

    const interval = canonicalInterval(chartInterval);
    const streams = [
      `${symbol.toLowerCase()}@kline_${interval}`,
      `${symbol.toLowerCase()}@depth20@100ms`,
      `${symbol.toLowerCase()}@trade`,
      `${symbol.toLowerCase()}@ticker`
    ].join('/');

    const wsUrl = isSandbox
      ? `wss://testnet.binance.vision/stream?streams=${streams}`
      : `wss://stream.binance.com:9443/stream?streams=${streams}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setApiConnected(true);
    ws.onclose = () => setApiConnected(false);

    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (!payload.stream) return;

      const { stream, data } = payload;
      const interval = canonicalInterval(chartInterval);

      if (stream.endsWith(`@kline_${interval}`)) {
        const kline = data.k;
        const updatedCandle = {
          time: kline.t / 1000,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
        };

        if (kline.x) {
          setLastClosedCandle({ price: updatedCandle.close, time: updatedCandle.time });
        }

        setCurrentPrice(updatedCandle.close);

        setMarketData((prev) => {
          if (prev.length === 0) return [updatedCandle];

          const lastCandle = prev[prev.length - 1];
          if (lastCandle.time === updatedCandle.time) {
            return [...prev.slice(0, -1), updatedCandle];
          } else {
            return [...prev, updatedCandle];
          }
        });
      } else if (stream.endsWith('@depth20@100ms')) {
        setOrderBook({ bids: data.bids, asks: data.asks });
      } else if (stream.endsWith('@trade')) {
        setRecentTrades(prev => {
          const newTrade = {
            id: data.t,
            price: data.p,
            quantity: data.q,
            time: data.T,
            isBuyerMaker: data.m
          };
          return [newTrade, ...prev].slice(0, 50);
        });
      } else if (stream.endsWith('@ticker')) {
        setTicker24h({
          high: data.h,
          low: data.l,
          volume: data.v,
          priceChangePercent: data.P
        });
        setPriceChange(parseFloat(data.P));
      }
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [symbol, chartInterval, isSandbox, lastRefreshed]);

  const handlePlaceOrder = async (order: any) => {
    setIsPlacingOrder(true);
    setError(null);
    const orderToast = toast.loading('Transmitting order to exchange...');

    try {
      // Convert symbol to CCXT format if needed (e.g., BTCUSDT -> BTC/USDT)
      const ccxtSymbol = symbol.includes('USDT') ? `${symbol.replace('USDT', '')}/USDT` : symbol;

      const data = await placeOrder({
        ...order,
        symbol: ccxtSymbol
      });

      if (order.type === 'MARKET') {
        toast.success(`Market Order Filled: ${data.id || 'Confirmed'}`, { id: orderToast });
      } else {
        toast.success(`${order.type} Order Placed. Waiting in Pending Orders...`, { id: orderToast, duration: 6000 });
      }

      // Refresh balance after successful order
      setTimeout(refreshBalance, 1000);
    } catch (err: any) {
      console.error('Order error:', err);
      toast.error(err.message || 'Execution Failed', {
        id: orderToast,
        duration: 5000
      });
      setError({
        message: err.message,
        details: err.details,
        code: err.code
      });
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-2050-gradient text-[#eaecef] font-sans selection:bg-[var(--holo-cyan)]/20 selection:text-white flex flex-col">
      <Toaster
        position="bottom-right"
        toastOptions={{
          className: '!bg-[#181a20] !text-[#eaecef] !font-sans !text-xs !border !border-[#2b3139] !shadow-2xl !rounded-xl',
          success: { iconTheme: { primary: 'var(--holo-cyan)', secondary: '#0b0e11' } },
          error: { iconTheme: { primary: 'var(--holo-magenta)', secondary: '#0b0e11' } },
        }}
      />

      {/* ═══════════════════════════ HEADER ═══════════════════════════ */}
      <header className="glass-panel border-b border-white/5 px-2 sm:px-3 md:px-5 py-1.5 sm:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between sticky top-0 z-50 sm:h-14 shrink-0 gap-y-1">
        {/* Left: Logo + Pair + Price */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-5 h-full min-w-0">
          {/* Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2 pr-2 sm:pr-4 border-r border-[#2b3139] h-full shrink-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[var(--holo-gold)] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0b0e11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight hidden sm:block">CryptoBot<span className="text-[var(--holo-gold)]">.</span></span>
          </div>

          {/* Pair Selector */}
          <CoinSelector symbol={symbol} setSymbol={setSymbol} />

          {/* Price Display */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <span className={`font-mono font-bold text-base sm:text-xl tracking-tight ${priceChange >= 0 ? 'text-[var(--holo-cyan)] drop-shadow-[0_0_8px_var(--holo-cyan-glow)]' : 'text-[var(--holo-magenta)] drop-shadow-[0_0_8px_var(--holo-magenta-glow)]'}`}>
              {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="hidden sm:flex">
              <CandleCountdown interval={chartInterval} onChange={(val) => setChartInterval(val)} />
            </span>
          </div>

          {/* 24h Stats */}
          {ticker24h && (
            <div className="hidden xl:flex items-center gap-5 pl-4 border-l border-[#2b3139] h-full">
              {[
                { label: '24h Change', value: `${priceChange >= 0 ? '+' : ''}${parseFloat(ticker24h.priceChangePercent).toFixed(2)}%`, color: priceChange >= 0 ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]' },
                { label: '24h High', value: parseFloat(ticker24h.high).toLocaleString(), color: 'text-white' },
                { label: '24h Low', value: parseFloat(ticker24h.low).toLocaleString(), color: 'text-white' },
                { label: '24h Vol', value: parseFloat(ticker24h.volume).toLocaleString(undefined, { maximumFractionDigits: 0 }), color: 'text-white' },
              ].map((s, i) => (
                <div key={i} className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-[#5e6673] uppercase tracking-wider font-medium">{s.label}</span>
                  <span className={`text-xs font-mono font-semibold ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Controls + Status */}
        <div className="flex items-center gap-1.5 sm:gap-3 h-full shrink-0">
          {activeMode === 'SPOT' && (
            <span className="hidden lg:flex"><CopierControls /></span>
          )}

          {/* Wallet Balance Pill */}
          <div className="hidden md:flex items-center gap-2 bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2 sm:px-3 py-1.5">
            <Wallet className="w-3.5 h-3.5 text-[var(--holo-gold)]" />
            <span className="text-[10px] sm:text-xs font-mono font-bold text-[#eaecef]">${parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          {/* §9.1 Nav Action Buttons (Delta Master Context) */}
          {activeMode === 'DELTA' && (
            <div className="hidden md:flex items-center gap-1">
              <button onClick={() => { refreshBalance(); toast.success('Synced'); }} className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[var(--holo-gold)] bg-[var(--holo-gold)]/5 hover:bg-[var(--holo-gold)]/15 border border-[var(--holo-gold)]/20 rounded-md transition-all" title="Force Sync">
                <RefreshCw className="w-3 h-3" /> Sync
              </button>
              <button onClick={async () => { try { const r = await fetch('/api/bot/pause', { method: 'POST' }); const d = await r.json(); toast(r.ok ? d.message : d.error, { icon: r.ok ? '⏸️' : '❌' }); } catch { toast.error('Pause failed'); } }} className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 border border-amber-500/20 rounded-md transition-all" title="Pause Engine">
                ⏸ Pause
              </button>
              <button onClick={async () => { if (!confirm('Close ALL positions and terminate?')) return; try { const r = await fetch('/api/bot/close-all', { method: 'POST' }); const d = await r.json(); toast(r.ok ? d.message : d.error, { icon: r.ok ? '🛑' : '❌' }); } catch { toast.error('Close All failed'); } }} className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-red-400 bg-red-500/5 hover:bg-red-500/15 border border-red-500/20 rounded-md transition-all" title="Emergency Close All">
                🛑 Close All
              </button>
            </div>
          )}

          {/* 24h Change (mobile only - compact) */}
          {ticker24h && (
            <div className="flex xl:hidden items-center">
              <span className={`text-[10px] font-mono font-bold ${priceChange >= 0 ? 'text-[var(--holo-cyan)]' : 'text-[var(--holo-magenta)]'}`}>
                {priceChange >= 0 ? '+' : ''}{parseFloat(ticker24h.priceChangePercent).toFixed(2)}%
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 sm:gap-4 overflow-hidden">

            <div className="flex items-center gap-1.5 glass-panel rounded-lg px-2 py-1">
              <div className={`glow-dot-sm ${apiConnected ? 'bg-[var(--holo-cyan)] drop-shadow-[0_0_8px_var(--holo-cyan-glow)]' : 'bg-[var(--holo-magenta)] drop-shadow-[0_0_8px_var(--holo-magenta-glow)]'}`} />
              <span className="text-[9px] sm:text-[10px] font-mono font-bold text-white uppercase tracking-widest">{apiConnected ? 'LIVE' : 'OFF'}</span>
            </div>

            {/* Sandbox Badge */}
            {isSandbox && (
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-[var(--holo-gold)] bg-[var(--holo-gold)]/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-[var(--holo-gold)]/20">Test</span>
            )}
          </div>
        </div>
      </header>

      {/* ═══════════════════════════ MAIN ═════════════════════════════ */}
      <main className="flex-1 p-2 flex flex-col gap-2 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">

        {/* Error Overlay */}
        {error && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1rem)] sm:w-full max-w-md px-2 sm:px-0">
            <div className="bg-black/40 backdrop-blur-md border border-[var(--holo-magenta)]/30 p-4 rounded-xl shadow-[0_8px_32px_rgba(255,0,127,0.15)] flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--holo-magenta)]/15 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--holo-magenta)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[var(--holo-magenta)]">{error.message}</h3>
                {error.details && <p className="text-xs text-[#848e9c] mt-1 leading-relaxed">{error.details}</p>}
                <div className="mt-1 flex flex-wrap gap-2">
                  {error.message.includes('WebSocket') ? (
                    <span className="text-[10px] bg-[var(--holo-magenta)]/10 border border-[var(--holo-magenta)]/20 px-2 py-0.5 rounded text-[var(--holo-magenta)] font-mono">Retrying connect...</span>
                  ) : (
                    <span className="text-[10px] bg-[var(--holo-magenta)]/10 border border-[var(--holo-magenta)]/20 px-2 py-0.5 rounded text-[var(--holo-magenta)] font-mono">Check .env</span>
                  )}
                  {error.message.includes('API') && <span className="text-[10px] bg-[var(--holo-magenta)]/10 border border-[var(--holo-magenta)]/20 px-2 py-0.5 rounded text-[var(--holo-magenta)] font-mono">Verify Keys</span>}
                </div>
              </div>
              <button onClick={() => setError(null)} className="text-[#5e6673] hover:text-[#eaecef] transition-colors p-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
          </div>
        )}

        {/* ─── TOP ROW: Chart + Order Panels ──────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-2 shrink-0 items-stretch">

          {/* Chart Panel */}
          <div
            id="crypto-terminal-chart-wrapper"
            className="h-[450px] sm:h-[550px] lg:h-auto lg:flex-[3] glass-panel flex flex-col relative overflow-hidden shrink-0 w-full z-0 transition-colors duration-300 bg-black/90"
          >
            {/* Chart Toolbar: Command Center */}
            <div
              className="px-2 py-1.5 border-b border-white/5 flex items-center justify-between shrink-0 transition-colors duration-300 relative z-20"
            >
              <div className="flex items-center gap-1 sm:gap-4 overflow-hidden">
                {/* Resolution Strip */}
                <div className="flex items-center bg-[#0b0e11]/60 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_10px_rgba(0,0,0,0.5)] rounded-xl p-1 gap-1 relative group/res">
                  <button
                    onClick={() => setChartConfig({ ...chartConfig, style: 'line' })}
                    className={`px-3 py-1.5 rounded-lg transition-all duration-300 flex items-center justify-center relative ${chartConfig.style === 'line'
                        ? 'text-[var(--holo-gold)] bg-[var(--holo-gold)]/10 shadow-[0_0_15px_rgba(252,213,53,0.1)] border border-[var(--holo-gold)]/20'
                        : 'text-[#5e6673] border border-transparent hover:text-white hover:bg-white/5'
                      }`}
                    title="Time Series"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                  </button>

                  <div className="w-px h-3.5 bg-white/5 mx-0.5" />

                  {visibleTimeframes.slice(0, -1).map(tf => {
                    const isActive = canonicalInterval(chartInterval) === canonicalInterval(tf);
                    return (
                      <button
                        key={tf}
                        onClick={() => {
                          setChartInterval(canonicalInterval(tf));
                          setChartConfig({ ...chartConfig, style: 'candle' });
                        }}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all duration-300 relative ${isActive
                            ? 'text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10 shadow-[0_0_20px_rgba(0,229,255,0.15)] border border-[var(--holo-cyan)]/30'
                            : 'text-[#5e6673] border border-transparent hover:text-white hover:bg-white/5'
                          }`}
                      >
                        {tf}
                        {isActive && <div className="absolute -bottom-0.5 left-1 right-1 h-0.5 bg-[var(--holo-cyan)] rounded-full blur-[2px] opacity-60" />}
                      </button>
                    );
                  })}

                  {/* "More" Trigger for Central Selector */}
                  <button
                    onClick={() => setIsTimeSelectorOpen(true)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] rounded-lg transition-all duration-300 flex items-center gap-1 ${isTimeSelectorOpen ? 'text-[var(--holo-cyan)] bg-[var(--holo-cyan)]/10' : 'text-[#5e6673] hover:text-white hover:bg-white/5'
                      }`}
                  >
                    More
                    <LayoutGrid className="w-3 h-3" />
                  </button>
                </div>

                <div className="h-4 w-px bg-[#2b3139] shrink-0" />

                {/* Depth Toggle */}
                <button
                  onClick={() => setChartView(chartView === 'price' ? 'depth' : 'price')}
                  className={`px-3 py-1 text-[11px] font-bold uppercase tracking-widest rounded transition-all ${chartView === 'depth' ? 'text-[var(--holo-gold)] bg-[var(--holo-gold)]/10 shadow-[inset_0_0_10px_rgba(252,213,53,0.1)]' : 'text-[#848e9c] hover:text-white'}`}
                >
                  Depth
                </button>
              </div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button
                  onClick={() => setIsStyleModalOpen(true)}
                  className="p-1.5 text-[#848e9c] hover:text-[var(--holo-gold)] hover:bg-white/5 rounded transition-all"
                  title="Chart Settings & Indicators"
                >
                  <SlidersHorizontal className="w-4 h-4" />
                </button>
                <button
                  onClick={() => toast('Advanced Tactical Tools Module requires Pro License authorization.', { icon: '🔒', style: { background: 'var(--surface-modal)', color: 'var(--holo-gold)', border: '1px solid var(--holo-gold)' } })}
                  className="p-1.5 text-[#848e9c] hover:text-[var(--holo-gold)] hover:bg-white/5 rounded transition-all shadow-[0_0_10px_var(--holo-gold-glow)]" title="Advanced Tools">
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    const chartEl = document.getElementById('crypto-terminal-chart-wrapper');
                    if (!document.fullscreenElement && chartEl) {
                      chartEl.requestFullscreen().catch(err => console.error(err));
                    } else if (document.fullscreenElement) {
                      if (document.exitFullscreen) document.exitFullscreen();
                    }
                  }}
                  className="p-1.5 text-[#848e9c] hover:text-[var(--holo-cyan)] hover:bg-white/5 rounded transition-all shadow-[0_0_10px_var(--holo-cyan-glow)]" title="Toggle Fullscreen">
                  <Maximize2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Active Indicator Legend Overlay */}
            {chartView === 'price' && mainIndicator && (
              <div className="absolute top-12 left-4 z-10 group">
                <div className="flex items-center gap-2 cursor-pointer">
                  <span className="text-[10px] sm:text-[11px] font-black text-[#5e6673] hover:text-[#848e9c] transition-colors uppercase tracking-[0.2em] flex items-center gap-1.5">
                    {mainIndicator === 'SUPER' ? 'SUPERTREND (10, 3)' : mainIndicator}
                    <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </span>

                  {/* Quick Action Popover */}
                  <div className="hidden group-hover:flex items-center bg-[#1e2329]/90 backdrop-blur-md border border-white/10 rounded-lg p-1 shadow-xl animate-in fade-in zoom-in-95 duration-200">
                    <button
                      onClick={() => setIsIndicatorLegendVisible(!isIndicatorLegendVisible)}
                      className="p-1.5 hover:bg-white/5 rounded text-[#848e9c] hover:text-white transition-colors"
                    >
                      {isIndicatorLegendVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => setIsStyleModalOpen(true)}
                      className="p-1.5 hover:bg-white/5 rounded text-[#848e9c] hover:text-white transition-colors"
                    >
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setMainIndicator(null)}
                      className="p-1.5 hover:bg-white/5 rounded text-[#848e9c] hover:text-[var(--holo-magenta)] transition-colors"
                      title="Dismiss">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Main Content: Chart or Depth */}
            <div className="flex-1 relative">
              {chartView === 'price' ? (
                <div className="absolute inset-1.5">
                  {marketData.length > 0 ? (
                    <Chart
                      data={marketData}
                      symbol={symbol}
                      chartInterval={chartInterval}
                      mainIndicator={isIndicatorLegendVisible ? mainIndicator : null}
                      subIndicators={subIndicators}
                      trades={userTrades.filter((t: any) => t.symbol.replace('/', '') === symbol.replace('/', ''))}
                      openOrders={openOrders.filter((o: any) => o.symbol.replace('/', '') === symbol.replace('/', ''))}
                      config={chartConfig}
                    />
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center gap-3">
                      <div className="skeleton w-[80%] h-4" />
                      <div className="skeleton w-[60%] h-4" />
                      <div className="skeleton w-[70%] h-4" />
                      <span className="text-[#5e6673] text-xs font-mono mt-2">Loading market data…</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="absolute inset-0 bg-[#0b0e11] flex flex-col p-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-black text-[#5e6673] uppercase tracking-[0.3em]">Market Depth</h3>
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--holo-cyan)]" /> Bids</div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[var(--holo-magenta)]" /> Asks</div>
                    </div>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <div className="border border-[var(--holo-cyan)]/10 bg-[var(--holo-cyan)]/5 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[var(--holo-cyan)]/20 blur-xl" />
                      <OrderBook bids={orderBook.bids.slice(0, 5)} asks={orderBook.asks.slice(0, 5)} />
                    </div>
                    <div className="border border-[var(--holo-magenta)]/10 bg-[var(--holo-magenta)]/5 rounded-xl p-4 flex flex-col items-center justify-center relative overflow-hidden">
                      <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-[var(--holo-magenta)]/20 blur-xl" />
                      <OrderBook bids={orderBook.bids.slice(0, 5)} asks={orderBook.asks.slice(0, 5)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Side Column: Telemetry + Order Panels ───────────────────── */}
          <div className="flex flex-col gap-2 w-full lg:w-[650px] shrink-0 z-10">

            {/* VOLTRON ARCHITECTURE: PILL SLIDER TOGGLE */}
            <div className="relative flex bg-[#0A0D14] border border-[#1E293B] rounded-full p-1 mx-auto w-[240px] shrink-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
              <div
                className={`absolute top-1 bottom-1 w-[114px] bg-[#1E293B] border border-cyan-500/30 rounded-full transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-[0_0_15px_rgba(6,182,212,0.15)] z-0 ${activeMode === 'SPOT' ? 'left-1' : 'left-[120px]'}`}
              />
              <button
                onClick={() => setActiveMode('SPOT')}
                className={`flex-1 text-center py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full z-10 transition-colors duration-300 ${activeMode === 'SPOT' ? 'text-cyan-400' : 'text-[#5e6673] hover:text-[#eaecef]'}`}
              >
                Spot Margin
              </button>
              <button
                onClick={() => setActiveMode('DELTA')}
                className={`flex-1 text-center py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full z-10 transition-colors duration-300 ${activeMode === 'DELTA' ? 'text-cyan-400' : 'text-[#5e6673] hover:text-[#eaecef]'}`}
              >
                Delta Master
              </button>
            </div>

            {activeMode === 'SPOT' ? (
              <div className="flex flex-col md:flex-row gap-2 w-full min-h-0 shrink-0 animate-in fade-in slide-in-from-left-4 duration-500">
                {/* Bullish Account */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="flex items-center justify-center gap-2 bg-[var(--holo-cyan)]/10 border border-[var(--holo-cyan)]/30 text-[var(--holo-cyan)] drop-shadow-[0_0_8px_var(--holo-cyan-glow)] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest py-1 sm:py-1.5 rounded-lg shadow-[0_4px_20px_var(--holo-cyan-glow)] backdrop-blur-md">
                    <div className="glow-dot-sm bg-[var(--holo-cyan)]" /> Bullish Hand
                  </div>
                  <OrderPanel symbol={symbol} currentPrice={currentPrice} balance={parseFloat(balance)} baseBalance={parseFloat(baseBalance)} onPlaceOrder={handlePlaceOrder} />
                </div>

                {/* Bearish Account */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="flex items-center justify-center gap-2 bg-[var(--holo-magenta)]/10 border border-[var(--holo-magenta)]/30 text-[var(--holo-magenta)] drop-shadow-[0_0_8px_var(--holo-magenta-glow)] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest py-1 sm:py-1.5 rounded-lg shadow-[0_4px_20px_var(--holo-magenta-glow)] backdrop-blur-md">
                    <div className="glow-dot-sm bg-[var(--holo-magenta)]" /> Bearish Hand
                  </div>
                  <OrderPanel symbol={symbol} currentPrice={currentPrice} balance={parseFloat(slaveBalance)} baseBalance={parseFloat(slaveBaseBalance)} onPlaceOrder={handlePlaceOrder} />
                </div>
              </div>
            ) : (
              <div className="w-full lg:w-[650px] lg:h-[689px] min-h-0 shrink-0 animate-in fade-in slide-in-from-right-4 duration-500 border border-indigo-500/20 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(99,102,241,0.05)] bg-[#0B0E14]/80 backdrop-blur-xl">
                <DeltaNeutralPanel symbol={symbol} currentPrice={currentPrice} lastClosedCandle={lastClosedCandle} />
              </div>
            )}
          </div>
        </div>

        {/* ─── BOTTOM ROW: Tabbed Terminal ────────────────────────── */}
        <div className="flex flex-col shrink-0 glass-panel border border-[var(--holo-cyan)]/20 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] overflow-hidden min-h-[250px] sm:min-h-[300px] rounded-2xl">
          {/* Tab Bar */}
          <div className="flex border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0 overflow-x-auto custom-scrollbar">
            {([
              { id: 'positions', icon: <Briefcase className="w-3.5 h-3.5" />, label: 'Positions' },
              { id: 'analytics', icon: <LineChart className="w-3.5 h-3.5" />, label: 'Analytics' },
              { id: 'history', icon: <History className="w-3.5 h-3.5" />, label: 'History' },
              { id: 'ai', icon: <Bot className="w-3.5 h-3.5" />, label: 'AI' },
              { id: 'database', icon: <Database className="w-3.5 h-3.5" />, label: 'DB' },
              { id: 'bot', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" /></svg>, label: 'Bots' },
            ] as { id: typeof activeTab; icon: React.ReactNode; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${activeTab === tab.id
                    ? 'text-[var(--holo-gold)] border-[var(--holo-gold)] bg-[var(--holo-gold)]/5'
                    : 'text-[#5e6673] border-transparent hover:text-[#848e9c] hover:bg-[#1e2329]'
                  }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden bg-[#0b0e11]">
            {activeTab === 'positions' && <CurrentPositions />}
            {activeTab === 'analytics' && <PerformanceChart />}
            {activeTab === 'history' && <RecentTrades trades={recentTrades} />}
            {activeTab === 'ai' && <AIAgentPanel marketData={marketData} symbol={symbol} />}
            {activeTab === 'database' && <DatabasePanel />}
            {activeTab === 'delta' && <DeltaNeutralPanel symbol={symbol} currentPrice={currentPrice} />}
            {activeTab === 'bot' && <BotPanel />}
          </div>
        </div>

        {/* ─── BOTTOM ROW: Watchlist + Open Orders + OrderBook + Asset Telemetry ───────────────── */}
        <div className="flex flex-col lg:flex-row gap-2 shrink-0">
          {/* Market Watchlist */}
          <div className="flex-1 glass-panel rounded-2xl overflow-hidden min-h-[320px]">
            <MarketWatchlist onSelectSymbol={setSymbol} activeSymbol={symbol} />
          </div>
          {/* Order Book */}
          <div className="lg:w-[320px] shrink-0 glass-panel rounded-2xl overflow-hidden min-h-[320px]">
            <OrderBook bids={orderBook.bids} asks={orderBook.asks} />
          </div>
          {/* Open Orders */}
          <div className="lg:w-[440px] xl:w-[480px] shrink-0 glass-panel rounded-2xl overflow-hidden min-h-[320px]">
            <OpenOrdersPanel symbol={symbol} />
          </div>
          {/* Asset Telemetry */}
          <div className="lg:w-[350px] shrink-0 flex flex-col justify-end min-h-[320px]">
            <CoinInfo symbol={symbol} />
          </div>
        </div>

      </main>

      {/* Unified Time Selector Grid Overlay */}
      {isTimeSelectorOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 animate-in fade-in duration-300">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            onClick={() => setIsTimeSelectorOpen(false)}
          />

          {/* Square Big Shape Selector */}
          <div className="relative w-full max-w-md bg-[#0a0f1a]/90 border border-[var(--holo-cyan)]/30 shadow-[0_30px_100px_rgba(0,0,0,1)] rounded-3xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Glossy Header Area */}
            <div className="px-6 py-6 border-b border-white/5 bg-gradient-to-b from-white/5 to-transparent flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-white tracking-tighter flex items-center gap-2">
                  <Clock className="w-5 h-5 text-[var(--holo-cyan)]" />
                  INTERVALS
                </h2>
                <p className="text-[10px] font-bold text-[#5e6673] uppercase tracking-[0.3em] mt-1">Select Chart Resolution</p>
              </div>
              <button
                onClick={() => setIsTimeSelectorOpen(false)}
                className="p-2 hover:bg-white/5 rounded-full transition-colors group"
              >
                <X className="w-6 h-6 text-[#5e6673] group-hover:text-white" />
              </button>
            </div>

            <div className="p-6 flex flex-col gap-8">
              {/* Category: Intraday (Minutes) */}
              <div>
                <h3 className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                  <div className="w-4 h-[1px] bg-[var(--holo-cyan)]/30" />
                  Intraday
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {['1m', '3m', '5m', '15m', '30m', '45m'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => {
                        setChartInterval(canonicalInterval(tf));
                        setIsTimeSelectorOpen(false);
                        setChartConfig({ ...chartConfig, style: 'candle' });
                      }}
                      className={`h-12 flex items-center justify-center text-sm font-black rounded-xl transition-all border ${canonicalInterval(chartInterval) === canonicalInterval(tf)
                          ? 'bg-[var(--holo-cyan)]/20 border-[var(--holo-cyan)] text-[var(--holo-cyan)] shadow-[0_0_20px_rgba(0,229,255,0.2)]'
                          : 'bg-white/5 border-transparent text-[#848e9c] hover:text-white hover:border-white/10 hover:bg-white/10'
                        }`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category: Daily / Macro */}
              <div>
                <h3 className="text-[10px] font-black text-[#5e6673] uppercase tracking-[0.4em] mb-4 flex items-center gap-2">
                  <div className="w-4 h-[1px] bg-[var(--holo-gold)]/30" />
                  Performance
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {['1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'].map(tf => (
                    <button
                      key={tf}
                      onClick={() => {
                        setChartInterval(canonicalInterval(tf));
                        setIsTimeSelectorOpen(false);
                        setChartConfig({ ...chartConfig, style: 'candle' });
                      }}
                      className={`h-12 flex items-center justify-center text-sm font-black rounded-xl transition-all border ${canonicalInterval(chartInterval) === canonicalInterval(tf)
                          ? 'bg-[var(--holo-gold)]/20 border-[var(--holo-gold)] text-[var(--holo-gold)] shadow-[0_0_20px_rgba(252,213,53,0.2)]'
                          : 'bg-white/5 border-transparent text-[#848e9c] hover:text-white hover:border-white/10 hover:bg-white/10'
                        }`}
                    >
                      {tf.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Accent */}
            <div className="h-1 bg-gradient-to-r from-transparent via-[var(--holo-cyan)] to-transparent opacity-30" />
          </div>
        </div>
      )}

      {/* Unified Chart Style & Indicators Modal */}
      <ChartStyleModal
        isOpen={isStyleModalOpen}
        onClose={() => setIsStyleModalOpen(false)}
        config={chartConfig}
        mainIndicator={mainIndicator}
        subIndicators={subIndicators}
        onApply={(conf, main, sub) => {
          setChartConfig(conf);
          setMainIndicator(main);
          setSubIndicators(sub);
          toast.success('Configuration applied');
        }}
        onReset={() => {
          setChartConfig(DEFAULT_CHART_CONFIG);
          setMainIndicator('SUPER');
          setSubIndicators(['VOL', 'RSI']);
          toast.success('Settings reset');
        }}
      />
    </div>
  );
}
