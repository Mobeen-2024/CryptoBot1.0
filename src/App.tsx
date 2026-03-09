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
import { IndicatorModal } from './components/IndicatorModal';
import { BotPanel } from './components/BotPanel';
import { Activity, ArrowUpRight, ArrowDownRight, RefreshCw, Circle, Wallet, Briefcase, LineChart, History, Bot, Database } from 'lucide-react';
import { placeOrder, fetchBalance as fetchBinanceBalance } from './services/api';
import toast, { Toaster } from 'react-hot-toast';

// Simple deterministic countdown hook based on current UTC time and Binance intervals
const CandleCountdown: React.FC<{ interval: string }> = ({ interval }) => {
  const [timeLeft, setTimeLeft] = useState<string>('--:--');

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const msSinceEpoch = now.getTime();
      let msPerInterval = 60000;
      
      const val = parseInt(interval);
      const unit = interval.slice(-1);
      
      if (unit === 'm') msPerInterval = val * 60 * 1000;
      else if (unit === 'h') msPerInterval = val * 60 * 60 * 1000;
      else if (unit === 'd') msPerInterval = val * 24 * 60 * 60 * 1000;
      
      const nextTick = Math.ceil(msSinceEpoch / msPerInterval) * msPerInterval;
      const remains = nextTick - msSinceEpoch;
      
      const h = Math.floor(remains / (1000 * 60 * 60));
      const m = Math.floor((remains % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((remains % (1000 * 60)) / 1000);
      
      if (h > 0) {
        setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      } else {
        setTimeLeft(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [interval]);

  return (
    <span className="text-[10px] font-mono font-medium text-[#848e9c] bg-[#1e2329] px-1.5 py-0.5 rounded flex items-center gap-1 border border-[#2b3139]">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      {timeLeft}
    </span>
  );
};

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [chartInterval, setChartInterval] = useState('1h');
  const [marketData, setMarketData] = useState<any[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [priceChange, setPriceChange] = useState<number>(0);
  const [balance, setBalance] = useState<string>('0.00');
  const [baseBalance, setBaseBalance] = useState<string>('0.00');
  
  // Secondary Account State (Mocked or Future implementation)
  const [slaveBalance, setSlaveBalance] = useState<string>('1500.00');
  const [slaveBaseBalance, setSlaveBaseBalance] = useState<string>('0.00');

  const [ticker24h, setTicker24h] = useState<any>(null);
  const [orderBook, setOrderBook] = useState<{ bids: [string, string][], asks: [string, string][] }>({ bids: [], asks: [] });
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [apiConnected, setApiConnected] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isSandbox, setIsSandbox] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(Date.now());
  const [error, setError] = useState<{ message: string, details?: string, code?: string } | null>(null);

  const [activeTab, setActiveTab] = useState<'positions' | 'analytics' | 'history' | 'ai' | 'database' | 'delta' | 'bot'>('positions');

  // Indicator Management State
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const [mainIndicator, setMainIndicator] = useState<string | null>('SUPER');
  const [subIndicators, setSubIndicators] = useState<string[]>(['MACD', 'RSI', 'VOL']);

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
        const response = await fetch(`/api/binance/klines?symbol=${symbol}&interval=${chartInterval}&limit=1000`);
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

    const streams = [
      `${symbol.toLowerCase()}@kline_${chartInterval}`,
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

      if (stream.endsWith(`@kline_${chartInterval}`)) {
        const kline = data.k;
        const updatedCandle = {
          time: kline.t / 1000,
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
        };

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

      toast.success(`Order Filled: ${data.id || 'Confirmed'}`, { id: orderToast });
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
    <div className="h-screen w-screen overflow-hidden bg-[#050505] text-gray-200 font-sans selection:bg-indigo-500/30 selection:text-white flex flex-col">
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          className: 'bg-black/80 text-white font-mono text-xs border border-white/10 backdrop-blur-md',
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
          error: { iconTheme: { primary: '#f43f5e', secondary: '#fff' } },
        }} 
      />
      {/* Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-md px-2 md:px-4 py-2 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-50 gap-2 sm:gap-0">
        <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <Activity className="text-indigo-500 w-5 h-5" />
            <h1 className="text-lg font-bold text-white tracking-tight">CryptoBot</h1>
          </div>

          <div className="hidden sm:block h-6 w-px bg-white/10"></div>

          <div className="flex items-center gap-2 md:gap-4">
            <CoinSelector symbol={symbol} setSymbol={setSymbol} />

            <div className="flex items-center gap-2">
              <span className={`font-mono font-bold text-lg ${priceChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <CandleCountdown interval={chartInterval} />
            </div>

            {ticker24h && (
              <div className="hidden md:flex items-center gap-4 text-xs font-mono ml-4">
                <div className="flex flex-col">
                  <span className="text-gray-500">24h Change</span>
                  <span className={priceChange >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                    {priceChange >= 0 ? '+' : ''}{parseFloat(ticker24h.priceChangePercent).toFixed(2)}%
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500">24h High</span>
                  <span className="text-white">{parseFloat(ticker24h.high).toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500">24h Low</span>
                  <span className="text-white">{parseFloat(ticker24h.low).toLocaleString()}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-gray-500">24h Vol(BTC)</span>
                  <span className="text-white">{parseFloat(ticker24h.volume).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-white/10 pt-2 sm:pt-0">
          {/* Emergency Management Controls */}
          <CopierControls />

          <div className="flex items-center gap-2 text-xs font-mono ml-4">
            <span className="text-gray-500">API</span>
            <Circle className={`w-2 h-2 fill-current ${apiConnected ? 'text-emerald-500 animate-pulse' : 'text-rose-500'}`} />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-2 flex flex-col gap-2 min-h-0 overflow-y-auto overflow-x-hidden relative custom-scrollbar">
        {/* Error Notification Overlay */}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="bg-rose-500/10 backdrop-blur-md border border-rose-500/20 p-4 rounded-lg shadow-2xl flex items-start gap-3">
              <div className="bg-rose-500/20 p-2 rounded-full">
                <Circle className="w-4 h-4 text-rose-500 fill-current" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-rose-500">{error.message}</h3>
                {error.details && <p className="text-xs text-rose-200/70 mt-1 leading-relaxed">{error.details}</p>}
                {error.code === 'INVALID_API_KEY' && (
                  <div className="mt-3 flex gap-2">
                    <div className="text-[10px] bg-rose-500/20 px-2 py-1 rounded text-rose-200 font-mono">Check .env file</div>
                    <div className="text-[10px] bg-rose-500/20 px-2 py-1 rounded text-rose-200 font-mono">Verify Testnet/Live</div>
                  </div>
                )}
              </div>
              <button
                onClick={() => setError(null)}
                className="text-rose-500/50 hover:text-rose-500 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          </div>
        )}

        {/* TOP ROW: Chart & Order Panel */}
        <div className="flex flex-col lg:flex-row gap-2 shrink-0 items-stretch">
          {/* Primary Chart Area */}
          <div className="h-[550px] lg:h-auto lg:flex-[3] bg-white/5 backdrop-blur-md rounded-md border border-white/10 flex flex-col relative overflow-hidden shrink-0 w-full">
            <div className="p-1 border-b border-white/10 flex items-center justify-between bg-black/20 z-10 shrink-0">
              <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono bg-black/40 px-2 py-1 rounded border border-white/5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                LIVE
              </div>

              <div className="flex gap-2 items-center">
                <button 
                  onClick={() => setIsIndicatorModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-gray-400 hover:text-[#fcd535] bg-black/40 hover:bg-[#fcd535]/10 rounded border border-white/10 hover:border-[#fcd535]/30 transition-colors uppercase tracking-wider"
                >
                  <LineChart className="w-3 h-3" />
                  <span className="hidden sm:inline">Indicators</span>
                </button>
                <div className="flex bg-black/40 rounded border border-white/10 p-0.5">
                  {['1m', '5m', '15m', '1h', '4h', '1d', '3d', '1w', '1M'].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => { e.preventDefault(); setChartInterval(i); }}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${chartInterval === i ? 'bg-white/20 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex-1 w-full min-h-0 relative overflow-hidden">
              <div className="absolute inset-2">
                {marketData.length > 0 ? (
                  <Chart 
                    data={marketData} 
                    symbol={symbol} 
                    chartInterval={chartInterval} 
                    mainIndicator={mainIndicator}
                    subIndicators={subIndicators}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-500 font-mono text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    Loading Chart Data...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Configuration Panels (Master & Slave) */}
          <div className="flex flex-col md:flex-row gap-2 w-full lg:w-[650px] shrink-0">
            
            {/* Master Account Panel */}
            <div className="flex flex-col gap-2 flex-1 min-w-[320px]">
              <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-wider text-center py-1 rounded-md mb-1 shrink-0">
                Main Account
              </div>
              <OrderPanel symbol={symbol} currentPrice={currentPrice} balance={parseFloat(balance)} baseBalance={parseFloat(baseBalance)} onPlaceOrder={handlePlaceOrder} />
            </div>

            {/* Slave Account Panel */}
            <div className="flex flex-col gap-2 flex-1 min-w-[320px]">
              <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-[10px] font-bold uppercase tracking-wider text-center py-1 rounded-md mb-1 shrink-0">
                Sub-Account (Slave)
              </div>
              <OrderPanel symbol={symbol} currentPrice={currentPrice} balance={parseFloat(slaveBalance)} baseBalance={parseFloat(slaveBaseBalance)} onPlaceOrder={handlePlaceOrder} />
            </div>

          </div>
        </div>

        {/* BOTTOM ROW: Tabbed Terminal Data */}
        <div className="flex flex-col shrink-0 bg-white/5 backdrop-blur-md rounded-md border border-white/10 overflow-hidden min-h-[300px]">
          {/* Tabs Header */}
          <div className="flex border-b border-white/10 bg-black/20 shrink-0 overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('positions')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'positions' ? 'text-indigo-400 border-indigo-500 bg-white/5' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              Active Positions
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'analytics' ? 'text-indigo-400 border-indigo-500 bg-white/5' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              <LineChart className="w-3.5 h-3.5" />
              Analytics & PnL
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'history' ? 'text-indigo-400 border-indigo-500 bg-white/5' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              <History className="w-3.5 h-3.5" />
              Trade History
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'ai' ? 'text-indigo-400 border-indigo-500 bg-white/5' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              <Bot className="w-3.5 h-3.5" />
              AI Analysis
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('database')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'database' ? 'text-indigo-400 border-indigo-500 bg-white/5' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
                <Database className="w-3.5 h-3.5" />
              Database
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('delta')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'delta' ? 'text-indigo-400 border-indigo-500 bg-white/5' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              <Activity className="w-3.5 h-3.5" />
              Strategy Engine
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('bot')}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold uppercase tracking-wider transition-colors border-b-2 whitespace-nowrap ${activeTab === 'bot' ? 'text-[#fcd535] border-[#fcd535] bg-[#fcd535]/5' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4M7 10.5C7 9.12 8.12 8 9.5 8S12 9.12 12 10.5 10.88 13 9.5 13 7 11.88 7 10.5z"/><path d="M14.5 8h3M14.5 11h3"/></svg>
              Bot Manager
            </button>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 overflow-hidden p-1 bg-black/10">
            {activeTab === 'positions' && <CurrentPositions />}
            {activeTab === 'analytics' && <PerformanceChart />}
            {activeTab === 'history' && <RecentTrades trades={recentTrades} />}
            {activeTab === 'ai' && <AIAgentPanel marketData={marketData} symbol={symbol} />}
            {activeTab === 'database' && <DatabasePanel />}
            {activeTab === 'delta' && <DeltaNeutralPanel symbol={symbol} />}
            {activeTab === 'bot' && <BotPanel />}
          </div>
        </div>
      </main>

      <IndicatorModal 
        isOpen={isIndicatorModalOpen}
        onClose={() => setIsIndicatorModalOpen(false)}
        selectedMain={mainIndicator}
        selectedSub={subIndicators}
        onApply={(main, sub) => {
          setMainIndicator(main);
          setSubIndicators(sub);
        }}
      />
    </div>
  );
}
