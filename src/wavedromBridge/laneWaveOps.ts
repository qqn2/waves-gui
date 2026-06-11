import { isClockBitState } from '../shared/bitToggle';
import type { BitState, Signal } from '../shared/types';
import {
  isClockWaveString,
  isRepeatingClockWave,
} from './clockWave';
import {
  hasSubcycleSyntax,
  padWaveOverride,
  waveColumnCount,
} from './subcycleWave';
import {
  decodeWaveDetail,
  encodeWaveString,
  encodeWaveStringForDiagram,
  padDecodedWaveToLength,
  type DecodedWave,
} from './waveStringCodec';

export type BitLaneMode = 'states' | 'wave';

/** WaveDrom wave string is canonical; `states[]` is a render/edit cache. */
export function isWaveModeLane(sig: Signal): boolean {
  return sig.type === 'bit' && (sig.laneMode === 'wave' || sig.waveOverride !== undefined);
}

export function isSubcycleWaveLane(sig: Signal): boolean {
  if (!isWaveModeLane(sig)) return false;
  return hasSubcycleSyntax(getBitLaneWave(sig));
}

/** Import-time: clock runs and sub-cycle syntax use wave-canonical storage. */
export function shouldImportAsWaveMode(wave: string): boolean {
  return (
    hasSubcycleSyntax(wave) ||
    isClockWaveString(wave) ||
    isRepeatingClockWave(wave)
  );
}

export function getBitLaneWave(sig: Signal): string {
  if (sig.type !== 'bit') return '0';
  if (isWaveModeLane(sig)) {
    return sig.wave ?? sig.waveOverride ?? '0';
  }
  return encodeWaveString(sig.states, sig.stepGaps, sig.stepGlitches);
}

export function bitLaneStepCount(sig: Signal, hscale = 1): number {
  if (sig.type !== 'bit') return 0;
  if (isWaveModeLane(sig) && isSubcycleWaveLane(sig)) {
    return waveColumnCount(getBitLaneWave(sig), sig.period ?? 1, hscale);
  }
  if (sig.states.length > 0) return sig.states.length;
  return decodeWaveDetail(getBitLaneWave(sig)).states.length;
}

export function writeDecodedToSignal(
  sig: Signal,
  decoded: DecodedWave,
  targetLen: number,
): void {
  const padded = padDecodedWaveToLength(decoded, targetLen);
  sig.states = padded.states;
  if (padded.stepGaps.some(Boolean)) sig.stepGaps = padded.stepGaps;
  else delete sig.stepGaps;
  if (padded.stepGlitches.some(Boolean)) sig.stepGlitches = padded.stepGlitches;
  else delete sig.stepGlitches;
}

export function syncStatesFromWave(sig: Signal, targetLen: number): void {
  if (sig.type !== 'bit' || !isWaveModeLane(sig)) return;
  writeDecodedToSignal(sig, decodeWaveDetail(getBitLaneWave(sig)), targetLen);
}

export function setBitLaneWave(sig: Signal, wave: string, targetLen: number): void {
  if (sig.type !== 'bit') return;
  sig.laneMode = 'wave';
  sig.wave = wave;
  delete sig.waveOverride;
  writeDecodedToSignal(sig, decodeWaveDetail(wave), targetLen);
}

export function demoteToStatesMode(sig: Signal, targetLen: number): void {
  if (sig.type !== 'bit' || !isWaveModeLane(sig)) return;
  syncStatesFromWave(sig, targetLen);
  delete sig.laneMode;
  delete sig.wave;
  delete sig.waveOverride;
}

/** Drop wave-canonical mode after a structural edit that cannot round-trip. */
export function clearWaveMode(sig: Signal): void {
  demoteToStatesMode(sig, sig.states.length);
}

export function isRepeatingClockLane(sig: Signal): boolean {
  if (sig.type !== 'bit') return false;
  if (isWaveModeLane(sig) && !isSubcycleWaveLane(sig)) {
    return isRepeatingClockWave(getBitLaneWave(sig));
  }
  return sig.states.length > 0 && sig.states.every(isClockBitState);
}

export function mutateBitWave(
  sig: Signal,
  edit: (wave: string) => string,
  targetLen: number,
): void {
  setBitLaneWave(sig, edit(getBitLaneWave(sig)), targetLen);
}

function trimWaveToLength(wave: string, len: number): string {
  let out = wave;
  while (decodeWaveDetail(out).states.length > len && out.length > 0) {
    out = out.slice(0, -1);
  }
  return out;
}

export function resizeWaveByDelta(wave: string, delta: number, targetLen: number): string {
  if (delta > 0) return wave + '.'.repeat(delta);
  if (delta < 0) return trimWaveToLength(wave, targetLen);
  const cur = decodeWaveDetail(wave).states.length;
  if (cur === targetLen) return wave;
  if (cur < targetLen) return wave + '.'.repeat(targetLen - cur);
  return trimWaveToLength(wave, targetLen);
}

export function padWaveForDiagram(
  sig: Signal,
  totalSteps: number,
  hscale: number,
): string {
  if (sig.type !== 'bit') return '0';
  if (!isWaveModeLane(sig)) {
    return encodeWaveStringForDiagram(
      sig.states,
      totalSteps,
      sig.stepGaps,
      sig.stepGlitches,
    );
  }
  const wave = getBitLaneWave(sig);
  if (isSubcycleWaveLane(sig)) {
    return padWaveOverride(wave, totalSteps, sig.period ?? 1, hscale);
  }
  const decoded = padDecodedWaveToLength(decodeWaveDetail(wave), totalSteps);
  return encodeWaveString(decoded.states, decoded.stepGaps, decoded.stepGlitches);
}

export function padWaveLaneToLength(sig: Signal, totalSteps: number, hscale: number): void {
  if (sig.type !== 'bit' || !isWaveModeLane(sig)) return;
  const padded = padWaveForDiagram(sig, totalSteps, hscale);
  setBitLaneWave(sig, padded, totalSteps);
}

function readLaneDecoded(sig: Signal): DecodedWave {
  if (!isWaveModeLane(sig)) {
    return {
      states: [...sig.states],
      stepGaps: sig.stepGaps ? [...sig.stepGaps] : [],
      stepGlitches: sig.stepGlitches ? [...sig.stepGlitches] : [],
    };
  }
  const fromWave = decodeWaveDetail(getBitLaneWave(sig));
  return {
    states: [...fromWave.states],
    stepGaps: sig.stepGaps ? [...sig.stepGaps] : [...fromWave.stepGaps],
    stepGlitches: sig.stepGlitches ? [...sig.stepGlitches] : [...fromWave.stepGlitches],
  };
}

/** Apply a column-level edit and re-encode wave-canonical lanes. */
export function applyDecodedEditToLane(
  sig: Signal,
  edit: (decoded: DecodedWave) => void,
  targetLen: number,
): void {
  if (sig.type !== 'bit') return;
  const decoded = readLaneDecoded(sig);
  edit(decoded);
  if (isWaveModeLane(sig)) {
    const wave = encodeWaveString(
      decoded.states,
      decoded.stepGaps,
      decoded.stepGlitches,
    );
    setBitLaneWave(sig, wave.length > 0 ? wave : '0', targetLen);
    return;
  }
  writeDecodedToSignal(sig, decoded, targetLen);
}

export function insertColumnInBitLane(
  sig: Signal,
  at: number,
  value: BitState,
  isGap: boolean,
): void {
  if (sig.type !== 'bit') return;
  const n = sig.states.length;
  const clamped = Math.max(0, Math.min(at, n));
  applyDecodedEditToLane(
    sig,
    (decoded) => {
      decoded.states.splice(clamped, 0, value);
      const gaps = decoded.stepGaps;
      while (gaps.length < n) gaps.push(false);
      gaps.splice(clamped, 0, isGap);
      decoded.stepGlitches.splice(clamped, 0, false);
    },
    n + 1,
  );
}

export function deleteColumnInBitLane(sig: Signal, at: number, minLen: number): boolean {
  if (sig.type !== 'bit' || sig.states.length <= minLen) return false;
  const n = sig.states.length;
  const clamped = Math.max(0, Math.min(at, n - 1));
  applyDecodedEditToLane(
    sig,
    (decoded) => {
      decoded.states.splice(clamped, 1);
      if (clamped < decoded.stepGaps.length) decoded.stepGaps.splice(clamped, 1);
      if (clamped > 0 && clamped - 1 < decoded.stepGlitches.length) {
        decoded.stepGlitches.splice(clamped - 1, 1);
      } else if (decoded.stepGlitches.length > 0) {
        decoded.stepGlitches.splice(0, 1);
      }
    },
    n - 1,
  );
  return true;
}
