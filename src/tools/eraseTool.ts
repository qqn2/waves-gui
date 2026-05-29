import { useStore } from '../shared/store';
import { flushPendingCodeToDiagram } from './codeFlush';
import { toolState } from './toolState';
import type { HitTestResult } from './hitTestStub';

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
  if (hit.signalId === null || hit.signalType !== 'bit' || hit.step === null) return;

  flushPendingCodeToDiagram();

  useStore.getState().setPaintDraft({
    signalId: hit.signalId,
    startStep: hit.step,
    endStep: hit.step,
    bitState: '0',
    mode: 'erase',
  });
  capturePointer(canvas, e);
}

export function erasePointerMove(hit: HitTestResult): void {
  if (!toolState.isEraseDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (!draft || hit.signalId !== draft.signalId || hit.step === null) return;
  if (hit.step === draft.endStep) return;
  useStore.getState().setPaintDraft({ ...draft, endStep: hit.step });
}

export function erasePointerUp(e: PointerEvent, canvas: HTMLCanvasElement | null): void {
  if (!toolState.isEraseDragging()) return;
  releasePointer(canvas, e);

  const draft = useStore.getState().view.paintDraft;
  if (!draft) return;
  const lo = Math.min(draft.startStep, draft.endStep);
  const hi = Math.max(draft.startStep, draft.endStep);
  useStore.getState().eraseSignalStateRange(draft.signalId, lo, hi);
  useStore.getState().clearPaintDraft();
}

export function eraseCancel(canvas: HTMLCanvasElement | null): void {
  if (!toolState.isEraseDragging()) return;
  const pid = toolState.getCapturedPointerId();
  if (canvas && pid !== null && canvas.hasPointerCapture(pid)) {
    canvas.releasePointerCapture(pid);
  }
  toolState.endEraseDrag();
  useStore.getState().clearPaintDraft();
}
