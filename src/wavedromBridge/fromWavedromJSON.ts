import { nanoid } from 'nanoid';
import type {
  DiagramState,
  Signal,
  SignalGroup,
  SignalOrGroup,
  VectorSegment,
} from '../shared/types';
import { DEFAULT_HSCALE, DEFAULT_SIGNAL_COLOR, ROW_HEIGHT } from '../shared/constants';
import { decodeWaveDetail, padDecodedWaveToLength } from './waveStringCodec';
import { fillHexForWaveChar } from '../shared/vectorSegments';
import { VECTOR_UNKNOWN_LABEL } from '../shared/vectorSegments';
import {
  bitLaneStepCount,
  isWaveModeLane,
  padWaveLaneToLength,
  shouldImportAsWaveMode,
} from './laneWaveOps';
import { hasSubcycleSyntax, waveColumnCount } from './subcycleWave';
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

function normalizeDataLabel(entry: string | string[]): string {
  if (Array.isArray(entry)) return entry.map(String).join('\n');
  return String(entry);
}

function parseVectorSegments(
  wave: string,
  data: Array<string | string[]>,
  totalSteps: number,
): { segments: VectorSegment[]; stepGaps: boolean[] } {
  const segments: VectorSegment[] = [];
  const stepGaps: boolean[] = [];
  let dataIdx = 0;

  let segStart = 0;
  let segValue: string | null = null;
  let segColor: string | undefined;
  const flushSegment = (endStep: number) => {
    if (endStep > segStart && segValue !== null) {
      segments.push({
        id: nanoid(),
        startStep: segStart,
        endStep,
        value: segValue,
        ...(segColor !== undefined ? { color: segColor } : {}),
      });
    }
  };

  for (let i = 0; i < wave.length; i++) {
    const ch = wave[i];
    if (ch === '|') {
      stepGaps[i] = true;
      continue;
    }
    if (ch === '.') {
      continue;
    }
    if (ch === 'x' || ch === 'X') {
      flushSegment(i);
      segStart = i;
      segValue = VECTOR_UNKNOWN_LABEL;
      segColor = undefined;
      continue;
    }
    if (ch !== '.') {
      flushSegment(i);
      segStart = i;
      segColor = fillHexForWaveChar(ch);
      if (ch === '=' || (ch >= '2' && ch <= '9')) {
        segValue = normalizeDataLabel(data[dataIdx++] ?? '');
      } else {
        segStart = i + 1;
        segValue = null;
        segColor = undefined;
        continue;
      }
    }
  }
  flushSegment(Math.max(wave.length, totalSteps));

  if (segments.length === 0) {
    segments.push({
      id: nanoid(),
      startStep: 0,
      endStep: totalSteps,
      value: normalizeDataLabel(data[0] ?? ''),
    });
  }
  return { segments, stepGaps };
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
    const rawData = (sig.data ?? []).map((d) =>
      Array.isArray(d) ? d.map(String) : String(d),
    );
    const totalSteps = wave.length;
    const { segments, stepGaps } = parseVectorSegments(wave, rawData, totalSteps);
    return {
      id: nanoid(),
      name: sig.name ?? 'bus',
      type: 'vector',
      states: [],
      segments,
      color: DEFAULT_SIGNAL_COLOR,
      rowHeight: ROW_HEIGHT,
      phase: sig.phase,
      period: sig.period,
      ...(stepGaps.some(Boolean) ? { stepGaps } : {}),
      ...(sig.node !== undefined ? { node: sig.node } : {}),
    };
  }
  const { states, stepGaps, stepGlitches } = decodeWaveDetail(wave);
  const waveMode = shouldImportAsWaveMode(wave);
  const columnSteps = hasSubcycleSyntax(wave)
    ? waveColumnCount(wave, sig.period ?? 1, DEFAULT_HSCALE)
    : states.length;
  return {
    id: nanoid(),
    name: sig.name ?? 'sig',
    type: 'bit',
    states: states.length > 0 ? states : Array(columnSteps).fill('0' as const),
    segments: [],
    color: DEFAULT_SIGNAL_COLOR,
    rowHeight: ROW_HEIGHT,
    phase: sig.phase,
    period: sig.period,
    ...(waveMode ? { laneMode: 'wave' as const, wave } : {}),
    ...(stepGaps.some(Boolean) ? { stepGaps } : {}),
    ...(stepGlitches.some(Boolean) ? { stepGlitches } : {}),
    ...(sig.node !== undefined ? { node: sig.node } : {}),
  };
}

function maxSteps(signals: SignalOrGroup[]): number {
  let max = 0;
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else if (item.type === 'bit') {
        const len = bitLaneStepCount(item, DEFAULT_HSCALE);
        max = Math.max(max, len);
      } else if (item.type === 'vector') {
        max = Math.max(max, item.stepGaps?.length ?? 0);
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
      if (isWaveModeLane(s)) {
        padWaveLaneToLength(s, totalSteps, DEFAULT_HSCALE);
        return;
      }
      const padded = padDecodedWaveToLength(
        {
          states: s.states,
          stepGaps: s.stepGaps ?? [],
          stepGlitches: s.stepGlitches ?? [],
        },
        totalSteps,
      );
      s.states = padded.states;
      if (padded.stepGaps.some(Boolean)) s.stepGaps = padded.stepGaps;
      else delete s.stepGaps;
      if (padded.stepGlitches.some(Boolean)) s.stepGlitches = padded.stepGlitches;
      else delete s.stepGlitches;
      if (s.stepGaps) {
        while (s.stepGaps.length < s.states.length) s.stepGaps.push(false);
        if (s.stepGaps.length > s.states.length) s.stepGaps.length = s.states.length;
        if (!s.stepGaps.some(Boolean)) delete s.stepGaps;
      }
      const maxBoundaries = Math.max(0, s.states.length - 1);
      if (s.stepGlitches) {
        while (s.stepGlitches.length < maxBoundaries) s.stepGlitches.push(false);
        if (s.stepGlitches.length > maxBoundaries) s.stepGlitches.length = maxBoundaries;
        if (!s.stepGlitches.some(Boolean)) delete s.stepGlitches;
      }
      return;
    }
    if (s.type === 'vector' && s.stepGaps?.length) {
      while (s.stepGaps.length < totalSteps) s.stepGaps.push(false);
      if (s.stepGaps.length > totalSteps) s.stepGaps.length = totalSteps;
      if (!s.stepGaps.some(Boolean)) delete s.stepGaps;
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
    ...(wd.config?.skin ? { skin: wd.config.skin } : {}),
    head: wd.head ?? wd.config?.head,
    foot: wd.foot ?? wd.config?.foot,
  };
  return {
    version: 1,
    signals,
    config,
    edges: wd.edge ? [...wd.edge] : [],
  };
}
