import { nanoid } from 'nanoid';
import { setNodeCharAt } from '../../wavedromBridge/nodeString';
import {
  applyClockBrushToRange,
  applyClockToggleToRange,
  isClockFallStep,
  isClockRiseStep,
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
  isRepeatingClockLane,
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
import type { BitState, Signal, SignalGroup, SignalOrGroup } from '../types';
import type { ImmerSet, StoreActions } from './storeActions';
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

function demoteWaveLaneOnStatesEdit(sig: Signal): void {
  if (isSubcycleWaveLane(sig)) {
    clearWaveMode(sig);
  }
}

function canDeleteStepAt(signals: SignalOrGroup[], at: number): boolean {
  let blocked = false;
  walkSignals(signals, (sig) => {
    if (sig.type !== 'vector') return;
    for (const seg of sig.segments) {
      if (
        seg.startStep <= at &&
        seg.endStep > at &&
        seg.endStep - seg.startStep <= 1
      ) {
        blocked = true;
      }
    }
  });
  return !blocked;
}

function deleteDiagramStepAt(
  signals: SignalOrGroup[],
  edges: string[],
  at: number,
  total: number,
): boolean {
  if (!canDeleteStepAt(signals, at)) return false;
  walkSignals(signals, (sig) => {
    deleteStepInSignal(sig, at, total, MIN_TOTAL_STEPS);
  });
  clearNodesAndEdges(signals, edges);
  return true;
}

function holdFillErasedSteps(sig: Signal, lo: number, hi: number): void {
  if (sig.type !== 'bit' || isWaveModeLane(sig)) return;
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
        if (decoded.states.some(isClockBitState)) {
          normalizeBinaryPaintOnClockLane(decoded.states, lo, hi, bitState);
        }
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
    if (sig.states.some(isClockBitState)) {
      normalizeBinaryPaintOnClockLane(sig.states, lo, hi, bitState);
    }
  }
}

/** Collapse redundant clock fall edges when painting explicit 0/1 into a clock lane. */
function normalizeBinaryPaintOnClockLane(
  states: BitState[],
  lo: number,
  hi: number,
  bitState: BitState,
): void {
  if (bitState !== '0' && bitState !== '1') return;
  for (let i = lo; i <= hi; i++) {
    if (bitState === '0') {
      if (i > 0 && isClockFallStep(states[i - 1]!)) {
        states[i - 1] = '0';
      }
      if (
        i + 2 < states.length &&
        isClockFallStep(states[i + 1]!) &&
        isClockRiseStep(states[i + 2]!)
      ) {
        states[i + 1] = '0';
      }
    }
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

export function createSignalActions(set: ImmerSet): Pick<
  StoreActions,
  | 'addSignal'
  | 'duplicateSignal'
  | 'addGroup'
  | 'removeSignal'
  | 'renameSignal'
  | 'setSignalState'
  | 'setSignalStateRange'
  | 'paintBitStateRange'
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
  | 'setTotalSteps'
  | 'setHscale'
  | 'insertStepAt'
  | 'deleteStepAt'
  | 'toggleStepGapAt'
  | 'setDiagramSkin'
> {
  return {
    addSignal(type, afterId) {
      set((s) => {
        pushHistory(s);
        const states = new Array<BitState>(s.diagram.config.totalSteps).fill('0');
        const signal: Signal = {
          id: nanoid(),
          name: type === 'vector' ? 'bus' : 'sig',
          type,
          states,
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
          color: DEFAULT_SIGNAL_COLOR,
          rowHeight: ROW_HEIGHT,
        };
        s.diagram.signals.splice(
          insertIndexAfter(s.diagram.signals, afterId),
          0,
          signal,
        );
      });
    },

    duplicateSignal(id) {
      set((s) => {
        pushHistory(s);
        duplicateSignalInDraft(s.diagram.signals, id);
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
          collapsed: false,
        };
        s.diagram.signals.splice(
          insertIndexAfter(s.diagram.signals, afterId),
          0,
          group,
        );
      });
    },

    removeSignal(id) {
      set((s) => {
        pushHistory(s);
        s.diagram.signals = removeFromTree(s.diagram.signals, id);
      });
    },

    renameSignal(id, name) {
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, id, (sig) => {
          sig.name = name;
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
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (phase === undefined) delete sig.phase;
          else sig.phase = phase;
        });
        s.view.isDirty = true;
      });
    },

    setSignalPeriod(signalId, period) {
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (period === undefined || period < 1) delete sig.period;
          else sig.period = Math.floor(period);
        });
        s.view.isDirty = true;
      });
    },

    setActiveSignalIds(ids) {
      set((s) => {
        s.view.activeSignalIds = ids;
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
            if (
              !isHoldPaintValue(bitState) &&
              !isClockBitState(bitState) &&
              decoded.states.some(isClockBitState)
            ) {
              normalizeBinaryPaintOnClockLane(decoded.states, lo, hi, bitState);
            }
          }, sig.states.length);
        });
        s.view.isDirty = true;
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

        if (isRepeatingClockLane(target)) {
          if (s.diagram.config.totalSteps <= MIN_TOTAL_STEPS) return;
          const total = s.diagram.config.totalSteps;
          if (!deleteDiagramStepAt(s.diagram.signals, s.diagram.edges, step, total)) {
            return;
          }
          s.diagram.config.totalSteps = total - 1;
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

        if (isRepeatingClockLane(target)) {
          const gapSet = new Set(gapCols);
          let deleted = 0;
          for (let i = hi; i >= lo; i--) {
            if (gapSet.has(i)) continue;
            if (s.diagram.config.totalSteps - deleted <= MIN_TOTAL_STEPS) break;
            const total = s.diagram.config.totalSteps - deleted;
            if (!deleteDiagramStepAt(s.diagram.signals, s.diagram.edges, i, total)) {
              break;
            }
            deleted++;
          }
          if (deleted > 0) {
            s.diagram.config.totalSteps -= deleted;
          }
          s.view.isDirty = true;
          return;
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
