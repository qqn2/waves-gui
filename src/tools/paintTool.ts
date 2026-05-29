import type { BitState } from '../shared/types';
import { useStore } from '../shared/store';
import { flushPendingCodeToDiagram } from './codeFlush';
import { toolState } from './toolState';
import type { HitTestResult } from './hitTestStub';

function capturePointer(canvas: HTMLCanvasElement | null, e: PointerEvent): void {
  if (!canvas) return;
  canvas.setPointerCapture(e.pointerId);
  toolState.beginPaintDrag(e.pointerId);
}

function releasePointer(canvas: HTMLCanvasElement | null, e: PointerEvent): void {
  if (!canvas) return;
  if (canvas.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
  toolState.endPaintDrag();
}

export function paintPointerDown(
  e: PointerEvent,
  hit: HitTestResult,
  canvas: HTMLCanvasElement | null,
): void {
  if (hit.signalId === null || hit.signalType !== 'bit' || hit.step === null) return;
  if (e.button === 2) return;

  flushPendingCodeToDiagram();

  const { view } = useStore.getState();
  let bitState: BitState;
  if (e.shiftKey) {
    bitState = view.activeBitState;
  } else if (hit.half === 'top') {
    bitState = '1';
  } else {
    bitState = '0';
  }

  useStore.getState().setPaintDraft({
    signalId: hit.signalId,
    startStep: hit.step,
    endStep: hit.step,
    bitState,
    mode: 'paint',
  });
  capturePointer(canvas, e);
}

export function paintPointerMove(hit: HitTestResult): void {
  if (!toolState.isPaintDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (!draft || hit.signalId !== draft.signalId || hit.step === null) return;
  if (hit.step === draft.endStep) return;
  useStore.getState().setPaintDraft({ ...draft, endStep: hit.step });
}

export function paintPointerUp(e: PointerEvent, canvas: HTMLCanvasElement | null): void {
  if (!toolState.isPaintDragging()) return;
  releasePointer(canvas, e);

  const draft = useStore.getState().view.paintDraft;
  if (!draft) return;
  const lo = Math.min(draft.startStep, draft.endStep);
  const hi = Math.max(draft.startStep, draft.endStep);
  useStore.getState().setSignalStateRange(draft.signalId, lo, hi, draft.bitState);
  useStore.getState().clearPaintDraft();
}

export function paintCancel(canvas: HTMLCanvasElement | null): void {
  if (!toolState.isPaintDragging()) return;
  const pid = toolState.getCapturedPointerId();
  if (canvas && pid !== null && canvas.hasPointerCapture(pid)) {
    canvas.releasePointerCapture(pid);
  }
  toolState.endPaintDrag();
  useStore.getState().clearPaintDraft();
}
