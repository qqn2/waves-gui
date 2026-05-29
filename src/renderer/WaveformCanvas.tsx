import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../shared/store';
import { CELL_WIDTH } from '../shared/constants';
import { CanvasRenderer } from './CanvasRenderer';
import { hitTest, type HitTestResult } from './hitTest';
import { buildRowLayout, totalContentHeight } from './rowLayout';

/** Optional scroll bridge from shell (Track H); kept local to avoid importing shell/. */
export interface CanvasScrollSync {
  applyCanvasScrollY: (y: number) => void;
}

export interface WaveformCanvasProps {
  scrollSync?: CanvasScrollSync;
  onPointerEvent?: (
    phase: 'down' | 'move' | 'up',
    e: PointerEvent,
    hit: HitTestResult,
  ) => void;
}

export function WaveformCanvas({ scrollSync, onPointerEvent }: WaveformCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const setScroll = useStore((s) => s.setScroll);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!rendererRef.current) rendererRef.current = new CanvasRenderer(ctx);
    rendererRef.current.draw(diagram, view, canvas.width, canvas.height);
  }, [diagram, view]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        rendererRef.current = new CanvasRenderer(ctx);
      }
      redraw();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const canvas = canvasRef.current;
      const viewportH = canvas?.clientHeight ?? 0;
      const viewportW = canvas?.clientWidth ?? 0;
      const rows = buildRowLayout(diagram.signals);
      const contentLogicalH = totalContentHeight(rows);
      const maxY = Math.max(0, contentLogicalH * view.zoom - viewportH);
      const contentLogicalW = diagram.config.totalSteps * CELL_WIDTH * diagram.config.hscale;
      const maxX = Math.max(
        0,
        contentLogicalW * view.zoom - viewportW,
      );
      const x = Math.max(0, Math.min(maxX, view.scrollX + e.deltaX));
      const y = Math.max(0, Math.min(maxY, view.scrollY + e.deltaY));
      setScroll(x, y);
      requestAnimationFrame(() => {
        scrollSync?.applyCanvasScrollY(y);
      });
    },
    [
      diagram.signals,
      diagram.config.totalSteps,
      diagram.config.hscale,
      view.zoom,
      view.scrollX,
      view.scrollY,
      setScroll,
      scrollSync,
    ],
  );

  const dispatchPointer = useCallback(
    (phase: 'down' | 'move' | 'up', e: React.PointerEvent) => {
      if (!onPointerEvent) return;
      const hit = hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY, diagram, view);
      onPointerEvent(phase, e.nativeEvent, hit);
    },
    [diagram, view, onPointerEvent],
  );

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      onWheel={handleWheel}
      onPointerDown={(e) => dispatchPointer('down', e)}
      onPointerMove={(e) => dispatchPointer('move', e)}
      onPointerUp={(e) => dispatchPointer('up', e)}
    />
  );
}
