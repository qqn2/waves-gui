import { nanoid } from 'nanoid';
import type { DiagramState, Signal, SignalGroup, SignalOrGroup } from './types';
import { DEFAULT_HSCALE, DEFAULT_SIGNAL_COLOR, DEFAULT_STEPS, ROW_HEIGHT } from './constants';

function cloneDiagram(diagram: DiagramState): DiagramState {
  return JSON.parse(JSON.stringify(diagram)) as DiagramState;
}

function normalizeSignal(signal: Signal, totalSteps: number): void {
  if (signal.rowHeight === undefined || signal.rowHeight <= 0) {
    signal.rowHeight = ROW_HEIGHT;
  }
  if (!signal.color) {
    signal.color = DEFAULT_SIGNAL_COLOR;
  }

  if (signal.type === 'vector') {
    if (!Array.isArray(signal.segments)) {
      signal.segments = [];
    }
    for (const seg of signal.segments) {
      delete seg.color;
    }
    if (signal.segments.length === 0) {
      signal.segments = [
        {
          id: nanoid(),
          startStep: 0,
          endStep: totalSteps,
          value: '0',
        },
      ];
    }
    if (!Array.isArray(signal.states)) {
      signal.states = [];
    }
    return;
  }

  if (signal.type === 'bit' || signal.type === 'spacer') {
    if (!Array.isArray(signal.states)) {
      signal.states = [];
    }
    const fill: Signal['states'][number] = signal.states[signal.states.length - 1] ?? '0';
    while (signal.states.length < totalSteps) {
      signal.states.push(fill);
    }
    if (signal.states.length > totalSteps) {
      signal.states.length = totalSteps;
    }
    if (!Array.isArray(signal.segments)) {
      signal.segments = [];
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
      if (typeof group.collapsed !== 'boolean') {
        group.collapsed = false;
      }
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

  if (!Array.isArray(d.edges)) {
    d.edges = [];
  }
  if (!Array.isArray(d.annotations)) {
    d.annotations = [];
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
    hscale: d.config?.hscale ?? DEFAULT_HSCALE,
  };

  walkSignals(d.signals, totalSteps);
  return d;
}
