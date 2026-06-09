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
import { useTimeAxisContextMenu } from '../shell/TimeAxisContextMenu';
import { copyStepSelection, pasteStepSelection } from './stepClipboard';
import { useEdgeCurveDrag } from './useEdgeCurveDrag';

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
  timeAxisMenu: { step: number; x: number; y: number } | null;
  closeTimeAxisMenu: () => void;
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
  const curveDrag = useEdgeCurveDrag(canvasRef);
  const { menu: timeAxisMenu, openMenu: openTimeAxisMenu, closeMenu: closeTimeAxisMenu } =
    useTimeAxisContextMenu();

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

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          select.selectAllSignals();
        } else if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (e.key === 'c' || e.key === 'C') {
          e.preventDefault();
          copyStepSelection();
        } else if (e.key === 'v' || e.key === 'V') {
          e.preventDefault();
          pasteStepSelection();
        } else if (e.key === '+' || e.key === '=') {
          e.preventDefault();
          setZoom(zoom * 1.25);
        } else if (e.key === '-') {
          e.preventDefault();
          setZoom(zoom / 1.25);
        } else if (e.key === '0') {
          e.preventDefault();
          setZoom(1);
        }
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

      if (e.key === 'v' || e.key === 'V') {
        if (e.ctrlKey || e.metaKey) return;
        setTool('cursor');
      } else if (e.key === 'd' || e.key === 'D') {
        setTool('paint');
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('erase');
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
      } else if (e.key === 'z') {
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
      } else if (e.key === '.') {
        setActiveBitState('.');
        setPaintMode('set');
        setTool('paint');
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
      if (curveDrag.onPointerDown(e)) return;
      flushPendingCodeToDiagram();
      const el = canvasRef.current;
      if (tool === 'paint') paint.paintPointerDown(e, hit, el);
      else if (tool === 'erase') erase.erasePointerDown(e, hit, el);
      else if (tool === 'arrow' || tool === 'timespan') {
        edge.onPointerDown(e, hit);
      } else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerDown(e, el, hit);
      }
    },
    [tool, canvasRef, edge, curveDrag],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      curveDrag.onPointerMove(e);
      if (tool === 'paint') paint.paintPointerMove(e);
      else if (tool === 'erase') erase.erasePointerMove(e);
      else if (tool === 'arrow' || tool === 'timespan') edge.onPointerMove(e, hit);
      else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerMove(e);
        setSelectionOverlay(toolState.getSelectOverlay());
      }
    },
    [tool, edge, curveDrag],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent) => {
      curveDrag.onPointerUp(e);
      const el = canvasRef.current;
      if (tool === 'paint') paint.paintPointerUp(e, el);
      else if (tool === 'erase') erase.erasePointerUp(e, el);
      else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerUp(e, el);
        setSelectionOverlay(null);
      }
    },
    [tool, canvasRef, curveDrag],
  );

  const onContextMenu = useCallback(
    (e: MouseEvent, hit: HitTestResult) => {
      if (hit.isTimeAxis && hit.step !== null) {
        e.preventDefault();
        openTimeAxisMenu(hit.step, e.clientX, e.clientY);
        return;
      }
      if (tool === 'paint' && hit.signalType === 'bit' && hit.signalId) {
        e.preventDefault();
      }
    },
    [tool, openTimeAxisMenu],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
    selectionOverlay,
    edgeHint: edge.edgeHint,
    timeAxisMenu,
    closeTimeAxisMenu,
  };
}
