import { nanoid } from 'nanoid';
import { setNodeCharAt } from '../../wavedromBridge/nodeString';
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
  DiagramConfig,
  Signal,
  SignalGroup,
  SignalOrGroup,
} from '../types';
import { normalizeSignalStyle } from '../signalStyles';
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
  deleteStepInSignal,
  insertStepInSignal,
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
  resizeAllStates,
} from './helpers';
import {
  paintDigitalTimingTicks,
  rescaleDiagramTiming,
  timingResolution,
} from '../fineTiming';

function demoteWaveLaneOnStatesEdit(sig: Signal): void {
  if (isSubcycleWaveLane(sig)) {
    clearWaveMode(sig);
  }
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
    return;
  }
  demoteWaveLaneOnStatesEdit(sig);
  for (let i = lo; i <= hi; i++) {
    sig.states[i] = i > 0 ? sig.states[i - 1]! : '0';
    clearStepGlitchesTouchingRange(sig, i, i);
  }
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
}

function duplicateSignalInDraft(
  signals: SignalOrGroup[],
  id: string,
): boolean {
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
        ...(item.laneMode !== undefined ? { laneMode: item.laneMode } : {}),
        ...(item.wave !== undefined ? { wave: item.wave } : {}),
        ...(item.waveOverride !== undefined ? { waveOverride: item.waveOverride } : {}),
      };
      signals.splice(i + 1, 0, clone);
      return true;
    } else if (item.type === 'group') {
      if (duplicateSignalInDraft(item.children, id)) {
        return true;
      }
    }
  }
  return false;
}

type SignalLocation = {
  parentId?: string;
  beforeId?: string;
  afterId?: string;
};

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
        pushHistory(s);
        duplicateSignalInDraft(s.diagram.signals, id);
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
        pushHistory(s);
        s.diagram.signals = removeFromTree(s.diagram.signals, id);
        s.view.collapsedGroupIds = s.view.collapsedGroupIds.filter(
          (groupId) => groupId !== id,
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
        const found = findSignal(s.diagram.signals, signalId, (sig) => {
          currentStyle = normalizeSignalStyle(sig.style ?? {});
          nextStyle = normalizeSignalStyle({ ...(sig.style ?? {}), ...patch });
        });
        if (
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
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'vector') return;
          const seg = sig.segments.find((x) => x.id === segmentId);
          if (seg) seg.value = value;
        });
        s.view.isDirty = true;
      });
    },

    setVectorSpanRange(signalId, startStep, endStepInclusive, value, busColorFill, options) {
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'vector') return;
          sig.segments = applyVectorSpan(
            sig.segments,
            startStep,
            endStepInclusive,
            value,
            s.diagram.config.totalSteps,
            busColorFill,
            options,
          );
        });
        s.view.isDirty = true;
      });
    },

    updateVectorSegmentColor(signalId, segmentId, color) {
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'vector') return;
          const seg = sig.segments.find((x) => x.id === segmentId);
          if (!seg) return;
          if (color === undefined) delete seg.color;
          else seg.color = color;
        });
        s.view.isDirty = true;
      });
    },

    setSignalNodeAt(signalId, step, char) {
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          setNodeCharAt(sig, step, char, s.diagram.config.totalSteps);
        });
        s.view.isDirty = true;
      });
    },

    setSignalPhase(signalId, phase) {
      if (phase !== undefined && !Number.isFinite(phase)) return;
      set((s) => {
        let previous: number | undefined;
        const found = findSignal(s.diagram.signals, signalId, (sig) => {
          previous = sig.phase;
        });
        if (!found || previous === phase) return;
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
        const found = findSignal(s.diagram.signals, signalId, (sig) => {
          previous = sig.period;
        });
        if (!found || previous === next) return;
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
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (signal) => {
          if (signal.type !== 'bit') return;
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
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (signal) => {
          if (signal.type !== 'bit') return;
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
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
          applyBitStateInRange(sig, step, step, bitState);
        });
      });
    },

    setSignalStateRange(signalId, startStep, endStep, bitState) {
      set((s) => {
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          applyBitStateInRange(sig, lo, hi, bitState);
        });
      });
    },

    paintBitStateRange(signalId, startStep, endStep, bitState, paintStyle) {
      set((s) => {
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
            clearNodesAndEdges(s.diagram.signals, s.diagram.edges);
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
          const cells = paintDigitalTimingTicks(
            signal.digitalTiming,
            startTick,
            endTick,
            bitState,
            mode,
          );
          if (JSON.stringify(cells) === JSON.stringify(signal.digitalTiming.cells)) {
            return;
          }
          pushHistory(s);
          signal.digitalTiming.cells = cells;
          signal.states = cells.map((cell) => cell.state);
          signal.digitalTimingStatesEdited = true;
          delete signal.undulateRepeat;
          changed = true;
        });
        if (changed) s.view.isDirty = true;
      });
    },

    toggleSignalStateRange(signalId, startStep, endStep) {
      set((s) => {
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
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
        });
      });
    },

    paintToggleRange(signalId, startStep, endStep, paintStyle) {
      set((s) => {
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
          if (s.diagram.config.totalSteps + n > MAX_TOTAL_STEPS) return;
          pushHistory(s);
          insertGapColumnsOnDiagram(s.diagram.signals, lo, n, signalId);
          clearNodesAndEdges(s.diagram.signals, s.diagram.edges);
          s.diagram.config.totalSteps += n;
          s.view.isDirty = true;
        });
        return;
      }
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          toggleGapColumnsOnSignal(sig, lo, hi);
        });
        s.view.isDirty = true;
      });
    },

    toggleStepGlitchRange(signalId, startStep, endStep) {
      set((s) => {
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
        if (s.diagram.config.totalSteps + n > MAX_TOTAL_STEPS) return;
        pushHistory(s);
        insertGapColumnsOnDiagram(s.diagram.signals, column, n, signalId);
        clearNodesAndEdges(s.diagram.signals, s.diagram.edges);
        s.diagram.config.totalSteps += n;
        s.view.isDirty = true;
      });
    },

    removeGapColumnsRange(signalId, startStep, endStep) {
      set((s) => {
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        pushHistory(s);
        const removed = removeGapColumnsOnDiagram(
          s.diagram.signals,
          signalId,
          lo,
          hi,
          MIN_TOTAL_STEPS,
        );
        if (removed > 0) {
          clearNodesAndEdges(s.diagram.signals, s.diagram.edges);
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
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          clearStepGapsOnColumns(sig, lo, hi);
        });
        s.view.isDirty = true;
      });
    },

    eraseSignalState(signalId, step) {
      set((s) => {
        pushHistory(s);
        let target: Signal | undefined;
        findSignal(s.diagram.signals, signalId, (sig) => {
          target = sig;
        });
        if (!target) return;

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

    eraseSignalStateRange(signalId, startStep, endStep) {
      set((s) => {
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        let target: Signal | undefined;
        findSignal(s.diagram.signals, signalId, (sig) => {
          target = sig;
        });
        if (!target) return;

        const gapCols: number[] = [];
        const valueCols: number[] = [];
        for (let i = lo; i <= hi; i++) {
          if (target.stepGaps?.[i]) gapCols.push(i);
          else valueCols.push(i);
        }

        for (const i of gapCols) {
          clearStepGapsOnColumns(target, i, i);
        }

        if (valueCols.length > 0) {
          const vLo = Math.min(...valueCols);
          const vHi = Math.max(...valueCols);
          findSignal(s.diagram.signals, signalId, (sig) => {
            holdFillErasedSteps(sig, vLo, vHi);
          });
        }
        s.view.isDirty = true;
      });
    },

    reorderSignals(orderedIds, parentId) {
      set((s) => {
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
      set((s) => {
        const next = Math.max(
          MIN_TOTAL_STEPS,
          Math.min(MAX_TOTAL_STEPS, Math.floor(steps)),
        );
        const old = s.diagram.config.totalSteps;
        if (next === old) return;
        pushHistory(s);
        s.diagram.config.totalSteps = next;
        resizeAllStates(s.diagram.signals, next, old);
        s.view.isDirty = true;
      });
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
        const at = Math.max(0, Math.min(index, total));
        pushHistory(s);
        walkSignals(s.diagram.signals, (sig) => insertStepInSignal(sig, at, total));
        clearNodesAndEdges(s.diagram.signals, s.diagram.edges);
        s.diagram.config.totalSteps = total + 1;
        s.view.isDirty = true;
      });
    },

    deleteStepAt(index) {
      set((s) => {
        const total = s.diagram.config.totalSteps;
        if (total <= MIN_TOTAL_STEPS) return;
        const at = Math.max(0, Math.min(index, total - 1));
        let blocked = false;
        walkSignals(s.diagram.signals, (sig) => {
          if (sig.type === 'vector') {
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
        clearNodesAndEdges(s.diagram.signals, s.diagram.edges);
        s.diagram.config.totalSteps = total - 1;
        s.view.isDirty = true;
      });
    },

    toggleStepGapAt(column) {
      set((s) => {
        if (s.diagram.config.totalSteps >= MAX_TOTAL_STEPS) return;
        const at = Math.max(0, Math.min(column, s.diagram.config.totalSteps));
        pushHistory(s);
        insertGapColumnOnDiagram(s.diagram.signals, at, null);
        clearNodesAndEdges(s.diagram.signals, s.diagram.edges);
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
