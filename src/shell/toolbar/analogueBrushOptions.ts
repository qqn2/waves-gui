import type { AnalogueTransition } from '../../shared/types';

export interface AnalogueBrushOption {
  kind: AnalogueTransition;
  label: string;
  description: string;
  symbol: string;
}

export const ANALOGUE_BRUSH_OPTIONS: AnalogueBrushOption[] = [
  {
    kind: 'hold',
    label: 'Hold previous',
    description: 'Keep the voltage from the preceding cell',
    symbol: '.',
  },
  {
    kind: 'step',
    label: 'Step to value',
    description: 'Move immediately to the target voltage',
    symbol: 's',
  },
  {
    kind: 'capacitive',
    label: 'Capacitive curve',
    description: 'Ease exponentially toward the target voltage',
    symbol: 'c',
  },
  {
    kind: 'samples',
    label: 'Sampled points',
    description: 'Create editable points from previous to target',
    symbol: 'a',
  },
  {
    kind: 'metastable-low',
    label: 'Metastable to low',
    description: 'Oscillate and resolve to the lower rail',
    symbol: 'm',
  },
  {
    kind: 'metastable-high',
    label: 'Metastable to high',
    description: 'Oscillate and resolve to the upper rail',
    symbol: 'M',
  },
  {
    kind: 'impulse-low',
    label: 'Downward impulse',
    description: 'Pulse low and return to the upper rail',
    symbol: 'i',
  },
  {
    kind: 'impulse-high',
    label: 'Upward impulse',
    description: 'Pulse high and return to the lower rail',
    symbol: 'I',
  },
];

export function analogueBrushPreviewPath(kind: AnalogueTransition): string {
  switch (kind) {
    case 'hold':
      return 'M2 17H62';
    case 'step':
      return 'M2 17H14V5H62';
    case 'capacitive':
      return 'M2 17C13 17 14 6 30 5C43 4.5 52 5 62 5';
    case 'samples':
      return 'M2 17L20 11L36 14L50 6L62 5';
    case 'metastable-low':
      return 'M2 11C8 2 12 20 18 11S28 3 34 12S44 15 50 14S57 17 62 17';
    case 'metastable-high':
      return 'M2 11C8 20 12 2 18 11S28 19 34 10S44 7 50 8S57 5 62 5';
    case 'impulse-low':
      return 'M2 5H32V17V5H62';
    case 'impulse-high':
      return 'M2 17H32V5V17H62';
  }
}
