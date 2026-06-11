import {
  applyDecodedEditToLane,
  clearWaveMode,
  insertColumnInBitLane,
  isRepeatingClockLane,
  isSubcycleWaveLane,
  isWaveModeLane,
  mutateBitWave,
} from '../wavedromBridge/laneWaveOps';
import type { Signal, SignalOrGroup } from './types';
import type { BitState } from './types';

/** `stepGaps[i] === true` — column i is a WaveDrom `|` gap column (holds previous level). */
export function gapColumnCount(totalSteps: number): number {
  return Math.max(0, totalSteps);
}

export function ensureStepGaps(flags: boolean[] | undefined, totalSteps: number): boolean[] {
  const out = flags ? [...flags] : [];
  while (out.length < totalSteps) out.push(false);
  if (out.length > totalSteps) out.length = totalSteps;
  return out;
}

export function pruneStepGaps(flags: boolean[] | undefined): boolean[] | undefined {
  if (!flags?.some(Boolean)) return undefined;
  return flags;
}

export function signalHasStepGapColumn(signal: Signal, column: number): boolean {
  return Boolean(signal.stepGaps?.[column]);
}

function holdState(states: BitState[], index: number): BitState {
  if (index > 0) return states[index - 1]!;
  return states[0] ?? '0';
}

function spliceColumnFlag(
  flags: boolean[] | undefined,
  index: number,
  newLength: number,
  value = false,
): boolean[] | undefined {
  const out = ensureStepGaps(flags, newLength - 1);
  out.splice(index, 0, value);
  while (out.length < newLength) out.push(false);
  if (out.length > newLength) out.length = newLength;
  return pruneStepGaps(out);
}

function removeColumnFlag(
  flags: boolean[] | undefined,
  index: number,
  newLength: number,
): boolean[] | undefined {
  if (!flags?.length) return undefined;
  const out = [...flags];
  if (index < out.length) out.splice(index, 1);
  while (out.length < newLength) out.push(false);
  if (out.length > newLength) out.length = newLength;
  return pruneStepGaps(out);
}

/** Insert one gap column at `index` on every lane; `gapSignalId` lane(s) marked as gap (`null` = all). */
export function insertGapColumnOnDiagram(
  signals: SignalOrGroup[],
  index: number,
  gapSignalId: string | null,
): void {
  const clamped = Math.max(0, index);
  walkSignals(signals, (sig) => {
    if (sig.type === 'spacer') return;
    const newLen =
      sig.type === 'bit' ? sig.states.length + 1 : gapColumnCount(sig.stepGaps?.length ?? 0) + 1;

    if (sig.type === 'bit') {
      const isGap = gapSignalId === null || sig.id === gapSignalId;
      if (isSubcycleWaveLane(sig)) {
        clearWaveMode(sig);
      }
      if (isWaveModeLane(sig)) {
        if (isGap && isRepeatingClockLane(sig)) {
          mutateBitWave(
            sig,
            (wave) => wave.slice(0, clamped) + '|' + wave.slice(clamped),
            newLen,
          );
        } else {
          insertColumnInBitLane(sig, clamped, holdState(sig.states, clamped), isGap);
        }
        return;
      }
      sig.states.splice(clamped, 0, holdState(sig.states, clamped));
      sig.stepGaps = spliceColumnFlag(sig.stepGaps, clamped, newLen, isGap);
      sig.stepGlitches = spliceColumnFlag(sig.stepGlitches, clamped, Math.max(0, newLen - 1), false);
      return;
    }

    if (sig.type === 'vector') {
      for (const seg of sig.segments) {
        if (seg.startStep >= clamped) seg.startStep++;
        if (seg.endStep > clamped) seg.endStep++;
        else if (seg.startStep < clamped && seg.endStep === clamped) seg.endStep++;
      }
      const isGap = gapSignalId === null || sig.id === gapSignalId;
      sig.stepGaps = spliceColumnFlag(sig.stepGaps, clamped, newLen, isGap);
    }
  });
}

/** Insert `count` gap columns starting at `index` (inserts at `index` repeatedly). */
export function insertGapColumnsOnDiagram(
  signals: SignalOrGroup[],
  index: number,
  count: number,
  gapSignalId: string | null,
): void {
  const n = Math.max(0, count);
  for (let c = 0; c < n; c++) {
    insertGapColumnOnDiagram(signals, index, gapSignalId);
  }
}

/** Remove gap columns on `signalId` within `[lo, hi]`; deletes those columns on all lanes. */
export function removeGapColumnsOnDiagram(
  signals: SignalOrGroup[],
  signalId: string,
  lo: number,
  hi: number,
  minSteps: number,
): number {
  let target: Signal | undefined;
  walkSignals(signals, (sig) => {
    if (sig.id === signalId) target = sig;
  });
  if (!target) return 0;

  let removed = 0;
  for (let i = hi; i >= lo; i--) {
    if (!target.stepGaps?.[i]) continue;
    if (!deleteGapColumnOnDiagram(signals, i, minSteps)) break;
    removed++;
  }
  return removed;
}

function deleteGapColumnOnDiagram(
  signals: SignalOrGroup[],
  index: number,
  minSteps: number,
): boolean {
  let ok = true;
  walkSignals(signals, (sig) => {
    if (sig.type === 'bit') {
      if (sig.states.length <= minSteps) {
        ok = false;
        return;
      }
      const clamped = Math.max(0, Math.min(index, sig.states.length - 1));
      if (isSubcycleWaveLane(sig)) {
        clearWaveMode(sig);
      }
      if (isWaveModeLane(sig)) {
        const newLen = sig.states.length - 1;
        applyDecodedEditToLane(sig, (decoded) => {
          decoded.states.splice(clamped, 1);
          if (clamped < decoded.stepGaps.length) decoded.stepGaps.splice(clamped, 1);
        }, newLen);
        return;
      }
      sig.states.splice(clamped, 1);
      const newLen = sig.states.length;
      sig.stepGaps = removeColumnFlag(sig.stepGaps, clamped, newLen);
      sig.stepGlitches = removeColumnFlag(sig.stepGlitches, clamped, Math.max(0, newLen - 1));
      return;
    }
    if (sig.type === 'vector') {
      for (const seg of sig.segments) {
        if (seg.startStep >= index + 1) seg.startStep--;
        else if (seg.endStep > index + 1) seg.endStep--;
        else if (seg.startStep <= index && seg.endStep > index) {
          if (seg.endStep - seg.startStep <= 1) ok = false;
          else seg.endStep--;
        }
      }
      const newLen = Math.max(0, (sig.stepGaps?.length ?? 0) - 1);
      sig.stepGaps = removeColumnFlag(sig.stepGaps, index, newLen);
    }
  });
  return ok;
}

/** Toggle gap flag on columns `[lo, hi]` without changing column count (replace paint). */
export function toggleGapColumnsOnSignal(signal: Signal, lo: number, hi: number): void {
  if (signal.type === 'spacer') return;
  const len =
    signal.type === 'bit' ? signal.states.length : Math.max(signal.stepGaps?.length ?? 0, 0);
  if (len === 0) return;
  const clampLo = Math.max(0, lo);
  const clampHi = Math.min(hi, len - 1);
  if (clampLo > clampHi) return;

  if (signal.type === 'bit' && isSubcycleWaveLane(signal)) {
    clearWaveMode(signal);
  }

  if (signal.type === 'bit' && isWaveModeLane(signal)) {
    applyDecodedEditToLane(
      signal,
      (decoded) => {
        const gaps = ensureStepGaps(decoded.stepGaps, decoded.states.length);
        for (let i = clampLo; i <= clampHi; i++) {
          if (gaps[i]) {
            gaps[i] = false;
          } else {
            gaps[i] = true;
            decoded.states[i] = holdState(decoded.states, i);
          }
        }
        decoded.stepGaps = gaps;
      },
      signal.states.length,
    );
    return;
  }

  const gaps = ensureStepGaps(signal.stepGaps, len);
  for (let i = clampLo; i <= clampHi; i++) {
    if (gaps[i]) {
      gaps[i] = false;
    } else {
      gaps[i] = true;
      if (signal.type === 'bit') {
        signal.states[i] = holdState(signal.states, i);
      }
    }
  }
  signal.stepGaps = pruneStepGaps(gaps);
}

/** Clear gap flags on columns `[lo, hi]` without deleting columns. */
export function clearStepGapsOnColumns(
  signal: Signal,
  lo: number,
  hi: number,
): void {
  if (signal.type === 'spacer' || !signal.stepGaps?.length) return;
  const gaps = [...signal.stepGaps];
  for (let i = lo; i <= hi && i < gaps.length; i++) {
    gaps[i] = false;
  }
  signal.stepGaps = pruneStepGaps(gaps);
}

export function diagramHasStepGapColumn(
  signals: SignalOrGroup[],
  column: number,
): boolean {
  let found = false;
  walkSignals(signals, (sig) => {
    if (signalHasStepGapColumn(sig, column)) found = true;
  });
  return found;
}

/** Insert one value column at `index` on every lane; only `valueSignalId` gets `bitState`. */
export function insertValueColumnOnDiagram(
  signals: SignalOrGroup[],
  index: number,
  valueSignalId: string,
  bitState: BitState,
): void {
  const clamped = Math.max(0, index);
  walkSignals(signals, (sig) => {
    if (sig.type === 'spacer') return;
    const newLen =
      sig.type === 'bit' ? sig.states.length + 1 : gapColumnCount(sig.stepGaps?.length ?? 0) + 1;

    if (sig.type === 'bit') {
      const value = sig.id === valueSignalId ? bitState : holdState(sig.states, clamped);
      if (isSubcycleWaveLane(sig)) {
        clearWaveMode(sig);
      }
      if (isWaveModeLane(sig)) {
        insertColumnInBitLane(sig, clamped, value, false);
        return;
      }
      sig.states.splice(clamped, 0, value);
      sig.stepGaps = spliceColumnFlag(sig.stepGaps, clamped, newLen, false);
      sig.stepGlitches = spliceColumnFlag(sig.stepGlitches, clamped, Math.max(0, newLen - 1), false);
      return;
    }

    if (sig.type === 'vector') {
      for (const seg of sig.segments) {
        if (seg.startStep >= clamped) seg.startStep++;
        if (seg.endStep > clamped) seg.endStep++;
        else if (seg.startStep < clamped && seg.endStep === clamped) seg.endStep++;
      }
      sig.stepGaps = spliceColumnFlag(sig.stepGaps, clamped, newLen, false);
    }
  });
}

export function walkSignals(signals: SignalOrGroup[], fn: (sig: Signal) => void): void {
  for (const item of signals) {
    if (item.type === 'group') walkSignals(item.children, fn);
    else fn(item);
  }
}
