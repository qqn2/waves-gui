/**
 * WaveDrom `wave` string codec — converts between JSON `wave` and internal arrays.
 *
 * Wave character cheat sheet (normal bit lanes):
 *   0 1 x z u d  — logic levels (unknown, high-Z, pull-up/down)
 *   p n P N      — clock rise/fall (see clockWave.ts for full clock encoding)
 *   =            — start/end of a bus span (pairs with data[] label)
 *   |            — gap before next column → stepGaps[]
 *   2–9          — bus fill color index (WaveDrom palette)
 *   repeated char — same level held; duplicate at boundary → stepGlitches[] (spurious transition)
 *
 * Decode order: pure clock string, expanded clock import, then mixed clock+binary scan.
 */
import { BIT_STATE_CHARS, type BitState } from '../shared/types';
import { isClockBitState } from '../shared/bitToggle';
import {
  decodeClockWave,
  decodeExpandedClockWave,
  encodeClockWaveString,
  isClockFallStep,
  isClockRiseStep,
  isClockWaveString,
  scanClockRuns,
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
    case 'X':
      return 'x';
    case 'z':
    case 'Z':
      return 'z';
    case 'u':
    case 'U':
      return 'u';
    case 'd':
    case 'D':
      return 'd';
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

function isBinaryLevel(st: BitState): boolean {
  return st === '0' || st === '1' || st === 'x' || st === 'z' || st === 'u' || st === 'd';
}

/**
 * Replace redundant clock fall steps around explicit binary lows so export uses
 * `P0..P...` instead of `Pn0..nPnPn`. Same step count — only re-labels edges.
 */
function normalizeMixedClockForExport(states: BitState[]): BitState[] {
  const out = states.slice();
  for (let i = 0; i < out.length; i++) {
    const st = out[i]!;
    const next = i + 1 < out.length ? out[i + 1]! : null;
    const prev = i > 0 ? out[i - 1]! : null;

    if (isClockFallStep(st) && next !== null && next === '0') {
      out[i] = '0';
    } else if (
      isClockFallStep(st) &&
      prev === '0' &&
      next !== null &&
      isClockRiseStep(next)
    ) {
      out[i] = '0';
    }
  }
  return out;
}

/** Longest alternating clock run starting at `start` (inclusive). */
function longestEncodableClockRun(states: BitState[], start: number): number {
  for (let len = states.length - start; len >= 1; len--) {
    const runs = scanClockRuns(states.slice(start, start + len));
    if (runs?.length === 1 && runs[0]!.start === 0 && runs[0]!.end === len) {
      return len;
    }
  }
  return 0;
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
    if (stepGaps?.[boundary]) {
      wave += '|';
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
  let wave = '';
  let i = 0;
  while (i < states.length) {
    let clockLen = isClockBitState(states[i]!)
      ? longestEncodableClockRun(states, i)
      : 0;
    if (clockLen > 0) {
      let encoded = false;
      for (let len = clockLen; len >= 1; len--) {
        const cw = encodeClockWaveString(
          states.slice(i, i + len),
          stepGaps?.slice(i, i + len - 1),
          stepGlitches?.slice(i, i + len - 1),
        );
        if (cw !== null) {
          wave += cw;
          i += len;
          encoded = true;
          break;
        }
      }
      if (encoded) continue;
    }

    let j = i + 1;
    while (j < states.length) {
      const nextClockLen = isClockBitState(states[j]!)
        ? longestEncodableClockRun(states, j)
        : 0;
      if (nextClockLen > 0) break;
      j++;
    }
    if (isClockBitState(states[i]!)) {
      j = i + 1;
    }
    wave += encodeGenericWaveSegment(states, i, j, stepGaps, stepGlitches);
    i = j;
  }
  return wave;
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
        if (result.states.length > 0) {
          result.stepGaps[result.states.length - 1] = true;
        }
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
      case 'D': {
        const next = waveCharToBitState(char)!;
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
      case '=':
      case '2':
      case '3':
      case '4':
      case '5':
      case '6':
      case '7':
      case '8':
      case '9':
        result.states.push('0');
        prev = '0';
        lastWaveChar = char;
        break;
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

  const expanded = decodeExpandedClockWave(wave);
  if (expanded) return expanded;

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
  const prepared =
    states.some(isClockBitState) && states.some(isBinaryLevel)
      ? normalizeMixedClockForExport(states)
      : states;
  const clockWave = encodeClockWaveString(prepared, stepGaps, stepGlitches);
  if (clockWave !== null) return clockWave;

  return encodeMixedWaveString(prepared, stepGaps, stepGlitches);
}

export function padDecodedWaveToLength(
  decoded: DecodedWave,
  totalSteps: number,
): DecodedWave {
  const n = Math.max(0, totalSteps);
  if (n === 0) return { states: [], stepGaps: [], stepGlitches: [] };

  let wave = encodeWaveString(
    decoded.states,
    decoded.stepGaps,
    decoded.stepGlitches,
  );
  if (wave.length === 0) wave = '0';
  if (wave.length < n) {
    wave += '.'.repeat(n - wave.length);
  } else if (wave.length > n) {
    wave = wave.slice(0, n);
  }
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
