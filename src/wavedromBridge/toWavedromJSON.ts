import type { DiagramState, Signal, SignalGroup, SignalOrGroup } from '../shared/types';
import { encodeWaveString } from './waveStringCodec';
import { segmentsToWaveAndData } from '../shared/vectorSegments';
import type { WdGroup, WdRoot, WdSignal, WdSignalEntry } from './wdTypes';
import { exportWdFoot, exportWdHead } from './headFootExport';

function signalToEntry(
  sig: Signal,
  totalSteps: number,
): WdSignal | Record<string, never> {
  if (sig.type === 'spacer') return {};
  if (sig.type === 'bit') {
    const entry: WdSignal = {
      name: sig.name,
      wave: encodeWaveString(sig.states, sig.stepGaps, sig.stepGlitches),
    };
    if (sig.phase !== undefined) entry.phase = sig.phase;
    if (sig.period !== undefined) entry.period = sig.period;
    if (sig.node !== undefined) entry.node = sig.node;
    return entry;
  }
  const steps = Math.max(
    totalSteps,
    sig.segments.length > 0 ? Math.max(...sig.segments.map((s) => s.endStep)) : 0,
  );
  const { wave, data } = segmentsToWaveAndData(sig.segments, steps);
  const entry: WdSignal = { name: sig.name, wave, data };
  if (sig.node !== undefined) entry.node = sig.node;
  if (sig.phase !== undefined) entry.phase = sig.phase;
  if (sig.period !== undefined) entry.period = sig.period;
  return entry;
}

function toEntry(item: SignalOrGroup, totalSteps: number): WdSignalEntry {
  if (item.type === 'group') {
    const g = item as SignalGroup;
    const children = g.children.map((c) => toEntry(c, totalSteps));
    return [g.name, ...children] as WdGroup;
  }
  return signalToEntry(item, totalSteps);
}

export function toWavedromJSON(diagram: DiagramState): WdRoot {
  const totalSteps = diagram.config.totalSteps;
  const root: WdRoot = {
    signal: diagram.signals.map((s) => toEntry(s, totalSteps)),
    config: { hscale: diagram.config.hscale },
  };
  const head = exportWdHead(diagram.config.head);
  const foot = exportWdFoot(diagram.config.foot);
  if (head) root.head = head;
  if (foot) root.foot = foot;
  const edges = diagram.edges ?? [];
  if (edges.length > 0) {
    root.edge = [...edges];
  }
  return root;
}
