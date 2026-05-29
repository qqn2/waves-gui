import { useCallback, useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { useStore } from '../shared/store';
import type { HitTestResult } from './hitTestStub';
import type { SelectOverlayRect } from './toolState';
import { toolState } from './toolState';
import * as paint from './paintTool';
import * as erase from './eraseTool';
import * as select from './selectTool';
import * as cursor from './cursorTool';
import { flushPendingCodeToDiagram } from './codeFlush';

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
} {
  const tool = useStore((s) => s.view.selectedTool);
  const setTool = useStore((s) => s.setTool);
  const setActiveBitState = useStore((s) => s.setActiveBitState);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const setZoom = useStore((s) => s.setZoom);
  const zoom = useStore((s) => s.view.zoom);
  const clearPaintDraft = useStore((s) => s.clearPaintDraft);

  const [selectionOverlay, setSelectionOverlay] = useState<SelectOverlayRect | null>(
    null,
  );

  const cancelOperation = useCallback(() => {
    const el = canvasRef.current;
    paint.paintCancel(el);
    erase.eraseCancel(el);
    select.selectCancel(el);
    clearPaintDraft();
    select.clearSelection();
    cursor.clearCursorSelection();
    toolState.cancelAll();
    setSelectionOverlay(null);
  }, [clearPaintDraft]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        cancelOperation();
        return;
      }

      if (e.ctrlKey && e.key === 'a') {
        if (tool === 'select') {
          e.preventDefault();
          select.selectAllSignals();
        }
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (tool === 'select') {
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
      } else if (e.key === 'd' || e.key === 'D') {
        setTool('paint');
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('erase');
      } else if (e.key === 's' || e.key === 'S') {
        setTool('select');
      } else if (e.key === '1') {
        setActiveBitState('1');
      } else if (e.key === '0') {
        setActiveBitState('0');
      } else if (e.key === 'z' || e.key === 'Z') {
        if (!e.ctrlKey) setActiveBitState('z');
      } else if (e.key === 'x' || e.key === 'X') {
        setActiveBitState('x');
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
      else if (tool === 'select') select.selectPointerDown(e, el);
      else if (tool === 'cursor') cursor.cursorPointerDown(hit);
    },
    [tool, canvasRef],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      if (tool === 'paint') paint.paintPointerMove(hit);
      else if (tool === 'erase') erase.erasePointerMove(hit);
      else if (tool === 'select') {
        select.selectPointerMove(e);
        setSelectionOverlay(toolState.getSelectOverlay());
      }
    },
    [tool],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent, _hit: HitTestResult) => {
      const el = canvasRef.current;
      if (tool === 'paint') paint.paintPointerUp(e, el);
      else if (tool === 'erase') erase.erasePointerUp(e, el);
      else if (tool === 'select') {
        select.selectPointerUp(e, el);
        setSelectionOverlay(null);
      }
    },
    [tool, canvasRef],
  );

  const onContextMenu = useCallback(
    (e: MouseEvent, hit: HitTestResult) => {
      if (tool === 'paint' && hit.signalType === 'bit' && hit.signalId) {
        e.preventDefault();
      }
    },
    [tool],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onContextMenu, selectionOverlay };
}
