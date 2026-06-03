import type { BitState } from '../../shared/types';

/** Shown by default on the paint toolbar. */
export const PRIMARY_BIT_STATES: BitState[] = ['1', '0', 'P', 'N', 'z', 'x'];

/** Extra WaveDrom values behind “More”. */
export const MORE_BIT_STATES: BitState[] = ['p', 'n', 'u', 'd'];

export const BIT_STATE_TITLES: Partial<Record<BitState, string>> = {
  p: 'Clock rising edge (p)',
  P: 'Clock rising edge with arrow (P)',
  n: 'Clock falling edge (n); toggle (¬) inverts phase (→p)',
  N: 'Clock falling edge with arrow (N)',
  u: 'Weak pull-up (u)',
  d: 'Weak pull-down (d)',
  z: 'High impedance (z)',
  x: 'Unknown (x)',
};

export const EDGE_SHAPES = ['', '-', '-~', '~', '-|', '|-', '-|-'] as const;
