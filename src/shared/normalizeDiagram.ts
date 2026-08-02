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

function normalizeSignalTiming(timing: SignalTiming): void {
  timing.ticksPerStep = Math.max(
    1,
    Math.min(1024, Math.floor(timing.ticksPerStep || 1)),
  );
  timing.phaseTicks = Math.round(timing.phaseTicks || 0);
  timing.cells = (timing.cells ?? []).map((source) => {
    const durationTicks = Math.max(
      1,
      Math.round(source?.durationTicks || timing.ticksPerStep),
    );
    return {
      ...source,
      durationTicks,
      ...(source?.dutyTicks !== undefined
        ? {
            dutyTicks: Math.max(
              0,
              Math.min(durationTicks, Math.round(source.dutyTicks)),
            ),
          }
        : {}),
    };
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
      if (signal.vectorTiming.cells.length === 0) delete signal.vectorTiming;
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
      signal.states = signal.digitalTiming!.cells.map((cell, index) =>
        cell.state ?? signal.states[index] ?? '0'
      );
    } else if (signal.type === 'bit' && isWaveModeLane(signal)) {
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
      signal.digitalTiming.cells = signal.states.map((state, index) => {
        const source = signal.digitalTiming!.cells?.[index];
        const durationTicks = Math.max(
          1,
          Math.round(source?.durationTicks || ticksPerStep),
        );
        return {
          state,
          durationTicks,
          ...(source?.dutyTicks !== undefined
            ? {
                dutyTicks: Math.max(
                  0,
                  Math.min(durationTicks, Math.round(source.dutyTicks)),
                ),
              }
          : {}),
        };
      });
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
