import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown } from 'lucide-react';

interface CoinSelectorProps {
  symbol: string;
  setSymbol: (symbol: string) => void;
}

interface CoinData {
  symbol: string;
  lastPrice: string;
  quoteVolume: string;
  priceChangePercent: string;
}

export const CoinSelector: React.FC<CoinSelectorProps> = ({ symbol, setSymbol }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [coins, setCoins] = useState<CoinData[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchTickers = async () => {
      try {
        const res = await fetch('/api/binance/ticker/24hr');
        const data = await res.json();
        
        if (!Array.isArray(data)) {
          console.error('Ticker data format error:', data);
          return;
        }

        const usdtPairs = data
          .filter((d: any) => d.symbol.endsWith('USDT'))
          .sort((a: any, b: any) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
        setCoins(usdtPairs);
      } catch (error) {
        console.error('Failed to fetch tickers', error);
      }
    };
    
    fetchTickers();
    const interval = window.setInterval(fetchTickers, 3000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredCoins = coins.filter(c => 
    c.symbol.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 50); // Limit to 50 for performance

  const formatVolume = (vol: string) => {
    const v = parseFloat(vol);
    if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
    if (v >= 1e3) return (v / 1e3).toFixed(2) + 'K';
    return v.toFixed(2);
  };

  const selectedCoin = coins.find(c => c.symbol === symbol);

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 bg-transparent text-white focus:outline-none hover:text-indigo-400 transition-colors text-left"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2 font-bold text-xl">
            {symbol.replace('USDT', '/USDT')}
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
          </div>
          {selectedCoin && (
            <div className="flex gap-2 text-[11px] font-mono mt-0.5">
              <span className={parseFloat(selectedCoin.priceChangePercent) >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                ${parseFloat(selectedCoin.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
              <span className="text-gray-500 flex items-center gap-1">
                Vol {formatVolume(selectedCoin.quoteVolume)}
              </span>
            </div>
          )}
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-3 w-80 bg-[#151619]/95 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col max-h-[400px]">
          <div className="p-2 border-b border-white/10 bg-black/40">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text"
                placeholder="Search coin (e.g. BTC)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-md pl-9 pr-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-gray-600"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1 custom-scrollbar">
            <div className="flex justify-between px-3 py-1 text-[9px] text-gray-500 uppercase tracking-wider">
              <span>Asset</span>
              <div className="flex gap-4 text-right">
                <span className="w-16">Price</span>
                <span className="w-12">Change</span>
              </div>
            </div>
            {filteredCoins.length > 0 ? (
              filteredCoins.map(c => {
                const change = parseFloat(c.priceChangePercent);
                const isPositive = change >= 0;
                return (
                  <button
                    key={c.symbol}
                    onClick={() => {
                      setSymbol(c.symbol);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    className={`w-full text-left px-3 py-2 text-sm font-mono rounded-md transition-colors flex justify-between items-center ${c.symbol === symbol ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-300 hover:bg-white/5'}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-bold">{c.symbol.replace('USDT', '')}</span>
                      <span className="text-[10px] text-gray-500">Vol {formatVolume(c.quoteVolume)}</span>
                    </div>
                    <div className="flex gap-4 text-right items-center">
                      <span className="w-16">{parseFloat(c.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                      <span className={`w-12 text-xs ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? '+' : ''}{change.toFixed(2)}%
                      </span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-4 text-center text-gray-500 text-sm font-mono">No coins found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
