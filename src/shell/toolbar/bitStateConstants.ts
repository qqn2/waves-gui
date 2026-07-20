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
