import type { BitState } from './types';

/** WaveDrom states that toggle (NOT) must not modify. */
const TOGGLE_IMMUTABLE: ReadonlySet<BitState> = new Set(['x', 'z', 'u', 'd']);

/**
 * Paint-tool toggle: flip 0↔1, clock polarity p↔n; leave x/z/u/d unchanged.
 */
export function toggleBinaryBitState(st: BitState): BitState {
  if (st === '1') return '0';
  if (st === '0') return '1';
  if (st === 'p') return 'n';
  if (st === 'n') return 'p';
  if (TOGGLE_IMMUTABLE.has(st)) return st;
  return st;
}
