import { current } from 'immer';
import { nanoid } from 'nanoid';
import { cancelPendingCodeToDiagramDebounce } from '../../codePanel/flushRegistry';
import {
  allocateNodeChars,
  findSignalInDiagram,
  formatArrowEdge,
  nodeSlotCount,
  pruneUnusedNodeAnchorsAfterEdgeRemoval,
  setNodeCharAt,
  visibleNodeCharAt,
} from '../../wavedromBridge/nodeString';
import { demoteToStatesMode, isWaveModeLane } from '../../wavedromBridge/laneWaveOps';
import { timingCellDuration } from '../timedStepResize';
import type {
  AppState,
  BitState,
  DiagramAnnotation,
  DiagramState,
  EdgeAnchorPending,
  PaintDraft,
  Signal,
  SignalOrGroup,
} from '../types';
import { normalizeDiagram } from '../normalizeDiagram';
import type { ImmerSet, StoreActions } from './storeActions';
import {
  diagramsEqual,
  findSignal,
  markDiagramChanged,
  pushHistory,
} from './helpers';
import { parseUndulateEdge } from '../edgeSyntax';
import {
  MAX_ANNOTATIONS,
  normalizeArrowAnnotation,
} from '../annotations';
import { canRescaleDiagramTiming, rescaleDiagramTiming } from '../fineTiming';
import { toolState } from '../../tools/toolState';

function resetTransientDocumentView(s: AppState & StoreActions): void {
  s.view.scrollX = 0;
  s.view.scrollY = 0;
  s.view.collapsedGroupIds = [];
  s.view.paintDraft = null;
  s.view.edgeAnchorPending = null;
  s.view.structuredArrowPending = null;
  s.view.edgeToolHover = null;
  s.view.activeSignalIds = [];
  s.view.activeAnnotationId = null;
  s.view.activeTimingCellIndex = null;
  toolState.cancelAll();
}

function disableExtensionView(s: AppState & StoreActions): void {
  s.view.activeAnnotationId = null;
  s.view.activeSignalIds = [];
  s.view.structuredArrowPending = null;
  if (
    s.view.activeBitState === 'i'
    || s.view.activeBitState === 'I'
    || s.view.activeBitState === 'm'
    || s.view.activeBitState === 'M'
    || s.view.activeBitState === 'h'
    || s.view.activeBitState === 'H'
    || s.view.activeBitState === 'l'
    || s.view.activeBitState === 'L'
  ) {
    s.view.activeBitState = '1';
  }
  if (
    s.view.selectedTool === 'analogue-paint'
    || s.view.selectedTool === 'annotation'
    || s.view.selectedTool === 'vertical-line'
    || s.view.selectedTool === 'horizontal-line'
    || s.view.selectedTool === 'global-compression'
    || s.view.selectedTool === 'structured-arrow'
  ) {
    s.view.selectedTool = 'cursor';
  }
}

function removeAnalogueSignals(signals: SignalOrGroup[]): SignalOrGroup[] {
  const remaining: SignalOrGroup[] = [];
  for (const signal of signals) {
    if (signal.type === 'analogue') continue;
    if (signal.type !== 'group') {
      remaining.push(signal);
      continue;
    }
    const children = removeAnalogueSignals(signal.children);
    if (children.length > 0) remaining.push({ ...signal, children });
  }
  return remaining;
}

const WAVEDROM_BIT_STATE_APPROXIMATIONS: Partial<Record<BitState, BitState>> = {
  X: 'x',
  '=': 'x',
  '2': 'x',
  '3': 'x',
  '4': 'x',
  '5': 'x',
  '6': 'x',
  '7': 'x',
  '8': 'x',
  '9': 'x',
  i: '0',
  I: '1',
  m: '0',
  M: '1',
  h: '1',
  H: '1',
  l: '0',
  L: '0',
};

function wavedromBitState(state: BitState): BitState {
  return WAVEDROM_BIT_STATE_APPROXIMATIONS[state] ?? state;
}

function removeExtendedDigitalStates(signals: SignalOrGroup[]): void {
  for (const signal of signals) {
    if (signal.type === 'group') {
      removeExtendedDigitalStates(signal.children);
      continue;
    }
    if (signal.type !== 'bit') continue;
    if (signal.states.some((state) => wavedromBitState(state) !== state)) {
      demoteToStatesMode(signal, signal.states.length);
      signal.states = signal.states.map(wavedromBitState);
    }
    if (signal.digitalTiming) {
      for (const cell of signal.digitalTiming.cells) {
        cell.state = wavedromBitState(cell.state);
      }
    }
    delete signal.undulateRepeat;
  }
}

function timingCellAtTick(
  timing: NonNullable<Signal['digitalTiming'] | Signal['vectorTiming']>,
  tick: number,
): number {
  const target = Math.max(0, Math.min(Math.max(0, timingCellDuration(timing) - 1), tick));
  let cursor = 0;
  for (let index = 0; index < timing.cells.length; index++) {
    cursor += timing.cells[index]!.durationTicks;
    if (target < cursor) return index;
  }
  return Math.max(0, timing.cells.length - 1);
}

function removeDigitalTiming(signals: SignalOrGroup[], totalSteps: number): void {
  for (const signal of signals) {
    if (signal.type === 'group') {
      removeDigitalTiming(signal.children, totalSteps);
      continue;
    }
    const timing = signal.digitalTiming ?? signal.vectorTiming;
    if (!timing) continue;
    const firstDuration = timing.cells[0]?.durationTicks;
    const uniformDuration = firstDuration !== undefined
      && timing.cells.every((cell) => cell.durationTicks === firstDuration);
    const exactIntegerPeriod = uniformDuration
      && firstDuration % timing.ticksPerStep === 0
      ? firstDuration / timing.ticksPerStep
      : null;
    const hasNonDefaultDuty = timing.cells.some((cell) => (
      cell.dutyTicks !== undefined
      && cell.dutyTicks * 2 !== cell.durationTicks
    ));
    const hasSlew = timing.slewing !== undefined && timing.slewing !== 0;
    const representable = exactIntegerPeriod !== null
      && exactIntegerPeriod >= 1
      && !hasNonDefaultDuty
      && !hasSlew;
    if (representable) {
      signal.period = exactIntegerPeriod;
      const phase = timing.phaseTicks / timing.ticksPerStep;
      if (phase === 0) delete signal.phase;
      else signal.phase = phase;
      // A uniform native lane is already exactly representable by its source
      // cells plus WaveDrom period/phase. Keep that compact representation;
      // resampling it would apply period and phase a second time on export.
      if (signal.type === 'bit' && signal.digitalTiming) {
        signal.states = signal.digitalTiming.cells.map((cell) => cell.state);
        if (isWaveModeLane(signal)) demoteToStatesMode(signal, signal.states.length);
      }
      delete signal.digitalTiming;
      delete signal.vectorTiming;
      continue;
    }

    // Non-uniform/fractional timing has no exact WaveDrom representation.
    // Samples below already include the native phase, so do not retain either
    // field and accidentally apply it again during export.
    delete signal.period;
    delete signal.phase;

    // Native cells can be finer than the document grid. Resample their
    // visible values at each major-column boundary before dropping timing.
    const targetSteps = Math.max(1, totalSteps);
    const sampled = Array.from({ length: targetSteps }, (_, step) =>
      timingCellAtTick(
        timing,
        step * timing.ticksPerStep + timing.phaseTicks,
      ));
    if (signal.type === 'bit' && signal.digitalTiming) {
      signal.states = sampled.map((index) => signal.digitalTiming!.cells[index]!.state);
      if (isWaveModeLane(signal)) {
        demoteToStatesMode(signal, targetSteps);
      }
    } else if (signal.type === 'vector' && signal.vectorTiming) {
      const sourceSegments = signal.segments;
      const nextSegments: Signal['segments'] = [];
      for (let step = 0; step < targetSteps; step++) {
        const sourceIndex = sampled[step]!;
        const source = sourceSegments.find(
          (segment) => segment.startStep <= sourceIndex && segment.endStep > sourceIndex,
        );
        const value = source?.value ?? '';
        const previous = nextSegments.at(-1);
        if (previous && previous.value === value && previous.endStep === step) {
          previous.endStep += 1;
        } else {
          nextSegments.push({
            id: nanoid(),
            startStep: step,
            endStep: step + 1,
            value,
          });
        }
      }
      signal.segments = nextSegments;
      delete signal.stepGaps;
    }
    delete signal.digitalTiming;
    delete signal.vectorTiming;
  }
}

function removeExpandedNodes(signals: SignalOrGroup[]): Set<string> {
  const removed = new Set<string>();
  const walk = (items: SignalOrGroup[]) => {
    for (const signal of items) {
      if (signal.type === 'group') {
        walk(signal.children);
        continue;
      }
      for (const name of Object.values(signal.nodeNames ?? {})) {
        removed.add(name);
      }
      delete signal.nodeNames;
    }
  };
  walk(signals);
  return removed;
}

interface SignalSelectionIdentity {
  id: string;
  name: string;
  type: Signal['type'];
  path: number[];
}

function findSignalSelectionIdentity(
  signals: SignalOrGroup[],
  id: string,
  parentPath: number[] = [],
): SignalSelectionIdentity | null {
  for (let index = 0; index < signals.length; index++) {
    const item = signals[index]!;
    const path = [...parentPath, index];
    if (item.type === 'group') {
      const nested = findSignalSelectionIdentity(item.children, id, path);
      if (nested) return nested;
    } else if (item.id === id) {
      return { id, name: item.name, type: item.type, path };
    }
  }
  return null;
}

function signalAtPath(
  signals: SignalOrGroup[],
  path: number[],
): Signal | null {
  let level = signals;
  for (let depth = 0; depth < path.length; depth++) {
    const item = level[path[depth]!];
    if (!item) return null;
    if (depth === path.length - 1) return item.type === 'group' ? null : item;
    if (item.type !== 'group') return null;
    level = item.children;
  }
  return null;
}

function collectMatchingSignals(
  signals: SignalOrGroup[],
  identity: SignalSelectionIdentity,
  requireSameName: boolean,
  matches: Signal[] = [],
): Signal[] {
  for (const item of signals) {
    if (item.type === 'group') {
      collectMatchingSignals(item.children, identity, requireSameName, matches);
    } else if (
      item.type === identity.type
      && (!requireSameName || item.name === identity.name)
    ) {
      matches.push(item);
    }
  }
  return matches;
}

function reconcileSignalSelection(
  previousSignals: SignalOrGroup[],
  nextSignals: SignalOrGroup[],
  activeIds: string[],
): string[] {
  const reconciled = activeIds.flatMap((id) => {
    let sameId: Signal | null = null;
    findSignal(nextSignals, id, (signal) => { sameId = signal; });
    if (sameId) return [sameId.id];

    const identity = findSignalSelectionIdentity(previousSignals, id);
    if (!identity) return [];
    const samePath = signalAtPath(nextSignals, identity.path);
    if (samePath?.type === identity.type) return [samePath.id];

    const sameNameAndType = collectMatchingSignals(nextSignals, identity, true);
    if (sameNameAndType.length === 1) return [sameNameAndType[0]!.id];
    const onlySignalOfType = collectMatchingSignals(nextSignals, identity, false);
    return onlySignalOfType.length === 1 ? [onlySignalOfType[0]!.id] : [];
  });
  return [...new Set(reconciled)];
}

interface PreservedIdMapping {
  signalIds: Map<string, string>;
  segmentIds: Map<string, string>;
  annotationIds: Map<string, string>;
  overlayGroupIds: Map<string, string>;
}

function withoutIds(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(withoutIds);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'id')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, withoutIds(item)]),
  );
}

function matchUniqueFingerprints(
  previous: SignalOrGroup[],
  next: SignalOrGroup[],
  used: Set<string>,
  matches: Map<SignalOrGroup, SignalOrGroup>,
): void {
  const oldBuckets = new Map<string, SignalOrGroup[]>();
  const nextBuckets = new Map<string, SignalOrGroup[]>();
  previous.forEach((item) => {
    const key = JSON.stringify(withoutIds(item));
    const bucket = oldBuckets.get(key) ?? [];
    bucket.push(item);
    oldBuckets.set(key, bucket);
  });
  next.forEach((item) => {
    if (matches.has(item)) return;
    const key = JSON.stringify(withoutIds(item));
    const bucket = nextBuckets.get(key) ?? [];
    bucket.push(item);
    nextBuckets.set(key, bucket);
  });
  nextBuckets.forEach((items, key) => {
    const candidates = (oldBuckets.get(key) ?? []).filter((item) => !used.has(item.id));
    if (items.length !== 1 || candidates.length !== 1) return;
    matches.set(items[0]!, candidates[0]!);
  });
}

function preserveSignalIds(
  previous: SignalOrGroup[],
  next: SignalOrGroup[],
): PreservedIdMapping {
  const used = new Set<string>();
  const mapping: PreservedIdMapping = {
    signalIds: new Map(),
    segmentIds: new Map(),
    annotationIds: new Map(),
    overlayGroupIds: new Map(),
  };
  const matchLevel = (oldItems: SignalOrGroup[], nextItems: SignalOrGroup[]) => {
    const exact = new Map<string, SignalOrGroup[]>();
    const nextCounts = new Map<string, number>();
    oldItems.forEach((item) => {
      const key = `${item.type}:${item.name}`;
      const bucket = exact.get(key) ?? [];
      bucket.push(item);
      exact.set(key, bucket);
    });
    nextItems.forEach((item) => {
      const key = `${item.type}:${item.name}`;
      nextCounts.set(key, (nextCounts.get(key) ?? 0) + 1);
    });

    const matches = new Map<SignalOrGroup, SignalOrGroup>();
    nextItems.forEach((item) => {
      const bucket = exact.get(`${item.type}:${item.name}`) ?? [];
      if (bucket.length !== 1 || nextCounts.get(`${item.type}:${item.name}`) !== 1) return;
      const candidate = bucket[0];
      if (!candidate || used.has(candidate.id)) return;
      used.add(candidate.id);
      matches.set(item, candidate);
    });
    matchUniqueFingerprints(oldItems, nextItems, used, matches);
    matches.forEach((candidate) => used.add(candidate.id));
    nextItems.forEach((item, index) => {
      if (matches.has(item)) return;
      const candidate = oldItems[index];
      const itemKey = `${item.type}:${item.name}`;
      const candidateKey = candidate ? `${candidate.type}:${candidate.name}` : '';
      if (
        !candidate
        || candidate.type !== item.type
        || used.has(candidate.id)
        || (exact.get(candidateKey)?.length ?? 0) !== 1
        || nextCounts.get(itemKey) !== 1
      ) return;
      used.add(candidate.id);
      matches.set(item, candidate);
    });

    nextItems.forEach((item) => {
      const candidate = matches.get(item);
      if (!candidate) return;
      mapping.signalIds.set(item.id, candidate.id);
      item.id = candidate.id;
      if (item.type === 'group' && candidate.type === 'group') {
        matchLevel(candidate.children, item.children);
      } else if (item.type === 'vector' && candidate.type === 'vector') {
        preserveVectorSegmentIds(candidate, item, mapping);
      }
    });
  };
  matchLevel(previous, next);
  return mapping;
}

function preserveVectorSegmentIds(
  previous: Signal,
  next: Signal,
  mapping: PreservedIdMapping,
): void {
  if (previous.type !== 'vector' || next.type !== 'vector') return;
  const used = new Set<string>();
  next.segments.forEach((segment, index) => {
    const exact = previous.segments.find((candidate) => (
      !used.has(candidate.id)
      && candidate.startStep === segment.startStep
      && candidate.endStep === segment.endStep
      && candidate.value === segment.value
    ));
    const fallback = previous.segments[index];
    const candidate = exact ?? (
      fallback && !used.has(fallback.id) ? fallback : undefined
    );
    if (!candidate) return;
    used.add(candidate.id);
    mapping.segmentIds.set(segment.id, candidate.id);
    segment.id = candidate.id;
  });
}

function preserveAnnotationIds(
  previous: DiagramAnnotation[] | undefined,
  next: DiagramAnnotation[] | undefined,
  mapping: PreservedIdMapping,
): void {
  if (!previous || !next) return;
  const used = new Set<string>();
  const oldByKey = new Map<string, DiagramAnnotation[]>();
  const nextByKey = new Map<string, DiagramAnnotation[]>();
  const oldByFingerprint = new Map<string, DiagramAnnotation[]>();
  const nextByFingerprint = new Map<string, DiagramAnnotation[]>();
  const keyFor = (annotation: DiagramAnnotation) => `${annotation.type}:${
    'tick' in annotation ? annotation.tick ?? '' : ''}`;
  const add = (map: Map<string, DiagramAnnotation[]>, key: string, item: DiagramAnnotation) => {
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  };
  previous.forEach((annotation) => {
    add(oldByKey, keyFor(annotation), annotation);
    add(oldByFingerprint, JSON.stringify(withoutIds(annotation)), annotation);
  });
  next.forEach((annotation) => {
    add(nextByKey, keyFor(annotation), annotation);
    add(nextByFingerprint, JSON.stringify(withoutIds(annotation)), annotation);
  });
  const matches = new Map<DiagramAnnotation, DiagramAnnotation>();
  nextByKey.forEach((items, key) => {
    const candidates = oldByKey.get(key) ?? [];
    if (items.length !== 1 || candidates.length !== 1) return;
    matches.set(items[0]!, candidates[0]!);
  });
  nextByFingerprint.forEach((items, key) => {
    const candidates = (oldByFingerprint.get(key) ?? []).filter(
      (annotation) => ![...matches.values()].includes(annotation),
    );
    if (items.length !== 1 || candidates.length !== 1 || matches.has(items[0]!)) return;
    matches.set(items[0]!, candidates[0]!);
  });
  const oldByType = new Map<string, DiagramAnnotation[]>();
  const nextByType = new Map<string, DiagramAnnotation[]>();
  previous.forEach((annotation) => add(oldByType, annotation.type, annotation));
  next.forEach((annotation) => add(nextByType, annotation.type, annotation));
  next.forEach((annotation) => {
    const uniqueTypeMatch = oldByType.get(annotation.type)?.length === 1
      && nextByType.get(annotation.type)?.length === 1
      ? oldByType.get(annotation.type)?.[0]
      : undefined;
    const candidate = matches.get(annotation) ?? uniqueTypeMatch;
    if (!candidate) return;
    if (used.has(candidate.id)) return;
    used.add(candidate.id);
    mapping.annotationIds.set(annotation.id, candidate.id);
    annotation.id = candidate.id;
  });
}

function preserveOverlayGroupIds(
  previous: DiagramState['analogueOverlayGroups'],
  next: DiagramState['analogueOverlayGroups'],
  signalIds: Map<string, string>,
  mapping: PreservedIdMapping,
): void {
  if (!previous || !next) return;
  const used = new Set<string>();
  next.forEach((group) => {
    group.signalIds = group.signalIds.map((id) => signalIds.get(id) ?? id);
    const candidate = previous.find((old) => (
      !used.has(old.id)
      && old.name === group.name
      && old.signalIds.length === group.signalIds.length
      && old.signalIds.every((id, index) => id === group.signalIds[index])
    )) ?? previous.find((old) => (
      !used.has(old.id)
      && old.signalIds.length === group.signalIds.length
      && old.signalIds.every((id, index) => id === group.signalIds[index])
    ));
    if (!candidate) return;
    used.add(candidate.id);
    mapping.overlayGroupIds.set(group.id, candidate.id);
    group.id = candidate.id;
  });
}

function remapOpaqueRecords(
  records: Record<string, Record<string, unknown>> | undefined,
  mapping: Map<string, string>,
): Record<string, Record<string, unknown>> | undefined {
  if (!records) return records;
  return Object.fromEntries(
    Object.entries(records).map(([id, value]) => [mapping.get(id) ?? id, value]),
  );
}

function collectGroupIds(signals: SignalOrGroup[]): Set<string> {
  const ids = new Set<string>();
  const walk = (items: SignalOrGroup[]) => {
    items.forEach((item) => {
      if (item.type !== 'group') return;
      ids.add(item.id);
      walk(item.children);
    });
  };
  walk(signals);
  return ids;
}

export function createEdgeActions(set: ImmerSet): Pick<
  StoreActions,
  | 'addDiagramEdge'
  | 'addDiagramArrow'
  | 'updateDiagramEdge'
  | 'promoteDiagramEdgeToAnnotation'
  | 'removeDiagramEdge'
  | 'setEdgeCurveControl'
  | 'setActiveEdgeConnector'
  | 'setShowAnchorLetters'
  | 'setEdgeAnchorPending'
> {
  return {
    addDiagramEdge(edge) {
      set((s) => {
        pushHistory(s);
        if (!s.diagram.edges) s.diagram.edges = [];
        s.diagram.edges.push(edge);
        s.view.isDirty = true;
      });
    },

    addDiagramArrow(from, to, connector = '->', label) {
      set((s) => {
        if (
          from.signalId === to.signalId
          && from.step === to.step
        ) return;

        const fromSignal = findSignalInDiagram(s.diagram, from.signalId);
        const toSignal = findSignalInDiagram(s.diagram, to.signalId);
        if (!fromSignal || !toSignal) return;
        if (fromSignal.type === 'spacer' || toSignal.type === 'spacer') return;

        const totalSteps = s.diagram.config.totalSteps;
        const fromSlots = nodeSlotCount(fromSignal, totalSteps);
        const toSlots = nodeSlotCount(toSignal, totalSteps);
        if (
          from.step < 0
          || from.step >= fromSlots
          || to.step < 0
          || to.step >= toSlots
        ) return;

        const existingFrom = visibleNodeCharAt(fromSignal, from.step, totalSteps);
        const existingTo = visibleNodeCharAt(toSignal, to.step, totalSteps);
        const missingCount = Number(existingFrom === null) + Number(existingTo === null);
        const allocated = allocateNodeChars(current(s.diagram), missingCount);
        if (allocated.length !== missingCount) return;

        let nextAllocated = 0;
        const fromChar = existingFrom ?? allocated[nextAllocated++]!;
        const toChar = existingTo ?? allocated[nextAllocated++]!;
        if (fromChar === toChar) return;

        pushHistory(s);
        if (!existingFrom) setNodeCharAt(fromSignal, from.step, fromChar, totalSteps);
        if (!existingTo) setNodeCharAt(toSignal, to.step, toChar, totalSteps);
        if (!s.diagram.edges) s.diagram.edges = [];
        s.diagram.edges.push(formatArrowEdge(fromChar, toChar, label, connector));
        s.view.isDirty = true;
      });
    },

    updateDiagramEdge(index, edge) {
      set((s) => {
        if (!s.diagram.edges?.[index]) return;
        pushHistory(s);
        s.diagram.edges[index] = edge;
        s.view.isDirty = true;
      });
    },

    promoteDiagramEdgeToAnnotation(index) {
      let annotationId: string | null = null;
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        const source = s.diagram.edges?.[index];
        if (!source) return;
        const parsed = parseUndulateEdge(source);
        if (!parsed) return;
        const annotations = s.diagram.annotations ?? [];
        if (annotations.length >= MAX_ANNOTATIONS) return;
        const id = nanoid();
        const annotation = normalizeArrowAnnotation({
          id,
          type: 'arrow',
          shape: parsed.connector,
          from: { kind: 'node', node: parsed.from },
          to: { kind: 'node', node: parsed.to },
          ...(parsed.label ? { text: parsed.label } : {}),
        });
        if (!annotation) return;

        pushHistory(s);
        s.diagram.annotations = annotations;
        s.diagram.annotations.push(annotation);
        s.diagram.edges.splice(index, 1);
        if (s.diagram.edgeCurveControls) {
          const next: Record<number, { c1x: number; c2x: number }> = {};
          for (const [key, value] of Object.entries(s.diagram.edgeCurveControls)) {
            const edgeIndex = Number(key);
            if (edgeIndex < index) next[edgeIndex] = value;
            else if (edgeIndex > index) next[edgeIndex - 1] = value;
          }
          s.diagram.edgeCurveControls = Object.keys(next).length > 0
            ? next
            : undefined;
        }
        s.view.activeSignalIds = [];
        s.view.activeAnnotationId = id;
        s.view.isDirty = true;
        annotationId = id;
      });
      return annotationId;
    },

    removeDiagramEdge(index) {
      set((s) => {
        if (!s.diagram.edges?.[index]) return;
        pushHistory(s);
        const removed = s.diagram.edges[index]!;
        s.diagram.edges.splice(index, 1);
        pruneUnusedNodeAnchorsAfterEdgeRemoval(s.diagram, removed);
        if (s.diagram.edgeCurveControls) {
          const next: Record<number, { c1x: number; c2x: number }> = {};
          for (const [k, v] of Object.entries(s.diagram.edgeCurveControls)) {
            const i = Number(k);
            if (i < index) next[i] = v;
            else if (i > index) next[i - 1] = v;
          }
          s.diagram.edgeCurveControls = Object.keys(next).length > 0 ? next : undefined;
        }
        s.view.isDirty = true;
      });
    },

    setEdgeCurveControl(index, control, options) {
      set((s) => {
        if (!s.diagram.edges?.[index]) return;
        if (options?.recordHistory !== false) pushHistory(s);
        else markDiagramChanged(s);
        if (!s.diagram.edgeCurveControls) s.diagram.edgeCurveControls = {};
        if (control === undefined) {
          delete s.diagram.edgeCurveControls[index];
          if (Object.keys(s.diagram.edgeCurveControls).length === 0) {
            delete s.diagram.edgeCurveControls;
          }
        } else {
          s.diagram.edgeCurveControls[index] = control;
        }
        s.view.isDirty = true;
      });
    },

    setActiveEdgeConnector(connector) {
      set((s) => {
        s.view.activeEdgeConnector = connector;
      });
    },

    setShowAnchorLetters(show) {
      set((s) => {
        s.view.showAnchorLetters = show;
      });
    },

    setEdgeAnchorPending(pending: EdgeAnchorPending | null) {
      set((s) => {
        s.view.edgeAnchorPending = pending;
      });
    },
  };
}

export function createDocumentActions(set: ImmerSet): Pick<
  StoreActions,
  | 'loadDiagram'
  | 'restoreDraft'
  | 'applyDiagramEdit'
  | 'clearAll'
  | 'setExtensionsEnabled'
  | 'setTicksPerStep'
  | 'removeUndulateFeatures'
  | 'markClean'
  | 'undo'
  | 'redo'
  | 'setPaintDraft'
  | 'clearPaintDraft'
> {
  return {
    loadDiagram(diagram: DiagramState) {
      cancelPendingCodeToDiagramDebounce();
      set((s) => {
        const normalized = normalizeDiagram(diagram);
        s.view.diagramRevision += 1;
        s.history = [];
        s.future = [];
        s.diagram = normalized;
        s.savedDiagram = normalizeDiagram(normalized);
        s.view.isDirty = false;
        s.view.sourceDraftDirty = false;
        s.view.sourceDraft = null;
        s.view.sourceDraftError = null;
        resetTransientDocumentView(s);
      });
    },

    restoreDraft(diagram: DiagramState) {
      cancelPendingCodeToDiagramDebounce();
      set((s) => {
        s.view.diagramRevision += 1;
        s.history = [];
        s.future = [];
        s.diagram = normalizeDiagram(diagram);
        s.view.sourceDraftDirty = false;
        s.view.sourceDraft = null;
        s.view.sourceDraftError = null;
        resetTransientDocumentView(s);
      });
    },

    applyDiagramEdit(diagram: DiagramState) {
      set((s) => {
        const normalized = normalizeDiagram(diagram);
        const preservedIds = preserveSignalIds(s.diagram.signals, normalized.signals);
        preserveAnnotationIds(s.diagram.annotations, normalized.annotations, preservedIds);
        preserveOverlayGroupIds(
          s.diagram.analogueOverlayGroups,
          normalized.analogueOverlayGroups,
          preservedIds.signalIds,
          preservedIds,
        );
        if (normalized.compatibility?.opaqueUndulate) {
          normalized.compatibility.opaqueUndulate.signals = remapOpaqueRecords(
            normalized.compatibility.opaqueUndulate.signals,
            preservedIds.signalIds,
          );
          normalized.compatibility.opaqueUndulate.annotations = remapOpaqueRecords(
            normalized.compatibility.opaqueUndulate.annotations,
            preservedIds.annotationIds,
          );
        }
        if (normalized.analogueOverlayGroups) {
          normalized.analogueOverlayGroups = normalized.analogueOverlayGroups.map((group) => ({
            ...group,
            id: preservedIds.overlayGroupIds.get(group.id) ?? group.id,
          }));
        }
        if (diagramsEqual(current(s.diagram), normalized)) return;
        const activeSignalIds = reconcileSignalSelection(
          s.diagram.signals,
          normalized.signals,
          s.view.activeSignalIds,
        );
        pushHistory(s);
        s.diagram = normalized;
        s.view.activeSignalIds = activeSignalIds;
        const validGroupIds = collectGroupIds(normalized.signals);
        s.view.collapsedGroupIds = s.view.collapsedGroupIds.filter((id) => validGroupIds.has(id));
        s.view.activeAnnotationId = null;
        s.view.activeTimingCellIndex = null;
        s.view.paintDraft = null;
        s.view.edgeAnchorPending = null;
        s.view.structuredArrowPending = null;
        s.view.edgeToolHover = null;
        toolState.cancelAll();
      });
    },

    clearAll() {
      set((s) => {
        pushHistory(s);
        s.diagram.signals = [];
        s.view.collapsedGroupIds = [];
      });
    },

    setExtensionsEnabled(enabled) {
      set((s) => {
        const currentValue = s.diagram.compatibility?.extensionsEnabled === true;
        if (currentValue === enabled) return;
        pushHistory(s);
        s.diagram.version = 2;
        s.diagram.compatibility = {
          ...s.diagram.compatibility,
          extensionsEnabled: enabled,
        };
        if (!enabled) disableExtensionView(s);
      });
    },

    setTicksPerStep(ticksPerStep) {
      if (!Number.isFinite(ticksPerStep)) return false;
      let changed = false;
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        const next = Math.floor(ticksPerStep);
        if (next < 1) return;
        if (s.diagram.config.ticksPerStep === next) {
          changed = true;
          return;
        }
        if (!canRescaleDiagramTiming(s.diagram, next)) return;
        pushHistory(s);
        rescaleDiagramTiming(s.diagram, next);
        changed = true;
      });
      return changed;
    },

    removeUndulateFeatures() {
      set((s) => {
        pushHistory(s);
        s.diagram.annotations = [];
        s.diagram.signals = removeAnalogueSignals(s.diagram.signals);
        delete s.diagram.analogueOverlayGroups;
        removeExtendedDigitalStates(s.diagram.signals);
        removeDigitalTiming(s.diagram.signals, s.diagram.config.totalSteps);
        const removedNodeNames = removeExpandedNodes(s.diagram.signals);
        s.diagram.edges = s.diagram.edges.filter((edge) => {
          const parsed = parseUndulateEdge(edge);
          return !parsed
            || (!parsed.connector.includes('#')
              && !parsed.connector.includes('*')
              && !removedNodeNames.has(parsed.from)
              && !removedNodeNames.has(parsed.to));
        });
        delete s.diagram.config.ticksPerStep;
        delete s.diagram.config.analogueContext;
        s.diagram.version = 2;
        s.diagram.compatibility = {
          ...s.diagram.compatibility,
          extensionsEnabled: false,
          sourceFormat: 'wavedrom-json',
        };
        delete s.diagram.compatibility.sourceRevision;
        delete s.diagram.compatibility.opaqueUndulate;
        disableExtensionView(s);
      });
    },

    markClean(fileName) {
      set((s) => {
        s.savedDiagram = normalizeDiagram(current(s.diagram));
        s.view.isDirty = false;
        s.view.sourceDraftDirty = false;
        s.view.sourceDraft = null;
        s.view.sourceDraftError = null;
        s.view.fileName = fileName;
      });
    },

    undo() {
      cancelPendingCodeToDiagramDebounce();
      set((s) => {
        if (s.history.length === 0) return;
        s.future.push(current(s.diagram));
        s.diagram = normalizeDiagram(s.history.pop()!);
        s.view.paintDraft = null;
        s.view.activeSignalIds = [];
        s.view.activeAnnotationId = null;
        s.view.activeTimingCellIndex = null;
        toolState.cancelAll();
        s.view.diagramRevision += 1;
      });
    },

    redo() {
      cancelPendingCodeToDiagramDebounce();
      set((s) => {
        if (s.future.length === 0) return;
        s.history.push(current(s.diagram));
        s.diagram = normalizeDiagram(s.future.pop()!);
        s.view.paintDraft = null;
        s.view.activeSignalIds = [];
        s.view.activeAnnotationId = null;
        s.view.activeTimingCellIndex = null;
        toolState.cancelAll();
        s.view.diagramRevision += 1;
      });
    },

    setPaintDraft(draft: PaintDraft) {
      set((s) => {
        s.view.paintDraft = draft;
      });
    },

    clearPaintDraft() {
      set((s) => {
        s.view.paintDraft = null;
      });
    },
  };
}
