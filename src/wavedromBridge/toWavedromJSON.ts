import type { DiagramState, Signal, SignalGroup, SignalOrGroup } from '../shared/types';
import { isWaveModeLane, padWaveForDiagram } from './laneWaveOps';
import { encodeWaveStringForDiagram } from './waveStringCodec';
import { segmentsToWaveAndData } from '../shared/vectorSegments';
import type { WdGroup, WdRoot, WdSignal, WdSignalEntry } from './wdTypes';
import { exportWdFoot, exportWdHead } from './headFootExport';

function sourceStepsForExactPeriod(sig: Signal, totalSteps: number): number | undefined {
  if (sig.period === undefined || !Number.isInteger(sig.period) || sig.period < 1) return undefined;
  const sourceSteps = sig.type === 'bit'
    ? sig.states.length
    : sig.type === 'vector'
      ? sig.segments.reduce((end, segment) => Math.max(end, segment.endStep), 0)
      : 0;
  return sourceSteps > 0 && sourceSteps * sig.period === totalSteps ? sourceSteps : undefined;
}

function signalToEntry(
  sig: Signal,
  totalSteps: number,
  hscale: number,
): WdSignal | Record<string, never> {
  if (sig.type === 'spacer') return {};
  if (sig.type === 'analogue') return {};
  if (sig.type === 'bit') {
    const sourceSteps = sourceStepsForExactPeriod(sig, totalSteps);
    const exportSteps = sourceSteps ?? totalSteps;
    const wave = isWaveModeLane(sig)
      ? padWaveForDiagram(sig, exportSteps, hscale)
      : encodeWaveStringForDiagram(
          sig.states,
          exportSteps,
          sig.stepGaps,
          sig.stepGlitches,
        );
    const entry: WdSignal = {
      name: sig.name,
      wave,
    };
    if (sig.phase !== undefined) entry.phase = sig.phase;
    if (sig.period !== undefined) entry.period = sig.period;
    if (sig.node !== undefined) entry.node = sig.node;
    return entry;
  }
  const steps = sourceStepsForExactPeriod(sig, totalSteps) ?? Math.max(
    totalSteps,
    sig.segments.length > 0 ? Math.max(...sig.segments.map((s) => s.endStep)) : 0,
  );
  const { wave, data } = segmentsToWaveAndData(sig.segments, steps, sig.stepGaps);
  const entry: WdSignal = { name: sig.name, wave, data };
  if (sig.node !== undefined) entry.node = sig.node;
  if (sig.phase !== undefined) entry.phase = sig.phase;
  if (sig.period !== undefined) entry.period = sig.period;
  return entry;
}

function toEntry(item: SignalOrGroup, totalSteps: number, hscale: number): WdSignalEntry {
  if (item.type === 'group') {
    const g = item as SignalGroup;
    const children = g.children.map((c) => toEntry(c, totalSteps, hscale));
    return [g.name, ...children] as WdGroup;
  }
  return signalToEntry(item, totalSteps, hscale);
}

export function toWavedromJSON(diagram: DiagramState): WdRoot {
  const totalSteps = diagram.config.totalSteps;
  const hscale = diagram.config.hscale;
  const root: WdRoot = {
    signal: diagram.signals.map((s) => toEntry(s, totalSteps, hscale)),
    config: {
      hscale: diagram.config.hscale,
      ...(diagram.config.skin ? { skin: diagram.config.skin } : {}),
    },
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
