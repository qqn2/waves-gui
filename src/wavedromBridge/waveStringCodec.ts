/**
 * WaveDrom `wave` string codec — converts between JSON `wave` and internal arrays.
 *
 * Wave character cheat sheet (normal bit lanes):
 *   0 1 x X z u d — logic levels and Undulate unknown/garbage data
 *   p n P N      — complete positive/negative-edge clock cycles
 *   = 2–9        — Undulate/WaveDrom data cells and palette variants
 *   i I m M      — Undulate impulses and metastability resolution
 *   |            — gap column (hold previous level) → stepGaps[] on that column
 *   repeated char — same level held; duplicate at boundary → stepGlitches[] (spurious transition)
 *
 * Decode order: pure clock string, expanded clock import, then mixed clock+binary scan.
 */
import { BIT_STATE_CHARS, type BitState } from '../shared/types';
import { isClockBitState } from '../shared/bitToggle';
import {
  decodeClockWave,
  encodeClockWaveString,
  isClockWaveString,
} from './clockWave';

export interface DecodedWave {
  states: BitState[];
  stepGaps: boolean[];
  stepGlitches: boolean[];
}

function waveCharToBitState(char: string): BitState | null {
  switch (char) {
    case '0':
      return '0';
    case '1':
      return '1';
    case 'x':
      return 'x';
    case 'X':
      return 'X';
    case 'z':
    case 'Z':
      return 'z';
    case 'u':
    case 'U':
      return 'u';
    case 'd':
    case 'D':
      return 'd';
    case '=':
    case '2':
    case '3':
    case '4':
    case '5':
    case '6':
    case '7':
    case '8':
    case '9':
    case 'i':
    case 'I':
    case 'm':
    case 'M':
      return char;
    default:
      return null;
  }
}

function markGlitch(stepGlitches: boolean[], boundaryIndex: number): void {
  if (boundaryIndex >= 0) stepGlitches[boundaryIndex] = true;
}

function isClockWaveHead(char: string): boolean {
  return char === 'p' || char === 'P' || char === 'n' || char === 'N';
}

function encodeGenericWaveSegment(
  states: BitState[],
  start: number,
  end: number,
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string {
  if (start >= end) return '';
  let wave = BIT_STATE_CHARS[states[start]!];
  for (let i = start + 1; i < end; i++) {
    const ch = BIT_STATE_CHARS[states[i]!];
    const prevCh = BIT_STATE_CHARS[states[i - 1]!];
    const boundary = i - 1;
    if (stepGaps?.[i]) {
      wave += '|';
      if (stepGlitches?.[boundary]) {
        wave += ch;
      } else if (ch !== prevCh) {
        wave += ch;
      }
    } else if (stepGlitches?.[boundary]) {
      wave += ch;
    } else if (ch === prevCh) {
      wave += '.';
    } else {
      wave += ch;
    }
  }
  return wave;
}

function encodeMixedWaveString(
  states: BitState[],
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string {
  return encodeGenericWaveSegment(states, 0, states.length, stepGaps, stepGlitches);
}

function mergeDecodedClockChunk(
  target: DecodedWave,
  chunk: DecodedWave,
): void {
  const offset = target.states.length;
  for (const st of chunk.states) {
    target.states.push(st);
  }
  for (let k = 0; k < chunk.stepGaps.length; k++) {
    if (chunk.stepGaps[k]) target.stepGaps[offset + k] = true;
  }
  for (let k = 0; k < chunk.stepGlitches.length; k++) {
    if (chunk.stepGlitches[k]) target.stepGlitches[offset + k] = true;
  }
}

function readMixedClockChunk(wave: string, start: number): {
  chunk: DecodedWave;
  consumed: number;
} {
  let end = start + 1;
  while (end < wave.length && (wave[end] === '.' || wave[end] === '|')) {
    end++;
  }
  const chunk = decodeClockWave(wave.slice(start, end));
  return { chunk, consumed: end - start };
}

/** Decode lanes that mix clock (`P...`) with binary (`0`, `1`, …). */
function decodeMixedWaveDetail(wave: string): DecodedWave {
  const result: DecodedWave = { states: [], stepGaps: [], stepGlitches: [] };
  const extendedDigital = /[iImM]/.test(wave);
  let prev: BitState = '0';
  let lastWaveChar = '';
  let i = 0;

  while (i < wave.length) {
    const char = wave[i]!;
    if (isClockWaveHead(char)) {
      const { chunk, consumed } = readMixedClockChunk(wave, i);
      mergeDecodedClockChunk(result, chunk);
      if (chunk.states.length > 0) {
        prev = chunk.states[chunk.states.length - 1]!;
      }
      lastWaveChar = wave[i + consumed - 1]!;
      i += consumed;
      continue;
    }

    switch (char) {
      case '|':
        result.states.push(prev);
        result.stepGaps[result.states.length - 1] = true;
        lastWaveChar = char;
        break;
      case '.':
        result.states.push(prev);
        lastWaveChar = char;
        break;
      case '0':
      case '1':
      case 'x':
      case 'X':
      case 'z':
      case 'Z':
      case 'u':
      case 'U':
      case 'd':
      case 'D':
      case '=':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
      case 'i':
      case 'I':
      case 'm':
      case 'M': {
        const next =
          char === 'X' && !extendedDigital ? 'x' : waveCharToBitState(char)!;
        if (result.states.length === 0) {
          result.states.push(next);
          prev = next;
        } else if (next === prev) {
          if (lastWaveChar === '.') {
            markGlitch(result.stepGlitches, result.states.length - 2);
          } else {
            result.states.push(next);
            markGlitch(result.stepGlitches, result.states.length - 2);
          }
        } else {
          result.states.push(next);
          prev = next;
        }
        lastWaveChar = char;
        break;
      }
      default:
        break;
    }
    i++;
  }

  return result;
}

export function decodeWaveDetail(wave: string): DecodedWave {
  if (isClockWaveString(wave)) {
    return decodeClockWave(wave);
  }

  return decodeMixedWaveDetail(wave);
}

export function decodeWaveString(wave: string): BitState[] {
  return decodeWaveDetail(wave).states;
}

/** Canonical WaveDrom wave string (holds use `.`; glitches are not preserved). */
export function normalizeWaveString(wave: string): string {
  const { states, stepGaps } = decodeWaveDetail(wave);
  return encodeWaveString(states, stepGaps);
}

export function encodeWaveString(
  states: BitState[],
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string {
  if (states.length === 0) return '';
  const clockWave = encodeClockWaveString(states, stepGaps, stepGlitches);
  if (clockWave !== null) return clockWave;

  return encodeMixedWaveString(states, stepGaps, stepGlitches);
}

export function padDecodedWaveToLength(
  decoded: DecodedWave,
  totalSteps: number,
): DecodedWave {
  const n = Math.max(0, totalSteps);
  if (n === 0) return { states: [], stepGaps: [], stepGlitches: [] };

  if (decoded.states.length === n) {
    const stepGaps = decoded.stepGaps ? [...decoded.stepGaps] : [];
    while (stepGaps.length < n) stepGaps.push(false);
    if (stepGaps.length > n) stepGaps.length = n;
    const stepGlitches = decoded.stepGlitches ? [...decoded.stepGlitches] : [];
    const maxBoundaries = Math.max(0, n - 1);
    while (stepGlitches.length < maxBoundaries) stepGlitches.push(false);
    if (stepGlitches.length > maxBoundaries) stepGlitches.length = maxBoundaries;
    return { states: [...decoded.states], stepGaps, stepGlitches };
  }

  if (decoded.states.length > n) {
    const clockOnly =
      decoded.states.every(isClockBitState) && !decoded.stepGaps?.some(Boolean);
    if (clockOnly) {
      let wave = encodeWaveString(decoded.states, decoded.stepGaps, decoded.stepGlitches);
      while (decodeWaveDetail(wave).states.length > n && wave.length > 0) {
        wave = wave.slice(0, -1);
      }
      return padDecodedWaveToLength(decodeWaveDetail(wave), n);
    }
    return {
      states: decoded.states.slice(0, n),
      stepGaps: (decoded.stepGaps ?? []).slice(0, n),
      stepGlitches: (decoded.stepGlitches ?? []).slice(0, Math.max(0, n - 1)),
    };
  }

  let wave = encodeWaveString(
    decoded.states,
    decoded.stepGaps,
    decoded.stepGlitches,
  );
  if (wave.length === 0) wave = '0';
  wave += '.'.repeat(n - decoded.states.length);
  return decodeWaveDetail(wave);
}

/** Pad or trim decoded bit states by applying WaveDrom `.` continuation semantics. */
export function padBitStatesToLength(
  states: BitState[],
  totalSteps: number,
): BitState[] {
  return padDecodedWaveToLength(
    { states, stepGaps: [], stepGlitches: [] },
    totalSteps,
  ).states;
}

export function encodeWaveStringForDiagram(
  states: BitState[],
  totalSteps: number,
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string {
  const n = Math.max(0, totalSteps);
  if (n === 0) return '';

  const padded = padDecodedWaveToLength(
    { states, stepGaps: stepGaps ?? [], stepGlitches: stepGlitches ?? [] },
    n,
  );
  return encodeWaveString(
    padded.states,
    padded.stepGaps,
    padded.stepGlitches,
  );
}
