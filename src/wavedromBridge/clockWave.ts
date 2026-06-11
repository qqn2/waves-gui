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

/** Valid `p...` / `n...p...` form — not per-step `pnPn` spam. */
export function isClockWaveString(wave: string): boolean {
  if (wave.length === 0) return false;
  const head = (c: string) => c === 'p' || c === 'P' || c === 'n' || c === 'N';
  if (!head(wave[0]!)) return false;

  let i = 0;
  while (i < wave.length) {
    if (!head(wave[i]!)) return false;
    i++;
    if (i >= wave.length) break;
    if (wave[i] !== '.' && wave[i] !== '|') return false;
    while (i < wave.length && (wave[i] === '.' || wave[i] === '|')) i++;
  }
  return true;
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

/** Legacy mistaken export like `pnPn` (only clock chars, no dots). */
export function isExpandedClockWave(wave: string): boolean {
  if (wave.length === 0 || isClockWaveString(wave)) return false;
  for (const c of wave) {
    if (c !== 'p' && c !== 'P' && c !== 'n' && c !== 'N') return false;
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

/** Split a clock-only lane into maximal valid alternating runs (phase may change between runs). */
export function scanClockRuns(states: BitState[]): ClockRun[] | null {
  if (states.length === 0 || !states.every(isClockBit)) return null;

  const runs: ClockRun[] = [];
  let i = 0;

  while (i < states.length) {
    const posedgeFirst = isClockRiseStep(states[i]!);
    let riseChar: BitState = posedgeFirst ? states[i]! : riseStateFor(states[i]!);
    let fallChar: BitState = posedgeFirst ? fallStateFor(riseChar) : states[i]!;

    let j = i;
    let runIdx = 0;
    while (j < states.length) {
      const expectRise = posedgeFirst ? runIdx % 2 === 0 : runIdx % 2 === 1;
      const st = states[j]!;
      if (expectRise && !isClockRiseStep(st)) break;
      if (!expectRise && !isClockFallStep(st)) break;
      if (expectRise && st === 'P') riseChar = 'P';
      if (expectRise && st === 'p' && riseChar !== 'P') riseChar = 'p';
      if (!expectRise && st === 'N') fallChar = 'N';
      if (!expectRise && st === 'n' && fallChar !== 'N') fallChar = 'n';
      j++;
      runIdx++;
    }

    if (j === i) return null;

    if (posedgeFirst) fallChar = fallStateFor(riseChar);
    else riseChar = riseStateFor(fallChar);

    const head: BitState = posedgeFirst ? riseChar : fallChar;
    runs.push({ start: i, end: j, head, posedgeFirst, riseChar, fallChar });
    i = j;
  }

  return runs;
}

/** True when steps alternate rise/fall (any mix of p/P and n/N). */
export function isAlternatingClockStates(states: BitState[]): boolean {
  const runs = scanClockRuns(states);
  if (!runs) return false;
  return runs.length === 1 && runs[0]!.start === 0 && runs[0]!.end === states.length;
}

/** Normalize one alternating run (P/n pairing, preserve arrows). */
export function canonicalizeClockStates(states: BitState[]): BitState[] {
  const runs = scanClockRuns(states);
  if (!runs || runs.length !== 1) return states;

  const run = runs[0]!;
  return states.map((_, i) => {
    const runIdx = i - run.start;
    const expectRise = run.posedgeFirst ? runIdx % 2 === 0 : runIdx % 2 === 1;
    return expectRise ? run.riseChar : run.fallChar;
  });
}

/** Paint clock brush: alternating rise/fall aligned to absolute step index. */
export function applyClockBrushToRange(
  states: BitState[],
  lo: number,
  hi: number,
  brush: BitState,
): void {
  const posedgeFirst = isClockRiseStep(brush);
  const riseChar = posedgeFirst ? brush : riseStateFor(brush);
  const fallChar = posedgeFirst ? fallStateFor(brush) : brush;
  for (let i = lo; i <= hi; i++) {
    const expectRise = posedgeFirst ? i % 2 === 0 : i % 2 === 1;
    states[i] = expectRise ? riseChar : fallChar;
  }
}

/**
 * Invert clock phase for every alternating run touched by [lo, hi].
 * Per-step NOT on one edge would break rise/fall alternation and break `P...` export;
 * inverting the whole run keeps WaveDrom clock encoding valid.
 */
export function applyClockToggleToRange(
  states: BitState[],
  lo: number,
  hi: number,
): void {
  if (!states.every(isClockBit)) {
    for (let i = lo; i <= hi; i++) {
      states[i] = toggleBinaryBitState(states[i]!);
    }
    return;
  }

  const runs = scanClockRuns(states);
  if (!runs) {
    for (let i = lo; i <= hi; i++) {
      states[i] = toggleBinaryBitState(states[i]!);
    }
    return;
  }

  for (const run of runs) {
    if (run.end <= lo || run.start > hi) continue;
    for (let i = run.start; i < run.end; i++) {
      states[i] = toggleBinaryBitState(states[i]!);
    }
  }
  ensureClockLaneFormat(states);
}

/** Repair uniform or alternating clock lanes after edits / import. */
export function ensureClockLaneFormat(states: BitState[]): void {
  if (states.length === 0 || !states.every(isClockBit)) return;

  const runs = scanClockRuns(states);
  if (runs) {
    for (const run of runs) {
      for (let k = run.start; k < run.end; k++) {
        const runIdx = k - run.start;
        const expectRise = run.posedgeFirst ? runIdx % 2 === 0 : runIdx % 2 === 1;
        states[k] = expectRise ? run.riseChar : run.fallChar;
      }
    }
    return;
  }

  const first = states[0]!;
  const uniform =
    states.every((s) => s === first) ||
    (isClockRiseStep(first) && states.every(isClockRiseStep)) ||
    (isClockFallStep(first) && states.every(isClockFallStep));
  if (uniform) {
    applyClockBrushToRange(states, 0, states.length - 1, first);
  }
}

/** Decode `P...`, `n...p...`, etc. (never per-step `pnPn` spam). */
export function decodeClockWave(wave: string): DecodedWave {
  const states: BitState[] = [];
  const stepGaps: boolean[] = [];
  let i = 0;

  while (i < wave.length) {
    const c = wave[i]!;
    if (c !== 'p' && c !== 'P' && c !== 'n' && c !== 'N') break;

    const head = c as BitState;
    const posedgeFirst = isClockRiseStep(head);
    const riseChar: BitState = posedgeFirst ? head : riseStateFor(head);
    const fallChar: BitState = posedgeFirst ? fallStateFor(head) : head;

    const pushAt = (runIdx: number) => {
      const riseEdge = posedgeFirst ? runIdx % 2 === 0 : runIdx % 2 === 1;
      states.push(riseEdge ? riseChar : fallChar);
    };

    pushAt(0);
    i++;
    let runIdx = 1;
    while (i < wave.length) {
      const nc = wave[i]!;
      if (nc === '.' || nc === '|') {
        pushAt(runIdx++);
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

export function decodeExpandedClockWave(wave: string): DecodedWave | null {
  if (!isExpandedClockWave(wave)) return null;
  const states: BitState[] = [];
  for (const char of wave) {
    states.push(char as BitState);
  }
  const runs = scanClockRuns(states);
  if (!runs) return null;
  ensureClockLaneFormat(states);
  return { states, stepGaps: [], stepGlitches: [] };
}

/**
 * Encode clock lanes as `p......`, `P........`, or `n....p....` when phase changes mid-lane.
 * Returns null if the lane is not clock-only or has glitches.
 */
export function encodeClockWaveString(
  states: BitState[],
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string | null {
  if (stepGlitches?.some(Boolean)) return null;

  const runs = scanClockRuns(states);
  if (!runs) return null;

  // Reject `P.......n` — a dotted run plus a one-step orphan tail (hold-fill bug).
  if (runs.length > 1) {
    const tail = runs[runs.length - 1]!;
    if (tail.end - tail.start === 1) return null;
  }

  let wave = '';
  for (const run of runs) {
    wave += run.head;
    for (let k = run.start + 1; k < run.end; k++) {
      if (stepGlitches?.[k - 1]) return null;
      wave += stepGaps?.[k] ? '|' : '.';
    }
  }
  // Reject accidental `PpNn`-style adjacent heads (invalid clock notation).
  if (/[pPnN][pPnN]/.test(wave)) return null;
  return wave;
}

/**
 * Repair clock-only lanes that no longer encode as WaveDrom clock notation
 * (e.g. broken alternation after a state-array slice). Preserves valid `n....p....`.
 */
export function repairClockLaneIfNeeded(
  states: BitState[],
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): BitState[] {
  if (states.length === 0 || !states.every(isClockBit)) return states;
  if (stepGlitches?.some(Boolean)) return states;

  const encoded = encodeClockWaveString(states, stepGaps, stepGlitches);
  if (encoded !== null && isRepeatingClockWave(encoded)) return states;
  if (encoded !== null && isClockWaveString(encoded) && !stepGaps?.some(Boolean)) {
    return states;
  }

  const copy = [...states];
  ensureClockLaneFormat(copy);
  const afterEnsure = encodeClockWaveString(copy, stepGaps, stepGlitches);
  if (afterEnsure !== null && isRepeatingClockWave(afterEnsure)) return copy;

  applyClockBrushToRange(copy, 0, copy.length - 1, copy[0]!);
  return copy;
}

/** @deprecated Use encodeClockWaveString */
export function encodeRepeatingClockWave(
  states: BitState[],
  stepGaps?: boolean[],
  stepGlitches?: boolean[],
): string | null {
  return encodeClockWaveString(states, stepGaps, stepGlitches);
}
