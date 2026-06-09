import type { DiagramState, Signal, SignalGroup, SignalOrGroup } from '../shared/types';
import { encodeWaveStringForDiagram } from './waveStringCodec';
import { padWaveOverride } from './subcycleWave';
import { segmentsToWaveAndData } from '../shared/vectorSegments';
import type { WdGroup, WdRoot, WdSignal, WdSignalEntry } from './wdTypes';
import { exportWdFoot, exportWdHead } from './headFootExport';

function signalToEntry(
  sig: Signal,
  totalSteps: number,
  hscale: number,
): WdSignal | Record<string, never> {
  if (sig.type === 'spacer') return {};
  if (sig.type === 'bit') {
    const wave =
      sig.waveOverride !== undefined
        ? padWaveOverride(
            sig.waveOverride,
            totalSteps,
            sig.period ?? 1,
            hscale,
          )
        : encodeWaveStringForDiagram(
            sig.states,
            totalSteps,
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
