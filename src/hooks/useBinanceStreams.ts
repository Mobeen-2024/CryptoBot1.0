import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * WebSocket Multiplexer for Binance Streams
 * 
 * Provides a single shared connection that handles multiple listeners
 * for various streams (kline, depth, trade, ticker).
 */

type StreamCallback = (data: any) => void;

interface SubscriptionRegistry {
  [stream: string]: Set<StreamCallback>;
}

// Module-level singletons to ensure only one connection exists across all hooks
let sharedSocket: WebSocket | null = null;
const subscribers: SubscriptionRegistry = {};
let isSandboxMode = false;
let globalConnectionListeners: Set<(connected: boolean) => void> = new Set();

export function useBinanceStatus() {
  const [isConnected, setIsConnected] = useState(sharedSocket?.readyState === WebSocket.OPEN);
  
  useEffect(() => {
    const listener = (s: boolean) => setIsConnected(s);
    globalConnectionListeners.add(listener);
    return () => { globalConnectionListeners.delete(listener); };
  }, []);

  return isConnected;
}

// Initialize sandbox mode from health check or env
fetch('/api/health')
  .then(res => res.json())
  .then(data => { isSandboxMode = data.sandbox; })
  .catch(() => {
    isSandboxMode = (import.meta as any).env.VITE_BINANCE_USE_TESTNET === 'true';
  });

const getWsUrl = (streams: string[]) => {
  const base = isSandboxMode
    ? 'wss://testnet.binance.vision/stream?streams='
    : 'wss://stream.binance.com:9443/stream?streams=';
  return base + streams.join('/');
};

const sendCommand = (method: 'SUBSCRIBE' | 'UNSUBSCRIBE', params: string[]) => {
  if (sharedSocket && sharedSocket.readyState === WebSocket.OPEN) {
    sharedSocket.send(JSON.stringify({
      method,
      params,
      id: Date.now()
    }));
  }
};

const initSocket = () => {
  if (sharedSocket) return;

  const activeStreams = Object.keys(subscribers);
  if (activeStreams.length === 0) return;

  sharedSocket = new WebSocket(getWsUrl(activeStreams));

  sharedSocket.onopen = () => {
    globalConnectionListeners.forEach(l => l(true));
    const activeStreams = Object.keys(subscribers);
    if (activeStreams.length > 0) {
      sendCommand('SUBSCRIBE', activeStreams);
    }
  };

  sharedSocket.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (!payload.stream) return;

    const listeners = subscribers[payload.stream];
    if (listeners) {
      listeners.forEach(cb => cb(payload.data));
    }
  };

  sharedSocket.onclose = () => {
    sharedSocket = null;
    globalConnectionListeners.forEach(l => l(false));
    // Attempt reconnection after a delay if there are still subscribers
    if (Object.keys(subscribers).length > 0) {
      setTimeout(initSocket, 3000);
    }
  };

  sharedSocket.onerror = (err) => {
    console.error('Binance WebSocket Error:', err);
  };
};

/**
 * Core hook for subscribing to any Binance stream
 */
export function useBinanceStream(stream: string | null, callback: StreamCallback) {
  useEffect(() => {
    if (!stream) return;

    if (!subscribers[stream]) {
      subscribers[stream] = new Set();
      // If socket is already open, subscribe to the new stream
      if (sharedSocket && sharedSocket.readyState === WebSocket.OPEN) {
        sendCommand('SUBSCRIBE', [stream]);
      } else {
        initSocket();
      }
    }

    subscribers[stream].add(callback);

    return () => {
      const listeners = subscribers[stream];
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          delete subscribers[stream];
          // Unsubscribe from Binance if no one is listening
          sendCommand('UNSUBSCRIBE', [stream]);
        }
      }
    };
  }, [stream, callback]);
}

/**
 * Specialized hook for OrderBook (Market Depth)
 */
export function useOrderBookStream(symbol: string) {
  const [data, setData] = useState<{ bids: [string, string][], asks: [string, string][] }>({ bids: [], asks: [] });
  const lastUpdate = useRef(0);

  const handleUpdate = useCallback((update: any) => {
    const now = Date.now();
    // Throttle to 250ms for performance
    if (now - lastUpdate.current > 250) {
      setData({ bids: update.bids, asks: update.asks });
      lastUpdate.current = now;
    }
  }, []);

  useBinanceStream(`${symbol.toLowerCase()}@depth20@100ms`, handleUpdate);

  return data;
}

/**
 * Specialized hook for Ticker (24h Stats)
 */
export function useTickerStream(symbol: string) {
  const [data, setData] = useState<any>(null);
  const lastUpdate = useRef(0);

  const handleUpdate = useCallback((update: any) => {
    const now = Date.now();
    if (now - lastUpdate.current > 500) {
      setData({
        high: update.h,
        low: update.l,
        volume: update.v,
        priceChangePercent: update.P,
        lastPrice: update.c
      });
      lastUpdate.current = now;
    }
  }, []);

  useBinanceStream(`${symbol.toLowerCase()}@ticker`, handleUpdate);

  return data;
}

/**
 * Specialized hook for Klines (Candlesticks)
 */
export function useKlinesStream(symbol: string, interval: string) {
  const [lastKline, setLastKline] = useState<any>(null);

  const handleUpdate = useCallback((update: any) => {
    const k = update.k;
    setLastKline({
      time: k.t / 1000,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      isClosed: k.x
    });
  }, []);

  useBinanceStream(`${symbol.toLowerCase()}@kline_${interval}`, handleUpdate);

  return lastKline;
}

/**
 * Specialized hook for Public Trades (The Tape)
 */
export function useTradesStream(symbol: string) {
  const [trades, setTrades] = useState<any[]>([]);
  const lastUpdate = useRef(0);

  const handleUpdate = useCallback((update: any) => {
    const now = Date.now();
    if (now - lastUpdate.current > 200) {
      const newTrade = {
        id: update.t,
        price: update.p,
        quantity: update.q,
        time: update.T,
        isBuyerMaker: update.m
      };
      setTrades(prev => [newTrade, ...prev].slice(0, 50));
      lastUpdate.current = now;
    }
  }, []);

  useBinanceStream(`${symbol.toLowerCase()}@trade`, handleUpdate);

  return trades;
}
