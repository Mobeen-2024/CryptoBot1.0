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
  targetTime: number; // For dynamic width/duration
  widthInCandles?: number; // Cross-timeframe persistence: stored as candle count
  riskAmount: number; // Mocked risk in USD
  isLocked?: boolean; // When true, blocks all drag interactions
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

// Safe roundRect for older browsers or environments
const drawRoundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
};

const canonicalInterval = (interval: string): string => {
  if (!interval) return '1h';
  const match = interval.match(/^(\d+)([a-zA-Z])$/);
  if (!match) return interval.toLowerCase();
  const val = match[1];
  const unit = match[2];
  if (unit === 'M') return val + 'M';
  return val + unit.toLowerCase();
};

const getIntervalMs = (interval: string) => {
  const canonical = canonicalInterval(interval);
  const value = parseInt(canonical);
  const unit = canonical.slice(-1);
  switch (unit) {
    case 'm': return value * 60 * 1000;
    case 'h': return value * 60 * 60 * 1000;
    case 'd': return value * 24 * 60 * 60 * 1000;
    case 'w': return value * 7 * 24 * 60 * 60 * 1000;
    case 'M': return value * 30 * 24 * 60 * 60 * 1000;
    default: return 60000;
  }
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  chartApi: any;          // IChartApi from lightweight-charts
  candleSeries: any;      // The main candlestick series for priceToCoordinate
  symbol: string;
  interval: string;
  activeTool: DrawingTool;
  onToolChange: (t: DrawingTool) => void;
  drawings: Drawing[];
  setDrawings: React.Dispatch<React.SetStateAction<Drawing[]>>;
  data: any[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ChartDrawingLayer: React.FC<Props> = ({
  chartApi, candleSeries, symbol, interval, activeTool, onToolChange, drawings, setDrawings, data,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [draftStart, setDraftStart] = useState<{ px: number; py: number; price: number; time: number } | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingPart, setDraggingPart] = useState<'entry' | 'tp' | 'sl' | 'p1' | 'p2' | 'duration' | 'right_edge' | null>(null);
  const [isHoveringShape, setIsHoveringShape] = useState(false);
  const [annotationDraft, setAnnotationDraft] = useState<{ price: number; time: number } | null>(null);
  const [annotationText, setAnnotationText] = useState('');
  const animRef = useRef<number>(0);
  const storageKey = symbol.replace('/', '');

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
  }, [storageKey, setDrawings]);

  // Handle Lock/Unlock global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'l' && selectedId) {
        setDrawings(prev => prev.map(d => 
          (d.id === selectedId && (d.type === 'long_position' || d.type === 'short_position'))
          ? { ...d, isLocked: !d.isLocked } 
          : d
        ));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedId, setDrawings]);


  // ── Coordinate bridge ──────────────────────────────────────────────────────

  const priceToY = useCallback((price: number): number | null => {
    if (!candleSeries) return null;
    return candleSeries.priceToCoordinate(price);
  }, [candleSeries]);

  const timeToX = useCallback((time: number): number | null => {
    if (!chartApi || !data || data.length === 0) return null;
    try {
      // 1. Try native mapping
      const native = chartApi.timeScale().timeToCoordinate(time as any);
      if (native !== null) return native;

      // 2. Future Extrapolation (AI-ALPHA)
      // If native mapping fails, it's likely a future timestamp.
      // We calculate its position relative to the last known candle.
      const lastBar = data[data.length - 1];
      const lastBarX = chartApi.timeScale().timeToCoordinate(lastBar.time as any);
      if (lastBarX === null) return null;

      const intervalMs = getIntervalMs(interval);
      const deltaTime = time - (lastBar.time as number);
      const barsForward = deltaTime / (intervalMs / 1000);
      
      // Calculate pixel width of a single bar (approximate)
      // Using logical indices for precision
      const timeScale = chartApi.timeScale();
      const lastLogical = timeScale.coordinateToLogical(lastBarX);
      if (lastLogical === null) return null;
      
      const futureLogical = lastLogical + barsForward;
      return timeScale.logicalToCoordinate(futureLogical as any);
    }
    catch { return null; }
  }, [chartApi, data, interval]);

  const xyToPrice = useCallback((y: number): number | null => {
    if (!candleSeries) return null;
    const price = candleSeries.coordinateToPrice(y);
    if (price !== null) return price;

    // Coordinate Extrapolation for Volume Pane / Bottom Areas
    // If the standard API fails, we estimate based on the visible range
    try {
      const firstBar = data[0];
      const lastBar = data[data.length - 1];
      if (!firstBar || !lastBar) return null;
      
      const firstY = candleSeries.priceToCoordinate(firstBar.high);
      const lastY = candleSeries.priceToCoordinate(lastBar.low);
      if (firstY == null || lastY == null) return null;
      
      // Rough linear extrapolation relative to the main scale height
      const height = Math.abs(lastY - firstY) || 1;
      const priceRange = Math.abs(firstBar.high - lastBar.low) || 1;
      const pxPerPrice = height / priceRange;
      
      const deltaY = y - lastY;
      return lastBar.low - (deltaY / pxPerPrice);
    } catch { return null; }
  }, [candleSeries, data]);

  const xyToTime = useCallback((x: number): number | null => {
    if (!chartApi || !data || data.length === 0) return null;
    try {
      // 1. Try native mapping
      const native = chartApi.timeScale().coordinateToTime(x) as number | null;
      if (native !== null) return native;

      // 2. Future Extrapolation (AI-ALPHA)
      // If we clicked in the right-hand blank space, we extrapolate based on bar logicals
      const timeScale = chartApi.timeScale();
      const logical = timeScale.coordinateToLogical(x);
      if (logical === null) return null;

      const lastBar = data[data.length - 1];
      const lastBarX = timeScale.timeToCoordinate(lastBar.time as any);
      if (lastBarX === null) return null;
      
      const lastLogical = timeScale.coordinateToLogical(lastBarX);
      if (lastLogical === null) return null;

      const barsForward = logical - lastLogical;
      const intervalMs = getIntervalMs(interval);
      return (lastBar.time as number) + Math.round(barsForward) * (intervalMs / 1000);
    }
    catch { return null; }
  }, [chartApi, data, interval]);

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
             ctx.fillStyle = 'rgba(5, 11, 20, 0.95)';
             ctx.beginPath();
             drawRoundRect(ctx, cx - (tw/2) - 8, cy - 24, tw + 16, 18, 4);
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
          drawRoundRect(ctx, 12, y - 10, tw + 10, 18, 3);
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
          drawRoundRect(ctx, x + 8, y - 28, textW + 14, 22, 5);
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
        const xE = timeToX(d.entryTime);
        const yE = priceToY(d.entryPrice);
        const yTP = priceToY(d.tpPrice);
        const ySL = priceToY(d.slPrice);

        if (xE != null && yE != null && yTP != null && ySL != null) {
          // --- Intelligent Cross-Timeframe Logic ---
          // Use stored widthInCandles to calculate current xT position
          const intervalMsVal = getIntervalMs(interval) / 1000;
          const currentTargetTime = d.entryTime + (d.widthInCandles || 10) * intervalMsVal;
          const xT_raw = timeToX(currentTargetTime);
          
          const xT = xT_raw ?? (xE + 140);
          const isLong = d.type === 'long_position';
          const boxWidth = Math.max(40, xT - xE);

          
          // --- TP Box (Success Zone) with Modern Vertical Gradient ---
          const tpRectY = Math.min(yE, yTP);
          const tpRectH = Math.abs(yE - yTP);

          // Phase-1: Metrics & Logic Preparation
          const risk = Math.abs(d.entryPrice - d.slPrice);
          const reward = Math.abs(d.tpPrice - d.entryPrice);
          const ratio = risk > 0 ? (reward / risk).toFixed(2) : '0';
          const riskPct = ((risk / d.entryPrice) * 100).toFixed(2);
          const targetPct = ((reward / d.entryPrice) * 100).toFixed(2);
          const posSize = risk > 0 ? (d.riskAmount / risk).toFixed(4) : '0';

          const intervalMs = getIntervalMs(interval);
          const barCount = Math.round((d.targetTime - d.entryTime) / (intervalMs / 1000));
          const durationStr = `${barCount} Bars`;

          // (Background Fills now handled by Chart.tsx underneath)
          ctx.strokeStyle = '#00FF9D';
          ctx.lineWidth = 1;
          ctx.strokeRect(xE, tpRectY, boxWidth, tpRectH);

          // --- SL Box Border only ---
          const slRectY = Math.min(yE, ySL);
          const slRectH = Math.abs(yE - ySL);
          ctx.strokeStyle = '#FF007F';
          ctx.strokeRect(xE, slRectY, boxWidth, slRectH);

          // --- Advanced PnL HUD Feature: 1:1 R:R Line ---
          const oneToOnePrice = isLong ? d.entryPrice + risk : d.entryPrice - risk;
          const yOneToOne = priceToY(oneToOnePrice);
          if (yOneToOne !== null) {
            ctx.setLineDash([2, 4]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.beginPath();
            ctx.moveTo(xE, yOneToOne);
            ctx.lineTo(xE + boxWidth, yOneToOne);
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.font = '8px monospace';
            ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.fillText('1:1 BE', xE + boxWidth - 35, yOneToOne - 4);
          }

          // --- Entry Line (Holographic Laser) ---
          ctx.save();
          if (isSelected) {
            // Pulsing Selection Glow
            const pulse = (Math.sin(Date.now() / 200) + 1) / 2;
            ctx.shadowBlur = 10 + pulse * 10;
            ctx.shadowColor = isLong ? '#00FF9D' : '#FF007F';
          }
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.beginPath(); ctx.moveTo(xE, yE); ctx.lineTo(xE + boxWidth, yE); ctx.stroke();
          ctx.restore();

          // --- Embedded Labels (Premium HUD Style) ---
          ctx.font = 'bold 10px monospace';
          ctx.fillStyle = '#fff';
          
          ctx.fillText(`TARGET: +${targetPct}% | R:R ${ratio}`, xE + 10, tpRectY + 15);
          ctx.fillText(`STOP: -${riskPct}% | SIZE: ${posSize}`, xE + 10, slRectY + slRectH - 8);

          // Duration Label (Center bottom)
          ctx.font = 'italic 9px monospace';
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillText(durationStr, xE + boxWidth / 2 - 15, (isLong ? slRectY + slRectH : tpRectY + tpRectH) + 12);

          // --- Drag Handles (Targeting Nodes) ---
          if (isSelected) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#fff';
            ctx.fillStyle = '#fff';
            [{ x: xE + boxWidth, y: yTP }, { x: xE + boxWidth, y: ySL }, { x: xE + boxWidth, y: yE }].forEach((p) => {
              ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
            });
            ctx.shadowBlur = 0;
          }

          // Lock icon overlay (renders on all locked positions)
          if ((d as PositionDrawing).isLocked) {
            ctx.save();
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#fcd535';
            ctx.strokeStyle = '#fcd535';
            ctx.fillStyle = '#fcd535';
            ctx.lineWidth = 1.5;
            const lx = xE + boxWidth - 20;
            const ly = Math.min(yTP, yE) + 4;
            // Padlock body
            ctx.beginPath();
            drawRoundRect(ctx, lx, ly + 6, 12, 9, 2);
            ctx.fill();
            // Padlock shackle arc
            ctx.fillStyle = 'rgba(0,0,0,0)';
            ctx.beginPath();
            ctx.arc(lx + 6, ly + 7, 4.5, Math.PI, 2 * Math.PI);
            ctx.stroke();
            ctx.restore();
          } else if (isSelected) {
            // Right-edge width grip bar (only when selected and not locked)
            const gx = xE + boxWidth + 2;
            const gyCentre = (Math.min(yTP, yE) + Math.max(ySL, yE)) / 2;
            ctx.save();
            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.shadowBlur = 5;
            ctx.shadowColor = 'rgba(255,255,255,0.6)';
            drawRoundRect(ctx, gx, gyCentre - 20, 4, 40, 2);
            ctx.fill();
            ctx.restore();
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
      const draftPrice = xyToPrice(mousePos.y) || 0;
      const priceDelta = draftPrice - draftStart.price;
      const pctChange = (priceDelta / draftStart.price) * 100;
      const sign = priceDelta >= 0 ? '+' : '';
      const text = `${sign}${priceDelta.toFixed(2)} (${sign}${pctChange.toFixed(2)}%)`;
      
      ctx.font = 'bold 10px monospace';
      const tw = ctx.measureText(text).width;
      const cx = (draftStart.px + mousePos.x) / 2;
      const cy = (draftStart.py + mousePos.y) / 2;
      
      ctx.shadowBlur = 10;
      ctx.fillStyle = 'rgba(5, 11, 20, 0.95)';
      ctx.beginPath();
      drawRoundRect(ctx, cx - (tw/2) - 8, cy - 24, tw + 16, 18, 4);
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

        if (dx != null && yE != null && yTP != null && ySL != null) {
          const intervalMsVal = getIntervalMs(interval) / 1000;
          const currentTargetTime = d.entryTime + (d.widthInCandles || 10) * intervalMsVal;
          const dxT = timeToX(currentTargetTime);
          const boxWidth = dxT !== null ? Math.max(40, dxT - dx) : 140;

          // Right-edge grip zone for width dragging (Grip Priority)
          const rEdgeX = dx + boxWidth;
          if (Math.abs(x - rEdgeX) < 12 && y >= Math.min(yTP, ySL) - 10 && y <= Math.max(yTP, ySL) + 10) {
            return { id: d.id, part: 'right_edge' as const };
          }


          // Check handles at the right edge of the box
          const hX = dx + boxWidth;
          if (Math.hypot(x - hX, y - yTP) < 10) return { id: d.id, part: 'tp' as const };
          if (Math.hypot(x - hX, y - ySL) < 10) return { id: d.id, part: 'sl' as const };
          if (Math.hypot(x - hX, y - yE) < 10) return { id: d.id, part: 'duration' as const };
          
          // Check if clicking anywhere inside the box zones
          if (x >= dx && x <= dx + boxWidth) {
            const minY = Math.min(yTP, ySL, yE);
            const maxY = Math.max(yTP, ySL, yE);
            if (y >= minY && y <= maxY) return { id: d.id, part: 'entry' as const };
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
        // Locked drawings cannot be moved
        if ((d as PositionDrawing).isLocked) return d;
        if (d.type === 'trendline') {
          if (draggingPart === 'p1') return { ...d, p1: { price, time: time ?? d.p1.time } };
          if (draggingPart === 'p2') return { ...d, p2: { price, time: time ?? d.p2.time } };
        }
        if (d.type === 'long_position' || d.type === 'short_position') {
          if (draggingPart === 'entry') return { ...d, entryPrice: price, entryTime: time ?? d.entryTime };
          if (draggingPart === 'tp') return { ...d, tpPrice: price };
          if (draggingPart === 'sl') return { ...d, slPrice: price };
          if (draggingPart === 'duration' && time !== null) {
            const newWidthInCandles = Math.round((time - d.entryTime) / (getIntervalMs(interval) / 1000));
            return { ...d, targetTime: time, widthInCandles: Math.max(1, newWidthInCandles) };
          }
          if (draggingPart === 'right_edge' && time !== null) {
            const newWidthInCandles = Math.round((time - d.entryTime) / (getIntervalMs(interval) / 1000));
            return { ...d, targetTime: time, widthInCandles: Math.max(1, newWidthInCandles) };
          }
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
        // Block drag on locked drawings
        const drawing = drawings.find(d => d.id === hit.id);
        if ((drawing as PositionDrawing)?.isLocked) return;
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
        targetTime: time + (getIntervalMs(interval) * 10 / 1000),
        widthInCandles: 10, // Default 10 candles wide — scales across timeframes
        riskAmount: 100,
        isLocked: false,
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

    // --- Global Hit Discovery (Unlocks Chart Interaction) ---
    const moveHandler = (e: MouseEvent) => {
      if (activeTool !== 'none' || draggingId) {
        setIsHoveringShape(true);
        return;
      }
      
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Hit Discovery: Is the mouse over any drawing?
      const hit = hitTest(x, y);
      setIsHoveringShape(!!hit);
    };

    window.addEventListener('keydown', keyHandler);
    window.addEventListener('mouseup', upHandler);
    window.addEventListener('mousemove', moveHandler);
    return () => {
      window.removeEventListener('keydown', keyHandler);
      window.removeEventListener('mouseup', upHandler);
      window.removeEventListener('mousemove', moveHandler);
    };
  }, [selectedId, deleteSelected, onToolChange, activeTool, draggingId, hitTest]);

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
    draggingPart === 'right_edge' ? 'ew-resize' :
    activeTool === 'none' ? (() => {
      const hit = hitTest(mousePos?.x ?? 0, mousePos?.y ?? 0);
      if (!hit) return 'default';
      if (hit.part === 'right_edge') return 'ew-resize';
      return 'pointer';
    })() :
    activeTool === 'horizontal' ? 'row-resize' :
    activeTool === 'trendline' ? 'crosshair' :
    activeTool === 'long_position' || activeTool === 'short_position' ? 'crosshair' :
    activeTool === 'annotation' ? 'cell' : 'default';

  return (
    <>
      {/* Drawing Canvas Overlay */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-30 touch-none"
        style={{ 
          cursor, 
          pointerEvents: (activeTool !== 'none' || draggingId || isHoveringShape) ? 'auto' : 'none'
        }}
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

          {/* Lock / Unlock toggle for position drawings */}
          {(drawings.find(d => d.id === selectedId)?.type === 'long_position' || drawings.find(d => d.id === selectedId)?.type === 'short_position') && (() => {
            const pos = drawings.find(d => d.id === selectedId) as PositionDrawing;
            return (
              <button
                onClick={() => setDrawings(prev => prev.map(d =>
                  d.id === selectedId && (d.type === 'long_position' || d.type === 'short_position')
                    ? { ...d, isLocked: !(d as PositionDrawing).isLocked }
                    : d
                ))}
                className={`flex items-center gap-1.5 border text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full transition-all hover-lift ${
                  pos?.isLocked
                    ? 'bg-[var(--holo-gold)]/20 border-[var(--holo-gold)]/60 text-[var(--holo-gold)] shadow-[0_0_8px_rgba(252,213,53,0.4)]'
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/60'
                }`}
                title={pos?.isLocked ? 'Unlock position' : 'Lock position'}
              >
                {pos?.isLocked ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                  </svg>
                )}
                {pos?.isLocked ? 'Locked' : 'Lock'}
              </button>
            );
          })()}

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
