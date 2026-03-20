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
        className="flex items-center gap-3 bg-transparent text-white focus:outline-none hover:text-[#00f0ff] transition-all text-left group"
      >
        <div className="flex flex-col">
          <div className="flex items-center gap-2 font-black text-xl tracking-widest drop-shadow-[0_0_8px_rgba(0,240,255,0.3)]">
            {symbol.replace('USDT', '')}
            <span className="text-[#00f0ff]/50 text-sm font-mono tracking-normal">/USDT</span>
            <ChevronDown className={`w-4 h-4 text-[#00f0ff] transition-transform duration-300 ${isOpen ? 'rotate-180 drop-shadow-[0_0_5px_#00f0ff]' : ''}`} />
          </div>
          {selectedCoin && (
            <div className="flex gap-2 text-[10px] uppercase font-mono mt-0.5 tracking-widest font-bold">
              <span className={parseFloat(selectedCoin.priceChangePercent) >= 0 ? 'text-[#39ff14]' : 'text-[#ff073a]'}>
                {parseFloat(selectedCoin.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
              </span>
              <span className="text-gray-500 flex items-center gap-1">
                VOL_{formatVolume(selectedCoin.quoteVolume)}
              </span>
            </div>
          )}
        </div>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[100] sm:hidden bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
          <div className="fixed top-20 left-4 right-4 z-[101] sm:absolute sm:top-full sm:left-0 sm:right-auto sm:mt-2 sm:w-[350px] bg-[#05070a]/95 backdrop-blur-2xl border border-[#00f0ff]/20 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[80vh] sm:max-h-[400px]">
            <div className="p-3 border-b border-white/5 bg-black/40 relative z-10">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#00f0ff]" />
                <input 
                  type="text"
                  placeholder="SEARCH_NODE (E.G. BTC)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 rounded text-xs pl-9 pr-3 py-2.5 text-white font-mono focus:outline-none focus:border-[#00f0ff] focus:shadow-[0_0_15px_rgba(0,240,255,0.1)] transition-colors placeholder:text-gray-600 uppercase tracking-widest"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 custom-scrollbar relative z-10">
              <div className="flex justify-between px-3 py-2 text-[9px] text-[#00f0ff]/50 uppercase font-black tracking-widest border-b border-[#00f0ff]/10 mb-1">
                <span>Asset_Symbol</span>
                <div className="flex gap-3 text-right">
                  <span className="w-20 min-w-[80px] text-right">Valuation</span>
                  <span className="w-16 min-w-[64px] text-right">24H_Dlt</span>
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
                      className={`w-full text-left px-3 py-2.5 my-0.5 rounded transition-all flex justify-between items-center group relative overflow-hidden ${c.symbol === symbol ? 'bg-[#00f0ff]/10 text-white border border-[#00f0ff]/30 box-glow' : 'text-gray-400 hover:bg-white/5 border border-transparent hover:border-white/10 hover:text-white'}`}
                    >
                      {c.symbol === symbol && <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(0,240,255,0.05),transparent)] animate-[shimmer_2s_infinite]" />}
                      <div className="flex flex-col relative z-10">
                        <span className="font-black tracking-widest">{c.symbol.replace('USDT', '')}</span>
                        <span className="text-[8px] uppercase tracking-widest text-[#00f0ff]/50">VOL_{formatVolume(c.quoteVolume)}</span>
                      </div>
                      <div className="flex gap-3 text-right items-center font-bold relative z-10 flex-shrink-0">
                        <span className="w-20 min-w-[80px] text-right">{parseFloat(c.lastPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</span>
                        <span className={`w-16 min-w-[64px] text-right text-[10px] tracking-widest ${isPositive ? 'text-[#39ff14]' : 'text-[#ff073a]'}`}>
                          {isPositive ? '+' : ''}{change.toFixed(2)}%
                        </span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-4 text-center text-gray-500 text-xs font-mono tracking-widest uppercase">No matching nodes</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
