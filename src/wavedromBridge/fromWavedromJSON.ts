import { nanoid } from 'nanoid';
import type {
  DiagramState,
  Signal,
  SignalGroup,
  SignalOrGroup,
  VectorSegment,
} from '../shared/types';
import { DEFAULT_HSCALE, DEFAULT_SIGNAL_COLOR, ROW_HEIGHT } from '../shared/constants';
import {
  decodeWaveDetail,
  isUndulateExtendedDigitalWave,
  padDecodedWaveToLength,
} from './waveStringCodec';
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

/** Authored source length for vectors, kept only during this import pass. */
const vectorAuthoredLengths = new WeakMap<Signal, number>();

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
  // Undulate permits data, impulse, metastability, and scalar logic cells in
  // one digital lane. Keep such lanes wave-canonical instead of coercing the
  // entire row to a WaveDrom vector bus.
  return /[=2-9]/.test(wave) && !isUndulateExtendedDigitalWave(wave);
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
    const sourceData =
      typeof sig.data === 'string'
        ? sig.data.trim().split(/\s+/).filter(Boolean)
        : (sig.data ?? []);
    const rawData = sourceData.map((d) =>
      Array.isArray(d) ? d.map(String) : String(d),
    );
    const totalSteps = wave.length;
    const { segments, stepGaps } = parseVectorSegments(wave, rawData, totalSteps);
    const vector: Signal = {
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
    vectorAuthoredLengths.set(vector, wave.length);
    return vector;
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
    // WaveDrom period multiplies source cells at render time. Keep the
    // authored source-cell sequence independent of another lane's duration.
    if (s.period !== undefined) return;
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
    if (s.type === 'vector') {
      // WaveDrom's `.` continues the previous bus value. When a vector wave
      // is shorter than the longest lane, carry its final segment through the
      // remaining document columns so the canvas and re-export match the
      // WaveDrom interpretation (for example AXI's trailing `x`).
      const lastSegment = s.segments.at(-1);
      const authoredLength = vectorAuthoredLengths.get(s);
      if (
        lastSegment
        && authoredLength !== undefined
        && lastSegment.endStep === authoredLength
        && lastSegment.endStep < totalSteps
      ) {
        lastSegment.endStep = totalSteps;
      }
      if (s.stepGaps?.length) {
        while (s.stepGaps.length < totalSteps) s.stepGaps.push(false);
        if (s.stepGaps.length > totalSteps) s.stepGaps.length = totalSteps;
        if (!s.stepGaps.some(Boolean)) delete s.stepGaps;
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

export interface FromWavedromJSONOptions {
  /**
   * WaveDrom normally extends every row to the longest source wave. Undulate
   * timed rows must retain their native cell counts until periods are applied.
   */
  padSignals?: boolean;
}

export function fromWavedromJSON(
  wd: WdRoot,
  options: FromWavedromJSONOptions = {},
): DiagramState {
  const signals: SignalOrGroup[] = [];
  for (const entry of wd.signal ?? []) {
    const parsed = parseEntry(entry);
    if (parsed) signals.push(parsed);
  }
  const totalSteps = maxSteps(signals);
  if (options.padSignals !== false) {
    padSignals(signals, totalSteps);
  }
  const config = {
    totalSteps,
    hscale: wd.config?.hscale ?? DEFAULT_HSCALE,
    ...(wd.config?.skin ? { skin: wd.config.skin } : {}),
    head: wd.head ?? wd.config?.head,
    foot: wd.foot ?? wd.config?.foot,
  };
  const rawCurveControls = wd['x-waves-gui']?.edgeCurveControls;
  const importMode = wd['x-waves-gui']?.importMode;
  const edgeCurveControls = rawCurveControls
    ? Object.fromEntries(
      Object.entries(rawCurveControls).filter(([index, value]) => (
        /^\d+$/.test(index)
        && value !== null
        && Number.isFinite(value.c1x)
        && Number.isFinite(value.c2x)
        && value.c1x >= 0 && value.c1x <= 1
        && value.c2x >= 0 && value.c2x <= 1
      )),
    )
    : undefined;
  return {
    version: 2,
    compatibility: {
      extensionsEnabled: false,
      sourceFormat: 'wavedrom-json',
      ...(importMode === 'event-compressed-vcd' ? { importMode } : {}),
    },
    signals,
    config,
    annotations: [],
    edges: wd.edge ? [...wd.edge] : [],
    ...(edgeCurveControls && Object.keys(edgeCurveControls).length > 0
      ? { edgeCurveControls }
      : {}),
  };
}
