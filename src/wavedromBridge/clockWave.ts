import { toggleBinaryBitState } from '../shared/bitToggle';
import type { BitState } from '../shared/types';
import type { DecodedWave } from './waveStringCodec';

export function isClockRiseStep(st: BitState): boolean {
  return st === 'p' || st === 'P';
}

export function isClockFallStep(st: BitState): boolean {
  return st === 'n' || st === 'N';
}

function isClockBit(st: BitState): boolean {
  return isClockRiseStep(st) || isClockFallStep(st);
}

/** A clock-only WaveDrom lane. Adjacent heads are valid phase/arrow changes. */
export function isClockWaveString(wave: string): boolean {
  if (wave.length === 0) return false;
  if (!isClockBit(wave[0] as BitState)) return false;
  return [...wave].every((c) => c === '.' || c === '|' || isClockBit(c as BitState));
}

/** WaveDrom clock lane: first char is p/P/n/N, rest are `.` or `|` only (single run). */
export function isRepeatingClockWave(wave: string): boolean {
  if (wave.length === 0) return false;
  const c0 = wave[0]!;
  if (c0 !== 'p' && c0 !== 'P' && c0 !== 'n' && c0 !== 'N') return false;
  for (let i = 1; i < wave.length; i++) {
    const c = wave[i]!;
    if (c !== '.' && c !== '|') return false;
  }
  return true;
}

export function fallStateFor(rise: BitState): BitState {
  if (rise === 'P') return 'n';
  if (rise === 'p') return 'n';
  if (rise === 'N') return 'p';
  return 'p';
}

export function riseStateFor(fall: BitState): BitState {
  if (fall === 'N') return 'P';
  if (fall === 'n') return 'p';
  return 'p';
}

export interface ClockRun {
  start: number;
  end: number;
  head: BitState;
  posedgeFirst: boolean;
  riseChar: BitState;
  fallChar: BitState;
}

/** Split a clock-only lane into maximal runs of the same WaveDrom clock cycle. */
export function scanClockRuns(states: BitState[]): ClockRun[] | null {
  if (states.length === 0 || !states.every(isClockBit)) return null;

  const runs: ClockRun[] = [];
  let i = 0;
  while (i < states.length) {
    const head = states[i]!;
    const posedgeFirst = isClockRiseStep(head);
    const riseChar = posedgeFirst ? head : riseStateFor(head);
    const fallChar = posedgeFirst ? fallStateFor(head) : head;
    let j = i + 1;
    while (j < states.length && states[j] === head) j++;
    runs.push({ start: i, end: j, head, posedgeFirst, riseChar, fallChar });
    i = j;
  }

  return runs;
}

/** Paint complete WaveDrom clock cycles in the selected columns. */
export function applyClockBrushToRange(
  states: BitState[],
  lo: number,
  hi: number,
  brush: BitState,
): void {
  for (let i = lo; i <= hi; i++) {
    states[i] = brush;
  }
}

/**
 * Invert only the selected WaveDrom clock cycles.
 */
export function applyClockToggleToRange(
  states: BitState[],
  lo: number,
  hi: number,
): void {
  for (let i = lo; i <= hi && i < states.length; i++) {
    states[i] = toggleBinaryBitState(states[i]!);
  }
}

/** Decode one WaveDrom clock character per time column; dots repeat that cycle. */
export function decodeClockWave(wave: string): DecodedWave {
  const states: BitState[] = [];
  const stepGaps: boolean[] = [];
  let i = 0;

  while (i < wave.length) {
    const c = wave[i]!;
    if (c !== 'p' && c !== 'P' && c !== 'n' && c !== 'N') break;

    const head = c as BitState;
    states.push(head);
    i++;
    while (i < wave.length) {
      const nc = wave[i]!;
      if (nc === '.' || nc === '|') {
        states.push(head);
        if (nc === '|') {
          stepGaps[states.length - 1] = true;
        }
        i++;
      } else {
        break;
      }
    }
  }

  return { states, stepGaps, stepGlitches: [] };
}

export function decodeRepeatingClockWave(wave: string): DecodedWave {
  return decodeClockWave(wave);
}

/**
 * Encode clock cycles using dots for identical adjacent cycles and explicit heads for changes.
 */
export function encodeClockWaveString(
  states: BitState[],
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string | null {
  if (stepGlitches?.some(Boolean)) return null;

  if (!states.every(isClockBit)) return null;
  let wave = states[0]!;
  for (let i = 1; i < states.length; i++) {
    if (stepGlitches?.[i - 1]) return null;
    if (stepGaps?.[i]) wave += '|';
    else wave += states[i] === states[i - 1] ? '.' : states[i]!;
  }
  return wave;
}

/** @deprecated Use encodeClockWaveString */
export function encodeRepeatingClockWave(
  states: BitState[],
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string | null {
  return encodeClockWaveString(states, stepGaps, stepGlitches);
}
