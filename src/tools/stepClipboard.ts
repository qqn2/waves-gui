import { nanoid } from 'nanoid';
import { clearWaveMode } from '../wavedromBridge/laneWaveOps';
import { useStore, findSignal, pushHistory } from '../shared/store';
import { applyVectorSpan } from '../shared/vectorSegments';
import type { BitState, VectorSegment } from '../shared/types';
import { toolState } from './toolState';
import { flushPendingCodeToDiagram } from './codeFlush';

export interface StepRangeClipboard {
  bitStates: BitState[][];
  vectorSlices: Array<{ segments: VectorSegment[]; stepCount: number }>;
  stepCount: number;
}

let internalClipboard: StepRangeClipboard | null = null;

export function getStepClipboard(): StepRangeClipboard | null {
  return internalClipboard;
}

export function copyStepSelection(): boolean {
  if (!flushPendingCodeToDiagram().ok) return false;
  const { diagram, view } = useStore.getState();
  const steps = toolState.getStepSelection();
  if (!steps || view.activeSignalIds.length === 0) return false;

  let hasNativeTiming = false;
  for (const signalId of view.activeSignalIds) {
    findSignal(diagram.signals, signalId, (sig) => {
      if (sig.digitalTiming || sig.vectorTiming) hasNativeTiming = true;
    });
  }
  if (hasNativeTiming) {
    internalClipboard = null;
    return false;
  }

  const lo = Math.min(steps.start, steps.end);
  const hi = Math.max(steps.start, steps.end);
  const stepCount = hi - lo + 1;

  const bitStates: BitState[][] = [];
  const vectorSlices: StepRangeClipboard['vectorSlices'] = [];

  for (const signalId of view.activeSignalIds) {
    let sig: import('../shared/types').Signal | undefined;
    findSignal(diagram.signals, signalId, (s) => {
      sig = s;
    });
    if (!sig || sig.type === 'spacer') continue;

    if (sig.type === 'bit') {
      bitStates.push(sig.states.slice(lo, hi + 1));
    } else if (sig.type === 'vector') {
      const segments: VectorSegment[] = [];
      for (const seg of sig.segments) {
        if (seg.endStep <= lo || seg.startStep > hi) continue;
        segments.push({
          ...seg,
          id: nanoid(),
          startStep: Math.max(0, seg.startStep - lo),
          endStep: Math.min(stepCount, seg.endStep - lo),
        });
      }
      vectorSlices.push({ segments, stepCount });
    }
  }

  if (bitStates.length === 0 && vectorSlices.length === 0) return false;

  internalClipboard = { bitStates, vectorSlices, stepCount };
  return true;
}

export function pasteStepSelection(atStep?: number): boolean {
  if (!flushPendingCodeToDiagram().ok) return false;
  const clip = internalClipboard;
  if (!clip) return false;

  const { view, diagram } = useStore.getState();
  let hasNativeTiming = false;
  for (const signalId of view.activeSignalIds) {
    findSignal(diagram.signals, signalId, (sig) => {
      if (sig.digitalTiming || sig.vectorTiming) hasNativeTiming = true;
    });
  }
  if (hasNativeTiming) return false;
  const steps = toolState.getStepSelection();
  const pasteAt = atStep ?? steps?.start ?? 0;

  useStore.setState((s) => {
    pushHistory(s);
    let bitIdx = 0;
    let vecIdx = 0;

    for (const signalId of view.activeSignalIds) {
      findSignal(s.diagram.signals, signalId, (sig) => {
        if (sig.type === 'spacer') return;
        if (sig.type === 'bit') {
          const src = clip.bitStates[bitIdx++];
          if (!src) return;
          const lo = Math.max(0, pasteAt);
          for (let i = 0; i < src.length && lo + i < sig.states.length; i++) {
            sig.states[lo + i] = src[i]!;
          }
          if (sig.digitalTiming) {
            sig.digitalTiming.cells.forEach((cell, index) => {
              if (sig.states[index] !== undefined) cell.state = sig.states[index]!;
            });
            sig.states = sig.digitalTiming.cells.map((cell) => cell.state);
          }
          clearWaveMode(sig);
        } else if (sig.type === 'vector') {
          const slice = clip.vectorSlices[vecIdx++];
          if (!slice) return;
          const lo = Math.max(0, pasteAt);
          const hi = Math.min(
            s.diagram.config.totalSteps - 1,
            lo + slice.stepCount - 1,
          );
          for (const seg of slice.segments) {
            const absStart = lo + seg.startStep;
            const absEnd = lo + seg.endStep;
            if (absStart > hi) continue;
            sig.segments = applyVectorSpan(
              sig.segments,
              absStart,
              Math.min(hi, absEnd - 1),
              seg.value,
              s.diagram.config.totalSteps,
              seg.color,
            );
          }
        }
      });
    }
    s.view.isDirty = true;
  });

  return true;
}
