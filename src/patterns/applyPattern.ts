import { nanoid } from 'nanoid';
import { useStore, pushHistory } from '../shared/store';
import type { BitState, Signal, SignalOrGroup, VectorSegment } from '../shared/types';

function findSignalById(
  signals: SignalOrGroup[],
  id: string,
): Signal | undefined {
  for (const sg of signals) {
    if (sg.type === 'group') {
      const found = findSignalById(sg.children, id);
      if (found) return found;
    } else if (sg.id === id) {
      return sg;
    }
  }
  return undefined;
}

/** Last non-group signal at the top level (matches addSignal placement). */
export function lastTopLevelSignalId(
  signals: SignalOrGroup[],
): string | undefined {
  for (let i = signals.length - 1; i >= 0; i--) {
    const sg = signals[i]!;
    if (sg.type !== 'group') return sg.id;
  }
  return undefined;
}

export function applyBitPatternToSignal(
  signalId: string,
  states: BitState[],
): void {
  useStore.setState((s) => {
    pushHistory(s);
    const sig = findSignalById(s.diagram.signals, signalId);
    if (sig?.type === 'bit' && states.length === s.diagram.config.totalSteps) {
      sig.states = [...states];
      delete sig.waveOverride;
      s.view.isDirty = true;
    }
  });
}

export function applyVectorPatternToSignal(
  signalId: string,
  segments: VectorSegment[],
): void {
  useStore.setState((s) => {
    pushHistory(s);
    const sig = findSignalById(s.diagram.signals, signalId);
    if (sig?.type === 'vector') {
      sig.segments = segments.map((seg) => ({ ...seg, id: nanoid() }));
      s.view.isDirty = true;
    }
  });
}
