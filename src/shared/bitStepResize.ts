import { repairClockLaneIfNeeded } from '../wavedromBridge/clockWave';
import {
  decodeWaveDetail,
  encodeWaveString,
  padDecodedWaveToLength,
  type DecodedWave,
} from '../wavedromBridge/waveStringCodec';
import { isClockBitState } from './bitToggle';
import type { BitState, Signal } from './types';

function readDecoded(sig: Signal): DecodedWave {
  return {
    states: [...sig.states],
    stepGaps: sig.stepGaps ? [...sig.stepGaps] : [],
    stepGlitches: sig.stepGlitches ? [...sig.stepGlitches] : [],
  };
}

function writeDecoded(sig: Signal, decoded: DecodedWave, len: number): void {
  const padded = padDecodedWaveToLength(decoded, len);
  sig.states = padded.states;
  if (padded.stepGaps.some(Boolean)) sig.stepGaps = padded.stepGaps;
  else delete sig.stepGaps;
  if (padded.stepGlitches.some(Boolean)) sig.stepGlitches = padded.stepGlitches;
  else delete sig.stepGlitches;
  delete sig.waveOverride;
}

function hasGapColumns(sig: Signal): boolean {
  return Boolean(sig.stepGaps?.some(Boolean));
}

/** Clock-bearing lanes always grow/shrink via wave `.` — never hold-fill state push. */
function useWaveStepResize(sig: Signal): boolean {
  return !hasGapColumns(sig) || sig.states.some(isClockBitState);
}

function preparedStates(sig: Signal): BitState[] {
  if (sig.states.every(isClockBitState)) {
    return repairClockLaneIfNeeded(sig.states, sig.stepGaps, sig.stepGlitches);
  }
  return sig.states;
}

function waveForSignal(sig: Signal): string {
  const wave = encodeWaveString(preparedStates(sig), sig.stepGaps, sig.stepGlitches);
  return wave.length > 0 ? wave : '0';
}

function trimWaveToLength(wave: string, len: number): string {
  let out = wave;
  while (decodeWaveDetail(out).states.length > len && out.length > 0) {
    out = out.slice(0, -1);
  }
  return out;
}

function resizeWaveByDelta(wave: string, delta: number, targetLen: number): string {
  if (delta > 0) return wave + '.'.repeat(delta);
  if (delta < 0) return trimWaveToLength(wave, targetLen);
  const cur = decodeWaveDetail(wave).states.length;
  if (cur === targetLen) return wave;
  if (cur < targetLen) return wave + '.'.repeat(targetLen - cur);
  return trimWaveToLength(wave, targetLen);
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

/** Resize a bit lane by appending or trimming `.` on its WaveDrom wave string. */
export function resizeBitSignalToLength(
  sig: Signal,
  newLen: number,
  prevDiagramLen?: number,
): void {
  if (sig.type !== 'bit' || newLen < 0) return;

  const delta =
    prevDiagramLen !== undefined ? newLen - prevDiagramLen : newLen - sig.states.length;
  if (delta === 0 && sig.states.length === newLen) return;

  if (useWaveStepResize(sig)) {
    const wave = resizeWaveByDelta(waveForSignal(sig), delta, newLen);
    writeDecoded(sig, decodeWaveDetail(wave), newLen);
    return;
  }

  if (delta > 0) {
    const decoded = readDecoded(sig);
    const hold = decoded.states[decoded.states.length - 1] ?? '0';
    for (let i = 0; i < delta; i++) {
      decoded.states.push(hold);
      decoded.stepGaps.push(false);
    }
    writeDecoded(sig, decoded, newLen);
    return;
  }

  writeDecoded(sig, readDecoded(sig), newLen);
}

/** Insert one timeline column on a bit lane (wave `.` insertion when no gaps). */
export function insertBitStepAt(sig: Signal, index: number): void {
  if (sig.type !== 'bit') return;
  const n = sig.states.length;
  const at = Math.max(0, Math.min(index, n));

  if (useWaveStepResize(sig)) {
    const wave = waveForSignal(sig);
    const extended = at === 0 ? '.' + wave : wave.slice(0, at) + '.' + wave.slice(at);
    writeDecoded(sig, decodeWaveDetail(extended), n + 1);
    return;
  }

  const decoded = readDecoded(sig);
  const hold: BitState = at > 0 ? decoded.states[at - 1]! : (decoded.states[0] ?? '0');
  decoded.states.splice(at, 0, hold);
  const gaps = [...decoded.stepGaps];
  while (gaps.length < n) gaps.push(false);
  gaps.splice(at, 0, false);
  decoded.stepGaps = gaps;
  decoded.stepGlitches = spliceBoundaryFlags(decoded.stepGlitches, at, Math.max(0, n));
  writeDecoded(sig, decoded, n + 1);
}

/** Remove one timeline column on a bit lane (wave char removal when no gaps). */
export function deleteBitStepAt(sig: Signal, index: number, minLen: number): boolean {
  if (sig.type !== 'bit' || sig.states.length <= minLen) return false;
  const n = sig.states.length;
  const at = Math.max(0, Math.min(index, n - 1));

  if (useWaveStepResize(sig)) {
    const wave = waveForSignal(sig);
    if (wave.length === 0) return false;
    const waveAt = Math.min(at, wave.length - 1);
    const trimmed = wave.slice(0, waveAt) + wave.slice(waveAt + 1);
    writeDecoded(sig, decodeWaveDetail(trimmed.length > 0 ? trimmed : '0'), n - 1);
    return true;
  }

  const decoded = readDecoded(sig);
  decoded.states.splice(at, 1);
  if (decoded.stepGaps.length > at) decoded.stepGaps.splice(at, 1);
  decoded.stepGlitches = removeBoundaryFlags(decoded.stepGlitches, at, Math.max(0, n - 2));
  writeDecoded(sig, decoded, n - 1);
  return true;
}
