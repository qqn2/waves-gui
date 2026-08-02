import {
  demoteToStatesMode,
  getBitLaneWave,
  isWaveModeLane,
  mutateBitWave,
  resizeWaveByDelta,
  setBitLaneWave,
  writeDecodedToSignal,
} from '../wavedromBridge/laneWaveOps';
import { encodeWaveString, type DecodedWave } from '../wavedromBridge/waveStringCodec';
import { isClockBitState } from './bitToggle';
import {
  deleteMajorStepInTiming,
  insertMajorStepInTiming,
  resizeTimingToDuration,
  timingBoundaryAtMajorStep,
  timingCellDuration,
} from './timedStepResize';
import type { BitState, Signal } from './types';

function readDecoded(sig: Signal): DecodedWave {
  return {
    states: [...sig.states],
    stepGaps: sig.stepGaps ? [...sig.stepGaps] : [],
    stepGlitches: sig.stepGlitches ? [...sig.stepGlitches] : [],
  };
}

function hasGapColumns(sig: Signal): boolean {
  return Boolean(sig.stepGaps?.some(Boolean));
}

function fitTimingFlags(flags: boolean[] | undefined, length: number): boolean[] | undefined {
  if (!flags?.length) return undefined;
  const out = flags.slice(0, length);
  while (out.length < length) out.push(false);
  return out.some(Boolean) ? out : undefined;
}

function insertTimingFlags(
  flags: boolean[] | undefined,
  boundary: ReturnType<typeof timingBoundaryAtMajorStep>,
): boolean[] | undefined {
  if (!flags?.length) return undefined;
  const out = [...flags];
  if (boundary.kind === 'inside') {
    const value = out[boundary.index] ?? false;
    out.splice(boundary.index, 1, value, value, value);
  } else {
    out.splice(boundary.index, 0, false);
  }
  return fitTimingFlags(out, out.length);
}

function deleteTimingFlags(
  flags: boolean[] | undefined,
  sourceCells: { durationTicks: number }[],
  start: number,
  end: number,
): boolean[] | undefined {
  if (!flags?.length) return undefined;
  const out: boolean[] = [];
  let cursor = 0;
  sourceCells.forEach((cell, index) => {
    const duration = Math.max(1, Math.round(cell.durationTicks));
    const cellEnd = cursor + duration;
    const before = Math.max(0, Math.min(cellEnd, start) - cursor);
    const after = Math.max(0, cellEnd - Math.max(cursor, end));
    if (before > 0) out.push(flags[index] ?? false);
    if (after > 0) out.push(flags[index] ?? false);
    cursor = cellEnd;
  });
  return fitTimingFlags(out, out.length);
}

function syncTimedBitSource(sig: Signal): void {
  const timing = sig.digitalTiming;
  if (!timing) return;
  const states = timing.cells.map((cell) => cell.state);
  sig.states = states;
  sig.stepGaps = fitTimingFlags(sig.stepGaps, states.length);
  sig.stepGlitches = fitTimingFlags(sig.stepGlitches, states.length);
  if (isWaveModeLane(sig)) {
    setBitLaneWave(
      sig,
      encodeWaveString(states, sig.stepGaps, sig.stepGlitches),
      states.length,
    );
    timing.cells.forEach((cell, index) => {
      cell.state = sig.states[index] ?? cell.state;
    });
  }
}

/** Clock-bearing lanes always grow/shrink via wave `.` — never hold-fill state push. */
function shouldUseWaveStepResize(sig: Signal): boolean {
  return isWaveModeLane(sig) || !hasGapColumns(sig) || sig.states.some(isClockBitState);
}

/** Resize a bit lane by appending or trimming `.` on its WaveDrom wave string. */
export function resizeBitSignalToLength(
  sig: Signal,
  newLen: number,
  prevDiagramLen?: number,
): void {
  if (sig.type !== 'bit' || newLen < 0) return;

  if (sig.digitalTiming) {
    resizeTimingToDuration(
      sig.digitalTiming,
      newLen * Math.max(1, sig.digitalTiming.ticksPerStep),
    );
    sig.stepGaps = fitTimingFlags(sig.stepGaps, sig.digitalTiming.cells.length);
    sig.stepGlitches = fitTimingFlags(sig.stepGlitches, sig.digitalTiming.cells.length);
    syncTimedBitSource(sig);
    return;
  }

  const delta =
    prevDiagramLen !== undefined ? newLen - prevDiagramLen : newLen - sig.states.length;
  if (delta === 0 && sig.states.length === newLen) return;

  if (shouldUseWaveStepResize(sig)) {
    mutateBitWave(sig, (wave) => resizeWaveByDelta(wave, delta, newLen), newLen);
    return;
  }

  if (delta > 0) {
    const decoded = readDecoded(sig);
    const hold = decoded.states[decoded.states.length - 1] ?? '0';
    for (let i = 0; i < delta; i++) {
      decoded.states.push(hold);
      decoded.stepGaps.push(false);
    }
    writeDecodedToSignal(sig, decoded, newLen);
    return;
  }

  writeDecodedToSignal(sig, readDecoded(sig), newLen);
}

/** Insert one timeline column on a bit lane (wave `.` insertion when no gaps). */
export function insertBitStepAt(sig: Signal, index: number): boolean {
  if (sig.type !== 'bit') return false;
  if (sig.digitalTiming) {
    const boundary = timingBoundaryAtMajorStep(sig.digitalTiming, index);
    const previousGaps = sig.stepGaps;
    const previousGlitches = sig.stepGlitches;
    const inserted = insertMajorStepInTiming(sig.digitalTiming, index);
    if (!inserted) return false;
    sig.stepGaps = insertTimingFlags(previousGaps, boundary);
    sig.stepGlitches = insertTimingFlags(previousGlitches, boundary);
    syncTimedBitSource(sig);
    return true;
  }
  const n = sig.states.length;
  const at = Math.max(0, Math.min(index, n));

  if (shouldUseWaveStepResize(sig)) {
    mutateBitWave(
      sig,
      (wave) => (at === 0 ? '.' + wave : wave.slice(0, at) + '.' + wave.slice(at)),
      n + 1,
    );
    return true;
  }

  const decoded = readDecoded(sig);
  const hold: BitState = at > 0 ? decoded.states[at - 1]! : (decoded.states[0] ?? '0');
  decoded.states.splice(at, 0, hold);
  const gaps = [...decoded.stepGaps];
  while (gaps.length < n) gaps.push(false);
  gaps.splice(at, 0, false);
  decoded.stepGaps = gaps;
  decoded.stepGlitches.splice(at, 0, false);
  writeDecodedToSignal(sig, decoded, n + 1);
  return true;
}

/** Remove one timeline column on a bit lane (wave char removal when no gaps). */
export function deleteBitStepAt(sig: Signal, index: number, minLen: number): boolean {
  if (sig.type !== 'bit') return false;
  if (sig.digitalTiming) {
    const sourceCells = sig.digitalTiming.cells.map((cell) => ({ ...cell }));
    const boundary = timingBoundaryAtMajorStep(sig.digitalTiming, index);
    const total = timingCellDuration(sig.digitalTiming);
    const stepTicks = Math.max(1, sig.digitalTiming.ticksPerStep);
    const start = Math.max(0, Math.min(Math.max(0, total - stepTicks), boundary.tick));
    const end = Math.min(total, start + stepTicks);
    const previousGaps = sig.stepGaps;
    const previousGlitches = sig.stepGlitches;
    const deleted = deleteMajorStepInTiming(sig.digitalTiming, index, minLen);
    if (deleted) {
      sig.stepGaps = deleteTimingFlags(previousGaps, sourceCells, start, end);
      sig.stepGlitches = deleteTimingFlags(previousGlitches, sourceCells, start, end);
      syncTimedBitSource(sig);
    }
    return deleted;
  }
  if (sig.states.length <= minLen) return false;
  const n = sig.states.length;
  const at = Math.max(0, Math.min(index, n - 1));

  if (shouldUseWaveStepResize(sig)) {
    const wave = getBitLaneWave(sig);
    if (wave.length === 0) return false;
    const waveAt = Math.min(at, wave.length - 1);
    const trimmed = wave.slice(0, waveAt) + wave.slice(waveAt + 1);
    setBitLaneWave(sig, trimmed.length > 0 ? trimmed : '0', n - 1);
    return true;
  }

  const decoded = readDecoded(sig);
  decoded.states.splice(at, 1);
  if (decoded.stepGaps.length > at) decoded.stepGaps.splice(at, 1);
  if (at > 0 && at - 1 < decoded.stepGlitches.length) {
    decoded.stepGlitches.splice(at - 1, 1);
  }
  writeDecodedToSignal(sig, decoded, n - 1);
  return true;
}

/** Drop wave-canonical mode when a states-first edit cannot round-trip. */
export function invalidateWaveMode(sig: Signal): void {
  demoteToStatesMode(sig, sig.states.length);
}
