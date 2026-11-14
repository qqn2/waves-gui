import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { findSignal, useStore } from '../shared/store';
import { CanvasRenderer } from './CanvasRenderer';
import { hitTest, type HitTestResult } from './hitTest';
import { buildRowLayout } from './rowLayout';
import { stepLogicalX, stepLogicalXEnd } from './laneTiming';
import { canvasWheelDelta, clampCanvasScroll, measureCanvasViewport, revealCanvasCell } from './canvasViewport';
import './WaveformCanvas.css';

/** Optional scroll bridge from shell (Track H); kept local to avoid importing shell/. */
export interface CanvasScrollSync {
  signalPanelEl?: HTMLDivElement | null;
  applyCanvasScrollY: (y: number) => void;
  setCanvasScrollBounds?: (maxY: number) => void;
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
  const horizontalRailRef = useRef<HTMLDivElement>(null);
  const verticalRailRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ width: number; height: number; signalHeight?: number }>({ width: 0, height: 0 });
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const setScroll = useStore((s) => s.setScroll);
  const renderStateRef = useRef({ diagram, view });
  const [keyboardHit, setKeyboardHit] = useState<HitTestResult | null>(null);
  renderStateRef.current = { diagram, view };
  const viewport = useMemo(
    () => measureCanvasViewport(diagram, { zoom: view.zoom, collapsedGroupIds: view.collapsedGroupIds }, size.width, size.height, size.signalHeight),
    [diagram, view.zoom, view.collapsedGroupIds, size],
  );

  const applyScroll = useCallback((x: number, y: number) => {
    const next = clampCanvasScroll(x, y, viewport);
    const current = useStore.getState().view;
    if (next.x !== current.scrollX || next.y !== current.scrollY) {
      setScroll(next.x, next.y);
    }
    scrollSync?.applyCanvasScrollY(next.y);
  }, [setScroll, scrollSync, viewport]);

  useLayoutEffect(() => {
    if (size.width === 0 || size.height === 0) return;
    const next = clampCanvasScroll(view.scrollX, view.scrollY, viewport);
    scrollSync?.setCanvasScrollBounds?.(viewport.maxY);
    if (horizontalRailRef.current) horizontalRailRef.current.scrollLeft = next.x;
    if (verticalRailRef.current) verticalRailRef.current.scrollTop = next.y;
    applyScroll(next.x, next.y);
  }, [applyScroll, scrollSync, size, view.scrollX, view.scrollY, viewport]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (!rendererRef.current) rendererRef.current = new CanvasRenderer(ctx);
    const latest = renderStateRef.current;
    rendererRef.current.draw(
      latest.diagram,
      latest.view,
      canvas.clientWidth,
      canvas.clientHeight,
      window.devicePixelRatio || 1,
    );
  }, [canvasRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver(() => {
      setSize({ width: canvas.clientWidth, height: canvas.clientHeight, signalHeight: scrollSync?.signalPanelEl?.clientHeight });
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        rendererRef.current = new CanvasRenderer(ctx);
      }
      redraw();
    });
    ro.observe(canvas);
    if (scrollSync?.signalPanelEl) ro.observe(scrollSync.signalPanelEl);
    return () => ro.disconnect();
  }, [canvasRef, redraw, scrollSync]);

  useEffect(() => {
    redraw();
  }, [diagram, view, redraw]);

  const focusableRows = useMemo(() => buildRowLayout(
    diagram.signals,
    view.collapsedGroupIds,
  ).filter((row) => row.type === 'bit' || row.type === 'vector' || row.type === 'analogue'),
  [diagram.signals, view.collapsedGroupIds]);

  const setKeyboardPosition = useCallback((rowIndex: number, step: number, reveal = true) => {
    const row = focusableRows[rowIndex];
    if (!row) return;
    const next: HitTestResult = {
      signalId: row.id,
      signalType:
        row.type === 'analogue'
          ? 'analogue'
          : row.type === 'bit'
            ? 'bit'
            : 'vector',
      step: Math.max(0, Math.min(diagram.config.totalSteps - 1, step)),
      half: null,
      isLabelArea: false,
      isTimeAxis: false,
      edgeIndex: null,
      annotationId: null,
    };
    setKeyboardHit(next);
    onKeyboardFocusHit?.(next);
    if (!reveal) return;
    findSignal(diagram.signals, row.id, (signal) => {
      const scaleX = diagram.config.hscale * view.zoom;
      const current = useStore.getState().view;
      const scroll = revealCanvasCell({
        left: stepLogicalX(signal, next.step!) * scaleX,
        right: stepLogicalXEnd(signal, next.step!) * scaleX,
        top: row.y * view.zoom,
        bottom: (row.y + row.height) * view.zoom,
      }, { x: current.scrollX, y: current.scrollY }, viewport);
      applyScroll(scroll.x, scroll.y);
    });
  }, [applyScroll, diagram, focusableRows, onKeyboardFocusHit, view.zoom, viewport]);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handleWheel = (event: WheelEvent) => {
      // Keep browser zoom available, while preventing the page from scrolling.
      if (event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const delta = canvasWheelDelta(event, viewport);
      const current = useStore.getState().view;
      applyScroll(current.scrollX + delta.x, current.scrollY + delta.y);
    };
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [applyScroll, canvasRef, viewport]);

  const handleRailKey = (event: React.KeyboardEvent, axis: 'x' | 'y') => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    const current = useStore.getState().view;
    const offset = axis === 'x' ? current.scrollX : current.scrollY;
    const max = axis === 'x' ? viewport.maxX : viewport.maxY;
    const page = axis === 'x' ? viewport.width : viewport.height - viewport.waveformTop;
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? max
        : event.key === 'PageUp' ? offset - page
          : event.key === 'PageDown' ? offset + page
            : offset + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -40 : 40);
    applyScroll(axis === 'x' ? next : current.scrollX, axis === 'y' ? next : current.scrollY);
  };

  const dispatchPointer = useCallback(
    (phase: 'down' | 'move' | 'up', e: React.PointerEvent) => {
      if (!onPointerEvent) return;
      const hit = hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY, diagram, view);
      onPointerEvent(phase, e.nativeEvent, hit);
    },
    [diagram, view, onPointerEvent],
  );

  return (
    <div className="waveformViewport">
      <canvas
        ref={canvasRef}
        role="grid"
        tabIndex={0}
        aria-label={`Waveform editor. ${keyboardStatus}. Use arrow keys to move between steps and signals.`}
        aria-rowcount={focusableRows.length}
        aria-colcount={diagram.config.totalSteps}
        onFocus={() => {
          if (!keyboardHit && focusableRows.length > 0) setKeyboardPosition(0, 0, false);
        }}
        onBlur={() => onKeyboardFocusHit?.(null)}
        onKeyDown={handleKeyboardNavigation}
        onPointerDown={(e) => dispatchPointer('down', e)}
        onPointerMove={(e) => dispatchPointer('move', e)}
        onPointerUp={(e) => dispatchPointer('up', e)}
        onContextMenu={(e) => {
          if (!onContextMenu) return;
          const hit = hitTest(e.nativeEvent.offsetX, e.nativeEvent.offsetY, diagram, view);
          onContextMenu(e.nativeEvent, hit);
        }}
      />
      <div
        ref={horizontalRailRef}
        className="waveformScrollRail waveformScrollRail--horizontal"
        role="region"
        aria-label="Scroll waveform steps horizontally"
        tabIndex={viewport.maxX > 0 ? 0 : -1}
        title="Scroll steps · Shift + wheel"
        onKeyDown={(event) => handleRailKey(event, 'x')}
        onScroll={(event) => applyScroll(event.currentTarget.scrollLeft, useStore.getState().view.scrollY)}
      >
        <div style={{ width: Math.max(size.width, viewport.contentWidth), height: 1 }} />
      </div>
      <div
        ref={verticalRailRef}
        className="waveformScrollRail waveformScrollRail--vertical"
        role="region"
        aria-label="Scroll waveform signals vertically"
        tabIndex={viewport.maxY > 0 ? 0 : -1}
        title="Scroll signals"
        onKeyDown={(event) => handleRailKey(event, 'y')}
        onScroll={(event) => applyScroll(useStore.getState().view.scrollX, event.currentTarget.scrollTop)}
      >
        <div style={{ height: Math.max(size.height, viewport.contentHeight), width: 1 }} />
      </div>
      <div className="waveformScrollCorner" aria-hidden="true" />
      <span className="srOnly" role="status" aria-live="polite">{keyboardStatus}</span>
    </div>
  );
}
