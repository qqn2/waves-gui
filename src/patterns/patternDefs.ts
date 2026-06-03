import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  ArrowDown,
  Binary,
  Clock,
  Hash,
  Layers,
  Pause,
  Radio,
  Repeat,
  Square,
  Zap,
} from 'lucide-react';
import type { BitState, VectorSegment } from '../shared/types';
import {
  clockPattern,
  counterPattern,
  resetPattern,
  pulsePattern,
  strobePattern,
  pwmPattern,
  walkingOnePattern,
  walkingZeroPattern,
  busIdlePattern,
  alternatingPattern,
  grayCodePattern,
} from './generators';

export type PatternId =
  | 'clock'
  | 'counter'
  | 'reset'
  | 'pulse'
  | 'strobe'
  | 'pwm'
  | 'walkingOne'
  | 'walkingZero'
  | 'busIdle'
  | 'alternating'
  | 'grayCode';

type SignalKind = 'bit' | 'vector';

export type FieldDef =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number; default: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; default: string }
  | { key: string; label: string; type: 'text'; default: string };

export interface PatternDef {
  id: PatternId;
  label: string;
  description: string;
  icon: LucideIcon;
  signalKind: SignalKind;
  defaultName: string;
  fields: FieldDef[];
}

export const PATTERN_DEFS: PatternDef[] = [
  {
    id: 'clock',
    label: 'Clock',
    description: 'Rising-edge clock with configurable period and phase.',
    icon: Clock,
    signalKind: 'bit',
    defaultName: 'clk',
    fields: [
      { key: 'period', label: 'Period (steps)', type: 'number', min: 1, max: 32, default: 2 },
      { key: 'phase', label: 'Phase (0–1)', type: 'number', min: 0, max: 1, step: 0.25, default: 0 },
      {
        key: 'initialValue',
        label: 'Initial',
        type: 'select',
        options: [
          { value: '1', label: 'High (1)' },
          { value: '0', label: 'Low (0)' },
        ],
        default: '1',
      },
    ],
  },
  {
    id: 'reset',
    label: 'Reset',
    description: 'Synchronous reset asserted for the first N steps.',
    icon: ArrowDown,
    signalKind: 'bit',
    defaultName: 'rst',
    fields: [
      { key: 'assertedSteps', label: 'Asserted steps', type: 'number', min: 1, max: 64, default: 2 },
      {
        key: 'activeHigh',
        label: 'Polarity',
        type: 'select',
        options: [
          { value: 'high', label: 'Active high' },
          { value: 'low', label: 'Active low' },
        ],
        default: 'high',
      },
    ],
  },
  {
    id: 'pulse',
    label: 'Pulse',
    description: 'Single pulse between start and end steps.',
    icon: Zap,
    signalKind: 'bit',
    defaultName: 'pulse',
    fields: [
      { key: 'startStep', label: 'Start step', type: 'number', min: 0, max: 999, default: 2 },
      { key: 'endStep', label: 'End step', type: 'number', min: 0, max: 999, default: 4 },
    ],
  },
  {
    id: 'strobe',
    label: 'Strobe',
    description: 'Repeating enable pulse every N steps.',
    icon: Repeat,
    signalKind: 'bit',
    defaultName: 'strb',
    fields: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 64, default: 4 },
      { key: 'width', label: 'Pulse width', type: 'number', min: 1, max: 32, default: 1 },
    ],
  },
  {
    id: 'pwm',
    label: 'PWM',
    description: 'Pulse-width modulation with fixed period.',
    icon: Activity,
    signalKind: 'bit',
    defaultName: 'pwm',
    fields: [
      { key: 'period', label: 'Period', type: 'number', min: 1, max: 64, default: 4 },
      { key: 'dutyCycle', label: 'Duty (0–1)', type: 'number', min: 0, max: 1, step: 0.25, default: 0.5 },
    ],
  },
  {
    id: 'alternating',
    label: 'Alternating',
    description: 'Simple 0/1 alternation.',
    icon: Radio,
    signalKind: 'bit',
    defaultName: 'alt',
    fields: [
      {
        key: 'startHigh',
        label: 'Start',
        type: 'select',
        options: [
          { value: 'high', label: 'High first' },
          { value: 'low', label: 'Low first' },
        ],
        default: 'high',
      },
    ],
  },
  {
    id: 'walkingOne',
    label: 'Walking 1',
    description: 'Single-bit scan pattern (one high per cycle).',
    icon: Square,
    signalKind: 'bit',
    defaultName: 'w1',
    fields: [{ key: 'bits', label: 'Cycle width', type: 'number', min: 2, max: 16, default: 4 }],
  },
  {
    id: 'walkingZero',
    label: 'Walking 0',
    description: 'Inverted walking-one scan.',
    icon: Pause,
    signalKind: 'bit',
    defaultName: 'w0',
    fields: [{ key: 'bits', label: 'Cycle width', type: 'number', min: 2, max: 16, default: 4 }],
  },
  {
    id: 'counter',
    label: 'Counter',
    description: 'Incrementing bus values per step.',
    icon: Hash,
    signalKind: 'vector',
    defaultName: 'count',
    fields: [
      { key: 'bits', label: 'Width (bits)', type: 'number', min: 2, max: 16, default: 4 },
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        options: [
          { value: 'hex', label: 'Hex' },
          { value: 'dec', label: 'Decimal' },
          { value: 'bin', label: 'Binary' },
        ],
        default: 'hex',
      },
    ],
  },
  {
    id: 'grayCode',
    label: 'Gray code',
    description: 'Gray-code counter on a bus.',
    icon: Binary,
    signalKind: 'vector',
    defaultName: 'gray',
    fields: [
      { key: 'bits', label: 'Width (bits)', type: 'number', min: 2, max: 16, default: 4 },
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        options: [
          { value: 'gray', label: 'Gray (binary)' },
          { value: 'hex', label: 'Hex' },
          { value: 'dec', label: 'Decimal' },
          { value: 'bin', label: 'Binary' },
        ],
        default: 'gray',
      },
    ],
  },
  {
    id: 'busIdle',
    label: 'Bus idle',
    description: 'Constant idle label across all steps.',
    icon: Layers,
    signalKind: 'vector',
    defaultName: 'bus',
    fields: [{ key: 'idleLabel', label: 'Label', type: 'text', default: 'IDLE' }],
  },
];

export function defaultConfig(def: PatternDef): Record<string, string | number> {
  const cfg: Record<string, string | number> = {};
  for (const f of def.fields) {
    cfg[f.key] = f.default;
  }
  return cfg;
}

export function fieldNum(cfg: Record<string, string | number>, key: string): number {
  return Number(cfg[key]);
}

export function buildPattern(
  id: PatternId,
  totalSteps: number,
  cfg: Record<string, string | number>,
): BitState[] | VectorSegment[] {
  switch (id) {
    case 'clock':
      return clockPattern({
        totalSteps,
        period: fieldNum(cfg, 'period'),
        phase: fieldNum(cfg, 'phase'),
        initialValue: cfg.initialValue === '0' ? '0' : '1',
      });
    case 'reset':
      return resetPattern({
        totalSteps,
        assertedSteps: fieldNum(cfg, 'assertedSteps'),
        activeHigh: cfg.activeHigh !== 'low',
      });
    case 'pulse':
      return pulsePattern({
        totalSteps,
        startStep: fieldNum(cfg, 'startStep'),
        endStep: fieldNum(cfg, 'endStep'),
      });
    case 'strobe':
      return strobePattern({
        totalSteps,
        period: fieldNum(cfg, 'period'),
        width: fieldNum(cfg, 'width'),
      });
    case 'pwm':
      return pwmPattern({
        totalSteps,
        period: fieldNum(cfg, 'period'),
        dutyCycle: fieldNum(cfg, 'dutyCycle'),
      });
    case 'alternating':
      return alternatingPattern({
        totalSteps,
        startHigh: cfg.startHigh !== 'low',
      });
    case 'walkingOne':
      return walkingOnePattern({ totalSteps, bits: fieldNum(cfg, 'bits') });
    case 'walkingZero':
      return walkingZeroPattern({ totalSteps, bits: fieldNum(cfg, 'bits') });
    case 'counter':
      return counterPattern({
        totalSteps,
        bits: fieldNum(cfg, 'bits'),
        format: cfg.format as 'hex' | 'dec' | 'bin',
      });
    case 'grayCode':
      return grayCodePattern({
        totalSteps,
        bits: fieldNum(cfg, 'bits'),
        format: cfg.format as 'hex' | 'dec' | 'bin' | 'gray',
      });
    case 'busIdle':
      return busIdlePattern({
        totalSteps,
        idleLabel: String(cfg.idleLabel ?? 'IDLE'),
      });
    default:
      return clockPattern({ totalSteps });
  }
}

export function initialPatternConfigs(): Record<
  PatternId,
  Record<string, string | number>
> {
  return Object.fromEntries(
    PATTERN_DEFS.map((d) => [d.id, defaultConfig(d)]),
  ) as Record<PatternId, Record<string, string | number>>;
}
