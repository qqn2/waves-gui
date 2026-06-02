import type { BitState } from '../shared/types';

/** WaveDrom states that toggle (NOT) must not modify. */
const TOGGLE_IMMUTABLE: ReadonlySet<BitState> = new Set(['x', 'z', 'u', 'd']);

export function isClockBitState(st: BitState): boolean {
  return st === 'p' || st === 'P' || st === 'n' || st === 'N';
}

/**
 * Invert clock phase at one step: rising↔falling (p/P→n, n/N→p).
 * Does not swap P↔N (that swaps edge kind + arrow and breaks the waveform).
 */
export function invertClockBitState(st: BitState): BitState {
  if (st === 'p' || st === 'P') return 'n';
  if (st === 'n' || st === 'N') return 'p';
  return st;
}

/**
 * Paint-tool toggle: 0↔1; clock rise↔fall; x/z/u/d unchanged.
 */
export function toggleBinaryBitState(st: BitState): BitState {
  if (st === '1') return '0';
  if (st === '0') return '1';
  if (isClockBitState(st)) return invertClockBitState(st);
  if (TOGGLE_IMMUTABLE.has(st)) return st;
  return st;
}
