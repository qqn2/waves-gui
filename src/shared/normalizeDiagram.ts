import { nanoid } from 'nanoid';
import type {
  DiagramState,
  Signal,
  SignalGroup,
  SignalOrGroup,
  SignalTiming,
} from './types';
import {
  clampHscale,
  DEFAULT_HSCALE,
  DEFAULT_SIGNAL_COLOR,
  DEFAULT_STEPS,
  ROW_HEIGHT,
} from './constants';
import { isWaveModeLane, padWaveLaneToLength } from '../wavedromBridge/laneWaveOps';
import { padBitStatesToLength } from '../wavedromBridge/waveStringCodec';
import { normalizeAnnotations } from './annotations';
import { normalizeAnalogueSignal } from './analogue';
import {
  DEFAULT_ANALOGUE_CONTEXT,
  type AnalogueContext,
} from './analogueExpressions';
import { reconcileAnalogueOverlayGroups } from './analogueOverlayGroups';
import { normalizeTimedVectorSegments } from './vectorSegments';
import { fitTimingFlags } from './bitStepResize';

function normalizeAnalogueContext(value: unknown): AnalogueContext | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const context = value as Partial<AnalogueContext>;
  if (
    typeof context.vssa !== 'number'
    || !Number.isFinite(context.vssa)
    || typeof context.vdda !== 'number'
    || !Number.isFinite(context.vdda)
    || context.vdda <= context.vssa
  ) return { ...DEFAULT_ANALOGUE_CONTEXT };
  return { vssa: context.vssa, vdda: context.vdda };
}

function cloneDiagram(diagram: DiagramState): DiagramState {
  return JSON.parse(JSON.stringify(diagram)) as DiagramState;
}

function normalizeDurationTicks(value: unknown, fallback: number): number {
  if (value === 0) return 0;
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.max(1, Math.round(value))
    : fallback;
}

function normalizeDutyTicks(value: unknown, durationTicks: number): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.max(0, Math.min(durationTicks, Math.round(value)));
}

function normalizeSignalTiming(timing: SignalTiming): void {
  const rawTicksPerStep = timing.ticksPerStep;
  timing.ticksPerStep = Math.max(
    1,
    Math.min(
      1024,
      typeof rawTicksPerStep === 'number' && Number.isFinite(rawTicksPerStep)
        ? Math.floor(rawTicksPerStep)
        : 1,
    ),
  );
  timing.phaseTicks = typeof timing.phaseTicks === 'number' && Number.isFinite(timing.phaseTicks)
    ? Math.round(timing.phaseTicks)
    : 0;
  timing.cells = (timing.cells ?? []).map((source) => {
    const durationTicks = normalizeDurationTicks(source?.durationTicks, timing.ticksPerStep);
    const normalized = {
      ...source,
      durationTicks,
    };
    const dutyTicks = normalizeDutyTicks(source?.dutyTicks, durationTicks);
    if (dutyTicks === undefined) delete normalized.dutyTicks;
    else normalized.dutyTicks = dutyTicks;
    return normalized;
  });
  if (timing.sourceFields) {
    timing.sourceFields = { ...timing.sourceFields };
  }
}

function normalizeSignal(signal: Signal, totalSteps: number): void {
  if (signal.rowHeight === undefined || signal.rowHeight <= 0) {
    signal.rowHeight = ROW_HEIGHT;
  }
  if (!signal.color) {
    signal.color = DEFAULT_SIGNAL_COLOR;
  }
  const nodeSlots =
    signal.digitalTiming?.cells.length
    ?? signal.vectorTiming?.cells.length
    ?? totalSteps;
  if (signal.nodeNames && typeof signal.nodeNames === 'object') {
    const normalized: Record<number, string> = {};
    for (const [rawStep, name] of Object.entries(signal.nodeNames)) {
      const step = Number(rawStep);
      if (
        Number.isInteger(step)
        && step >= 0
        && step < nodeSlots
        && typeof name === 'string'
        && name.length > 0
      ) {
        normalized[step] = name;
      }
    }
    if (Object.keys(normalized).length > 0) signal.nodeNames = normalized;
    else delete signal.nodeNames;
  }

  if (signal.type === 'analogue') {
    normalizeAnalogueSignal(signal, totalSteps);
    return;
  }

  if (signal.type === 'vector') {
    if (!Array.isArray(signal.segments)) {
      signal.segments = [];
    }
    if (signal.segments.length === 0) {
      signal.segments = [
        {
          id: nanoid(),
          startStep: 0,
          endStep: signal.vectorTiming?.cells.length ?? totalSteps,
          value: '',
        },
      ];
    }
    if (!Array.isArray(signal.states)) {
      signal.states = [];
    }
    if (signal.vectorTiming) {
      normalizeSignalTiming(signal.vectorTiming);
      if (signal.vectorTiming.cells.length === 0) {
        delete signal.vectorTiming;
      } else {
        signal.segments = normalizeTimedVectorSegments(
          signal.segments,
          signal.vectorTiming.cells.length,
        );
        signal.stepGaps = fitTimingFlags(
          signal.stepGaps,
          signal.vectorTiming.cells.length,
        );
      }
    }
    return;
  }

  if (signal.type === 'bit' || signal.type === 'spacer') {
    if (!Array.isArray(signal.states)) {
      signal.states = [];
    }
    const hasDigitalTiming =
      signal.type === 'bit'
      && signal.digitalTiming
      && signal.digitalTiming.cells.length > 0;
    if (hasDigitalTiming) {
      // Native timing is the authoritative representation for timed bit
      // lanes.  Older drafts may only have the compatibility `states` cache,
      // so use it only to fill a missing cell state, never to overwrite an
      // authored native state during normalization/save/reload.
      signal.digitalTiming!.cells = signal.digitalTiming!.cells.map((cell, index) => ({
        ...cell,
        state: cell.state ?? signal.states[index] ?? '0',
      }));
      signal.states = signal.digitalTiming!.cells.map((cell) => cell.state);
    } else if (signal.type === 'bit' && signal.period !== undefined) {
      // Preserve period-bearing WaveDrom source cells; period is applied by
      // the renderer/exporter and must not be baked into the stored array.
    } else if (signal.type === 'bit' && isWaveModeLane(signal) && !signal.sourceWaveData) {
      padWaveLaneToLength(signal, totalSteps, DEFAULT_HSCALE);
    } else {
      signal.states = padBitStatesToLength(signal.states, totalSteps);
    }
    if (!Array.isArray(signal.segments)) {
      signal.segments = [];
    }
    if (signal.type === 'bit' && signal.digitalTiming) {
      normalizeSignalTiming(signal.digitalTiming);
      const ticksPerStep = signal.digitalTiming.ticksPerStep;
      signal.digitalTiming.cells = signal.digitalTiming.cells.map((source, index) => {
        const durationTicks = normalizeDurationTicks(source.durationTicks, ticksPerStep);
        const normalized = {
          ...source,
          state: source.state ?? signal.states[index] ?? '0',
          durationTicks,
        };
        const dutyTicks = normalizeDutyTicks(source.dutyTicks, durationTicks);
        if (dutyTicks === undefined) delete normalized.dutyTicks;
        else normalized.dutyTicks = dutyTicks;
        return normalized;
      });
      signal.states = signal.digitalTiming.cells.map((cell) => cell.state);
      if (signal.stepGaps) {
        signal.stepGaps.length = signal.digitalTiming.cells.length;
      }
      if (signal.stepGlitches) {
        signal.stepGlitches.length = Math.max(0, signal.digitalTiming.cells.length - 1);
      }
      if (signal.digitalTiming.sourceFields) {
        signal.digitalTiming.sourceFields = {
          ...signal.digitalTiming.sourceFields,
        };
      }
    }
  }
}

function walkSignals(signals: SignalOrGroup[], totalSteps: number): void {
  for (const item of signals) {
    if (item.type === 'group') {
      const group = item as SignalGroup;
      if (!Array.isArray(group.children)) {
        group.children = [];
      }
      delete (group as SignalGroup & { collapsed?: boolean }).collapsed;
      walkSignals(group.children, totalSteps);
    } else {
      normalizeSignal(item, totalSteps);
    }
  }
}

/**
 * Repair diagrams from older drafts or partial JSON (missing edges[], segments, etc.).
 */
export function normalizeDiagram(diagram: DiagramState): DiagramState {
  const d = cloneDiagram(diagram);

  d.version = 2;
  d.compatibility = {
    extensionsEnabled: d.compatibility?.extensionsEnabled === true,
    ...(d.compatibility?.sourceFormat
      ? { sourceFormat: d.compatibility.sourceFormat }
      : {}),
    ...(d.compatibility?.importMode === 'event-compressed-vcd'
      ? { importMode: d.compatibility.importMode }
      : {}),
    ...(d.compatibility?.sourceRevision
      ? { sourceRevision: d.compatibility.sourceRevision }
      : {}),
    ...(typeof d.compatibility?.sourceText === 'string'
      ? { sourceText: d.compatibility.sourceText }
      : {}),
    ...(d.compatibility?.opaqueUndulate
      ? { opaqueUndulate: d.compatibility.opaqueUndulate }
      : {}),
  };

  if (!Array.isArray(d.edges)) {
    d.edges = [];
  }
  if (!Array.isArray(d.signals)) {
    d.signals = [];
  }

  const totalSteps =
    typeof d.config?.totalSteps === 'number' && d.config.totalSteps > 0
      ? d.config.totalSteps
      : DEFAULT_STEPS;
  d.config = {
    ...d.config,
    totalSteps,
    hscale: clampHscale(d.config?.hscale ?? DEFAULT_HSCALE),
    ...(d.config?.ticksPerStep !== undefined
      ? {
          ticksPerStep: Math.max(
            1,
            Math.min(1024, Math.floor(d.config.ticksPerStep)),
          ),
        }
      : {}),
    ...(d.config?.analogueContext !== undefined
      ? { analogueContext: normalizeAnalogueContext(d.config.analogueContext) }
      : {}),
    ...(Number.isInteger(d.config?.analogueRandomSeed)
      ? { analogueRandomSeed: d.config.analogueRandomSeed! >>> 0 }
      : {}),
  };
  d.annotations = normalizeAnnotations(d.annotations, totalSteps);

  walkSignals(d.signals, totalSteps);
  reconcileAnalogueOverlayGroups(d);
  return d;
}
