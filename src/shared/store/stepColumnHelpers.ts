import type { Signal, SignalOrGroup } from '../types';
import type { BitState } from '../types';

/** Clear node anchors and dependency edges after column insert/delete (node shift is error-prone). */
export function clearNodesAndEdges(signals: SignalOrGroup[], edges: string[]): void {
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else delete item.node;
    }
  };
  walk(signals);
  edges.length = 0;
}

function spliceBoundaryFlags(
  flags: boolean[] | undefined,
  index: number,
  newBoundaryCount: number,
): boolean[] | undefined {
  if (!flags?.some(Boolean) && newBoundaryCount <= 0) return undefined;
  const out = flags ? [...flags] : [];
  while (out.length < newBoundaryCount) out.push(false);
  if (out.length > newBoundaryCount) out.length = newBoundaryCount;
  if (index > 0 && index <= out.length) {
    out.splice(index - 1, 0, false);
  }
  if (!out.some(Boolean)) return undefined;
  return out;
}

function removeBoundaryFlags(
  flags: boolean[] | undefined,
  index: number,
  newBoundaryCount: number,
): boolean[] | undefined {
  if (!flags?.length) return undefined;
  const out = [...flags];
  if (index > 0 && index - 1 < out.length) {
    out.splice(index - 1, 1);
  }
  while (out.length < newBoundaryCount) out.push(false);
  if (out.length > newBoundaryCount) out.length = newBoundaryCount;
  if (!out.some(Boolean)) return undefined;
  return out;
}

function holdState(states: BitState[], index: number): BitState {
  if (index > 0) return states[index - 1]!;
  return states[0] ?? '0';
}

export function insertStepInSignal(sig: Signal, index: number): void {
  const clamped = Math.max(0, Math.min(index, sig.states.length));

  if (sig.type === 'bit') {
    sig.states.splice(clamped, 0, holdState(sig.states, clamped));
    delete sig.waveOverride;
    const maxBoundaries = Math.max(0, sig.states.length - 1);
    sig.stepGaps = spliceBoundaryFlags(sig.stepGaps, clamped, maxBoundaries);
    sig.stepGlitches = spliceBoundaryFlags(sig.stepGlitches, clamped, maxBoundaries);
    return;
  }

  if (sig.type === 'vector') {
    for (const seg of sig.segments) {
      if (seg.startStep >= clamped) seg.startStep++;
      if (seg.endStep > clamped) seg.endStep++;
      else if (seg.startStep < clamped && seg.endStep === clamped) seg.endStep++;
    }
  }
}

export function deleteStepInSignal(sig: Signal, index: number, minSteps: number): boolean {
  if (sig.type === 'bit') {
    if (sig.states.length <= minSteps) return false;
    const clamped = Math.max(0, Math.min(index, sig.states.length - 1));
    sig.states.splice(clamped, 1);
    delete sig.waveOverride;
    const maxBoundaries = Math.max(0, sig.states.length - 1);
    sig.stepGaps = removeBoundaryFlags(sig.stepGaps, clamped, maxBoundaries);
    sig.stepGlitches = removeBoundaryFlags(sig.stepGlitches, clamped, maxBoundaries);
    return true;
  }

  if (sig.type === 'vector') {
    for (const seg of sig.segments) {
      if (seg.startStep >= index + 1) {
        seg.startStep--;
      } else if (seg.endStep > index + 1) {
        seg.endStep--;
      } else if (seg.startStep <= index && seg.endStep > index) {
        if (seg.endStep - seg.startStep <= 1) return false;
        seg.endStep--;
      }
    }
    return true;
  }

  return true;
}

export function walkSignals(signals: SignalOrGroup[], fn: (sig: Signal) => void): void {
  for (const item of signals) {
    if (item.type === 'group') walkSignals(item.children, fn);
    else fn(item);
  }
}
