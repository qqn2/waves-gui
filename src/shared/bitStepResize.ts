import {
  demoteToStatesMode,
  getBitLaneWave,
  isWaveModeLane,
  mutateBitWave,
  resizeWaveByDelta,
  setBitLaneWave,
  writeDecodedToSignal,
} from '../wavedromBridge/laneWaveOps';
import type { DecodedWave } from '../wavedromBridge/waveStringCodec';
import { isClockBitState } from './bitToggle';
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

/** Clock-bearing lanes always grow/shrink via wave `.` — never hold-fill state push. */
function useWaveStepResize(sig: Signal): boolean {
  return isWaveModeLane(sig) || !hasGapColumns(sig) || sig.states.some(isClockBitState);
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
export function insertBitStepAt(sig: Signal, index: number): void {
  if (sig.type !== 'bit') return;
  const n = sig.states.length;
  const at = Math.max(0, Math.min(index, n));

  if (useWaveStepResize(sig)) {
    mutateBitWave(
      sig,
      (wave) => (at === 0 ? '.' + wave : wave.slice(0, at) + '.' + wave.slice(at)),
      n + 1,
    );
    return;
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
}

/** Remove one timeline column on a bit lane (wave char removal when no gaps). */
export function deleteBitStepAt(sig: Signal, index: number, minLen: number): boolean {
  if (sig.type !== 'bit' || sig.states.length <= minLen) return false;
  const n = sig.states.length;
  const at = Math.max(0, Math.min(index, n - 1));

  if (useWaveStepResize(sig)) {
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
