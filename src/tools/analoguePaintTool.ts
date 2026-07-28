import type { HitTestResult } from '../renderer/hitTest';
import { useStore } from '../shared/store';
import { flushPendingCodeToDiagram } from './codeFlush';
import { stepAtCanvasX } from './pointerUtils';
import { toolState } from './toolState';

function releasePointer(
  canvas: HTMLCanvasElement | null,
  e: PointerEvent,
): void {
  if (canvas?.hasPointerCapture(e.pointerId)) {
    canvas.releasePointerCapture(e.pointerId);
  }
  toolState.endPaintDrag();
}

export function analoguePaintPointerDown(
  e: PointerEvent,
  hit: HitTestResult,
  canvas: HTMLCanvasElement | null,
): void {
  if (
    e.button === 2
    || hit.signalType !== 'analogue'
    || hit.signalId === null
    || hit.step === null
  ) return;

  flushPendingCodeToDiagram();
  const { view } = useStore.getState();
  useStore.getState().setActiveSignalIds([hit.signalId]);
  useStore.getState().setPaintDraft({
    signalId: hit.signalId,
    startStep: hit.step,
    endStep: hit.step,
    lane: 'analogue',
    bitState: '0',
    apply: 'set',
    mode: 'paint',
    analogueKind: view.activeAnalogueKind,
    analogueValue: view.activeAnalogueValue,
  });
  canvas?.setPointerCapture(e.pointerId);
  toolState.beginPaintDrag(e.pointerId);
}

export function analoguePaintPointerMove(e: PointerEvent): void {
  if (!toolState.isPaintDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (!draft || draft.lane !== 'analogue') return;
  const { diagram, view } = useStore.getState();
  const step = stepAtCanvasX(e.offsetX, diagram, view, draft.signalId);
  if (step !== draft.endStep) {
    useStore.getState().setPaintDraft({ ...draft, endStep: step });
  }
}

export function analoguePaintPointerUp(
  e: PointerEvent,
  canvas: HTMLCanvasElement | null,
): void {
  if (!toolState.isPaintDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  releasePointer(canvas, e);
  if (!draft || draft.lane !== 'analogue') return;
  useStore.getState().paintAnalogueCellRange(
    draft.signalId,
    draft.startStep,
    draft.endStep,
    draft.analogueKind ?? 'step',
    draft.analogueValue ?? 0,
  );
  useStore.getState().clearPaintDraft();
}

export function analoguePaintCancel(
  canvas: HTMLCanvasElement | null,
): void {
  const draft = useStore.getState().view.paintDraft;
  if (!toolState.isPaintDragging() || draft?.lane !== 'analogue') return;
  const pointerId = toolState.getCapturedPointerId();
  if (canvas && pointerId !== null && canvas.hasPointerCapture(pointerId)) {
    canvas.releasePointerCapture(pointerId);
  }
  toolState.endPaintDrag();
  useStore.getState().clearPaintDraft();
}
