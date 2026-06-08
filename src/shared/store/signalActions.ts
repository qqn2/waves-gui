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
import { toggleBinaryBitState, isClockBitState, resolvePaintValue, isHoldPaintValue } from '../bitToggle';
import { applyVectorSpan } from '../vectorSegments';
import type { BitState, Signal, SignalGroup, SignalOrGroup } from '../types';
import type { ImmerSet, StoreActions } from './storeActions';
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

export function createSignalActions(set: ImmerSet): Pick<
  StoreActions,
  | 'addSignal'
  | 'addGroup'
  | 'removeSignal'
  | 'renameSignal'
  | 'setSignalState'
  | 'setSignalStateRange'
  | 'toggleSignalStateRange'
  | 'toggleStepGlitchRange'
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

    setVectorSpanRange(signalId, startStep, endStepInclusive, value, busColorFill) {
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
          sig.states[step] = resolvePaintValue(sig.states, step, bitState);
        });
      });
    },

    setSignalStateRange(signalId, startStep, endStep, bitState) {
      set((s) => {
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
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
        });
      });
    },

    toggleSignalStateRange(signalId, startStep, endStep) {
      set((s) => {
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
          if (sig.states.every(isClockBitState)) {
            applyClockToggleToRange(sig.states, lo, hi);
          } else {
            for (let i = lo; i <= hi; i++) {
              sig.states[i] = toggleBinaryBitState(sig.states[i]);
            }
          }
        });
      });
    },

    toggleStepGlitchRange(signalId, startStep, endStep) {
      set((s) => {
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit' || sig.states.length < 2) return;
          const maxBoundaries = sig.states.length - 1;
          if (!sig.stepGlitches) sig.stepGlitches = [];
          while (sig.stepGlitches.length < maxBoundaries) {
            sig.stepGlitches.push(false);
          }
          if (sig.stepGlitches.length > maxBoundaries) {
            sig.stepGlitches.length = maxBoundaries;
          }
          for (let i = lo; i < hi && i < maxBoundaries; i++) {
            sig.stepGlitches[i] = !sig.stepGlitches[i];
          }
          if (!sig.stepGlitches.some(Boolean)) delete sig.stepGlitches;
        });
      });
    },

    eraseSignalState(signalId, step) {
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type === 'bit') {
            sig.states[step] = step > 0 ? sig.states[step - 1]! : '0';
            clearStepGlitchesTouchingRange(sig, step, step);
          }
        });
      });
    },

    eraseSignalStateRange(signalId, startStep, endStep) {
      set((s) => {
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type !== 'bit') return;
          for (let i = lo; i <= hi; i++) {
            sig.states[i] = i > 0 ? sig.states[i - 1]! : '0';
          }
          clearStepGlitchesTouchingRange(sig, lo, hi);
        });
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
  };
}
