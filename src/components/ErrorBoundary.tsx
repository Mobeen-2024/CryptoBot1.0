import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<any, any> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Neural Agent Uncaught Error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    const { hasError, error } = this.state;
    const { children } = this.props;

    if (hasError) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#07090e] border border-red-500/20 rounded-xl m-4 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-500">
          <div className="p-4 bg-red-500/10 rounded-full mb-6 relative">
            <AlertTriangle className="w-10 h-10 text-red-500" />
            <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full" />
          </div>
          
          <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] mb-2">Neural Link Severed</h2>
          <p className="text-xs text-gray-500 font-mono tracking-widest max-w-md mb-8">
            The mission-critical AI matrix encountered a terminal exception. 
            Automated recovery protocols are available.
          </p>
          
          <div className="flex flex-col gap-3 w-full max-w-[240px]">
            <button 
              onClick={this.handleReload}
              className="flex items-center justify-center gap-2 py-3 bg-red-500 text-black font-black uppercase tracking-widest text-[10px] rounded-lg hover:shadow-[0_0_20px_rgba(244,63,94,0.4)] transition-all active:scale-95"
            >
              <RefreshCw className="w-4 h-4" />
              Pulse Core Reload
            </button>
            <button 
              onClick={this.handleReset}
              className="py-3 bg-white/5 border border-white/10 text-white/40 font-black uppercase tracking-widest text-[10px] rounded-lg hover:bg-white/10 hover:text-white transition-all"
            >
              Resume (Safe Mode)
            </button>
          </div>

          {process.env.NODE_ENV === 'development' && (
            <div className="mt-10 p-4 bg-black/60 border border-white/5 rounded-lg text-left w-full max-w-2xl overflow-auto custom-scrollbar shadow-inner">
               <span className="text-[10px] font-black text-red-500/60 uppercase block mb-2">Diagnostic Snippet:</span>
               <pre className="text-[10px] font-mono text-gray-500 leading-relaxed">
                 {error?.stack}
               </pre>
            </div>
          )}
        </div>
      );
    }

    return children;
  }
}
