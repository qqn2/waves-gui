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
import { editingShortcutForEvent, paintValueForEvent } from '../shared/shortcuts';
import type { HitTestResult } from '../renderer/hitTest';
import { hitTest } from '../renderer/hitTest';
import type { SelectOverlayRect } from './toolState';
import { toolState } from './toolState';
import * as paint from './paintTool';
import * as analoguePaint from './analoguePaintTool';
import * as erase from './eraseTool';
import * as select from './selectTool';
import { flushPendingCodeToDiagram } from './codeFlush';
import { undoDocument, redoDocument } from '../codePanel/documentHistory';
import { runAfterSourceFlush } from '../codePanel/sourceMutationGuard';
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
  if (
    target instanceof HTMLInputElement
    || target instanceof HTMLTextAreaElement
    || target instanceof HTMLSelectElement
    || target.isContentEditable
  ) {
    return true;
  }
  return Boolean(target.closest('.cm-editor, [contenteditable="true"]'));
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
    curveDrag.cancel();
    clearPaintDraft();
    toolState.cancelAll();
    setSelectionOverlay(null);
  }, [clearPaintDraft, canvasRef, edge, curveDrag]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing || e.altKey || isEditableTarget(e.target)) return;
      if (e.target instanceof HTMLElement && e.target.closest('[aria-modal="true"]')) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        cancelOperation();
        return;
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 'a') {
          e.preventDefault();
          select.selectAllSignals();
        } else if (key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undoDocument();
        } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redoDocument();
        } else if (key === 'c') {
          e.preventDefault();
          copyStepSelection();
        } else if (key === 'v') {
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
          runAfterSourceFlush(() => select.deleteSelection());
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

      const shortcut = editingShortcutForEvent(
        e,
        useStore.getState().diagram.compatibility?.extensionsEnabled === true,
      );
      if (shortcut) {
        e.preventDefault();
        setTool(shortcut.tool);
        if (shortcut.paintMode) setPaintMode(shortcut.paintMode);
      } else {
        const value = paintValueForEvent(e);
        if (value !== undefined) {
          e.preventDefault();
          setActiveBitState(value);
          setPaintMode('set');
          setTool('paint');
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    tool,
    setTool,
    setActiveBitState,
    setPaintMode,
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
