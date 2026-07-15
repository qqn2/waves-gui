import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
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
  /** Optional external ref for pointer capture (tools). */
  canvasRef?: RefObject<HTMLCanvasElement | null>;
  onPointerEvent?: (
    phase: 'down' | 'move' | 'up',
    e: PointerEvent,
    hit: HitTestResult,
  ) => void;
  onContextMenu?: (e: MouseEvent, hit: HitTestResult) => void;
  onKeyboardFocusHit?: (hit: HitTestResult | null) => void;
}

export function WaveformCanvas({
  scrollSync,
  canvasRef: canvasRefProp,
  onPointerEvent,
  onContextMenu,
  onKeyboardFocusHit,
}: WaveformCanvasProps) {
  const internalRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = canvasRefProp ?? internalRef;
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const setScroll = useStore((s) => s.setScroll);
  const renderStateRef = useRef({ diagram, view });
  const [keyboardHit, setKeyboardHit] = useState<HitTestResult | null>(null);
  renderStateRef.current = { diagram, view };

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!rendererRef.current) rendererRef.current = new CanvasRenderer(ctx);
    const latest = renderStateRef.current;
    rendererRef.current.draw(latest.diagram, latest.view, canvas.width, canvas.height);
  }, [canvasRef]);

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
  }, [canvasRef, redraw]);

  useEffect(() => {
    redraw();
  }, [diagram, view, redraw]);

  const focusableRows = buildRowLayout(diagram.signals).filter(
    (row) => row.type === 'bit' || row.type === 'vector',
  );

  const setKeyboardPosition = useCallback((rowIndex: number, step: number) => {
    const row = focusableRows[rowIndex];
    if (!row) return;
    const next: HitTestResult = {
      signalId: row.id,
      signalType: row.type === 'bit' ? 'bit' : 'vector',
      step: Math.max(0, Math.min(diagram.config.totalSteps - 1, step)),
      half: null,
      isLabelArea: false,
      isTimeAxis: false,
      edgeIndex: null,
    };
    setKeyboardHit(next);
    onKeyboardFocusHit?.(next);
  }, [diagram.config.totalSteps, focusableRows, onKeyboardFocusHit]);

  const handleKeyboardNavigation = useCallback((e: React.KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const currentRow = Math.max(
      0,
      focusableRows.findIndex((row) => row.id === keyboardHit?.signalId),
    );
    const currentStep = keyboardHit?.step ?? 0;
    if (e.key === 'ArrowLeft') setKeyboardPosition(currentRow, currentStep - 1);
    else if (e.key === 'ArrowRight') setKeyboardPosition(currentRow, currentStep + 1);
    else if (e.key === 'ArrowUp') setKeyboardPosition(Math.max(0, currentRow - 1), currentStep);
    else if (e.key === 'ArrowDown') setKeyboardPosition(Math.min(focusableRows.length - 1, currentRow + 1), currentStep);
    else if (e.key === 'Home') setKeyboardPosition(currentRow, 0);
    else setKeyboardPosition(currentRow, diagram.config.totalSteps - 1);
  }, [diagram.config.totalSteps, focusableRows, keyboardHit, setKeyboardPosition]);

  let keyboardStatus = 'Waveform grid';
  if (keyboardHit?.signalId && keyboardHit.step !== null) {
    let signalName = keyboardHit.signalId;
    const visit = (items: typeof diagram.signals): boolean => {
      for (const item of items) {
        if (item.type === 'group') {
          if (visit(item.children)) return true;
        } else if (item.id === keyboardHit.signalId) {
          signalName = item.name;
          return true;
        }
      }
      return false;
    };
    visit(diagram.signals);
    keyboardStatus = `${signalName}, step ${keyboardHit.step + 1} of ${diagram.config.totalSteps}`;
  }

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
      canvasRef,
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
    <>
      <canvas
        ref={canvasRef}
        role="grid"
        tabIndex={0}
        aria-label={`Waveform editor. ${keyboardStatus}. Use arrow keys to move between steps and signals.`}
        aria-rowcount={focusableRows.length}
        aria-colcount={diagram.config.totalSteps}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
        onFocus={() => {
          if (!keyboardHit && focusableRows.length > 0) setKeyboardPosition(0, 0);
        }}
        onBlur={() => onKeyboardFocusHit?.(null)}
        onKeyDown={handleKeyboardNavigation}
        onWheel={handleWheel}
        onPointerDown={(e) => dispatchPointer('down', e)}
        onPointerMove={(e) => dispatchPointer('move', e)}
        onPointerUp={(e) => dispatchPointer('up', e)}
        onContextMenu={(e) => {
          if (!onContextMenu) return;
          const hit = hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY, diagram, view);
          onContextMenu(e.nativeEvent, hit);
        }}
      />
      <span className="srOnly" role="status" aria-live="polite">{keyboardStatus}</span>
    </>
  );
}
