import { useMemo, useState } from 'react';
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
import type { LucideIcon } from 'lucide-react';
import { useStore } from '../shared/store';
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
import {
  applyBitPatternToSignal,
  applyVectorPatternToSignal,
  lastTopLevelSignalId,
} from './applyPattern';
import styles from './PatternsMenu.module.css';

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

interface PatternDef {
  id: PatternId;
  label: string;
  description: string;
  icon: LucideIcon;
  signalKind: SignalKind;
  defaultName: string;
  fields: FieldDef[];
}

type FieldDef =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number; default: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[]; default: string }
  | { key: string; label: string; type: 'text'; default: string };

const PATTERN_DEFS: PatternDef[] = [
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

function defaultConfig(def: PatternDef): Record<string, string | number> {
  const cfg: Record<string, string | number> = {};
  for (const f of def.fields) {
    cfg[f.key] = f.default;
  }
  return cfg;
}

function num(cfg: Record<string, string | number>, key: string): number {
  return Number(cfg[key]);
}

function buildPattern(
  id: PatternId,
  totalSteps: number,
  cfg: Record<string, string | number>,
): BitState[] | VectorSegment[] {
  switch (id) {
    case 'clock':
      return clockPattern({
        totalSteps,
        period: num(cfg, 'period'),
        phase: num(cfg, 'phase'),
        initialValue: cfg.initialValue === '0' ? '0' : '1',
      });
    case 'reset':
      return resetPattern({
        totalSteps,
        assertedSteps: num(cfg, 'assertedSteps'),
        activeHigh: cfg.activeHigh !== 'low',
      });
    case 'pulse':
      return pulsePattern({
        totalSteps,
        startStep: num(cfg, 'startStep'),
        endStep: num(cfg, 'endStep'),
      });
    case 'strobe':
      return strobePattern({
        totalSteps,
        period: num(cfg, 'period'),
        width: num(cfg, 'width'),
      });
    case 'pwm':
      return pwmPattern({
        totalSteps,
        period: num(cfg, 'period'),
        dutyCycle: num(cfg, 'dutyCycle'),
      });
    case 'alternating':
      return alternatingPattern({
        totalSteps,
        startHigh: cfg.startHigh !== 'low',
      });
    case 'walkingOne':
      return walkingOnePattern({ totalSteps, bits: num(cfg, 'bits') });
    case 'walkingZero':
      return walkingZeroPattern({ totalSteps, bits: num(cfg, 'bits') });
    case 'counter':
      return counterPattern({
        totalSteps,
        bits: num(cfg, 'bits'),
        format: cfg.format as 'hex' | 'dec' | 'bin',
      });
    case 'grayCode':
      return grayCodePattern({
        totalSteps,
        bits: num(cfg, 'bits'),
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

function BitPreview({ states }: { states: BitState[] }) {
  const n = states.length;
  const cellW = Math.max(2, Math.min(8, 200 / Math.max(n, 1)));
  const h = 40;
  const mid = h / 2;

  return (
    <svg className={styles.previewSvg} viewBox={`0 0 ${n * cellW} ${h}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        points={states
          .map((s, i) => {
            const y = s === '1' ? 6 : h - 6;
            const x = i * cellW + cellW / 2;
            return `${x},${y}`;
          })
          .join(' ')}
      />
      <line x1={0} y1={mid} x2={n * cellW} y2={mid} stroke="var(--border)" strokeWidth="0.5" />
    </svg>
  );
}

function VectorPreview({ segments }: { segments: VectorSegment[] }) {
  const end = segments.length ? segments[segments.length - 1]!.endStep : 1;
  const n = Math.max(1, end);
  const cellW = Math.max(2, Math.min(8, 200 / n));
  const h = 40;

  return (
    <svg className={styles.previewSvg} viewBox={`0 0 ${n * cellW} ${h}`} preserveAspectRatio="none">
      {segments.map((seg) => (
        <g key={seg.id}>
          <rect
            x={seg.startStep * cellW + 1}
            y={8}
            width={(seg.endStep - seg.startStep) * cellW - 2}
            height={h - 16}
            fill="color-mix(in srgb, var(--accent) 25%, transparent)"
            stroke="var(--accent)"
            strokeWidth="0.5"
          />
          <text
            x={((seg.startStep + seg.endStep) / 2) * cellW}
            y={h / 2 + 4}
            textAnchor="middle"
            fontSize="8"
            fill="var(--text)"
          >
            {seg.value.length > 6 ? `${seg.value.slice(0, 5)}…` : seg.value}
          </text>
        </g>
      ))}
    </svg>
  );
}

export interface PatternsMenuProps {
  onInserted?: (patternId: PatternId, signalId: string) => void;
  onClose?: () => void;
}

export function PatternsMenu({ onInserted, onClose }: PatternsMenuProps) {
  const totalSteps = useStore((s) => s.diagram.config.totalSteps);
  const addSignal = useStore((s) => s.addSignal);
  const renameSignal = useStore((s) => s.renameSignal);

  const [selectedId, setSelectedId] = useState<PatternId>('clock');
  const [configs, setConfigs] = useState<Record<PatternId, Record<string, string | number>>>(
    () =>
      Object.fromEntries(
        PATTERN_DEFS.map((d) => [d.id, defaultConfig(d)]),
      ) as Record<PatternId, Record<string, string | number>>,
  );

  const def = PATTERN_DEFS.find((d) => d.id === selectedId) ?? PATTERN_DEFS[0]!;
  const cfg = configs[selectedId];

  const preview = useMemo(
    () => buildPattern(selectedId, totalSteps, cfg),
    [selectedId, totalSteps, cfg],
  );

  const handleInsert = () => {
    addSignal(def.signalKind);
    const signalId = lastTopLevelSignalId(useStore.getState().diagram.signals);
    if (!signalId) return;

    renameSignal(signalId, def.defaultName);

    if (def.signalKind === 'bit') {
      applyBitPatternToSignal(signalId, preview as BitState[]);
    } else {
      applyVectorPatternToSignal(signalId, preview as VectorSegment[]);
    }

    onInserted?.(selectedId, signalId);
    onClose?.();
  };

  const setField = (key: string, value: string | number) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], [key]: value },
    }));
  };

  return (
    <div className={styles.menu} role="dialog" aria-label="Predefined signal patterns">
      <div className={styles.header}>Predefined signals</div>
      <div className={styles.body}>
        <div className={styles.list} role="listbox" aria-label="Pattern list">
          {PATTERN_DEFS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={p.id === selectedId}
                className={`${styles.listItem} ${p.id === selectedId ? styles.listItemActive : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                <Icon size={14} aria-hidden />
                {p.label}
              </button>
            );
          })}
        </div>
        <div className={styles.panel}>
          <p className={styles.desc}>{def.description}</p>
          <div className={styles.fields}>
            {def.fields.map((field) => (
              <label key={field.key} className={styles.field}>
                {field.label}
                {field.type === 'number' ? (
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    value={num(cfg, field.key)}
                    onChange={(e) => setField(field.key, Number(e.target.value))}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={String(cfg[field.key])}
                    onChange={(e) => setField(field.key, e.target.value)}
                  >
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={String(cfg[field.key] ?? '')}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <div className={styles.preview} aria-label="Pattern preview">
            {def.signalKind === 'bit' ? (
              <BitPreview states={preview as BitState[]} />
            ) : (
              <VectorPreview segments={preview as VectorSegment[]} />
            )}
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.insertBtn} onClick={handleInsert}>
          Insert signal
        </button>
      </div>
    </div>
  );
}

export { PATTERN_DEFS };
