/**
 * Routes canvas pointer events to the active editing tool.
 *
 * Flow: WaveformCanvas hitTest(x,y) → onPointerDown/Move/Up here → tool module → store action
 *       → CanvasRenderer redraw. flushPendingCodeToDiagram() runs before mutating edits.
 *
 * toolState (module singleton) holds drag-in-progress data; paintDraft in the store is the
 * live preview overlay — both are cleared on pointer up.
 */
import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useStore } from '../shared/store';
import type { HitTestResult } from '../renderer/hitTest';
import type { SelectOverlayRect } from './toolState';
import { toolState } from './toolState';
import * as paint from './paintTool';
import * as erase from './eraseTool';
import * as select from './selectTool';
import { flushPendingCodeToDiagram } from './codeFlush';
import { useEdgeTools } from './useEdgeTools';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return true;
  }
  return Boolean(target.closest('.cm-editor'));
}

export function useToolHandler(canvasRef: RefObject<HTMLCanvasElement | null>): {
  onPointerDown: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerMove: (e: PointerEvent, hit: HitTestResult) => void;
  onPointerUp: (e: PointerEvent, hit: HitTestResult) => void;
  onContextMenu: (e: MouseEvent, hit: HitTestResult) => void;
  selectionOverlay: SelectOverlayRect | null;
  edgeHint: string | null;
} {
  const tool = useStore((s) => s.view.selectedTool);
  const setTool = useStore((s) => s.setTool);
  const setActiveBitState = useStore((s) => s.setActiveBitState);
  const setPaintMode = useStore((s) => s.setPaintMode);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const setZoom = useStore((s) => s.setZoom);
  const zoom = useStore((s) => s.view.zoom);
  const clearPaintDraft = useStore((s) => s.clearPaintDraft);
  const edge = useEdgeTools();

  const [selectionOverlay, setSelectionOverlay] = useState<SelectOverlayRect | null>(
    null,
  );

  const cancelOperation = useCallback(() => {
    const el = canvasRef.current;
    paint.paintCancel(el);
    erase.eraseCancel(el);
    select.selectCancel(el);
    edge.cancelEdgeEdit();
    clearPaintDraft();
    toolState.cancelAll();
    setSelectionOverlay(null);
  }, [clearPaintDraft, canvasRef, edge]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        cancelOperation();
        return;
      }

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        select.selectAllSignals();
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const t = useStore.getState().view.selectedTool;
        if (t === 'cursor' || t === 'select') {
          e.preventDefault();
          select.deleteSelection();
        }
        return;
      }

      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      } else if (e.key === 'v' || e.key === 'V') {
        setTool('cursor');
      } else if (e.key === 'd' || e.key === 'D') {
        setTool('paint');
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('erase');
      } else if (e.key === 'N' && e.shiftKey) {
        setActiveBitState('N');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === 'g' || e.key === 'G') {
        setTool('paint');
        setPaintMode('glitch');
      } else if (e.key === 't' || e.key === 'T') {
        setTool('paint');
        setPaintMode('toggle');
      } else if (e.key === 'n') {
        setActiveBitState('n');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === 'N') {
        setActiveBitState('N');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === '1') {
        setActiveBitState('1');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === '0') {
        setActiveBitState('0');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === 'p') {
        setActiveBitState('p');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === 'P') {
        setActiveBitState('P');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === 'z' && !e.ctrlKey) {
        setActiveBitState('z');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === 'x' || e.key === 'X') {
        setActiveBitState('x');
        setPaintMode('set');
        setTool('paint');
      } else if (e.key === 'u' || e.key === 'U') {
        setActiveBitState('u');
        setPaintMode('set');
        setTool('paint');
      } else if (e.ctrlKey && (e.key === '+' || e.key === '=')) {
        e.preventDefault();
        setZoom(zoom * 1.25);
      } else if (e.ctrlKey && e.key === '-') {
        e.preventDefault();
        setZoom(zoom / 1.25);
      } else if (e.ctrlKey && e.key === '0') {
        e.preventDefault();
        setZoom(1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    tool,
    setTool,
    setActiveBitState,
    setPaintMode,
    undo,
    redo,
    setZoom,
    zoom,
    cancelOperation,
  ]);

  const onPointerDown = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      flushPendingCodeToDiagram();
      const el = canvasRef.current;
      if (tool === 'paint') paint.paintPointerDown(e, hit, el);
      else if (tool === 'erase') erase.erasePointerDown(e, hit, el);
      else if (tool === 'arrow' || tool === 'timespan') {
        el?.setPointerCapture(e.pointerId);
        edge.onPointerDown(e, hit);
      } else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerDown(e, el, hit);
      }
    },
    [tool, canvasRef, edge],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      if (tool === 'paint') paint.paintPointerMove(e, hit);
      else if (tool === 'erase') erase.erasePointerMove(e, hit);
      else if (tool === 'arrow' || tool === 'timespan') edge.onPointerMove(e, hit);
      else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerMove(e);
        setSelectionOverlay(toolState.getSelectOverlay());
      }
    },
    [tool, edge],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      const el = canvasRef.current;
      if (tool === 'paint') paint.paintPointerUp(e, el);
      else if (tool === 'erase') erase.erasePointerUp(e, el);
      else if (tool === 'arrow' || tool === 'timespan') {
        if (el?.hasPointerCapture(e.pointerId)) {
          el.releasePointerCapture(e.pointerId);
        }
        edge.onPointerUp(e, hit);
      } else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerUp(e, el);
        setSelectionOverlay(null);
      }
    },
    [tool, canvasRef, edge],
  );

  const onContextMenu = useCallback(
    (e: MouseEvent, hit: HitTestResult) => {
      if (tool === 'paint' && hit.signalType === 'bit' && hit.signalId) {
        e.preventDefault();
      }
    },
    [tool],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
    selectionOverlay,
    edgeHint: edge.edgeHint,
  };
}
