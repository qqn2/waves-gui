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
import { hitTest } from '../renderer/hitTest';
import type { SelectOverlayRect } from './toolState';
import { toolState } from './toolState';
import * as paint from './paintTool';
import * as analoguePaint from './analoguePaintTool';
import * as erase from './eraseTool';
import * as select from './selectTool';
import { flushPendingCodeToDiagram } from './codeFlush';
import { useEdgeTools } from './useEdgeTools';
import { useTimeAxisContextMenu } from '../shell/TimeAxisContextMenu';
import { copyStepSelection, pasteStepSelection } from './stepClipboard';
import { useEdgeCurveDrag } from './useEdgeCurveDrag';
import {
  annotationPointerDown,
  cancelStructuredArrow,
  globalCompressionPointerDown,
  horizontalLinePointerDown,
  structuredArrowPointerDown,
  verticalLinePointerDown,
} from './annotationTool';

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

  useEffect(() => {
    if (tool !== 'structured-arrow') cancelStructuredArrow();
  }, [tool]);

  const cancelOperation = useCallback(() => {
    const el = canvasRef.current;
    paint.paintCancel(el);
    analoguePaint.analoguePaintCancel(el);
    erase.eraseCancel(el);
    select.selectCancel(el);
    cancelStructuredArrow();
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
          if (!flushPendingCodeToDiagram().ok) return;
          undo();
        } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          if (!flushPendingCodeToDiagram().ok) return;
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
          if (!flushPendingCodeToDiagram().ok) return;
          select.deleteSelection();
        }
        return;
      }

      if (
        e.key === 'ArrowLeft'
        || e.key === 'ArrowRight'
        || e.key === 'ArrowUp'
        || e.key === 'ArrowDown'
      ) {
        if (!flushPendingCodeToDiagram().ok) return;
        if (select.nudgeSelectedAnnotation(e.key, e.shiftKey)) {
          e.preventDefault();
          return;
        }
      }

      if (e.key === 'v' || e.key === 'V') {
        if (e.ctrlKey || e.metaKey) return;
        setTool('cursor');
      } else if (e.key === 'd' || e.key === 'D') {
        setTool(
          e.key === 'D'
          && useStore.getState().diagram.compatibility?.extensionsEnabled
            ? 'analogue-paint'
            : 'paint',
        );
      } else if (e.key === 'e' || e.key === 'E') {
        setTool('erase');
      } else if (e.key === 'i' || e.key === 'I') {
        if (useStore.getState().diagram.compatibility?.extensionsEnabled) {
          setTool('annotation');
        }
      } else if (e.key === 'A') {
        if (useStore.getState().diagram.compatibility?.extensionsEnabled) {
          setTool('structured-arrow');
        }
      } else if (e.key === 'l' || e.key === 'L') {
        if (useStore.getState().diagram.compatibility?.extensionsEnabled) {
          setTool(e.shiftKey ? 'horizontal-line' : 'vertical-line');
        }
      } else if (e.key === 'C') {
        if (useStore.getState().diagram.compatibility?.extensionsEnabled) {
          setTool('global-compression');
        }
      } else if (e.key === 'g' || e.key === 'G') {
        setTool('paint');
        setPaintMode('glitch');
      } else if (e.key === '|') {
        setTool('paint');
        setPaintMode('gap');
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
      const revisionBeforeFlush = useStore.getState().view.diagramRevision;
      if (!flushPendingCodeToDiagram().ok) return;
      // A successful Source apply can replace every signal ID. The canvas
      // event's hit was computed against the previous diagram, so refresh it
      // before any tool consumes signalId/step/edgeIndex.
      const revisionAfterFlush = useStore.getState().view.diagramRevision;
      const currentHit = revisionAfterFlush === revisionBeforeFlush
        ? hit
        : hitTest(
          e.offsetX,
          e.offsetY,
          useStore.getState().diagram,
          useStore.getState().view,
        );
      if (curveDrag.onPointerDown(e)) return;
      const el = canvasRef.current;
      if (tool === 'paint') paint.paintPointerDown(e, currentHit, el);
      else if (tool === 'analogue-paint') {
        analoguePaint.analoguePaintPointerDown(e, currentHit, el);
      }
      else if (tool === 'erase') erase.erasePointerDown(e, currentHit, el);
      else if (tool === 'annotation') annotationPointerDown(e, currentHit);
      else if (tool === 'vertical-line') verticalLinePointerDown(e, currentHit);
      else if (tool === 'horizontal-line') horizontalLinePointerDown(e, currentHit);
      else if (tool === 'global-compression') globalCompressionPointerDown(e, currentHit);
      else if (tool === 'structured-arrow') structuredArrowPointerDown(e);
      else if (tool === 'arrow' || tool === 'timespan') {
        if (tool === 'arrow' && e.button !== 2) el?.setPointerCapture(e.pointerId);
        edge.onPointerDown(e, currentHit);
      } else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerDown(e, el, currentHit);
      }
    },
    [tool, canvasRef, edge, curveDrag],
  );

  const onPointerMove = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      curveDrag.onPointerMove(e);
      if (tool === 'paint') paint.paintPointerMove(e);
      else if (tool === 'analogue-paint') analoguePaint.analoguePaintPointerMove(e);
      else if (tool === 'erase') erase.erasePointerMove(e);
      else if (tool === 'arrow' || tool === 'timespan') edge.onPointerMove(e, hit);
      else if (tool === 'structured-arrow') {
        useStore.getState().setEdgeToolHover({
          signalId: hit.signalId,
          step: hit.step,
          canvasX: e.offsetX,
          canvasY: e.offsetY,
        });
      }
      else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerMove(e);
        setSelectionOverlay(toolState.getSelectOverlay());
      }
    },
    [tool, edge, curveDrag],
  );

  const onPointerUp = useCallback(
    (e: PointerEvent, hit: HitTestResult) => {
      curveDrag.onPointerUp(e);
      const el = canvasRef.current;
      if (tool === 'paint') paint.paintPointerUp(e, el);
      else if (tool === 'analogue-paint') {
        analoguePaint.analoguePaintPointerUp(e, el);
      }
      else if (tool === 'erase') erase.erasePointerUp(e, el);
      else if (tool === 'arrow' || tool === 'timespan') edge.onPointerUp(e, hit);
      else if (tool === 'cursor' || tool === 'select') {
        select.selectPointerUp(e, el);
        setSelectionOverlay(null);
      }
      if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    },
    [tool, canvasRef, edge, curveDrag],
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
