import { nanoid } from 'nanoid';
import {
  NODE_PAD_CHAR,
  padNodeString,
  setNodeCharAt,
} from '../../wavedromBridge/nodeString';
import {
  applyClockBrushToRange,
  applyClockToggleToRange,
} from '../../wavedromBridge/clockWave';
import {
  clampHscale,
  DEFAULT_SIGNAL_COLOR,
  MAX_TOTAL_STEPS,
  MIN_TOTAL_STEPS,
  ROW_HEIGHT,
} from '../constants';
import {
  applyDecodedEditToLane,
  clearWaveMode,
  isSubcycleWaveLane,
  isWaveModeLane,
} from '../../wavedromBridge/laneWaveOps';
import {
  toggleBinaryBitState,
  isClockBitState,
  resolvePaintValue,
  isHoldPaintValue,
} from '../bitToggle';
import { applyVectorSpan } from '../vectorSegments';
import {
  clearStepGapsOnColumns,
  insertGapColumnsOnDiagram,
  insertGapColumnOnDiagram,
  insertValueColumnOnDiagram,
  removeGapColumnsOnDiagram,
  toggleGapColumnsOnSignal,
} from '../stepGapHelpers';
import type {
  BitState,
  DigitalTimingCell,
  DiagramConfig,
  Signal,
  SignalGroup,
  SignalOrGroup,
} from '../types';
import { normalizeSignalStyle } from '../signalStyles';
import { parseUndulateEdge } from '../edgeSyntax';
import { applyAnalogueBrushRange, normalizeAnalogueSignal } from '../analogue';
import {
  DEFAULT_ANALOGUE_CONTEXT,
  evaluateAnalogueCurve,
  evaluateAnalogueScalar,
  type AnalogueContext,
} from '../analogueExpressions';
import type { ImmerSet, StoreActions } from './storeActions';
import {
  MAX_ANALOGUE_OVERLAY_MEMBERS,
  nextAnalogueOverlayCandidate,
  overlayGroupForSignal,
  reconcileAnalogueOverlayGroups,
} from '../analogueOverlayGroups';
import {
  clearNodesAndEdges,
  canDeleteStepInSignal,
  canInsertStepInSignal,
  deleteStepInSignal,
  hasLegacyTimelineTiming,
  insertStepInSignal,
  pruneReferencesBeyondSteps,
  walkSignals,
} from './stepColumnHelpers';
import {
  clearStepGlitchesTouchingRange,
  findGroup,
  findSignal,
  insertIndexAfter,
  pushHistory,
  removeFromTree,
  reorderSiblingLevel,
  canResizeAllStates,
  resizeAllStates,
} from './helpers';
import {
  eraseDigitalTimingTicksWithMapping,
  paintDigitalTimingTicksWithMapping,
  rescaleDiagramTiming,
  timingResolution,
} from '../fineTiming';
import { toolState } from '../../tools/toolState';
import {
  countOpaqueMixedWaves,
  hasOpaqueMixedWave,
  MIXED_WAVE_NOTICE,
} from '../mixedWave';

type TimingOutputRange = { start: number; end: number };

function closestOutputCell(
  range: TimingOutputRange,
  output: DigitalTimingCell[],
): number {
  if (range.end - range.start <= 1) return range.start;
  const duration = output
    .slice(range.start, range.end)
    .reduce((total, cell) => total + cell.durationTicks, 0);
  const sourceCenter = duration / 2;
  let offset = 0;
  let closest = range.start;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = range.start; index < range.end; index++) {
    const cell = output[index]!;
    const center = offset + cell.durationTicks / 2;
    const distance = Math.abs(center - sourceCenter);
    if (distance < closestDistance) {
      closest = index;
      closestDistance = distance;
    }
    offset += cell.durationTicks;
  }
  return closest;
}

/**
 * A precision paint may split a source cell. Preserve the meaning of every
 * source-indexed decoration by moving it into the corresponding output range
 * rather than letting array indexes drift in time.
 */
function remapTimingDecorations(
  signal: Signal,
  sourceCellRanges: TimingOutputRange[],
  cells: DigitalTimingCell[],
  erasedOutputCells: ReadonlySet<number> = new Set(),
): void {
  const outputLength = cells.length;
  const sourceGaps = signal.stepGaps;
  if (sourceGaps) {
    const gaps = Array<boolean>(outputLength).fill(false);
    sourceCellRanges.forEach((range, sourceIndex) => {
      if (
        sourceGaps[sourceIndex]
        && range.start < outputLength
        && !erasedOutputCells.has(range.start)
      ) {
        // A WaveDrom gap belongs to the cell it decorates, so use its first
        // fragment after a precision split.
        gaps[range.start] = true;
      }
    });
    signal.stepGaps = gaps.some(Boolean) ? gaps : undefined;
  }

  const sourceGlitches = signal.stepGlitches;
  if (sourceGlitches) {
    const glitches = Array<boolean>(Math.max(0, outputLength - 1)).fill(false);
    for (let sourceIndex = 0; sourceIndex < sourceGlitches.length; sourceIndex++) {
      if (!sourceGlitches[sourceIndex]) continue;
      const range = sourceCellRanges[sourceIndex];
      const boundary = range ? range.end - 1 : -1;
      if (
        boundary >= 0
        && boundary < glitches.length
        && !erasedOutputCells.has(boundary)
        && !erasedOutputCells.has(boundary + 1)
      ) {
        glitches[boundary] = true;
      }
    }
    signal.stepGlitches = glitches.some(Boolean) ? glitches : undefined;
  }

  if (signal.node !== undefined) {
    const sourceNode = padNodeString(signal.node, sourceCellRanges.length);
    const node = Array<string>(outputLength).fill(NODE_PAD_CHAR);
    if (sourceNode) {
      sourceCellRanges.forEach((range, sourceIndex) => {
        const char = sourceNode[sourceIndex] ?? NODE_PAD_CHAR;
        node[closestOutputCell(range, cells)] = char;
      });
    }
    signal.node = node.every((char) => char === NODE_PAD_CHAR || char === ' ')
      ? undefined
      : node.join('');
  }

  if (signal.nodeNames) {
    const names: Record<number, string> = {};
    for (const [rawIndex, name] of Object.entries(signal.nodeNames)) {
      const sourceIndex = Number(rawIndex);
      const range = sourceCellRanges[sourceIndex];
      if (!Number.isInteger(sourceIndex) || !range) continue;
      names[closestOutputCell(range, cells)] = name;
    }
    signal.nodeNames = Object.keys(names).length > 0 ? names : undefined;
  }
}

function demoteWaveLaneOnStatesEdit(sig: Signal): void {
  if (isSubcycleWaveLane(sig)) {
    clearWaveMode(sig);
  }
}

/** Timed bit lanes keep their native cells authoritative after every state edit. */
function syncTimedBitStateSource(sig: Signal): void {
  if (sig.type !== 'bit' || !sig.digitalTiming) return;
  sig.digitalTiming.cells.forEach((cell, index) => {
    if (sig.states[index] !== undefined) cell.state = sig.states[index]!;
  });
  sig.states = sig.digitalTiming.cells.map((cell) => cell.state);
}

function nativeCellsForMajorRange(
  sig: Signal,
  lo: number,
  hi: number,
): { start: number; end: number } | null {
  const timing = sig.digitalTiming;
  if (!timing) return null;
  const rangeStart = lo * timing.ticksPerStep + timing.phaseTicks;
  const rangeEnd = (hi + 1) * timing.ticksPerStep + timing.phaseTicks;
  let cursor = 0;
  let start: number | null = null;
  let end = -1;
  timing.cells.forEach((cell, index) => {
    const cellEnd = cursor + cell.durationTicks;
    if (cellEnd > rangeStart && cursor < rangeEnd) {
      start ??= index;
      end = index;
    }
    cursor = cellEnd;
  });
  return start === null ? null : { start, end };
}

interface AppliedEraseResult {
  accepted: boolean;
  changed: boolean;
  reason?:
    | 'partial-clock-macro'
    | 'unsupported-native-vector'
    | 'unsupported-legacy-timing'
    | 'unsupported-mixed-wave';
}

/** Apply one erase range to a draft signal without recording history. */
function applyEraseToSignal(
  target: Signal,
  requestedLo: number,
  requestedHi: number,
  coordinate: 'native' | 'document',
): AppliedEraseResult {
  if (target.sourceWaveData) {
    return { accepted: false, changed: false, reason: 'unsupported-mixed-wave' };
  }
  if (coordinate === 'document' && target.digitalTiming) {
    const timing = target.digitalTiming;
    const erased = eraseDigitalTimingTicksWithMapping(
      timing,
      requestedLo * timing.ticksPerStep,
      (requestedHi + 1) * timing.ticksPerStep,
    );
    if (!erased.ok) {
      return {
        accepted: false,
        changed: false,
        reason: 'reason' in erased ? erased.reason : 'partial-clock-macro',
      };
    }
    if (JSON.stringify(erased.cells) === JSON.stringify(timing.cells)) {
      return { accepted: true, changed: false };
    }
    timing.cells = erased.cells;
    target.states = erased.cells.map((cell) => cell.state);
    remapTimingDecorations(
      target,
      erased.sourceCellRanges,
      erased.cells,
      new Set(erased.erasedOutputCells),
    );
    target.digitalTimingStatesEdited = true;
    return { accepted: true, changed: true };
  }

  if (
    coordinate === 'document'
    && ((target.period !== undefined && target.period !== 1)
      || (target.phase !== undefined && target.phase !== 0))
  ) {
    return { accepted: false, changed: false, reason: 'unsupported-legacy-timing' };
  }

  // Vector native cells have no bit-state hold-fill semantics. Refuse a
  // document-coordinate erase rather than indexing their source cells as
  // though they were major columns.
  if (coordinate === 'document' && target.vectorTiming) {
    return { accepted: false, changed: false, reason: 'unsupported-native-vector' };
  }

  if (coordinate === 'document' && target.type === 'vector') {
    const totalSteps = Math.max(
      requestedHi + 1,
      ...target.segments.map((segment) => segment.endStep),
      0,
    );
    const before = JSON.stringify(target);
    target.segments = applyVectorSpan(
      target.segments,
      requestedLo,
      requestedHi,
      null,
      totalSteps,
    );
    delete target.sourceWaveData;
    clearStepGapsOnColumns(target, requestedLo, requestedHi);
    return { accepted: true, changed: before !== JSON.stringify(target) };
  }

  const nativeRange = coordinate === 'document'
    ? nativeCellsForMajorRange(target, requestedLo, requestedHi)
    : null;
  const lo = nativeRange?.start ?? requestedLo;
  const hi = nativeRange?.end ?? requestedHi;
  if (coordinate === 'document' && target.digitalTiming && !nativeRange) {
    return { accepted: true, changed: false };
  }
  if (hi < 0 || lo >= target.states.length) {
    return { accepted: true, changed: false };
  }

  const before = JSON.stringify(target);
  const gapCols: number[] = [];
  const valueCols: number[] = [];
  for (let index = lo; index <= hi; index++) {
    if (target.stepGaps?.[index]) gapCols.push(index);
    else valueCols.push(index);
  }
  for (const index of gapCols) clearStepGapsOnColumns(target, index, index);
  if (valueCols.length > 0) {
    holdFillErasedSteps(target, Math.min(...valueCols), Math.max(...valueCols));
  }
  return { accepted: true, changed: before !== JSON.stringify(target) };
}

function diagramHasNativeTiming(signals: SignalOrGroup[]): boolean {
  let timed = false;
  walkSignals(signals, (sig) => {
    if (sig.digitalTiming || sig.vectorTiming) timed = true;
  });
  return timed;
}

/** Structural column edits need a source-cell-to-document mapping. */
function diagramHasUnsupportedStructuralTiming(signals: SignalOrGroup[]): boolean {
  return diagramHasNativeTiming(signals) || hasLegacyTimelineTiming(signals);
}

function diagramHasOpaqueMixedWave(signals: SignalOrGroup[]): boolean {
  return countOpaqueMixedWaves(signals) > 0;
}

function rejectOpaqueMixedWave(
  signal: Signal,
  view: { operationNotice?: string | null },
): boolean {
  if (!hasOpaqueMixedWave(signal)) return false;
  view.operationNotice = MIXED_WAVE_NOTICE;
  return true;
}

function rejectOpaqueMixedWaveDocument(
  signals: SignalOrGroup[],
  view: { operationNotice?: string | null },
): boolean {
  if (!diagramHasOpaqueMixedWave(signals)) return false;
  view.operationNotice = MIXED_WAVE_NOTICE;
  return true;
}

function holdFillErasedSteps(sig: Signal, lo: number, hi: number): void {
  if (sig.type !== 'bit') return;
  if (isWaveModeLane(sig)) {
    applyDecodedEditToLane(sig, (decoded) => {
      for (let i = lo; i <= hi; i++) {
        const current = decoded.states[i] ?? '0';
        decoded.states[i] =
          current === 'p' || current === 'P'
            ? '0'
            : current === 'n' || current === 'N'
              ? '1'
              : i > 0
                ? decoded.states[i - 1]!
                : '0';
        if (i > 0) decoded.stepGlitches[i - 1] = false;
        decoded.stepGlitches[i] = false;
      }
    }, sig.states.length);
    syncTimedBitStateSource(sig);
    return;
  }
  demoteWaveLaneOnStatesEdit(sig);
  for (let i = lo; i <= hi; i++) {
    sig.states[i] = i > 0 ? sig.states[i - 1]! : '0';
    clearStepGlitchesTouchingRange(sig, i, i);
  }
  syncTimedBitStateSource(sig);
}

function applyBitStateInRange(
  sig: Signal,
  lo: number,
  hi: number,
  bitState: BitState,
): void {
  if (sig.type !== 'bit') return;
  const len = sig.states.length;

  if (isWaveModeLane(sig)) {
    applyDecodedEditToLane(sig, (decoded) => {
      if (isHoldPaintValue(bitState)) {
        for (let i = lo; i <= hi; i++) {
          decoded.states[i] = resolvePaintValue(decoded.states, i, bitState);
        }
      } else if (isClockBitState(bitState) && lo < hi) {
        applyClockBrushToRange(decoded.states, lo, hi, bitState);
      } else if (isClockBitState(bitState)) {
        decoded.states[lo] = bitState;
      } else {
        for (let i = lo; i <= hi; i++) decoded.states[i] = bitState;
      }
    }, len);
    syncTimedBitStateSource(sig);
    return;
  }

  demoteWaveLaneOnStatesEdit(sig);
  if (isHoldPaintValue(bitState)) {
    for (let i = lo; i <= hi; i++) {
      sig.states[i] = resolvePaintValue(sig.states, i, bitState);
    }
  } else if (isClockBitState(bitState) && lo < hi) {
    applyClockBrushToRange(sig.states, lo, hi, bitState);
  } else if (isClockBitState(bitState)) {
    sig.states[lo] = bitState;
  } else {
    for (let i = lo; i <= hi; i++) sig.states[i] = bitState;
  }
  syncTimedBitStateSource(sig);
}

function duplicateSignalInDraft(
  signals: SignalOrGroup[],
  id: string,
): string | null {
  for (let i = 0; i < signals.length; i++) {
    const item = signals[i]!;
    if (item.type !== 'group' && item.id === id) {
      const clone: Signal = {
        ...item,
        id: nanoid(),
        states: [...item.states],
        segments: item.segments.map((seg) => ({
          ...seg,
          id: nanoid(),
        })),
        stepGaps: item.stepGaps ? [...item.stepGaps] : undefined,
        stepGlitches: item.stepGlitches ? [...item.stepGlitches] : undefined,
        analogueCells: item.analogueCells?.map((cell) => ({
          ...cell,
          id: nanoid(),
          samples: cell.samples?.map((point) => ({ ...point })),
          sampleTimebase: cell.sampleTimebase
            ? { ...cell.sampleTimebase }
            : undefined,
        })),
        digitalTiming: item.digitalTiming
          ? {
              ...item.digitalTiming,
              cells: item.digitalTiming.cells.map((cell) => ({ ...cell })),
            }
          : undefined,
        vectorTiming: item.vectorTiming
          ? {
              ...item.vectorTiming,
              cells: item.vectorTiming.cells.map((cell) => ({ ...cell })),
            }
          : undefined,
        ...(item.laneMode !== undefined ? { laneMode: item.laneMode } : {}),
        ...(item.wave !== undefined ? { wave: item.wave } : {}),
        ...(item.waveOverride !== undefined ? { waveOverride: item.waveOverride } : {}),
        ...(item.sourceWaveData
          ? {
              sourceWaveData: {
                wave: item.sourceWaveData.wave,
                ...(item.sourceWaveData.data !== undefined
                  ? { data: JSON.parse(JSON.stringify(item.sourceWaveData.data)) }
                  : {}),
              },
            }
          : {}),
      };
      signals.splice(i + 1, 0, clone);
      return clone.id;
    } else if (item.type === 'group') {
      const cloneId = duplicateSignalInDraft(item.children, id);
      if (cloneId) return cloneId;
    }
  }
  return null;
}

type SignalLocation = {
  parentId?: string;
  beforeId?: string;
  afterId?: string;
};

function eraseSignalRanges(
  set: ImmerSet,
  signalIds: string[],
  startStep: number,
  endStep: number,
  coordinate: 'native' | 'document',
): boolean {
  const requestedLo = Math.min(startStep, endStep);
  const requestedHi = Math.max(startStep, endStep);
  let accepted = true;
  let changed = false;

  set((s) => {
    const targets: Signal[] = [];
    for (const signalId of signalIds) {
      findSignal(s.diagram.signals, signalId, (signal) => {
        targets.push(signal);
      });
    }
    if (targets.length === 0) {
      accepted = false;
      return;
    }

    // Preflight every lane before touching any of them. This keeps a partial
    // clock-macro rejection from leaving a mixed selection half-erased.
    const previews = targets.map((target) => {
      const preview = JSON.parse(JSON.stringify(target)) as Signal;
      const result = applyEraseToSignal(
        preview,
        requestedLo,
        requestedHi,
        coordinate,
      );
      return { target, result };
    });
    if (previews.some(({ result }) => !result.accepted)) {
      if (previews.some(({ result }) => result.reason === 'unsupported-mixed-wave')) {
        s.view.operationNotice = MIXED_WAVE_NOTICE;
      }
      accepted = false;
      return;
    }
    if (!previews.some(({ result }) => result.changed)) return;

    pushHistory(s);
    for (const target of targets) {
      const result = applyEraseToSignal(
        target,
        requestedLo,
        requestedHi,
        coordinate,
      );
      changed = changed || result.changed;
    }
    if (changed) s.view.isDirty = true;
  });

  return accepted && changed;
}

function insertAtLocation(
  signals: SignalOrGroup[],
  item: SignalOrGroup,
  location: SignalLocation | undefined,
): boolean {
  let siblings = signals;
  if (location?.parentId) {
    const parentFound = findGroup(signals, location.parentId, (group) => {
      siblings = group.children;
    });
    if (!parentFound) return false;
  }
  let index = siblings.length;
  if (location?.beforeId) {
    index = siblings.findIndex((candidate) => candidate.id === location.beforeId);
    if (index < 0) return false;
  } else if (location?.afterId) {
    const afterIndex = siblings.findIndex(
      (candidate) => candidate.id === location.afterId,
    );
    if (afterIndex < 0) return false;
    index = afterIndex + 1;
  }
  siblings.splice(index, 0, item);
  return true;
}

function normalizeHead(
  value: NonNullable<DiagramConfig['head']>,
): DiagramConfig['head'] {
  const next = {
    ...(value.text ? { text: value.text } : {}),
    ...(value.tick !== undefined ? { tick: value.tick } : {}),
    ...(value.every !== undefined ? { every: value.every } : {}),
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

function normalizeFoot(
  value: NonNullable<DiagramConfig['foot']>,
): DiagramConfig['foot'] {
  const next = {
    ...(value.text ? { text: value.text } : {}),
    ...(value.tock !== undefined ? { tock: value.tock } : {}),
    ...(value.every !== undefined ? { every: value.every } : {}),
  };
  return Object.keys(next).length > 0 ? next : undefined;
}

export function createSignalActions(set: ImmerSet): Pick<
  StoreActions,
  | 'addSignal'
  | 'duplicateSignal'
  | 'addGroup'
  | 'removeSignal'
  | 'renameSignal'
  | 'renameGroup'
  | 'updateSignalStyle'
  | 'updateAnalogueCell'
  | 'paintAnalogueCellRange'
  | 'updateAnalogueSignal'
  | 'updateAnalogueContext'
  | 'refreshAnalogueRandomSeed'
  | 'extendAnalogueOverlayGroup'
  | 'dissolveAnalogueOverlayGroup'
  | 'enableDigitalTiming'
  | 'updateDigitalTimingCell'
  | 'updateDigitalTimingSignal'
  | 'setSignalState'
  | 'setSignalStateRange'
  | 'paintBitStateRange'
  | 'paintDigitalTimingRange'
  | 'toggleSignalStateRange'
  | 'paintToggleRange'
  | 'toggleStepGlitchRange'
  | 'paintGapRange'
  | 'insertGapColumnsRange'
  | 'removeGapColumnsRange'
  | 'clearGapFlagsRange'
  | 'eraseSignalState'
  | 'eraseSignalStateRange'
  | 'eraseSignalStateRanges'
  | 'reorderSignals'
  | 'moveSignalToParent'
  | 'updateVectorSegmentValue'
  | 'setVectorSpanRange'
  | 'updateVectorSegmentColor'
  | 'setSignalNodeAt'
  | 'setSignalPhase'
  | 'setSignalPeriod'
  | 'setActiveSignalIds'
  | 'setActiveAnnotationId'
  | 'setTotalSteps'
  | 'setHscale'
  | 'updateDiagramHead'
  | 'updateDiagramFoot'
  | 'insertStepAt'
  | 'deleteStepAt'
  | 'toggleStepGapAt'
  | 'setDiagramSkin'
> {
  return {
    addSignal(type, location) {
      set((s) => {
        if (
          location?.parentId
          && !findGroup(s.diagram.signals, location.parentId, () => {})
        ) return;
        if (location?.beforeId || location?.afterId) {
          let siblings = s.diagram.signals;
          if (location.parentId) {
            findGroup(s.diagram.signals, location.parentId, (group) => {
              siblings = group.children;
            });
          }
          const anchorId = location.beforeId ?? location.afterId;
          if (!siblings.some((candidate) => candidate.id === anchorId)) return;
        }
        pushHistory(s);
        const analogueContext =
          s.diagram.config.analogueContext ?? DEFAULT_ANALOGUE_CONTEXT;
        const states = new Array<BitState>(s.diagram.config.totalSteps).fill('0');
        const signal: Signal = {
          id: nanoid(),
          name:
            type === 'vector'
              ? 'bus'
              : type === 'analogue'
                ? 'analog'
                : 'sig',
          type,
          states: type === 'analogue' ? [] : states,
          segments:
            type === 'vector'
              ? [
                  {
                    id: nanoid(),
                    startStep: 0,
                    endStep: s.diagram.config.totalSteps,
                    value: '',
                  },
                ]
              : [],
          ...(type === 'analogue'
            ? {
                analogueMin: analogueContext.vssa,
                analogueMax: analogueContext.vdda,
                analogueCells: states.map(() => ({
                  id: nanoid(),
                  kind: 'step' as const,
                  value: analogueContext.vssa,
                })),
              }
            : {}),
          color: DEFAULT_SIGNAL_COLOR,
          rowHeight: ROW_HEIGHT,
        };
        if (!insertAtLocation(s.diagram.signals, signal, location)) return;
        reconcileAnalogueOverlayGroups(s.diagram);
      });
    },

    duplicateSignal(id) {
      set((s) => {
        let exists = false;
        findSignal(s.diagram.signals, id, () => { exists = true; });
        if (!exists) return;
        pushHistory(s);
        const cloneId = duplicateSignalInDraft(s.diagram.signals, id);
        const opaqueSignals = s.diagram.compatibility?.opaqueUndulate?.signals;
        if (cloneId && opaqueSignals?.[id]) {
          opaqueSignals[cloneId] = JSON.parse(JSON.stringify(opaqueSignals[id]));
        }
        reconcileAnalogueOverlayGroups(s.diagram);
      });
    },

    addGroup(afterId, name = 'Section') {
      set((s) => {
        pushHistory(s);
        const group: SignalGroup = {
          id: nanoid(),
          name,
          type: 'group',
          children: [],
        };
        s.diagram.signals.splice(
          insertIndexAfter(s.diagram.signals, afterId),
          0,
          group,
        );
        reconcileAnalogueOverlayGroups(s.diagram);
      });
    },

    removeSignal(id) {
      set((s) => {
        const removedIds = new Set<string>();
        const removedNodeNames = new Set<string>();
        const collect = (items: SignalOrGroup[]) => {
          for (const item of items) {
            if (item.id === id) {
              const add = (entry: SignalOrGroup) => {
                removedIds.add(entry.id);
                if (entry.type === 'group') entry.children.forEach(add);
                else {
                  if (entry.node) {
                    for (const char of entry.node) {
                      if (char !== '.' && char !== ' ') removedNodeNames.add(char);
                    }
                  }
                  Object.values(entry.nodeNames ?? {}).forEach((name) => removedNodeNames.add(name));
                }
              };
              add(item);
              return true;
            }
            if (item.type === 'group' && collect(item.children)) return true;
          }
          return false;
        };
        if (!collect(s.diagram.signals)) return;
        pushHistory(s);
        s.diagram.signals = removeFromTree(s.diagram.signals, id);
        const opaqueSignals = s.diagram.compatibility?.opaqueUndulate?.signals;
        if (opaqueSignals) {
          for (const removedId of removedIds) delete opaqueSignals[removedId];
          if (Object.keys(opaqueSignals).length === 0) {
            delete s.diagram.compatibility!.opaqueUndulate!.signals;
          }
        }
        const nextEdges: string[] = [];
        const nextCurveControls: Record<number, { c1x: number; c2x: number }> = {};
        s.diagram.edges.forEach((edge, index) => {
          const parsed = parseUndulateEdge(edge);
          if (parsed && (removedNodeNames.has(parsed.from) || removedNodeNames.has(parsed.to))) return;
          const nextIndex = nextEdges.length;
          nextEdges.push(edge);
          const control = s.diagram.edgeCurveControls?.[index];
          if (control) nextCurveControls[nextIndex] = control;
        });
        s.diagram.edges = nextEdges;
        if (Object.keys(nextCurveControls).length > 0) s.diagram.edgeCurveControls = nextCurveControls;
        else delete s.diagram.edgeCurveControls;
        s.diagram.annotations = (s.diagram.annotations ?? []).filter((annotation) => {
          if ('signalId' in annotation && annotation.signalId !== undefined && removedIds.has(annotation.signalId)) {
            return false;
          }
          if (annotation.type === 'arrow') {
            const fromRemoved = annotation.from.kind === 'node' && removedNodeNames.has(annotation.from.node);
            const toRemoved = annotation.to.kind === 'node' && removedNodeNames.has(annotation.to.node);
            if (fromRemoved || toRemoved) return false;
          }
          return true;
        });
        if (
          s.view.activeAnnotationId
          && !s.diagram.annotations.some((annotation) => annotation.id === s.view.activeAnnotationId)
        ) {
          s.view.activeAnnotationId = null;
        }
        s.view.activeSignalIds = s.view.activeSignalIds.filter((signalId) => !removedIds.has(signalId));
        s.view.collapsedGroupIds = s.view.collapsedGroupIds.filter(
          (groupId) => !removedIds.has(groupId),
        );
        reconcileAnalogueOverlayGroups(s.diagram);
      });
    },

    renameSignal(id, name) {
      set((s) => {
        let currentName: string | undefined;
        findSignal(s.diagram.signals, id, (sig) => {
          currentName = sig.name;
        });
        if (currentName === undefined || currentName === name) return;
        pushHistory(s);
        findSignal(s.diagram.signals, id, (sig) => {
          sig.name = name;
        });
      });
    },

    renameGroup(id, name) {
      set((s) => {
        let currentName: string | undefined;
        findGroup(s.diagram.signals, id, (group) => {
          currentName = group.name;
        });
        if (currentName === undefined || currentName === name) return;
        pushHistory(s);
        findGroup(s.diagram.signals, id, (group) => {
          group.name = name;
        });
      });
    },

    updateSignalStyle(signalId, patch) {
      set((s) => {
        let currentStyle: Signal['style'];
        let nextStyle: Signal['style'];
        let blocked = false;
        const found = findSignal(s.diagram.signals, signalId, (sig) => {
          if (rejectOpaqueMixedWave(sig, s.view)) {
            blocked = true;
            return;
          }
          currentStyle = normalizeSignalStyle(sig.style ?? {});
          nextStyle = normalizeSignalStyle({ ...(sig.style ?? {}), ...patch });
        });
        if (
          blocked
          ||
          !found
          || JSON.stringify(currentStyle ?? {}) === JSON.stringify(nextStyle ?? {})
        ) return;
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (nextStyle) sig.style = nextStyle;
          else delete sig.style;
        });
      });
    },

    updateVectorSegmentValue(signalId, segmentId, value) {
      set((s) => {
        let changed = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'vector') return;
          if (rejectOpaqueMixedWave(sig, s.view)) return;
          const seg = sig.segments.find((x) => x.id === segmentId);
          if (seg && seg.value !== value) {
            pushHistory(s);
            delete sig.sourceWaveData;
            seg.value = value;
            changed = true;
          }
        });
        if (changed) s.view.isDirty = true;
      });
    },

    setVectorSpanRange(signalId, startStep, endStepInclusive, value, busColorFill, options) {
      set((s) => {
        let changed = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'vector') return;
          if (rejectOpaqueMixedWave(sig, s.view)) return;
          pushHistory(s);
          delete sig.sourceWaveData;
          sig.segments = applyVectorSpan(
            sig.segments,
            startStep,
            endStepInclusive,
            value,
            sig.vectorTiming?.cells.length ?? s.diagram.config.totalSteps,
            busColorFill,
            options,
          );
          changed = true;
        });
        if (changed) s.view.isDirty = true;
      });
    },

    updateVectorSegmentColor(signalId, segmentId, color) {
      set((s) => {
        let changed = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'vector') return;
          if (rejectOpaqueMixedWave(sig, s.view)) return;
          const seg = sig.segments.find((x) => x.id === segmentId);
          if (!seg) return;
          if (seg.color === color) return;
          pushHistory(s);
          delete sig.sourceWaveData;
          if (color === undefined) delete seg.color;
          else seg.color = color;
          changed = true;
        });
        if (changed) s.view.isDirty = true;
      });
    },

    setSignalNodeAt(signalId, step, char) {
      let changed = false;
      set((s) => {
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (rejectOpaqueMixedWave(sig, s.view)) return;
          const before = sig.node;
          pushHistory(s);
          setNodeCharAt(sig, step, char, s.diagram.config.totalSteps);
          changed = before !== sig.node;
        });
        if (changed) s.view.isDirty = true;
      });
      return changed;
    },

    setSignalPhase(signalId, phase) {
      if (phase !== undefined && !Number.isFinite(phase)) return;
      set((s) => {
        let previous: number | undefined;
        let blocked = false;
        const found = findSignal(s.diagram.signals, signalId, (sig) => {
          if (rejectOpaqueMixedWave(sig, s.view)) {
            blocked = true;
            return;
          }
          previous = sig.phase;
        });
        if (!found || blocked || previous === phase) return;
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (phase === undefined) delete sig.phase;
          else sig.phase = phase;
        });
      });
    },

    setSignalPeriod(signalId, period) {
      if (period !== undefined && !Number.isFinite(period)) return;
      const next = period === undefined || period < 1 ? undefined : Math.floor(period);
      set((s) => {
        let previous: number | undefined;
        let blocked = false;
        const found = findSignal(s.diagram.signals, signalId, (sig) => {
          if (rejectOpaqueMixedWave(sig, s.view)) {
            blocked = true;
            return;
          }
          previous = sig.period;
        });
        if (!found || blocked || previous === next) return;
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (next === undefined) delete sig.period;
          else sig.period = next;
        });
      });
    },

    setActiveSignalIds(ids) {
      set((s) => {
        s.view.activeSignalIds = ids;
        if (ids.length > 0) s.view.activeAnnotationId = null;
      });
    },

    updateAnalogueCell(signalId, index, patch) {
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        let target: Signal | null = null;
        findSignal(s.diagram.signals, signalId, (signal) => {
          target = signal;
        });
        if (!target || target.type !== 'analogue') return;
        const cell = target.analogueCells?.[index];
        if (!cell) return;
        pushHistory(s);
        if (
          patch.expression === undefined
          && (
            patch.value !== undefined
            || patch.samples !== undefined
            || patch.kind !== undefined
          )
        ) delete cell.expression;
        Object.assign(cell, patch);
        normalizeAnalogueSignal(target, s.diagram.config.totalSteps);
      });
    },

    paintAnalogueCellRange(signalId, startStep, endStep, kind, value) {
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        let target: Signal | null = null;
        findSignal(s.diagram.signals, signalId, (signal) => {
          target = signal;
        });
        if (!target || target.type !== 'analogue') return;
        pushHistory(s);
        applyAnalogueBrushRange(target, startStep, endStep, kind, value);
        normalizeAnalogueSignal(target, s.diagram.config.totalSteps);
      });
    },

    updateAnalogueSignal(signalId, patch) {
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        let target: Signal | null = null;
        findSignal(s.diagram.signals, signalId, (signal) => {
          target = signal;
        });
        if (!target || target.type !== 'analogue') return;
        pushHistory(s);
        Object.assign(target, patch);
        normalizeAnalogueSignal(target, s.diagram.config.totalSteps);
        target.rowHeight = ROW_HEIGHT * (target.vscale ?? 1);
      });
    },

    updateAnalogueContext(patch) {
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        const currentContext =
          s.diagram.config.analogueContext ?? DEFAULT_ANALOGUE_CONTEXT;
        const next: AnalogueContext = {
          vssa: patch.vssa ?? currentContext.vssa,
          vdda: patch.vdda ?? currentContext.vdda,
        };
        if (
          !Number.isFinite(next.vssa)
          || !Number.isFinite(next.vdda)
          || next.vdda <= next.vssa
        ) return;
        const resolved = new Map<
          string,
          { value: number; samples?: Array<{ offset: number; value: number }> }
        >();
        try {
          walkSignals(s.diagram.signals, (signal) => {
            if (signal.type !== 'analogue') return;
            for (const cell of signal.analogueCells ?? []) {
              if (!cell.expression) continue;
              if (cell.kind === 'samples') {
                const samples = evaluateAnalogueCurve(
                  cell.expression,
                  next,
                  s.diagram.config.analogueRandomSeed,
                )
                  .map(([offset, value]) => ({ offset, value }));
                resolved.set(cell.id, {
                  samples,
                  value: samples.at(-1)?.value ?? cell.value,
                });
              } else {
                resolved.set(cell.id, {
                  value: evaluateAnalogueScalar(
                    cell.expression,
                    next,
                    {},
                    s.diagram.config.analogueRandomSeed,
                  ),
                });
              }
            }
          });
        } catch {
          return;
        }
        pushHistory(s);
        s.diagram.config.analogueContext = next;
        walkSignals(s.diagram.signals, (signal) => {
          if (signal.type !== 'analogue') return;
          signal.analogueMin = next.vssa;
          signal.analogueMax = next.vdda;
          for (const cell of signal.analogueCells ?? []) {
            const result = resolved.get(cell.id);
            if (!result) continue;
            cell.value = result.value;
            if (result.samples) cell.samples = result.samples;
          }
          normalizeAnalogueSignal(signal, s.diagram.config.totalSteps);
        });
      });
    },

    refreshAnalogueRandomSeed() {
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        const current = s.diagram.config.analogueRandomSeed ?? 0;
        const nextSeed = (current + 0x9e37_79b9) >>> 0;
        const context =
          s.diagram.config.analogueContext ?? DEFAULT_ANALOGUE_CONTEXT;
        const resolved = new Map<
          string,
          { value: number; samples?: Array<{ offset: number; value: number }> }
        >();
        try {
          walkSignals(s.diagram.signals, (signal) => {
            if (signal.type !== 'analogue') return;
            for (const cell of signal.analogueCells ?? []) {
              if (!cell.expression || !/\brnd\s*\(\s*\)/.test(cell.expression)) {
                continue;
              }
              if (cell.kind === 'samples') {
                const samples = evaluateAnalogueCurve(
                  cell.expression,
                  context,
                  nextSeed,
                ).map(([offset, value]) => ({ offset, value }));
                resolved.set(cell.id, {
                  samples,
                  value: samples.at(-1)?.value ?? cell.value,
                });
              } else {
                resolved.set(cell.id, {
                  value: evaluateAnalogueScalar(
                    cell.expression,
                    context,
                    {},
                    nextSeed,
                  ),
                });
              }
            }
          });
        } catch {
          return;
        }
        pushHistory(s);
        s.diagram.config.analogueRandomSeed = nextSeed;
        walkSignals(s.diagram.signals, (signal) => {
          if (signal.type !== 'analogue') return;
          for (const cell of signal.analogueCells ?? []) {
            const result = resolved.get(cell.id);
            if (!result) continue;
            cell.value = result.value;
            if (result.samples) cell.samples = result.samples;
          }
          normalizeAnalogueSignal(signal, s.diagram.config.totalSteps);
        });
      });
    },

    extendAnalogueOverlayGroup(signalId) {
      let changed = false;
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        const next = nextAnalogueOverlayCandidate(s.diagram, signalId);
        if (!next) return;
        const group = overlayGroupForSignal(s.diagram, signalId);
        if (group && group.signalIds.length >= MAX_ANALOGUE_OVERLAY_MEMBERS) return;
        pushHistory(s);
        if (group) {
          group.signalIds.push(next.id);
        } else {
          const groups = s.diagram.analogueOverlayGroups ?? [];
          s.diagram.analogueOverlayGroups = groups;
          groups.push({
            id: nanoid(),
            name: `Overlay ${groups.length + 1}`,
            signalIds: [signalId, next.id],
          });
        }
        reconcileAnalogueOverlayGroups(s.diagram);
        changed = true;
      });
      return changed;
    },

    dissolveAnalogueOverlayGroup(groupId) {
      set((s) => {
        const groups = s.diagram.analogueOverlayGroups ?? [];
        if (!groups.some((group) => group.id === groupId)) return;
        pushHistory(s);
        s.diagram.analogueOverlayGroups = groups.filter(
          (group) => group.id !== groupId,
        );
        reconcileAnalogueOverlayGroups(s.diagram);
      });
    },

    enableDigitalTiming(signalId) {
      let enabled = false;
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        findSignal(s.diagram.signals, signalId, (signal) => {
          if (signal.type !== 'bit') return;
          if (rejectOpaqueMixedWave(signal, s.view)) return;
          if (signal.digitalTiming) {
            enabled = true;
            return;
          }
          const configuredTicks = s.diagram.config.ticksPerStep ?? 1;
          const ticksPerStep = timingResolution([
            1 / configuredTicks,
            signal.phase ?? 0,
            signal.period ?? 1,
          ]);
          if (ticksPerStep === null) return;
          pushHistory(s);
          if (!rescaleDiagramTiming(s.diagram, ticksPerStep)) return;
          signal.digitalTiming = {
            ticksPerStep,
            phaseTicks: Math.round((signal.phase ?? 0) * ticksPerStep),
            cells: signal.states.map((state) => ({
              state,
              durationTicks: Math.round((signal.period ?? 1) * ticksPerStep),
            })),
          };
          delete signal.phase;
          delete signal.period;
          enabled = true;
        });
      });
      return enabled;
    },

    updateDigitalTimingCell(signalId, index, patch) {
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        findSignal(s.diagram.signals, signalId, (signal) => {
          if (signal.type !== 'bit') return;
          if (rejectOpaqueMixedWave(signal, s.view)) return;
          pushHistory(s);
          if (!signal.digitalTiming) {
            const ticksPerStep = s.diagram.config.ticksPerStep ?? 1;
            signal.digitalTiming = {
              ticksPerStep,
              phaseTicks: Math.round((signal.phase ?? 0) * ticksPerStep),
              cells: signal.states.map((state) => ({
                state,
                durationTicks: Math.round((signal.period ?? 1) * ticksPerStep),
              })),
            };
            delete signal.phase;
            delete signal.period;
          }
          const cell = signal.digitalTiming.cells[index];
          if (!cell) return;
          if (patch.durationTicks !== undefined) {
            cell.durationTicks = Math.max(1, Math.round(patch.durationTicks));
            if (cell.dutyTicks !== undefined) {
              cell.dutyTicks = Math.min(cell.dutyTicks, cell.durationTicks);
            }
          }
          if (patch.dutyTicks === null) delete cell.dutyTicks;
          else if (patch.dutyTicks !== undefined) {
            cell.dutyTicks = Math.max(
              0,
              Math.min(cell.durationTicks, Math.round(patch.dutyTicks)),
            );
          }
        });
      });
    },

    updateDigitalTimingSignal(signalId, patch) {
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        findSignal(s.diagram.signals, signalId, (signal) => {
          if (signal.type !== 'bit') return;
          if (rejectOpaqueMixedWave(signal, s.view)) return;
          pushHistory(s);
          if (!signal.digitalTiming) {
            const ticksPerStep = s.diagram.config.ticksPerStep ?? 1;
            signal.digitalTiming = {
              ticksPerStep,
              phaseTicks: Math.round((signal.phase ?? 0) * ticksPerStep),
              cells: signal.states.map((state) => ({
                state,
                durationTicks: Math.round((signal.period ?? 1) * ticksPerStep),
              })),
            };
            delete signal.phase;
            delete signal.period;
          }
          if (patch.phaseTicks !== undefined) {
            signal.digitalTiming.phaseTicks = Math.round(patch.phaseTicks);
          }
          if (patch.slewing === null) delete signal.digitalTiming.slewing;
          else if (patch.slewing !== undefined) {
            signal.digitalTiming.slewing = Math.max(0, patch.slewing);
          }
        });
      });
    },

    setActiveAnnotationId(id) {
      set((s) => {
        s.view.activeAnnotationId = id;
        if (id !== null) s.view.activeSignalIds = [];
      });
    },

    setSignalState(signalId, step, bitState) {
      set((s) => {
        let valid = false;
        let blocked = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (rejectOpaqueMixedWave(sig, s.view)) {
            blocked = true;
            return;
          }
          valid = sig.type === 'bit'
            && Number.isInteger(step)
            && step >= 0 && step < sig.states.length;
        });
        if (!valid || blocked) return;
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
          applyBitStateInRange(sig, step, step, bitState);
        });
      });
    },

    setSignalStateRange(signalId, startStep, endStep, bitState) {
      set((s) => {
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        let valid = false;
        let blocked = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (rejectOpaqueMixedWave(sig, s.view)) {
            blocked = true;
            return;
          }
          valid = sig.type === 'bit' && Number.isFinite(lo) && Number.isFinite(hi)
            && hi >= 0 && lo < sig.states.length;
        });
        if (!valid || blocked) return;
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          const nativeRange = nativeCellsForMajorRange(
            sig,
            lo,
            hi,
          );
          applyBitStateInRange(
            sig,
            nativeRange?.start ?? lo,
            nativeRange?.end ?? hi,
            bitState,
          );
        });
      });
    },

    paintBitStateRange(signalId, startStep, endStep, bitState, paintStyle) {
      set((s) => {
        let blocked = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          blocked = rejectOpaqueMixedWave(sig, s.view);
        });
        if (blocked) return;
        blocked = false;
        if (paintStyle === 'additive') {
          blocked = diagramHasUnsupportedStructuralTiming(s.diagram.signals);
        }
        if (blocked) return;
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
          if (paintStyle === 'replace') {
            clearStepGapsOnColumns(sig, lo, hi);
            applyBitStateInRange(sig, lo, hi, bitState);
            return;
          }

          if (sig.digitalTiming) return;

          const wasGap: boolean[] = [];
          for (let i = lo; i <= hi; i++) {
            wasGap[i] = Boolean(sig.stepGaps?.[i]);
          }
          const hasGap = wasGap.slice(lo, hi + 1).some(Boolean);
          if (!hasGap) {
            applyBitStateInRange(sig, lo, hi, bitState);
            return;
          }

          let inserted = 0;
          for (let i = hi; i >= lo; i--) {
            if (!wasGap[i]) continue;
            if (s.diagram.config.totalSteps + inserted >= MAX_TOTAL_STEPS) break;
            insertValueColumnOnDiagram(
              s.diagram.signals,
              i + 1,
              signalId,
              resolvePaintValue(sig.states, i, bitState),
            );
            inserted++;
          }
          if (inserted > 0) {
            clearNodesAndEdges(s.diagram.signals, s.diagram.edges, s.diagram.annotations);
            delete s.diagram.edgeCurveControls;
            s.diagram.config.totalSteps += inserted;
          }

          applyDecodedEditToLane(sig, (decoded) => {
            for (let i = lo; i <= hi; i++) {
              if (wasGap[i]) continue;
              if (isHoldPaintValue(bitState)) {
                decoded.states[i] = resolvePaintValue(decoded.states, i, bitState);
              } else {
                decoded.states[i] = bitState;
              }
            }
          }, sig.states.length);
          syncTimedBitStateSource(sig);
        });
        s.view.isDirty = true;
      });
    },

    paintDigitalTimingRange(signalId, startTick, endTick, bitState, mode) {
      set((s) => {
        if (s.diagram.compatibility?.extensionsEnabled !== true) return;
        let changed = false;
        findSignal(s.diagram.signals, signalId, (signal) => {
          if (signal.type !== 'bit' || !signal.digitalTiming) return;
          if (rejectOpaqueMixedWave(signal, s.view)) return;
          const painted = paintDigitalTimingTicksWithMapping(
            signal.digitalTiming,
            startTick,
            endTick,
            bitState,
            mode,
          );
          if (JSON.stringify(painted.cells) === JSON.stringify(signal.digitalTiming.cells)) {
            return;
          }
          pushHistory(s);
          signal.digitalTiming.cells = painted.cells;
          signal.states = painted.cells.map((cell) => cell.state);
          remapTimingDecorations(
            signal,
            painted.sourceCellRanges,
            painted.cells,
          );
          signal.digitalTimingStatesEdited = true;
          delete signal.undulateRepeat;
          changed = true;
        });
        if (changed) s.view.isDirty = true;
      });
    },

    toggleSignalStateRange(signalId, startStep, endStep) {
      set((s) => {
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        let valid = false;
        let blocked = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (rejectOpaqueMixedWave(sig, s.view)) {
            blocked = true;
            return;
          }
          valid = sig.type === 'bit' && hi >= 0 && lo < sig.states.length;
        });
        if (!valid || blocked) return;
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
          applyDecodedEditToLane(sig, (decoded) => {
            if (decoded.states.every(isClockBitState)) {
              applyClockToggleToRange(decoded.states, lo, hi);
            } else {
              for (let i = lo; i <= hi; i++) {
                decoded.states[i] = toggleBinaryBitState(decoded.states[i]!);
              }
            }
          }, sig.states.length);
          syncTimedBitStateSource(sig);
        });
      });
    },

    paintToggleRange(signalId, startStep, endStep, paintStyle) {
      set((s) => {
        let blocked = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          blocked = rejectOpaqueMixedWave(sig, s.view);
        });
        if (blocked) return;
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
          if (paintStyle === 'replace') {
            clearStepGapsOnColumns(sig, lo, hi);
          }
          applyDecodedEditToLane(sig, (decoded) => {
            if (decoded.states.every(isClockBitState)) {
              applyClockToggleToRange(decoded.states, lo, hi);
              return;
            }
            for (let i = lo; i <= hi; i++) {
              if (paintStyle === 'additive' && decoded.stepGaps[i]) continue;
              decoded.states[i] = toggleBinaryBitState(decoded.states[i]!);
            }
          }, sig.states.length);
          syncTimedBitStateSource(sig);
        });
        s.view.isDirty = true;
      });
    },

    paintGapRange(signalId, startStep, endStep, paintStyle) {
      const lo = Math.min(startStep, endStep);
      const hi = Math.max(startStep, endStep);
      if (paintStyle === 'additive') {
        set((s) => {
          const n = hi - lo + 1;
          if (n === 0) return;
          if (rejectOpaqueMixedWaveDocument(s.diagram.signals, s.view)) return;
          if (diagramHasUnsupportedStructuralTiming(s.diagram.signals)) return;
          if (s.diagram.config.totalSteps + n > MAX_TOTAL_STEPS) return;
          pushHistory(s);
          insertGapColumnsOnDiagram(s.diagram.signals, lo, n, signalId);
          clearNodesAndEdges(s.diagram.signals, s.diagram.edges, s.diagram.annotations);
          delete s.diagram.edgeCurveControls;
          s.diagram.config.totalSteps += n;
          s.view.isDirty = true;
        });
        return;
      }
      set((s) => {
        let blocked = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          blocked = rejectOpaqueMixedWave(sig, s.view);
        });
        if (blocked) return;
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          toggleGapColumnsOnSignal(sig, lo, hi);
          syncTimedBitStateSource(sig);
        });
        s.view.isDirty = true;
      });
    },

    toggleStepGlitchRange(signalId, startStep, endStep) {
      set((s) => {
        let blocked = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          blocked = rejectOpaqueMixedWave(sig, s.view);
        });
        if (blocked) return;
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
          if (sig.states.length < 2) return;
          applyDecodedEditToLane(sig, (decoded) => {
            if (decoded.states.length < 2) return;
            const maxBoundaries = decoded.states.length - 1;
            while (decoded.stepGlitches.length < maxBoundaries) {
              decoded.stepGlitches.push(false);
            }
            if (decoded.stepGlitches.length > maxBoundaries) {
              decoded.stepGlitches.length = maxBoundaries;
            }
            for (let i = lo; i < hi && i < maxBoundaries; i++) {
              decoded.stepGlitches[i] = !decoded.stepGlitches[i];
            }
          }, sig.states.length);
          if (!sig.stepGlitches?.some(Boolean)) delete sig.stepGlitches;
        });
      });
    },

    insertGapColumnsRange(signalId, column, count) {
      set((s) => {
        const n = Math.max(0, count);
        if (n === 0) return;
        if (rejectOpaqueMixedWaveDocument(s.diagram.signals, s.view)) return;
        if (diagramHasUnsupportedStructuralTiming(s.diagram.signals)) return;
        if (s.diagram.config.totalSteps + n > MAX_TOTAL_STEPS) return;
        pushHistory(s);
        insertGapColumnsOnDiagram(s.diagram.signals, column, n, signalId);
        clearNodesAndEdges(s.diagram.signals, s.diagram.edges, s.diagram.annotations);
        delete s.diagram.edgeCurveControls;
        s.diagram.config.totalSteps += n;
        s.view.isDirty = true;
      });
    },

    removeGapColumnsRange(signalId, startStep, endStep) {
      set((s) => {
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        if (rejectOpaqueMixedWaveDocument(s.diagram.signals, s.view)) return;
        if (diagramHasUnsupportedStructuralTiming(s.diagram.signals)) return;
        pushHistory(s);
        const removed = removeGapColumnsOnDiagram(
          s.diagram.signals,
          signalId,
          lo,
          hi,
          MIN_TOTAL_STEPS,
        );
        if (removed > 0) {
          clearNodesAndEdges(s.diagram.signals, s.diagram.edges, s.diagram.annotations);
          delete s.diagram.edgeCurveControls;
          s.diagram.config.totalSteps = Math.max(
            MIN_TOTAL_STEPS,
            s.diagram.config.totalSteps - removed,
          );
        }
        s.view.isDirty = true;
      });
    },

    clearGapFlagsRange(signalId, startStep, endStep) {
      set((s) => {
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        let changed = false;
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (rejectOpaqueMixedWave(sig, s.view)) return;
          pushHistory(s);
          clearStepGapsOnColumns(sig, lo, hi);
          changed = true;
        });
        if (changed) s.view.isDirty = true;
      });
    },

    eraseSignalState(signalId, step) {
      set((s) => {
        let target: Signal | undefined;
        findSignal(s.diagram.signals, signalId, (sig) => {
          target = sig;
        });
        if (!target || step < 0 || step >= target.states.length) return;
        if (rejectOpaqueMixedWave(target, s.view)) return;
        pushHistory(s);

        if (target.stepGaps?.[step]) {
          clearStepGapsOnColumns(target, step, step);
          s.view.isDirty = true;
          return;
        }

        findSignal(s.diagram.signals, signalId, (sig) => {
          holdFillErasedSteps(sig, step, step);
        });
        s.view.isDirty = true;
      });
    },

    eraseSignalStateRange(signalId, startStep, endStep, coordinate = 'native') {
      return eraseSignalRanges(set, [signalId], startStep, endStep, coordinate);
    },

    eraseSignalStateRanges(signalIds, startStep, endStep, coordinate = 'native') {
      return eraseSignalRanges(set, signalIds, startStep, endStep, coordinate);
    },

    reorderSignals(orderedIds, parentId) {
      set((s) => {
        let siblings: SignalOrGroup[] | null = parentId === undefined
          ? s.diagram.signals
          : null;
        if (parentId !== undefined) {
          findGroup(s.diagram.signals, parentId, (group) => {
            siblings = group.children;
          });
        }
        if (!siblings || orderedIds.length !== siblings.length) return;
        const expected = new Set(siblings.map((item) => item.id));
        if (
          new Set(orderedIds).size !== orderedIds.length
          || orderedIds.some((id) => !expected.has(id))
        ) return;
        pushHistory(s);
        if (parentId === undefined) {
          s.diagram.signals = reorderSiblingLevel(s.diagram.signals, orderedIds);
        } else {
          findGroup(s.diagram.signals, parentId, (group) => {
            group.children = reorderSiblingLevel(group.children, orderedIds);
          });
        }
        reconcileAnalogueOverlayGroups(s.diagram);
      });
    },

    moveSignalToParent(signalId, parentId, beforeId) {
      set((s) => {
        let isSignal = false;
        findSignal(s.diagram.signals, signalId, () => {
          isSignal = true;
        });
        if (!isSignal) return;
        if (beforeId === signalId) return;
        if (parentId !== undefined) {
          let validParent = false;
          let validBefore = beforeId === undefined;
          findGroup(s.diagram.signals, parentId, (group) => {
            validParent = true;
            if (beforeId !== undefined) {
              validBefore = group.children.some((child) => child.id === beforeId);
            }
          });
          if (!validParent || !validBefore) return;
        } else if (
          beforeId !== undefined
          && !s.diagram.signals.some((item) => item.id === beforeId)
        ) return;

        pushHistory(s);
        let removed: Signal | null = null;

        const extract = (items: SignalOrGroup[]): SignalOrGroup[] => {
          const out: SignalOrGroup[] = [];
          for (const item of items) {
            if (item.id === signalId && item.type !== 'group') {
              removed = item;
              continue;
            }
            if (item.type === 'group') {
              item.children = extract(item.children);
            }
            out.push(item);
          }
          return out;
        };

        const insertAt = (items: SignalOrGroup[], parent?: string): boolean => {
          if (!removed) return false;
          if (parent === undefined) {
            const idx = beforeId
              ? items.findIndex((sg) => sg.id === beforeId)
              : items.length;
            items.splice(idx === -1 ? items.length : idx, 0, removed);
            return true;
          }
          for (const item of items) {
            if (item.type === 'group' && item.id === parent) {
              const idx = beforeId
                ? item.children.findIndex((c) => c.id === beforeId)
                : item.children.length;
              item.children.splice(idx === -1 ? item.children.length : idx, 0, removed);
              return true;
            }
            if (item.type === 'group' && insertAt(item.children, parent)) {
              return true;
            }
          }
          return false;
        };

        s.diagram.signals = extract(s.diagram.signals);
        if (!removed) return;
        if (!insertAt(s.diagram.signals, parentId)) {
          s.diagram.signals.push(removed);
        }
        reconcileAnalogueOverlayGroups(s.diagram);
        s.view.isDirty = true;
      });
    },

    setTotalSteps(steps) {
      if (!Number.isFinite(steps)) return false;
      let accepted = false;
      set((s) => {
        const next = Math.max(
          MIN_TOTAL_STEPS,
          Math.min(MAX_TOTAL_STEPS, Math.floor(steps)),
        );
        const old = s.diagram.config.totalSteps;
        if (next === old) {
          accepted = true;
          return;
        }
        if (rejectOpaqueMixedWaveDocument(s.diagram.signals, s.view)) return;
        if (hasLegacyTimelineTiming(s.diagram.signals)) return;
        if (!canResizeAllStates(s.diagram.signals, next)) return;
        pushHistory(s);
        s.diagram.config.totalSteps = next;
        resizeAllStates(s.diagram.signals, next, old);
        if (next < old) {
          pruneReferencesBeyondSteps(s.diagram, next);
          s.view.activeAnnotationId = null;
          s.view.activeTimingCellIndex = null;
          s.view.paintDraft = null;
          s.view.edgeAnchorPending = null;
          s.view.structuredArrowPending = null;
          s.view.edgeToolHover = null;
          toolState.cancelAll();
        }
        s.view.isDirty = true;
        accepted = true;
      });
      return accepted;
    },

    setHscale(hscale) {
      set((s) => {
        const next = clampHscale(hscale);
        if (s.diagram.config.hscale === next) return;
        pushHistory(s);
        s.diagram.config.hscale = next;
        s.view.isDirty = true;
      });
    },

    updateDiagramHead(patch) {
      set((s) => {
        const previous = normalizeHead(s.diagram.config.head ?? {});
        const next = normalizeHead({ ...(previous ?? {}), ...patch });
        if (JSON.stringify(previous ?? {}) === JSON.stringify(next ?? {})) return;
        pushHistory(s);
        if (next) s.diagram.config.head = next;
        else delete s.diagram.config.head;
      });
    },

    updateDiagramFoot(patch) {
      set((s) => {
        const previous = normalizeFoot(s.diagram.config.foot ?? {});
        const next = normalizeFoot({ ...(previous ?? {}), ...patch });
        if (JSON.stringify(previous ?? {}) === JSON.stringify(next ?? {})) return;
        pushHistory(s);
        if (next) s.diagram.config.foot = next;
        else delete s.diagram.config.foot;
      });
    },

    insertStepAt(index) {
      set((s) => {
        const total = s.diagram.config.totalSteps;
        if (total >= MAX_TOTAL_STEPS) return;
        if (rejectOpaqueMixedWaveDocument(s.diagram.signals, s.view)) return;
        if (hasLegacyTimelineTiming(s.diagram.signals)) return;
        const at = Math.max(0, Math.min(index, total));
        let blocked = false;
        walkSignals(s.diagram.signals, (sig) => {
          if (!canInsertStepInSignal(sig, at, total)) blocked = true;
        });
        if (blocked) return;
        pushHistory(s);
        walkSignals(s.diagram.signals, (sig) => insertStepInSignal(sig, at, total));
        clearNodesAndEdges(s.diagram.signals, s.diagram.edges, s.diagram.annotations);
        delete s.diagram.edgeCurveControls;
        s.diagram.config.totalSteps = total + 1;
        s.view.isDirty = true;
      });
    },

    deleteStepAt(index) {
      set((s) => {
        const total = s.diagram.config.totalSteps;
        if (total <= MIN_TOTAL_STEPS) return;
        if (rejectOpaqueMixedWaveDocument(s.diagram.signals, s.view)) return;
        if (hasLegacyTimelineTiming(s.diagram.signals)) return;
        const at = Math.max(0, Math.min(index, total - 1));
        let blocked = false;
        walkSignals(s.diagram.signals, (sig) => {
          if (!canDeleteStepInSignal(sig, at, MIN_TOTAL_STEPS)) {
            blocked = true;
          }
          if (sig.type === 'vector' && !sig.vectorTiming) {
            for (const seg of sig.segments) {
              if (
                seg.startStep <= at &&
                seg.endStep > at &&
                seg.endStep - seg.startStep <= 1
              ) {
                blocked = true;
              }
            }
          }
        });
        if (blocked) return;
        pushHistory(s);
        walkSignals(s.diagram.signals, (sig) => {
          deleteStepInSignal(sig, at, total, MIN_TOTAL_STEPS);
        });
        clearNodesAndEdges(s.diagram.signals, s.diagram.edges, s.diagram.annotations);
        delete s.diagram.edgeCurveControls;
        s.diagram.config.totalSteps = total - 1;
        s.view.isDirty = true;
      });
    },

    toggleStepGapAt(column) {
      set((s) => {
        if (s.diagram.config.totalSteps >= MAX_TOTAL_STEPS) return;
        if (rejectOpaqueMixedWaveDocument(s.diagram.signals, s.view)) return;
        if (
          diagramHasNativeTiming(s.diagram.signals)
          || hasLegacyTimelineTiming(s.diagram.signals)
        ) return;
        const at = Math.max(0, Math.min(column, s.diagram.config.totalSteps));
        pushHistory(s);
        insertGapColumnOnDiagram(s.diagram.signals, at, null);
        clearNodesAndEdges(s.diagram.signals, s.diagram.edges, s.diagram.annotations);
        delete s.diagram.edgeCurveControls;
        s.diagram.config.totalSteps += 1;
        s.view.isDirty = true;
      });
    },

    setDiagramSkin(skin) {
      set((s) => {
        pushHistory(s);
        if (skin === undefined || skin.trim() === '') delete s.diagram.config.skin;
        else s.diagram.config.skin = skin.trim();
        s.view.isDirty = true;
      });
    },
  };
}
