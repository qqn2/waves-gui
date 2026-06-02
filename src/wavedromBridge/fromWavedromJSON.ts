import { nanoid } from 'nanoid';
import type {
  DiagramState,
  Signal,
  SignalGroup,
  SignalOrGroup,
  VectorSegment,
} from '../shared/types';
import { DEFAULT_HSCALE, DEFAULT_SIGNAL_COLOR, ROW_HEIGHT } from '../shared/constants';
import { decodeWaveDetail } from './waveStringCodec';
import { VECTOR_UNKNOWN_LABEL } from '../shared/vectorSegments';
import type { WdGroup, WdRoot, WdSignal, WdSignalEntry } from './wdTypes';

function isGroup(entry: WdSignalEntry): entry is WdGroup {
  return Array.isArray(entry) && typeof entry[0] === 'string';
}

function isBlank(entry: WdSignalEntry): boolean {
  return (
    typeof entry === 'object' &&
    entry !== null &&
    !Array.isArray(entry) &&
    Object.keys(entry).length === 0
  );
}

function isVectorWave(wave: string): boolean {
  return /[=2-9]/.test(wave);
}

function parseVectorSegments(
  wave: string,
  data: string[],
  totalSteps: number,
): VectorSegment[] {
  const segments: VectorSegment[] = [];
  let dataIdx = 0;
  let segStart = 0;
  let segValue = '0';
  const flushSegment = (endStep: number) => {
    if (endStep > segStart) {
      segments.push({
        id: nanoid(),
        startStep: segStart,
        endStep,
        value: segValue,
      });
    }
  };

  for (let i = 0; i < wave.length; i++) {
    const ch = wave[i];
    if (ch === 'x' || ch === 'X') {
      flushSegment(i);
      segments.push({
        id: nanoid(),
        startStep: i,
        endStep: i + 1,
        value: VECTOR_UNKNOWN_LABEL,
      });
      segStart = i + 1;
      continue;
    }
    if (ch !== '.') {
      flushSegment(i);
      segStart = i;
      if (ch === '=' || (ch >= '2' && ch <= '9')) {
        segValue = data[dataIdx++] ?? '';
      } else {
        segValue = '0';
      }
    }
  }
  flushSegment(Math.max(wave.length, totalSteps));

  if (segments.length === 0) {
    segments.push({
      id: nanoid(),
      startStep: 0,
      endStep: totalSteps,
      value: data[0] ?? '0',
    });
  }
  return segments;
}

function parseEntry(entry: WdSignalEntry): SignalOrGroup | null {
  if (isBlank(entry)) {
    return {
      id: nanoid(),
      name: '',
      type: 'spacer',
      states: [],
      segments: [],
      color: DEFAULT_SIGNAL_COLOR,
      rowHeight: ROW_HEIGHT,
    };
  }
  if (isGroup(entry)) {
    const [, ...children] = entry;
    const group: SignalGroup = {
      id: nanoid(),
      name: entry[0],
      type: 'group',
      children: [],
      collapsed: false,
    };
    for (const child of children) {
      const parsed = parseEntry(child);
      if (parsed) group.children.push(parsed);
    }
    return group;
  }
  const sig = entry as WdSignal;
  const wave = sig.wave ?? '0';
  if (isVectorWave(wave)) {
    const totalSteps = wave.length;
    return {
      id: nanoid(),
      name: sig.name ?? 'bus',
      type: 'vector',
      states: [],
      segments: parseVectorSegments(wave, sig.data ?? [], totalSteps),
      color: DEFAULT_SIGNAL_COLOR,
      rowHeight: ROW_HEIGHT,
      phase: sig.phase,
      period: sig.period,
      ...(sig.node !== undefined ? { node: sig.node } : {}),
    };
  }
  const { states, stepGaps } = decodeWaveDetail(wave);
  return {
    id: nanoid(),
    name: sig.name ?? 'sig',
    type: 'bit',
    states,
    segments: [],
    color: DEFAULT_SIGNAL_COLOR,
    rowHeight: ROW_HEIGHT,
    phase: sig.phase,
    period: sig.period,
    ...(stepGaps.some(Boolean) ? { stepGaps } : {}),
    ...(sig.node !== undefined ? { node: sig.node } : {}),
  };
}

function maxSteps(signals: SignalOrGroup[]): number {
  let max = 0;
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else if (item.type === 'bit') max = Math.max(max, item.states.length);
      else if (item.type === 'vector') {
        for (const seg of item.segments) {
          max = Math.max(max, seg.endStep);
        }
      }
    }
  };
  walk(signals);
  return max || 20;
}

function padNode(node: string | undefined, totalSteps: number): string | undefined {
  if (node === undefined) return undefined;
  if (node.length >= totalSteps) return node.slice(0, totalSteps);
  const pad = node.length > 0 ? node[node.length - 1]! : '.';
  return node + pad.repeat(totalSteps - node.length);
}

function padSignals(signals: SignalOrGroup[], totalSteps: number): void {
  const padSignal = (s: Signal) => {
    if (s.node !== undefined) {
      s.node = padNode(s.node, totalSteps);
    }
    if (s.type === 'bit') {
      const last = s.states[s.states.length - 1] ?? '0';
      while (s.states.length < totalSteps) s.states.push(last);
      if (s.states.length > totalSteps) s.states.length = totalSteps;
      if (s.stepGaps) {
        const maxGaps = Math.max(0, s.states.length - 1);
        while (s.stepGaps.length < maxGaps) s.stepGaps.push(false);
        if (s.stepGaps.length > maxGaps) s.stepGaps.length = maxGaps;
        if (!s.stepGaps.some(Boolean)) delete s.stepGaps;
      }
      return;
    }
    if (s.type === 'vector') {
      const lastEnd = s.segments.reduce(
        (m, seg) => Math.max(m, seg.endStep),
        0,
      );
      if (lastEnd < totalSteps) {
        const lastVal =
          s.segments.length > 0
            ? s.segments[s.segments.length - 1].value
            : '0';
        s.segments.push({
          id: nanoid(),
          startStep: lastEnd,
          endStep: totalSteps,
          value: lastVal,
        });
      }
    }
  };
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else padSignal(item);
    }
  };
  walk(signals);
}

export function fromWavedromJSON(wd: WdRoot): DiagramState {
  const signals: SignalOrGroup[] = [];
  for (const entry of wd.signal ?? []) {
    const parsed = parseEntry(entry);
    if (parsed) signals.push(parsed);
  }
  const totalSteps = maxSteps(signals);
  padSignals(signals, totalSteps);
  const config = {
    totalSteps,
    hscale: wd.config?.hscale ?? DEFAULT_HSCALE,
    head: wd.head ?? wd.config?.head,
    foot: wd.foot ?? wd.config?.foot,
  };
  return {
    version: 1,
    signals,
    config,
    edges: wd.edge ? [...wd.edge] : [],
    annotations: [],
  };
}
