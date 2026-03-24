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
import { MarketWatchlist } from './components/MarketWatchlist';
import { OpenOrdersPanel } from './components/OpenOrdersPanel';
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
    <span className="text-[10px] font-mono font-bold text-[#848e9c] bg-[#0b0e11] px-2 py-1 rounded-lg flex items-center gap-1.5 border border-[#2b3139]">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#5e6673" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      {timeLeft}
    </span>
  );
};

export default function App() {
  const [symbol, setSymbol] = useState('BTCUSDT');
  const [activeMode, setActiveMode] = useState<'SPOT'|'DELTA'>('SPOT');
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

  // Indicator Management State
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const [mainIndicator, setMainIndicator] = useState<string | null>(null);
  const [subIndicators, setSubIndicators] = useState<string[]>([]);

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
    <div className="h-screen w-screen overflow-hidden bg-[#0b0e11] text-[#eaecef] font-sans selection:bg-[#fcd535]/20 selection:text-white flex flex-col">
      <Toaster 
        position="bottom-right" 
        toastOptions={{
          className: '!bg-[#181a20] !text-[#eaecef] !font-sans !text-xs !border !border-[#2b3139] !shadow-2xl !rounded-xl',
          success: { iconTheme: { primary: '#0ecb81', secondary: '#0b0e11' } },
          error: { iconTheme: { primary: '#f6465d', secondary: '#0b0e11' } },
        }} 
      />

      {/* ═══════════════════════════ HEADER ═══════════════════════════ */}
      <header className="border-b border-[#2b3139] bg-[#181a20] px-2 sm:px-3 md:px-5 py-1.5 sm:py-0 flex flex-wrap sm:flex-nowrap items-center justify-between sticky top-0 z-50 sm:h-14 shrink-0 gap-y-1">
        {/* Left: Logo + Pair + Price */}
        <div className="flex items-center gap-2 sm:gap-3 md:gap-5 h-full min-w-0">
          {/* Logo */}
          <div className="flex items-center gap-1.5 sm:gap-2 pr-2 sm:pr-4 border-r border-[#2b3139] h-full shrink-0">
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#fcd535] flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0b0e11" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
            </div>
            <span className="text-xs sm:text-sm font-extrabold text-white tracking-tight hidden sm:block">CryptoBot<span className="text-[#fcd535]">.</span></span>
          </div>

          {/* Pair Selector */}
          <CoinSelector symbol={symbol} setSymbol={setSymbol} />

          {/* Price Display */}
          <div className="flex items-center gap-1.5 sm:gap-3">
            <span className={`font-mono font-bold text-base sm:text-xl tracking-tight ${priceChange >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
              {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="hidden sm:flex">
              <CandleCountdown interval={chartInterval} />
            </span>
          </div>

          {/* 24h Stats */}
          {ticker24h && (
            <div className="hidden xl:flex items-center gap-5 pl-4 border-l border-[#2b3139] h-full">
              {[
                { label: '24h Change', value: `${priceChange >= 0 ? '+' : ''}${parseFloat(ticker24h.priceChangePercent).toFixed(2)}%`, color: priceChange >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]' },
                { label: '24h High', value: parseFloat(ticker24h.high).toLocaleString(), color: 'text-[#eaecef]' },
                { label: '24h Low', value: parseFloat(ticker24h.low).toLocaleString(), color: 'text-[#eaecef]' },
                { label: '24h Vol', value: parseFloat(ticker24h.volume).toLocaleString(undefined, { maximumFractionDigits: 0 }), color: 'text-[#eaecef]' },
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
            <Wallet className="w-3.5 h-3.5 text-[#fcd535]" />
            <span className="text-[10px] sm:text-xs font-mono font-bold text-[#eaecef]">${parseFloat(balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>

          {/* §9.1 Nav Action Buttons (Delta Master Context) */}
          {activeMode === 'DELTA' && (
            <div className="hidden md:flex items-center gap-1">
              <button onClick={() => { refreshBalance(); toast.success('Synced'); }} className="flex items-center gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#fcd535] bg-[#fcd535]/5 hover:bg-[#fcd535]/15 border border-[#fcd535]/20 rounded-md transition-all" title="Force Sync">
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
              <span className={`text-[10px] font-mono font-bold ${priceChange >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                {priceChange >= 0 ? '+' : ''}{parseFloat(ticker24h.priceChangePercent).toFixed(2)}%
              </span>
            </div>
          )}

          {/* API Status */}
          <div className="flex items-center gap-1.5 bg-[#0b0e11] border border-[#2b3139] rounded-lg px-2 py-1">
            <div className={`glow-dot-sm ${apiConnected ? 'bg-[#0ecb81]' : 'bg-[#f6465d]'}`} />
            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#5e6673]">{apiConnected ? 'LIVE' : 'OFF'}</span>
          </div>

          {/* Sandbox Badge */}
          {isSandbox && (
            <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-widest text-[#fcd535] bg-[#fcd535]/10 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md border border-[#fcd535]/20">Test</span>
          )}
        </div>
      </header>

      {/* ═══════════════════════════ MAIN ═════════════════════════════ */}
      <main className="flex-1 p-2 flex flex-col gap-2 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">

        {/* Error Overlay */}
        {error && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-1rem)] sm:w-full max-w-md px-2 sm:px-0">
            <div className="bg-[#181a20] border border-[#f6465d]/30 p-4 rounded-xl shadow-[0_8px_32px_rgba(246,70,93,0.15)] flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#f6465d]/15 flex items-center justify-center shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f6465d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-[#f6465d]">{error.message}</h3>
                {error.details && <p className="text-xs text-[#848e9c] mt-1 leading-relaxed">{error.details}</p>}
                {error.code === 'INVALID_API_KEY' && (
                  <div className="mt-2 flex gap-2">
                    <span className="text-[10px] bg-[#f6465d]/10 border border-[#f6465d]/20 px-2 py-0.5 rounded text-[#f6465d] font-mono">Check .env</span>
                    <span className="text-[10px] bg-[#f6465d]/10 border border-[#f6465d]/20 px-2 py-0.5 rounded text-[#f6465d] font-mono">Verify Keys</span>
                  </div>
                )}
              </div>
              <button onClick={() => setError(null)} className="text-[#5e6673] hover:text-[#eaecef] transition-colors p-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        )}

        {/* ─── TOP ROW: Chart + Order Panels ──────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-2 shrink-0 items-stretch">
          
          {/* Chart Panel */}
          <div className="h-[350px] sm:h-[450px] lg:h-auto lg:flex-[3] panel-surface flex flex-col relative overflow-hidden shrink-0 w-full z-0">
            {/* Chart Toolbar */}
            <div className="px-3 py-1.5 border-b border-[#2b3139] flex items-center justify-between bg-[#181a20] shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5 text-[10px] text-[#0ecb81] font-mono font-bold bg-[#0ecb81]/10 px-2 py-0.5 rounded-full border border-[#0ecb81]/20">
                  <div className="glow-dot-sm bg-[#0ecb81]" />
                  LIVE
                </div>
                <span className="text-[10px] text-[#5e6673] font-mono hidden sm:block">{symbol} · Binance Spot</span>
              </div>

              <div className="flex gap-2 items-center">
                {/* Indicator Button */}
                <button 
                  onClick={() => setIsIndicatorModalOpen(true)}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold text-[#848e9c] hover:text-[#fcd535] bg-[#0b0e11] hover:bg-[#fcd535]/10 rounded-lg border border-[#2b3139] hover:border-[#fcd535]/30 transition-all uppercase tracking-wider"
                >
                  <LineChart className="w-3 h-3" />
                  <span className="hidden sm:inline">Indicators</span>
                </button>
                {/* Interval Selector */}
                <div className="flex bg-[#0b0e11] rounded-lg border border-[#2b3139] p-0.5 overflow-x-auto">
                  {['1m', '5m', '15m', '1h', '4h', '1d', '1w'].map((i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={(e) => { e.preventDefault(); setChartInterval(i); }}
                      className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-mono font-bold rounded-md transition-all whitespace-nowrap ${chartInterval === i ? 'bg-[#fcd535] text-[#0b0e11] shadow-[0_0_8px_rgba(252,213,53,0.2)]' : 'text-[#5e6673] hover:text-[#eaecef]'}`}
                    >
                      {i}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Chart Canvas Wrapper */}
            <div className="flex-1 w-full min-h-0 relative overflow-hidden">
              <div className="absolute inset-1.5">
                {marketData.length > 0 ? (
                  <Chart 
                    data={marketData} 
                    symbol={symbol} 
                    chartInterval={chartInterval} 
                    mainIndicator={mainIndicator}
                    subIndicators={subIndicators}
                    trades={userTrades.filter((t: any) => t.symbol.replace('/', '') === symbol.replace('/', ''))}
                    openOrders={openOrders.filter((o: any) => o.symbol.replace('/', '') === symbol.replace('/', ''))}
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
                  <div className="flex items-center justify-center gap-2 bg-[#0ecb81]/8 border border-[#0ecb81]/20 text-[#0ecb81] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest py-1 sm:py-1.5 rounded-lg shadow-[0_4px_20px_rgba(14,203,129,0.05)]">
                    <div className="glow-dot-sm bg-[#0ecb81]" /> Bullish Hand
                  </div>
                  <OrderPanel symbol={symbol} currentPrice={currentPrice} balance={parseFloat(balance)} baseBalance={parseFloat(baseBalance)} onPlaceOrder={handlePlaceOrder} />
                </div>

                {/* Bearish Account */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                  <div className="flex items-center justify-center gap-2 bg-[#f6465d]/8 border border-[#f6465d]/20 text-[#f6465d] text-[9px] sm:text-[10px] font-bold uppercase tracking-widest py-1 sm:py-1.5 rounded-lg shadow-[0_4px_20px_rgba(246,70,93,0.05)]">
                    <div className="glow-dot-sm bg-[#f6465d]" /> Bearish Hand
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
        <div className="flex flex-col shrink-0 panel-surface overflow-hidden min-h-[250px] sm:min-h-[300px]">
          {/* Tab Bar */}
          <div className="flex border-b border-[#2b3139] bg-[#181a20] shrink-0 overflow-x-auto custom-scrollbar">
            {([
              { id: 'positions', icon: <Briefcase className="w-3.5 h-3.5" />, label: 'Positions' },
              { id: 'analytics', icon: <LineChart className="w-3.5 h-3.5" />, label: 'Analytics' },
              { id: 'history', icon: <History className="w-3.5 h-3.5" />, label: 'History' },
              { id: 'ai', icon: <Bot className="w-3.5 h-3.5" />, label: 'AI' },
              { id: 'database', icon: <Database className="w-3.5 h-3.5" />, label: 'DB' },
              { id: 'bot', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>, label: 'Bots' },
            ] as { id: typeof activeTab; icon: React.ReactNode; label: string }[]).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'text-[#fcd535] border-[#fcd535] bg-[#fcd535]/5'
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
          <div className="flex-1 panel-surface overflow-hidden min-h-[320px]">
            <MarketWatchlist onSelectSymbol={setSymbol} activeSymbol={symbol} />
          </div>

          {/* Order Book */}
          <div className="lg:w-[320px] shrink-0 panel-surface overflow-hidden min-h-[320px]">
            <OrderBook bids={orderBook.bids} asks={orderBook.asks} />
          </div>

          {/* Open Orders */}
          <div className="lg:w-[440px] xl:w-[480px] shrink-0 panel-surface overflow-hidden min-h-[320px]">
            <OpenOrdersPanel symbol={symbol} />
          </div>

          {/* Asset Telemetry */}
          <div className="lg:w-[350px] shrink-0 flex flex-col justify-end min-h-[320px]">
            <CoinInfo symbol={symbol} />
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
