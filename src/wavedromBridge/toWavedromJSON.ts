import type { DiagramState, Signal, SignalGroup, SignalOrGroup } from '../shared/types';
import { encodeWaveString } from './waveStringCodec';
import { COLOR_TO_MARKER } from './segmentColors';
import type { WdGroup, WdRoot, WdSignal, WdSignalEntry } from './wdTypes';

function segmentMarker(seg: { color?: string }): string {
  if (seg.color !== undefined) {
    return COLOR_TO_MARKER.get(seg.color) ?? '=';
  }
  return '=';
}

function signalToEntry(sig: Signal): WdSignal | Record<string, never> {
  if (sig.type === 'spacer') return {};
  if (sig.type === 'bit') {
    const entry: WdSignal = {
      name: sig.name,
      wave: encodeWaveString(sig.states),
    };
    if (sig.phase !== undefined) entry.phase = sig.phase;
    if (sig.period !== undefined) entry.period = sig.period;
    if (sig.node !== undefined) entry.node = sig.node;
    return entry;
  }
  const steps =
    sig.segments.length > 0
      ? Math.max(...sig.segments.map((s) => s.endStep))
      : 0;
  let wave = '';
  const data: string[] = [];
  for (let i = 0; i < steps; i++) {
    const seg = sig.segments.find((s) => i >= s.startStep && i < s.endStep);
    if (seg && i === seg.startStep) {
      wave += segmentMarker(seg);
      data.push(seg.value);
    } else {
      wave += '.';
    }
  }
  const entry: WdSignal = { name: sig.name, wave, data };
  if (sig.node !== undefined) entry.node = sig.node;
  if (sig.phase !== undefined) entry.phase = sig.phase;
  if (sig.period !== undefined) entry.period = sig.period;
  return entry;
}

function toEntry(item: SignalOrGroup): WdSignalEntry {
  if (item.type === 'group') {
    const g = item as SignalGroup;
    const children = g.children.map(toEntry);
    return [g.name, ...children] as WdGroup;
  }
  return signalToEntry(item);
}

export function toWavedromJSON(diagram: DiagramState): WdRoot {
  const root: WdRoot = {
    signal: diagram.signals.map(toEntry),
    config: {
      hscale: diagram.config.hscale,
      head: diagram.config.head,
      foot: diagram.config.foot,
    },
  };
  if (root.config?.head === undefined) delete root.config?.head;
  if (root.config?.foot === undefined) delete root.config?.foot;
  if (diagram.edges.length > 0) {
    root.edge = [...diagram.edges];
  }
  return root;
}
