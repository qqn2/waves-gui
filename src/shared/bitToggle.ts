import type { BitState } from '../shared/types';

/** WaveDrom states that toggle (NOT) must not modify. */
const TOGGLE_IMMUTABLE: ReadonlySet<BitState> = new Set(['x', 'z', 'u', 'd', '.']);

/** Paint-only: WaveDrom continuation (hold previous step). */
export function isHoldPaintValue(st: BitState): boolean {
  return st === '.';
}

/** Resolve a paint brush value to a stored lane state. */
export function resolvePaintValue(
  states: BitState[],
  step: number,
  paint: BitState,
): BitState {
  if (!isHoldPaintValue(paint)) return paint;
  for (let i = step - 1; i >= 0; i--) {
    const prev = states[i];
    if (prev !== undefined) return prev;
  }
  return '0';
}

export function isClockBitState(st: BitState): boolean {
  return st === 'p' || st === 'P' || st === 'n' || st === 'N';
}

/**
 * Invert one WaveDrom clock cycle while preserving whether edge arrows are shown.
 */
export function invertClockBitState(st: BitState): BitState {
  if (st === 'p') return 'n';
  if (st === 'P') return 'N';
  if (st === 'n') return 'p';
  if (st === 'N') return 'P';
  return st;
}

/**
 * Paint-tool toggle: 0↔1; clock-cycle phase p↔n and P↔N; x/z/u/d unchanged.
 */
export function toggleBinaryBitState(st: BitState): BitState {
  if (st === '1') return '0';
  if (st === '0') return '1';
  if (st === 'h') return 'l';
  if (st === 'H') return 'L';
  if (st === 'l') return 'h';
  if (st === 'L') return 'H';
  if (isClockBitState(st)) return invertClockBitState(st);
  if (TOGGLE_IMMUTABLE.has(st)) return st;
  return st;
}
