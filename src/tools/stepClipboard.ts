import { nanoid } from 'nanoid';
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
  flushPendingCodeToDiagram();
  const { diagram, view } = useStore.getState();
  const steps = toolState.getStepSelection();
  if (!steps || view.activeSignalIds.length === 0) return false;

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
    } else {
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
  flushPendingCodeToDiagram();
  const clip = internalClipboard;
  if (!clip) return false;

  const { view } = useStore.getState();
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
          delete sig.waveOverride;
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
