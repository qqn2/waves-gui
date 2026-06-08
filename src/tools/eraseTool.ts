import { useStore } from '../shared/store';
import { flushPendingCodeToDiagram } from './codeFlush';
import { toolState } from './toolState';
import type { HitTestResult } from '../renderer/hitTest';
import { stepAtCanvasX } from './pointerUtils';
import * as vectorPaint from './vectorPaintTool';

function capturePointer(canvas: HTMLCanvasElement | null, e: PointerEvent): void {
  if (!canvas) return;
  canvas.setPointerCapture(e.pointerId);
  toolState.beginEraseDrag(e.pointerId);
}

function releasePointer(canvas: HTMLCanvasElement | null, e: PointerEvent): void {
  if (!canvas) return;
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
  toolState.endEraseDrag();
}

export function erasePointerDown(
  e: PointerEvent,
  hit: HitTestResult,
  canvas: HTMLCanvasElement | null,
): void {
  if (hit.edgeIndex !== null) {
    flushPendingCodeToDiagram();
    useStore.getState().setPaintDraft({
      signalId: '',
      startStep: 0,
      endStep: 0,
      lane: 'bit',
      bitState: '0',
      apply: 'set',
      mode: 'erase',
      edgeIndex: hit.edgeIndex,
    });
    capturePointer(canvas, e);
    return;
  }

  if (hit.signalId === null || hit.step === null) return;

  if (hit.signalType === 'vector') {
    vectorPaint.vectorErasePointerDown(e, hit, canvas);
    return;
  }
  if (hit.signalType !== 'bit') return;

  flushPendingCodeToDiagram();

  useStore.getState().setPaintDraft({
    signalId: hit.signalId,
    startStep: hit.step,
    endStep: hit.step,
    lane: 'bit',
    bitState: '0',
    apply: 'set',
    mode: 'erase',
  });
  capturePointer(canvas, e);
}

export function erasePointerMove(e: PointerEvent): void {
  if (!toolState.isEraseDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (!draft) return;
  if (draft.lane === 'vector') {
    vectorPaint.vectorErasePointerMove(e);
    return;
  }

  const { diagram, view } = useStore.getState();
  const step = stepAtCanvasX(e.offsetX, diagram, view, draft.signalId);
  if (step === draft.endStep) return;
  useStore.getState().setPaintDraft({ ...draft, endStep: step });
}

export function erasePointerUp(e: PointerEvent, canvas: HTMLCanvasElement | null): void {
  if (!toolState.isEraseDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (draft?.lane === 'vector') {
    vectorPaint.vectorErasePointerUp(e, canvas);
    return;
  }
  releasePointer(canvas, e);

  if (!draft) return;
  if (draft.edgeIndex !== undefined) {
    useStore.getState().removeDiagramEdge(draft.edgeIndex);
    useStore.getState().clearPaintDraft();
    return;
  }
  const lo = Math.min(draft.startStep, draft.endStep);
  const hi = Math.max(draft.startStep, draft.endStep);
  useStore.getState().eraseSignalStateRange(draft.signalId, lo, hi);
  useStore.getState().clearPaintDraft();
}

export function eraseCancel(canvas: HTMLCanvasElement | null): void {
  if (!toolState.isEraseDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (draft?.edgeIndex !== undefined) {
    const pid = toolState.getCapturedPointerId();
    if (canvas && pid !== null && canvas.hasPointerCapture(pid)) {
      canvas.releasePointerCapture(pid);
    }
    toolState.endEraseDrag();
    useStore.getState().clearPaintDraft();
    return;
  }
  if (draft?.lane === 'vector') {
    vectorPaint.vectorEraseCancel(canvas);
    return;
  }
  const pid = toolState.getCapturedPointerId();
  if (canvas && pid !== null && canvas.hasPointerCapture(pid)) {
    canvas.releasePointerCapture(pid);
  }
  toolState.endEraseDrag();
  useStore.getState().clearPaintDraft();
}
