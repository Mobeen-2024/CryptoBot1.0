import React from 'react';
import { BookOpen } from 'lucide-react';

interface AIAgentPanelProps {
  marketData: any[];
  symbol: string;
}

export const AIAgentPanel: React.FC<AIAgentPanelProps> = () => {
  return (
    <div className="bg-white/5 backdrop-blur-md p-3 rounded-md border border-white/10 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="text-indigo-400 w-4 h-4" />
          <h2 className="text-sm font-semibold text-white tracking-wider uppercase">Strategic Architecture</h2>
        </div>
      </div>

      <div className="flex-1 bg-black/40 border border-white/5 rounded p-3 overflow-y-auto font-sans text-sm text-gray-300 custom-scrollbar">
        <div className="prose prose-invert prose-sm max-w-none">
          <h3 className="text-white font-bold text-base mb-2">Introduction to Bidirectional Delta-Neutral Market Initiation</h3>
          
          <p className="mb-4 leading-relaxed">
            In the rapidly evolving domain of cryptocurrency algorithmic trading, market participants frequently attempt to engineer automated strategies that circumvent directional market risk. The proposed architecture for the application designated as "CryptoBot" outlines a theoretical construct involving simultaneous bidirectional market entry. The operational logic dictates executing a long (buy) position in a primary account and a short (sell) position in a secondary account on the same asset, at the exact same entry price. This bidirectional entry is coupled with a hyper-tight risk parameter, specifically a nominal 1 USDT stop-loss, alongside an automated re-entry mechanism.
          </p>

          <p className="mb-4 leading-relaxed">
            The underlying hypothesis posits that as the market establishes a definitive trend, one position will be immediately stopped out for a negligible loss of 1 USDT, while the surviving position captures the overarching trend, theoretically guaranteeing a net positive yield. Furthermore, the logic assumes that if the market reverses, the algorithm can repeatedly re-enter the stopped-out direction at the exact previous stop-loss level, creating a continuous loop of minimal risk and uncapped upside.
          </p>

          <p className="mb-4 leading-relaxed">
            While mathematically appealing in a frictionless, theoretical vacuum, the deployment of this specific architecture across distributed centralized exchange environments introduces severe structural, financial, and regulatory vulnerabilities. The execution of identical, opposing orders across discrete, unauthorized multiple accounts fundamentally violates contemporary exchange compliance mechanisms and anti-manipulation laws.
          </p>

          <p className="mb-4 leading-relaxed">
            Furthermore, the strategy severely underestimates the realities of market microstructure frictions, particularly the compounding attrition of maker/taker fees, order slippage during volatile events, and the prevalence of market noise that induces whipsawing. Developing a custom algorithmic application to automate this logic requires an exhaustive understanding of exchange compliance surveillance, alternative native hedging architectures, latency-sensitive Application Programming Interface (API) routing, and the overarching geopolitical regulatory landscape governing virtual assets.
          </p>

          <p className="leading-relaxed">
            This comprehensive report provides an in-depth, multi-disciplinary evaluation of the proposed bidirectional tight-stop strategy. It analyzes the critical compliance risks associated with multi-account routing and self-trading, evaluates the mathematical viability of micro-stop losses against the physical realities of exchange friction, details the requisite WebSocket API infrastructure for high-frequency execution, and contextualizes the commercialization of such a strategy within the contemporary 2026 regulatory frameworks.
          </p>
        </div>
      </div>
    </div>
  );
};
