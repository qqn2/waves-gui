import type { BitState } from '../../shared/types';

/** Shown by default on the paint toolbar. */
export const PRIMARY_BIT_STATES: BitState[] = ['1', '0', 'P', 'N', 'z', 'x'];

/** Extra WaveDrom values behind “More”. */
export const MORE_BIT_STATES: BitState[] = ['.', 'p', 'n', 'u', 'd'];

/** Undulate-only digital cells, visible only while extensions are enabled. */
export const UNDULATE_BIT_STATES: BitState[] = [
  'i', 'I', 'm', 'M',
  'h', 'H', 'l', 'L',
];

export const BIT_STATE_LABELS: Partial<Record<BitState, string>> = {
  '.': 'Hold previous',
  p: 'Rising clock',
  n: 'Falling clock',
  u: 'Weak high',
  d: 'Weak low',
  i: 'Low-going impulse',
  I: 'High-going impulse',
  m: 'Resolves low',
  M: 'Resolves high',
  h: 'Rise and hold',
  H: 'Rise, arrow, hold',
  l: 'Fall and hold',
  L: 'Fall, arrow, hold',
};

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
  i: 'Low-going impulse from high (Undulate i)',
  I: 'High-going impulse from low (Undulate I)',
  m: 'Metastability resolving low (Undulate m)',
  M: 'Metastability resolving high (Undulate M)',
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
