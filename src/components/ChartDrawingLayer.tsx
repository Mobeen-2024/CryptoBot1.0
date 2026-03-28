import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DrawingTool = 'none' | 'trendline' | 'horizontal' | 'annotation' | 'long_position' | 'short_position';

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

export interface PositionDrawing {
  id: string; type: 'long_position' | 'short_position';
  entryPrice: number; entryTime: number;
  tpPrice: number;
  slPrice: number;
  riskAmount: number; // Mocked risk in USD
}

export type Drawing = TrendLineDrawing | HorizontalDrawing | AnnotationDrawing | PositionDrawing;

// ─── Color palette for new drawings ──────────────────────────────────────────

const TOOL_COLORS: Record<DrawingTool, string> = {
  none:           '#ffffff',
  trendline:      '#00E5FF', // Holo-Cyan
  horizontal:     '#fcd535', // Gold
  annotation:     '#FF007F', // Deep Magenta
  long_position:  '#00FF9D', // Bullish Green
  short_position: '#FF007F', // Bearish Pink
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
  data: any[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ChartDrawingLayer: React.FC<Props> = ({
  chartApi, candleSeries, symbol, activeTool, onToolChange, data,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [draftStart, setDraftStart] = useState<{ px: number; py: number; price: number; time: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingPart, setDraggingPart] = useState<'entry' | 'tp' | 'sl' | 'p1' | 'p2' | null>(null);
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
      
      const themeColor = isSelected ? '#ffffff' : (d.color);
      ctx.strokeStyle = themeColor;
      ctx.fillStyle = themeColor;
      ctx.lineWidth = (('width' in d ? d.width : 1.5) as number) + (isSelected ? 1 : 0);
      
      // 2050 Canvas Glow Filters
      ctx.shadowBlur = isSelected ? 20 : 10;
      ctx.shadowColor = themeColor;

      if (d.type === 'trendline') {
        const x1 = timeToX(d.p1.time); const y1 = priceToY(d.p1.price);
        const x2 = timeToX(d.p2.time); const y2 = priceToY(d.p2.price);
        if (x1 != null && y1 != null && x2 != null && y2 != null) {
          drawArrow(ctx, x1, y1, x2, y2, d.extended);
          
          // High-Tech Anchor Targeting Nodes
          ctx.shadowBlur = 0; // Turn off glow for inner node clarity
          [{ x: x1, y: y1 }, { x: x2, y: y2 }].forEach(p => {
             // Outer ring
             ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.stroke();
             // Inner core
             ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
          });
          
          // Ultra 2050 Pro Feature: Trendline Dynamic Measurement Plate
          const isHovered = isSelected || activeTool === 'none'; // Could restrict text to hover/select
          if (isHovered) {
             const cx = (x1 + x2) / 2;
             const cy = (y1 + y2) / 2;
             const priceDelta = d.p2.price - d.p1.price;
             const pctChange = (priceDelta / d.p1.price) * 100;
             const sign = priceDelta >= 0 ? '+' : '';
             const text = `${sign}${priceDelta.toFixed(2)} (${sign}${pctChange.toFixed(2)}%)`;
             
             ctx.font = 'bold 10px monospace';
             const tw = ctx.measureText(text).width;
             
             // Glass panel background simulation (dark transparent)
             ctx.shadowBlur = 10;
             ctx.fillStyle = 'rgba(5, 11, 20, 0.85)';
             ctx.beginPath();
             ctx.roundRect(cx - (tw/2) - 8, cy - 24, tw + 16, 18, 4);
             ctx.fill();
             
             // Text print
             ctx.shadowBlur = 0;
             ctx.fillStyle = priceDelta >= 0 ? '#00E5FF' : '#FF007F';
             ctx.fillText(text, cx - (tw/2), cy - 12);
          }
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
          ctx.fillStyle = '#050b14'; // Darker contrast for 2050 theme
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

      if (d.type === 'long_position' || d.type === 'short_position') {
        const x = timeToX(d.entryTime);
        const yE = priceToY(d.entryPrice);
        const yTP = priceToY(d.tpPrice);
        const ySL = priceToY(d.slPrice);

        if (x != null && yE != null && yTP != null && ySL != null) {
          const isLong = d.type === 'long_position';
          const boxWidth = 140; // Modern wide plate
          
          // --- TP Box (Green Zone) ---
          ctx.fillStyle = isLong ? 'rgba(0, 255, 157, 0.15)' : 'rgba(255, 0, 127, 0.15)';
          const tpRectY = Math.min(yE, yTP);
          const tpRectH = Math.abs(yE - yTP);
          ctx.fillRect(x, tpRectY, boxWidth, tpRectH);
          ctx.strokeStyle = isLong ? '#00FF9D' : '#FF007F';
          ctx.lineWidth = 1;
          ctx.strokeRect(x, tpRectY, boxWidth, tpRectH);

          // --- SL Box (Red Zone) ---
          ctx.fillStyle = isLong ? 'rgba(255, 0, 127, 0.15)' : 'rgba(0, 255, 157, 0.15)';
          const slRectY = Math.min(yE, ySL);
          const slRectH = Math.abs(yE - ySL);
          ctx.fillRect(x, slRectY, boxWidth, slRectH);
          ctx.strokeStyle = isLong ? '#FF007F' : '#00FF9D';
          ctx.strokeRect(x, slRectY, boxWidth, slRectH);

          // --- Metrics calculation ---
          const risk = Math.abs(d.entryPrice - d.slPrice);
          const reward = Math.abs(d.tpPrice - d.entryPrice);
          const ratio = risk > 0 ? (reward / risk).toFixed(2) : '0';
          const riskPct = ((risk / d.entryPrice) * 100).toFixed(2);
          const posSize = risk > 0 ? (d.riskAmount / risk).toFixed(4) : '0';

          // --- Glass HUD Overlay ---
          const hudY = yE - 25;
          ctx.fillStyle = 'rgba(5, 11, 20, 0.95)';
          ctx.beginPath();
          ctx.roundRect(x + 10, hudY - 50, 120, 45, 8);
          ctx.fill();
          ctx.strokeStyle = isLong ? 'rgba(0, 255, 157, 0.4)' : 'rgba(255, 0, 127, 0.4)';
          ctx.stroke();

          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#fff';
          ctx.fillText(`Ratio: ${ratio}`, x + 20, hudY - 35);
          ctx.font = '8px monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillText(`Size: ${posSize} Units`, x + 20, hudY - 22);
          ctx.fillStyle = isLong ? '#00FF9D' : '#FF007F';
          ctx.font = 'bold 9px monospace';
          ctx.fillText(`Risk: -${riskPct}%`, x + 20, hudY - 10);

          // --- Drag Handles (Targeting Nodes) ---
          if (isSelected) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#fff';
            [yE, yTP, ySL].forEach((y) => {
              ctx.beginPath(); ctx.arc(x + boxWidth, y, 4, 0, Math.PI * 2); ctx.fill();
            });
            ctx.shadowBlur = 0;
          }
        }
      }

      ctx.restore();
    }

    // Draft preview (trendline rubber-band)
    if (activeTool === 'trendline' && draftStart && mousePos) {
      ctx.save();
      ctx.strokeStyle = TOOL_COLORS.trendline;
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 15;
      ctx.shadowColor = TOOL_COLORS.trendline;
      
      // Dashed laser beam
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(draftStart.px, draftStart.py);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.stroke();
      ctx.setLineDash([]);
      
      // Draft Anchor point (Targeting Node)
      ctx.fillStyle = TOOL_COLORS.trendline;
      ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(draftStart.px, draftStart.py, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(draftStart.px, draftStart.py, 2, 0, Math.PI * 2); ctx.fill();
      
      // Dynamic Draft Measurement rendering
      const draftPrice = candleSeries?.coordinateToPrice(mousePos.y) || 0;
      const priceDelta = draftPrice - draftStart.price;
      const pctChange = (priceDelta / draftStart.price) * 100;
      const sign = priceDelta >= 0 ? '+' : '';
      const text = `${sign}${priceDelta.toFixed(2)} (${sign}${pctChange.toFixed(2)}%)`;
      
      ctx.font = 'bold 10px monospace';
      const tw = ctx.measureText(text).width;
      const cx = (draftStart.px + mousePos.x) / 2;
      const cy = (draftStart.py + mousePos.y) / 2;
      
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(5, 11, 20, 0.85)';
      ctx.beginPath();
      ctx.roundRect(cx - (tw/2) - 8, cy - 24, tw + 16, 18, 4);
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.fillStyle = priceDelta >= 0 ? '#00E5FF' : '#FF007F';
      ctx.fillText(text, cx - (tw/2), cy - 12);
      
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

  const hitTest = useCallback((x: number, y: number) => {
    for (let i = drawings.length - 1; i >= 0; i--) {
      const d = drawings[i];
      
      // --- Position Drawing Hit Test ---
      if (d.type === 'long_position' || d.type === 'short_position') {
        const dx = timeToX(d.entryTime);
        const yE = priceToY(d.entryPrice);
        const yTP = priceToY(d.tpPrice);
        const ySL = priceToY(d.slPrice);
        const boxWidth = 140;

        if (dx != null && yE != null && yTP != null && ySL != null) {
          // Check handles at the right edge of the box
          const hX = dx + boxWidth;
          if (Math.hypot(x - hX, y - yTP) < 10) return { id: d.id, part: 'tp' as const };
          if (Math.hypot(x - hX, y - ySL) < 10) return { id: d.id, part: 'sl' as const };
          if (Math.hypot(x - hX, y - yE) < 10) return { id: d.id, part: 'entry' as const };
          
          // Check if clicking anywhere inside the box zones
          if (x >= dx && x <= dx + boxWidth) {
            const minY = Math.min(yTP, ySL, yE);
            const maxY = Math.max(yTP, ySL, yE);
            if (y >= minY && y <= maxY) return { id: d.id, part: 'entry' as const }; // Drag whole box via entry
          }
        }
      }

      if (d.type === 'horizontal') {
        const dy = priceToY(d.price);
        if (dy != null && Math.abs(dy - y) < 6) return { id: d.id, part: null };
      }
      if (d.type === 'trendline') {
        const x1 = timeToX(d.p1.time); const y1 = priceToY(d.p1.price);
        const x2 = timeToX(d.p2.time); const y2 = priceToY(d.p2.price);
        if (x1 != null && y1 != null && x2 != null && y2 != null) {
          if (Math.hypot(x - x1, y - y1) < 8) return { id: d.id, part: 'p1' as const };
          if (Math.hypot(x - x2, y - y2) < 8) return { id: d.id, part: 'p2' as const };

          const dx1 = x2 - x1; const dy1 = y2 - y1;
          const len2 = dx1 * dx1 + dy1 * dy1;
          if (len2 > 0) {
            const t = Math.max(0, Math.min(1, ((x - x1) * dx1 + (y - y1) * dy1) / len2));
            const dist = Math.hypot(x - (x1 + t * dx1), y - (y1 + t * dy1));
            if (dist < 6) return { id: d.id, part: null };
          }
        }
      }
      if (d.type === 'annotation') {
        const ax = timeToX(d.time); const ay = priceToY(d.price);
        if (ax != null && ay != null && Math.hypot(x - ax, y - ay) < 12) return { id: d.id, part: null };
      }
    }
    return null;
  }, [drawings, priceToY, timeToX]);

  // ── Mouse handlers ────────────────────────────────────────────────────────

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    if (draggingId && draggingPart) {
      const price = xyToPrice(y);
      const time = xyToTime(x);
      if (price == null) return;

      setDrawings(prev => prev.map(d => {
        if (d.id !== draggingId) return d;
        if (d.type === 'trendline') {
          if (draggingPart === 'p1') return { ...d, p1: { price, time: time ?? d.p1.time } };
          if (draggingPart === 'p2') return { ...d, p2: { price, time: time ?? d.p2.time } };
        }
        if (d.type === 'long_position' || d.type === 'short_position') {
          if (draggingPart === 'entry') return { ...d, entryPrice: price };
          if (draggingPart === 'tp') return { ...d, tpPrice: price };
          if (draggingPart === 'sl') return { ...d, slPrice: price };
        }
        return d;
      }));
    }
  }, [draggingId, draggingPart, xyToPrice, xyToTime]);

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
      setSelectedId(hit?.id ?? null);
      if (hit?.id && hit?.part) {
        setDraggingId(hit.id);
        setDraggingPart(hit.part);
      }
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

    if ((activeTool === 'long_position' || activeTool === 'short_position') && price != null && time != null) {
      // Intelligent ATR-Based Defaults
      let activeAtr = 0;
      const targetCandle = data.find(d => d.time === time) || data[data.length - 1]; // Fallback to last
      if (targetCandle?.atr) activeAtr = targetCandle.atr;
      else {
        // Fallback: estimate ATR as 1% of price
        activeAtr = price * 0.01;
      }

      const isLong = activeTool === 'long_position';
      const slDist = activeAtr * 1.5;
      const tpDist = activeAtr * 3.0; // 1:2 default R:R

      const p: PositionDrawing = {
        id: uid(),
        type: activeTool,
        entryPrice: price,
        entryTime: time,
        slPrice: isLong ? price - slDist : price + slDist,
        tpPrice: isLong ? price + tpDist : price - tpDist,
        riskAmount: 100, // Mock $100 risk
      };
      setDrawings(prev => [...prev, p]);
      onToolChange('none');
      return;
    }

    if (activeTool === 'annotation' && price != null && time != null) {
      setAnnotationDraft({ price, time });
      setAnnotationText('');
      return;
    }
  }, [activeTool, draftStart, hitTest, xyToPrice, xyToTime, onToolChange, data]);

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
    const keyHandler = (e: KeyboardEvent) => {
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
    const upHandler = () => {
      setDraggingId(null);
      setDraggingPart(null);
    };
    window.addEventListener('keydown', keyHandler);
    window.addEventListener('mouseup', upHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('mouseup', upHandler);
    };
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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (activeTool === 'none') return;
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const mockEvent = {
      button: 0,
      clientX: touch.clientX,
      clientY: touch.clientY,
      preventDefault: () => e.preventDefault(),
    } as unknown as React.MouseEvent;
    
    handleMouseDown(mockEvent);
  }, [activeTool, handleMouseDown]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (activeTool === 'none' && !draftStart) return;
    const touch = e.touches[0];
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setMousePos({ x: touch.clientX - rect.left, y: touch.clientY - rect.top });
  }, [activeTool, draftStart]);

  const handleTouchEnd = useCallback(() => {
    // Optional cleanup on touch end
  }, []);

  // ── Cursor ────────────────────────────────────────────────────────────────

  const cursor =
    draggingId ? 'grabbing' :
    activeTool === 'none' ? (hitTest(mousePos?.x ?? 0, mousePos?.y ?? 0) ? 'pointer' : 'default') :
    activeTool === 'horizontal' ? 'row-resize' :
    activeTool === 'trendline' ? 'crosshair' :
    activeTool === 'long_position' || activeTool === 'short_position' ? 'crosshair' :
    activeTool === 'annotation' ? 'cell' : 'default';

  return (
    <>
      {/* Drawing Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-30 pointer-events-auto touch-none"
        style={{ cursor, display: activeTool === 'none' && drawings.length === 0 ? 'none' : 'block' }}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onContextMenu={handleRightClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Annotation Input Popup */}
      {annotationDraft && (
        <div className="absolute z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass-tooltip p-4 w-72 font-sans overflow-hidden">
          {/* Neon Border Glow Wrapper */}
          <div className="absolute inset-0 border border-[var(--holo-magenta)] opacity-20 bg-gradient-to-br from-[var(--holo-magenta)]/10 to-transparent pointer-events-none rounded-lg" />
          
          <h4 className="text-white text-sm font-black mb-3 flex items-center gap-2 uppercase tracking-widest relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--holo-magenta)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            System Log
          </h4>
          <input
            autoFocus
            type="text"
            value={annotationText}
            onChange={e => setAnnotationText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') confirmAnnotation(); if (e.key === 'Escape') setAnnotationDraft(null); }}
            placeholder="Type transmission..."
            className="w-full bg-[#050B14]/80 border border-white/10 focus:border-[var(--holo-magenta)] rounded-md px-3 py-2 text-[#00E5FF] text-sm outline-none font-mono font-bold mb-3 shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)] relative z-10 transition-colors"
          />
          <div className="flex gap-2 relative z-10">
            <button onClick={() => setAnnotationDraft(null)} className="flex-1 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[#848e9c] text-xs font-bold uppercase tracking-wider rounded-md transition-colors hover-lift">Abort</button>
            <button onClick={confirmAnnotation} disabled={!annotationText.trim()} className="flex-1 py-1.5 bg-[var(--holo-magenta)]/20 hover:bg-[var(--holo-magenta)]/30 border border-[var(--holo-magenta)] disabled:opacity-50 text-[var(--holo-magenta)] text-xs font-black drop-shadow-[0_0_8px_var(--holo-magenta)] uppercase tracking-wider rounded-md transition-all hover-lift">Commit</button>
          </div>
        </div>
      )}

      {/* Selected Drawing Context Menu */}
      {selectedId && (
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 glass-panel rounded-full px-4 py-2 font-sans shadow-[0_10px_30px_rgba(0,0,0,0.8)] border border-[var(--holo-cyan)]/20">
          <span className="text-[var(--holo-cyan)] drop-shadow-[0_0_8px_var(--holo-cyan)] text-[9px] uppercase tracking-[0.2em] font-black mr-2">Target Lock</span>
          {/* Toggle extend for trendlines */}
          {drawings.find(d => d.id === selectedId)?.type === 'trendline' && (
            <button
              onClick={() => setDrawings(prev => prev.map(d => d.id === selectedId && d.type === 'trendline' ? { ...d, extended: !d.extended } : d))}
              className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[var(--holo-cyan)] drop-shadow-[0_0_4px_var(--holo-cyan)] text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors hover-lift"
              title="Toggle ray extension"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              Ray Ext
            </button>
          )}
          <button
            onClick={deleteSelected}
            className="flex items-center gap-1.5 bg-[var(--holo-magenta)]/10 hover:bg-[var(--holo-magenta)]/20 border border-[var(--holo-magenta)]/30 text-[var(--holo-magenta)] drop-shadow-[0_0_4px_var(--holo-magenta)] text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-colors hover-lift"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            Destroy
          </button>
          <button onClick={() => setSelectedId(null)} className="text-[#848e9c] hover:text-white p-1 rounded-full transition-colors">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      )}
    </>
  );
};
