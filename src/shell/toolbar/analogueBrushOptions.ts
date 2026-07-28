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
  }
}
