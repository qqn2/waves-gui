import type { BitState } from '../../shared/types';

/** Shown by default on the paint toolbar. */
export const PRIMARY_BIT_STATES: BitState[] = ['1', '0', 'P', 'N', 'z', 'x'];

/** Extra WaveDrom values behind “More”. */
export const MORE_BIT_STATES: BitState[] = ['.', 'p', 'n', 'u', 'd'];

/** Undulate-only clock-edge cells, visible only while extensions are enabled. */
export const UNDULATE_BIT_STATES: BitState[] = ['h', 'H', 'l', 'L'];

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
  h: 'Rise to high, then hold (Undulate h)',
  H: 'Rise to high with an edge arrow, then hold (Undulate H)',
  l: 'Fall to low, then hold (Undulate l)',
  L: 'Fall to low with an edge arrow, then hold (Undulate L)',
};

export const EDGE_CONNECTOR_GROUPS = [
  {
    label: 'Spline — no arrow',
    options: [
      { value: '~', label: '~  Smooth' },
      { value: '-~', label: '-~  Curve into target' },
      { value: '~-', label: '~-  Curve out of source' },
    ],
  },
  {
    label: 'Spline — arrow',
    options: [
      { value: '~>', label: '~>  Smooth →' },
      { value: '-~>', label: '-~>  Curve into target →' },
      { value: '~->', label: '~->  Curve out of source →' },
      { value: '<~>', label: '<~>  Smooth ↔' },
      { value: '<-~>', label: '<-~>  Curve ↔' },
    ],
  },
  {
    label: 'Sharp — no arrow',
    options: [
      { value: '-', label: '-  Straight' },
      { value: '-|', label: '-|  Across, then down' },
      { value: '|-', label: '|-  Down, then across' },
      { value: '-|-', label: '-|-  Centered elbow' },
    ],
  },
  {
    label: 'Sharp — arrow',
    options: [
      { value: '->', label: '->  Straight →' },
      { value: '-|>', label: '-|>  Across, then down →' },
      { value: '|->', label: '|->  Down, then across →' },
      { value: '-|->', label: '-|->  Centered elbow →' },
      { value: '<->', label: '<->  Straight ↔' },
      { value: '<-|>', label: '<-|>  Elbow ↔' },
      { value: '<-|->', label: '<-|->  Centered elbow ↔' },
    ],
  },
] as const;
