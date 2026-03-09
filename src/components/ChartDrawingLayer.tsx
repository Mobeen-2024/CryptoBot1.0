import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrawingTool = 'none' | 'trendline' | 'horizontal' | 'annotation';

interface Point { price: number; time: number; }

export interface TrendLineDrawing {
  id: string; type: 'trendline';
  p1: Point; p2: Point;
  color: string; width: number;
  extended: boolean; // extend ray beyond p2
}

export interface HorizontalDrawing {
  id: string; type: 'horizontal';
  price: number; color: string; width: number;
  label: string; style: 'solid' | 'dashed' | 'dotted';
}

export interface AnnotationDrawing {
  id: string; type: 'annotation';
  price: number; time: number;
  text: string; color: string;
}

export type Drawing = TrendLineDrawing | HorizontalDrawing | AnnotationDrawing;

// ─── Color palette for new drawings ──────────────────────────────────────────

const TOOL_COLORS: Record<DrawingTool, string> = {
  none:       '#ffffff',
  trendline:  '#fcd535',
  horizontal: '#0ecb81',
  annotation: '#2962FF',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => `d_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const loadDrawings = (key: string): Drawing[] => {
  try { return JSON.parse(localStorage.getItem(`chart_drawings_${key}`) || '[]'); }
  catch { return []; }
};

const saveDrawings = (key: string, drawings: Drawing[]) => {
  try { localStorage.setItem(`chart_drawings_${key}`, JSON.stringify(drawings)); }
  catch {}
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  chartApi: any;          // IChartApi from lightweight-charts
  candleSeries: any;      // The main candlestick series for priceToCoordinate
  symbol: string;
  activeTool: DrawingTool;
  onToolChange: (t: DrawingTool) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ChartDrawingLayer: React.FC<Props> = ({
  chartApi, candleSeries, symbol, activeTool, onToolChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [draftStart, setDraftStart] = useState<{ px: number; py: number; price: number; time: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [annotationDraft, setAnnotationDraft] = useState<{ price: number; time: number } | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const animRef = useRef<number>(0);
  const storageKey = symbol.replace('/', '');

  // Load drawings for this symbol
  useEffect(() => {
    setDrawings(loadDrawings(storageKey));
    setSelectedId(null);
  }, [symbol]);

  // Persist drawings whenever they change
  useEffect(() => {
    saveDrawings(storageKey, drawings);
  }, [drawings, storageKey]);

  // Listen for clear-all signal from parent toolbar
  useEffect(() => {
    const handler = (e: Event) => {
      const sym = (e as CustomEvent).detail?.symbol;
      if (!sym || sym.replace('/', '') === storageKey) {
        setDrawings([]);
        setSelectedId(null);
        setDraftStart(null);
      }
    };
    window.addEventListener('clearDrawings', handler);
    return () => window.removeEventListener('clearDrawings', handler);
  }, [storageKey]);

  // ── Coordinate bridge ──────────────────────────────────────────────────────

  const priceToY = useCallback((price: number): number | null => {
    if (!candleSeries) return null;
    return candleSeries.priceToCoordinate(price);
  }, [candleSeries]);

  const timeToX = useCallback((time: number): number | null => {
    if (!chartApi) return null;
    try { return chartApi.timeScale().timeToCoordinate(time as any); }
    catch { return null; }
  }, [chartApi]);

  const xyToPrice = useCallback((y: number): number | null => {
    if (!candleSeries) return null;
    return candleSeries.coordinateToPrice(y);
  }, [candleSeries]);

  const xyToTime = useCallback((x: number): number | null => {
    if (!chartApi) return null;
    try { return chartApi.timeScale().coordinateToTime(x) as number | null; }
    catch { return null; }
  }, [chartApi]);

  // ── Canvas render loop ────────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const W = canvas.width;

    const drawArrow = (ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, ext: boolean) => {
      if (ext) {
        const dx = x2 - x1; const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 1) return;
        const scale = (W - x1) / (dx || 1);
        x2 = x1 + dx * scale;
        y2 = y1 + dy * scale;
      }
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    };

    // Render saved drawings
    for (const d of drawings) {
      const isSelected = d.id === selectedId;
      ctx.save();
      ctx.strokeStyle = isSelected ? '#ffffff' : (d.color);
      ctx.fillStyle = isSelected ? '#ffffff' : (d.color);
      ctx.lineWidth = (('width' in d ? d.width : 1.5) as number) + (isSelected ? 1 : 0);

      if (d.type === 'trendline') {
        const x1 = timeToX(d.p1.time); const y1 = priceToY(d.p1.price);
        const x2 = timeToX(d.p2.time); const y2 = priceToY(d.p2.price);
        if (x1 != null && y1 != null && x2 != null && y2 != null) {
          drawArrow(ctx, x1, y1, x2, y2, d.extended);
          // Anchor dots
          [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(p => {
            ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
          });
        }
      }

      if (d.type === 'horizontal') {
        const y = priceToY(d.price);
        if (y != null) {
          if (d.style === 'dashed') ctx.setLineDash([10, 5]);
          else if (d.style === 'dotted') ctx.setLineDash([3, 5]);
          ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
          ctx.setLineDash([]);
          // Price label
          ctx.font = 'bold 11px monospace';
          const label = `${d.label ? d.label + ' ' : ''}${d.price.toFixed(4)}`;
          const tw = ctx.measureText(label).width;
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.roundRect(12, y - 10, tw + 10, 18, 3);
          ctx.fill();
          ctx.fillStyle = '#0b0e11';
          ctx.fillText(label, 17, y + 3);
        }
      }

      if (d.type === 'annotation') {
        const x = timeToX(d.time); const y = priceToY(d.price);
        if (x != null && y != null) {
          ctx.font = 'bold 12px sans-serif';
          const textW = ctx.measureText(d.text).width;
          // Bubble
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.roundRect(x + 8, y - 28, textW + 14, 22, 5);
          ctx.fill();
          // Arrow tail
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 8, y - 17); ctx.lineTo(x + 8, y - 14); ctx.closePath(); ctx.fill();
          // Text
          ctx.fillStyle = '#fff';
          ctx.fillText(d.text, x + 15, y - 13);
          // Dot
          ctx.fillStyle = d.color;
          ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
        }
      }

      ctx.restore();
    }

    // Draft preview (trendline rubber-band)
    if (activeTool === 'trendline' && draftStart && mousePos) {
      ctx.save();
      ctx.strokeStyle = TOOL_COLORS.trendline;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(draftStart.px, draftStart.py);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = TOOL_COLORS.trendline;
      ctx.beginPath(); ctx.arc(draftStart.px, draftStart.py, 4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    animRef.current = requestAnimationFrame(draw);
  }, [drawings, selectedId, activeTool, draftStart, mousePos, priceToY, timeToX]);

  useEffect(() => {
    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [draw]);

  // ── Resize canvas to match container ──────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(() => {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    });
    ro.observe(parent);
    canvas.width = parent.clientWidth;
    canvas.height = parent.clientHeight;
    return () => ro.disconnect();
  }, []);

  // ── Hit test for clicking existing drawings ───────────────────────────────

  const hitTest = useCallback((x: number, y: number): string | null => {
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      if (d.type === 'horizontal') {
        const dy = priceToY(d.price);
        if (dy != null && Math.abs(dy - y) < 6) return d.id;
      }
      if (d.type === 'trendline') {
        const x1 = timeToX(d.p1.time); const y1 = priceToY(d.p1.price);
        const x2 = timeToX(d.p2.time); const y2 = priceToY(d.p2.price);
        if (x1 != null && y1 != null && x2 != null && y2 != null) {
          const dx1 = x2 - x1; const dy1 = y2 - y1;
          const len2 = dx1 * dx1 + dy1 * dy1;
          if (len2 < 1) continue;
          const t = Math.max(0, Math.min(1, ((x - x1) * dx1 + (y - y1) * dy1) / len2));
          const dist = Math.hypot(x - (x1 + t * dx1), y - (y1 + t * dy1));
          if (dist < 6) return d.id;
        }
      }
      if (d.type === 'annotation') {
        const ax = timeToX(d.time); const ay = priceToY(d.price);
        if (ax != null && ay != null && Math.hypot(x - ax, y - ay) < 12) return d.id;
      }
    }
    return null;
  }, [drawings, priceToY, timeToX]);

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const price = xyToPrice(py);
    const time = xyToTime(px);

    if (activeTool === 'none') {
      const hit = hitTest(px, py);
      setSelectedId(hit);
      return;
    }

    if (activeTool === 'horizontal' && price != null) {
      const h: HorizontalDrawing = {
        id: uid(), type: 'horizontal',
        price, color: TOOL_COLORS.horizontal, width: 1.5,
        label: 'S/R', style: 'dashed',
      };
      setDrawings(prev => [...prev, h]);
      onToolChange('none');
      return;
    }

    if (activeTool === 'trendline' && price != null && time != null) {
      if (!draftStart) {
        setDraftStart({ px, py, price, time });
      } else {
        const tl: TrendLineDrawing = {
          id: uid(), type: 'trendline',
          p1: { price: draftStart.price, time: draftStart.time },
          p2: { price, time },
          color: TOOL_COLORS.trendline, width: 1.5,
          extended: false,
        };
        setDrawings(prev => [...prev, tl]);
        setDraftStart(null);
        onToolChange('none');
      }
      return;
    }

    if (activeTool === 'annotation' && price != null && time != null) {
      setAnnotationDraft({ price, time });
      setAnnotationText('');
      return;
    }
  }, [activeTool, draftStart, hitTest, xyToPrice, xyToTime, onToolChange]);

  const handleRightClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Cancel draft or deselect
    if (draftStart) { setDraftStart(null); return; }
    if (selectedId) { setSelectedId(null); return; }
    onToolChange('none');
  }, [draftStart, selectedId, onToolChange]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    setDrawings(prev => prev.filter(d => d.id !== selectedId));
    setSelectedId(null);
  }, [selectedId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
      if (e.key === 'Escape') {
        setDraftStart(null);
        setSelectedId(null);
        onToolChange('none');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, deleteSelected, onToolChange]);

  const confirmAnnotation = () => {
    if (!annotationDraft || !annotationText.trim()) { setAnnotationDraft(null); return; }
    const ann: AnnotationDrawing = {
      id: uid(), type: 'annotation',
      price: annotationDraft.price, time: annotationDraft.time,
      text: annotationText.trim(), color: TOOL_COLORS.annotation,
    };
    setDrawings(prev => [...prev, ann]);
    setAnnotationDraft(null);
    setAnnotationText('');
    onToolChange('none');
  };

  // ── Cursor ────────────────────────────────────────────────────────────────

  const cursor =
    activeTool === 'none' ? 'default' :
    activeTool === 'horizontal' ? 'row-resize' :
    activeTool === 'trendline' ? 'crosshair' :
    activeTool === 'annotation' ? 'cell' : 'default';

  return (
    <>
      {/* Drawing Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-30 pointer-events-auto"
        style={{ cursor, display: activeTool === 'none' && drawings.length === 0 ? 'none' : 'block' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onContextMenu={handleRightClick}
      />

      {/* Annotation Input Popup */}
      {annotationDraft && (
        <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1e2329] border border-[#3b4351] rounded-xl shadow-2xl p-4 w-72 font-sans">
          <h4 className="text-[#eaecef] text-sm font-bold mb-3 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2962FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            Add Annotation
          </h4>
          <input
            autoFocus
            type="text"
            value={annotationText}
            onChange={e => setAnnotationText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmAnnotation(); if (e.key === 'Escape') setAnnotationDraft(null); }}
            placeholder="Type your note…"
            className="w-full bg-[#0b0e11] border border-[#2b3139] focus:border-[#2962FF] rounded-lg px-3 py-2 text-[#eaecef] text-sm outline-none font-mono mb-3"
          />
          <div className="flex gap-2">
            <button onClick={() => setAnnotationDraft(null)} className="flex-1 py-2 bg-[#2b3139] hover:bg-[#474d57] text-[#eaecef] text-xs font-bold rounded-lg transition-colors">Cancel</button>
            <button onClick={confirmAnnotation} disabled={!annotationText.trim()} className="flex-1 py-2 bg-[#2962FF] hover:bg-[#1e4dc7] disabled:opacity-50 text-white text-xs font-bold rounded-lg transition-colors">Add Note</button>
          </div>
        </div>
      )}

      {/* Selected Drawing Context Menu */}
      {selectedId && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-1 bg-[#1e2329] border border-[#3b4351] rounded-full shadow-xl px-3 py-1.5 font-sans">
          <span className="text-[#848e9c] text-[10px] uppercase tracking-wider font-bold mr-2">Drawing</span>
          {/* Toggle extend for trendlines */}
          {drawings.find(d => d.id === selectedId)?.type === 'trendline' && (
            <button
              onClick={() => setDrawings(prev => prev.map(d => d.id === selectedId && d.type === 'trendline' ? { ...d, extended: !d.extended } : d))}
              className="flex items-center gap-1 bg-[#2b3139] hover:bg-[#474d57] text-[#fcd535] text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors"
              title="Toggle ray extension"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              RAY
            </button>
          )}
          <button
            onClick={deleteSelected}
            className="flex items-center gap-1 bg-[#f6465d]/10 hover:bg-[#f6465d]/20 text-[#f6465d] text-[10px] font-bold px-2.5 py-1 rounded-full transition-colors"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            Delete
          </button>
          <button onClick={() => setSelectedId(null)} className="text-[#848e9c] hover:text-white p-1 rounded-full transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </>
  );
};
