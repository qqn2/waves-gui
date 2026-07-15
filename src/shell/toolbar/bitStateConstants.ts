import type { BitState } from '../../shared/types';

/** Shown by default on the paint toolbar. */
export const PRIMARY_BIT_STATES: BitState[] = ['1', '0', 'P', 'N', 'z', 'x'];

/** Extra WaveDrom values behind “More”. */
export const MORE_BIT_STATES: BitState[] = ['.', 'p', 'n', 'u', 'd'];

export const BIT_STATE_TITLES: Partial<Record<BitState, string>> = {
  '.': 'Hold previous step (WaveDrom continuation .)',
  p: 'Positive-edge clock cycle (p)',
  P: 'Positive-edge clock cycle with arrow (P)',
  n: 'Negative-edge clock cycle (n); toggle (¬) inverts phase (→p)',
  N: 'Negative-edge clock cycle with arrow (N)',
  u: 'Weak pull-up (u)',
  d: 'Weak pull-down (d)',
  z: 'High impedance (z)',
  x: 'Unknown (x)',
};

export const EDGE_SHAPES = ['', '-', '-~', '~', '-|', '|-', '-|-'] as const;
