import type { BitState } from '../shared/types';
import { canPaintDigitalTimingTicks } from '../shared/fineTiming';
import { findSignal, useStore } from '../shared/store';
import { flushPendingCodeToDiagram } from './codeFlush';
import { toolState } from './toolState';
import type { HitTestResult } from '../renderer/hitTest';
import { stepAtCanvasX, timingTickAtCanvasX } from './pointerUtils';
import * as vectorPaint from './vectorPaintTool';

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
  if (hit.signalId === null || hit.step === null) return;
  if (hit.signalType === 'vector') {
    vectorPaint.vectorPaintPointerDown(e, hit, canvas);
    return;
  }
  if (hit.signalType !== 'bit') return;
  if (e.button === 2) return;

  flushPendingCodeToDiagram();

  const { diagram, view } = useStore.getState();
  const apply: 'toggle' | 'set' | 'glitch' | 'gap' =
    view.paintMode === 'gap'
      ? 'gap'
      : view.paintMode === 'glitch'
        ? 'glitch'
        : e.shiftKey || view.paintMode === 'toggle'
          ? 'toggle'
          : 'set';
  const bitState: BitState = view.activeBitState;
  let fineTiming = false;
  let timing: import('../shared/types').DigitalTiming | null = null;
  findSignal(diagram.signals, hit.signalId, (signal) => {
    fineTiming =
      signal.type === 'bit'
      && Boolean(signal.digitalTiming)
      && (diagram.config.ticksPerStep ?? 1) > 1
      && (apply === 'set' || apply === 'toggle');
    if (signal.type === 'bit') timing = signal.digitalTiming ?? null;
  });
  const timingTick = fineTiming
    ? timingTickAtCanvasX(e.offsetX, diagram, view, hit.signalId)
    : undefined;
  // A P/p/N/n cell is one complete clock cycle. Do not split it into more
  // clock symbols—the result would silently add cycles. Fine painting becomes
  // available after an explicit clock-to-static expansion is introduced.
  if (
    timingTick !== undefined
    && timing
    && !canPaintDigitalTimingTicks(timing, timingTick, timingTick)
  ) return;

  useStore.getState().setPaintDraft({
    signalId: hit.signalId,
    startStep: hit.step,
    endStep: hit.step,
    ...(timingTick !== undefined
      ? { startTick: timingTick, endTick: timingTick }
      : {}),
    lane: 'bit',
    bitState,
    apply,
    mode: 'paint',
  });
  capturePointer(canvas, e);
}

export function paintPointerMove(e: PointerEvent): void {
  if (!toolState.isPaintDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (!draft) return;
  if (draft.lane === 'vector') {
    vectorPaint.vectorPaintPointerMove(e);
    return;
  }

  const { diagram, view } = useStore.getState();
  if (draft.startTick !== undefined) {
    const tick = timingTickAtCanvasX(e.offsetX, diagram, view, draft.signalId);
    if (tick !== draft.endTick) {
      useStore.getState().setPaintDraft({ ...draft, endTick: tick });
    }
    return;
  }
  const step = stepAtCanvasX(e.offsetX, diagram, view, draft.signalId);
  if (step === draft.endStep) return;
  useStore.getState().setPaintDraft({ ...draft, endStep: step });
}

export function paintPointerUp(e: PointerEvent, canvas: HTMLCanvasElement | null): void {
  if (!toolState.isPaintDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (draft?.lane === 'vector') {
    vectorPaint.vectorPaintPointerUp(e, canvas);
    return;
  }
  releasePointer(canvas, e);

  if (!draft) return;
  if (draft.startTick !== undefined && draft.endTick !== undefined) {
    if (draft.apply === 'set' || draft.apply === 'toggle') {
      useStore.getState().paintDigitalTimingRange(
        draft.signalId,
        draft.startTick,
        draft.endTick,
        draft.bitState,
        draft.apply,
      );
    }
    useStore.getState().clearPaintDraft();
    return;
  }
  const lo = Math.min(draft.startStep, draft.endStep);
  const hi = Math.max(draft.startStep, draft.endStep);
  const paintStyle = useStore.getState().view.paintStyle;
  if (draft.apply === 'glitch') {
    useStore.getState().toggleStepGlitchRange(draft.signalId, lo, hi);
  } else if (draft.apply === 'gap') {
    useStore.getState().paintGapRange(draft.signalId, lo, hi, paintStyle);
  } else if (draft.apply === 'toggle') {
    useStore.getState().paintToggleRange(draft.signalId, lo, hi, paintStyle);
  } else {
    useStore.getState().paintBitStateRange(
      draft.signalId,
      lo,
      hi,
      draft.bitState,
      paintStyle,
    );
  }
  useStore.getState().clearPaintDraft();
}

export function paintCancel(canvas: HTMLCanvasElement | null): void {
  if (!toolState.isPaintDragging()) return;
  const draft = useStore.getState().view.paintDraft;
  if (draft?.lane === 'vector') {
    vectorPaint.vectorPaintCancel(canvas);
    return;
  }
  const pid = toolState.getCapturedPointerId();
  if (canvas && pid !== null && canvas.hasPointerCapture(pid)) {
    canvas.releasePointerCapture(pid);
  }
  toolState.endPaintDrag();
  useStore.getState().clearPaintDraft();
}
