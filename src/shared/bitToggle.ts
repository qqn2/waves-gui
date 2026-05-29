import type { BitState } from './types';

/** Flip binary 0/1; other WaveDrom states become the opposite rail (1↔0). */
export function toggleBinaryBitState(st: BitState): BitState {
  if (st === '1') return '0';
  if (st === '0') return '1';
  return '1';
}
