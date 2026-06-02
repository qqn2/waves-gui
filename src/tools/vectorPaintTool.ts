import { useStore } from '../shared/store';
import { flushPendingCodeToDiagram } from './codeFlush';
import { toolState } from './toolState';
import type { HitTestResult } from './hitTestStub';
import { stepAtCanvasX } from './pointerUtils';

function capturePointer(
  canvas: HTMLCanvasElement | null,
  e: PointerEvent,
  kind: 'paint' | 'erase',
): void {
  if (!canvas) return;
  canvas.setPointerCapture(e.pointerId);
  if (kind === 'paint') toolState.beginPaintDrag(e.pointerId);
  else toolState.beginEraseDrag(e.pointerId);
}

function releasePointer(
  canvas: HTMLCanvasElement | null,
  e: PointerEvent,
  kind: 'paint' | 'erase',
): void {
  if (!canvas) return;
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
  if (kind === 'paint') toolState.endPaintDrag();
  else toolState.endEraseDrag();
}

function busLabelForPaint(): string {
  const label = useStore.getState().view.activeBusLabel.trim();
  return label.length > 0 ? label : 'data';
}

export function vectorPaintPointerDown(
  e: PointerEvent,
  hit: HitTestResult,
  canvas: HTMLCanvasElement | null,
): void {
  if (hit.signalId === null || hit.signalType !== 'vector' || hit.step === null) return;
  if (e.button === 2) return;

  flushPendingCodeToDiagram();

  useStore.getState().setPaintDraft({
    signalId: hit.signalId,
    startStep: hit.step,
    endStep: hit.step,
    lane: 'vector',
    bitState: '0',
    apply: 'set',
    busLabel: busLabelForPaint(),
    mode: 'paint',
  });
  capturePointer(canvas, e, 'paint');
}

export function vectorPaintPointerMove(e: PointerEvent): void {
  if (!toolState.isPaintDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (!draft || draft.lane !== 'vector') return;
  const { diagram, view } = useStore.getState();
  const step = stepAtCanvasX(e.offsetX, diagram, view);
  if (step === draft.endStep) return;
  useStore.getState().setPaintDraft({ ...draft, endStep: step });
}

export function vectorPaintPointerUp(
  e: PointerEvent,
  canvas: HTMLCanvasElement | null,
): void {
  if (!toolState.isPaintDragging()) return;
  releasePointer(canvas, e, 'paint');

  const draft = useStore.getState().view.paintDraft;
  if (!draft || draft.lane !== 'vector') return;
  const lo = Math.min(draft.startStep, draft.endStep);
  const hi = Math.max(draft.startStep, draft.endStep);
  useStore.getState().setVectorSpanRange(draft.signalId, lo, hi, draft.busLabel ?? 'data');
  useStore.getState().clearPaintDraft();
}

export function vectorPaintCancel(canvas: HTMLCanvasElement | null): void {
  if (!toolState.isPaintDragging()) return;
  const pid = toolState.getCapturedPointerId();
  if (canvas && pid !== null && canvas.hasPointerCapture(pid)) {
    canvas.releasePointerCapture(pid);
  }
  toolState.endPaintDrag();
  useStore.getState().clearPaintDraft();
}

export function vectorErasePointerDown(
  e: PointerEvent,
  hit: HitTestResult,
  canvas: HTMLCanvasElement | null,
): void {
  if (hit.signalId === null || hit.signalType !== 'vector' || hit.step === null) return;

  flushPendingCodeToDiagram();

  useStore.getState().setPaintDraft({
    signalId: hit.signalId,
    startStep: hit.step,
    endStep: hit.step,
    lane: 'vector',
    bitState: '0',
    apply: 'set',
    mode: 'erase',
  });
  capturePointer(canvas, e, 'erase');
}

export function vectorErasePointerMove(e: PointerEvent): void {
  if (!toolState.isEraseDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (!draft || draft.lane !== 'vector') return;
  const { diagram, view } = useStore.getState();
  const step = stepAtCanvasX(e.offsetX, diagram, view);
  if (step === draft.endStep) return;
  useStore.getState().setPaintDraft({ ...draft, endStep: step });
}

export function vectorErasePointerUp(
  e: PointerEvent,
  canvas: HTMLCanvasElement | null,
): void {
  if (!toolState.isEraseDragging()) return;
  releasePointer(canvas, e, 'erase');

  const draft = useStore.getState().view.paintDraft;
  if (!draft || draft.lane !== 'vector') return;
  const lo = Math.min(draft.startStep, draft.endStep);
  const hi = Math.max(draft.startStep, draft.endStep);
  useStore.getState().setVectorSpanRange(draft.signalId, lo, hi, null);
  useStore.getState().clearPaintDraft();
}

export function vectorEraseCancel(canvas: HTMLCanvasElement | null): void {
  if (!toolState.isEraseDragging()) return;
  const pid = toolState.getCapturedPointerId();
  if (canvas && pid !== null && canvas.hasPointerCapture(pid)) {
    canvas.releasePointerCapture(pid);
  }
  toolState.endEraseDrag();
  useStore.getState().clearPaintDraft();
}
