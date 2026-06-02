import { create } from 'zustand';
import { current } from 'immer';
import { immer } from 'zustand/middleware/immer';
import { nanoid } from 'nanoid';
import type {
  AppState,
  DiagramState,
  Signal,
  SignalGroup,
  SignalOrGroup,
  BitState,
  Annotation,
  Tool,
  Theme,
  ViewState,
  PaintDraft,
  PaintMode,
} from './types';
import { toggleBinaryBitState } from './bitToggle';
import {
  DEFAULT_STEPS,
  DEFAULT_HSCALE,
  DEFAULT_SIGNAL_COLOR,
  MAX_HISTORY,
  MAX_TOTAL_STEPS,
  MIN_TOTAL_STEPS,
  MIN_ZOOM,
  MAX_ZOOM,
  ROW_HEIGHT,
} from './constants';
import { normalizeDiagram } from './normalizeDiagram';
import { applyVectorSpan } from './vectorSegments';
import { saveStoredTheme } from './theme';
import {
  clampLabelColumnWidth,
  loadLabelColumnWidth,
  saveLabelColumnWidth,
} from '../shell/labelColumnLayout';

export interface Actions {
  // Signals
  addSignal(type: Signal['type'], afterId?: string): void;
  /** WaveDrom group bracket — empty section; add signals via drag or import */
  addGroup(afterId?: string, name?: string): void;
  removeSignal(id: string): void;
  renameSignal(id: string, name: string): void;
  setSignalState(signalId: string, step: number, bitState: BitState): void;
  setSignalStateRange(
    signalId: string,
    startStep: number,
    endStep: number,
    bitState: BitState,
  ): void;
  toggleSignalStateRange(signalId: string, startStep: number, endStep: number): void;
  eraseSignalState(signalId: string, step: number): void;
  eraseSignalStateRange(signalId: string, startStep: number, endStep: number): void;
  reorderSignals(orderedIds: string[], parentId?: string): void;
  /** Move a bit/vector/spacer lane into a section (group) or back to the root list */
  moveSignalToParent(
    signalId: string,
    parentId?: string,
    beforeId?: string,
  ): void;
  updateVectorSegmentValue(signalId: string, segmentId: string, value: string): void;
  setVectorSpanRange(
    signalId: string,
    startStep: number,
    endStepInclusive: number,
    value: string | null,
  ): void;
  setSignalPhase(signalId: string, phase: number | undefined): void;
  setSignalPeriod(signalId: string, period: number | undefined): void;
  setActiveSignalIds(ids: string[]): void;
  setTotalSteps(steps: number): void;
  setHscale(hscale: number): void;
  // Annotations
  addAnnotation(annotation: Annotation): void;
  updateAnnotation(id: string, updates: Partial<Annotation>): void;
  removeAnnotation(id: string): void;
  // Document
  loadDiagram(diagram: DiagramState): void;
  clearAll(): void;
  markClean(fileName: string): void;
  // History + paint draft
  undo(): void;
  redo(): void;
  setPaintDraft(draft: PaintDraft): void;
  clearPaintDraft(): void;
  // View
  setZoom(zoom: number): void;
  setScroll(x: number, y: number): void;
  setTool(tool: Tool): void;
  setActiveBitState(state: BitState): void;
  setActiveBusLabel(label: string): void;
  setPaintMode(mode: PaintMode): void;
  toggleCodePanel(): void;
  setLabelWidth(width: number): void;
  toggleTimeAxis(): void;
  setTheme(theme: Theme): void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultDiagram(): DiagramState {
  return {
    version: 1,
    signals: [],
    config: { totalSteps: DEFAULT_STEPS, hscale: DEFAULT_HSCALE },
    edges: [],
    annotations: [],
  };
}

function defaultView(): ViewState {
  return {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    selectedTool: 'cursor',
    paintMode: 'set',
    activeBitState: '1',
    activeBusLabel: 'data',
    activeSignalIds: [],
    showCodePanel: true,
    labelWidth: loadLabelColumnWidth(),
    showTimeAxis: true,
    theme: 'light',
    isDirty: false,
    fileName: null,
    paintDraft: null,
  };
}

/** Snapshot diagram for undo. Use immer `current()` — do NOT structuredClone. */
function pushHistory(state: AppState): void {
  state.history.push(current(state.diagram));
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.future = [];
  state.view.isDirty = true;
}

/** Walk the signal tree to find a signal by id, call fn on it. Recurses into groups. */
export function findSignal(
  signals: SignalOrGroup[],
  id: string,
  fn: (s: Signal) => void,
): boolean {
  for (const sg of signals) {
    if (sg.type === 'group') {
      if (findSignal(sg.children, id, fn)) return true;
    } else if (sg.id === id) {
      fn(sg);
      return true;
    }
  }
  return false;
}

/** Walk the signal tree to find a group by id, call fn on it. */
function findGroup(
  signals: SignalOrGroup[],
  id: string,
  fn: (g: SignalGroup) => void,
): boolean {
  for (const sg of signals) {
    if (sg.type !== 'group') continue;
    if (sg.id === id) {
      fn(sg);
      return true;
    }
    if (findGroup(sg.children, id, fn)) return true;
  }
  return false;
}

/** Remove a signal/group by id anywhere in the tree (recurses into group children). */
function removeFromTree(signals: SignalOrGroup[], id: string): SignalOrGroup[] {
  return signals
    .filter((sg) => sg.id !== id)
    .map((sg) => {
      if (sg.type === 'group') {
        return { ...sg, children: removeFromTree(sg.children, id) };
      }
      return sg;
    });
}

/** After totalSteps changes, resize bit lanes and clamp vector segment spans. */
function resizeAllStates(
  signals: SignalOrGroup[],
  newLen: number,
  oldLen: number,
): void {
  for (const sg of signals) {
    if (sg.type === 'group') {
      resizeAllStates(sg.children, newLen, oldLen);
    } else if (sg.type === 'bit') {
      if (newLen > oldLen) {
        const pad = oldLen > 0 ? sg.states[oldLen - 1]! : '0';
        while (sg.states.length < newLen) {
          sg.states.push(pad);
        }
      } else if (newLen < oldLen) {
        sg.states.length = newLen;
      }
    } else if (sg.type === 'vector') {
      for (const seg of sg.segments) {
        if (seg.endStep > newLen) seg.endStep = newLen;
        if (seg.startStep >= newLen) seg.startStep = Math.max(0, newLen - 1);
      }
      const last = sg.segments[sg.segments.length - 1];
      if (last && last.endStep < newLen) last.endStep = newLen;
    }
  }
}

function annotationReferencesSignal(a: Annotation, signalId: string): boolean {
  switch (a.type) {
    case 'arrow':
      return a.fromSignalId === signalId || a.toSignalId === signalId;
    case 'text':
      return a.signalId === signalId;
    default:
      return false;
  }
}

function reorderSiblingLevel(
  siblings: SignalOrGroup[],
  orderedIds: string[],
): SignalOrGroup[] {
  const map = new Map(siblings.map((sg) => [sg.id, sg]));
  return orderedIds.map((id) => map.get(id)!).filter(Boolean);
}

// ── Store ─────────────────────────────────────────────────────────────────────

export const useStore = create<AppState & Actions>()(
  immer((set) => ({
    diagram: defaultDiagram(),
    view: defaultView(),
    history: [],
    future: [],

    // ── Signal mutations ────────────────────────────────────────────────────

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
                    value: '0',
                  },
                ]
              : [],
          color: DEFAULT_SIGNAL_COLOR,
          rowHeight: ROW_HEIGHT,
        };
        const idx = afterId
          ? (() => {
              const i = s.diagram.signals.findIndex((sg) => sg.id === afterId);
              return i === -1 ? s.diagram.signals.length : i + 1;
            })()
          : s.diagram.signals.length;
        s.diagram.signals.splice(idx, 0, signal);
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
        const idx = afterId
          ? (() => {
              const i = s.diagram.signals.findIndex((sg) => sg.id === afterId);
              return i === -1 ? s.diagram.signals.length : i + 1;
            })()
          : s.diagram.signals.length;
        s.diagram.signals.splice(idx, 0, group);
      });
    },

    removeSignal(id) {
      set((s) => {
        pushHistory(s);
        s.diagram.signals = removeFromTree(s.diagram.signals, id);
        s.diagram.annotations = s.diagram.annotations.filter(
          (a) => !annotationReferencesSignal(a, id),
        );
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

    setVectorSpanRange(signalId, startStep, endStepInclusive, value) {
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
          );
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
          if (sig.type === 'bit') sig.states[step] = bitState;
        });
      });
    },

    setSignalStateRange(signalId, startStep, endStep, bitState) {
      set((s) => {
        pushHistory(s);
        const lo = Math.min(startStep, endStep);
        const hi = Math.max(startStep, endStep);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type === 'bit') {
            for (let i = lo; i <= hi; i++) sig.states[i] = bitState;
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
          if (sig.type === 'bit') {
            for (let i = lo; i <= hi; i++) {
              sig.states[i] = toggleBinaryBitState(sig.states[i]);
            }
          }
        });
      });
    },

    eraseSignalState(signalId, step) {
      set((s) => {
        pushHistory(s);
        findSignal(s.diagram.signals, signalId, (sig) => {
          if (sig.type === 'bit') {
            sig.states[step] = step > 0 ? sig.states[step - 1]! : '0';
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
        s.diagram.config.hscale = Math.max(1, Math.min(4, hscale));
        s.view.isDirty = true;
      });
    },

    // ── Annotations ─────────────────────────────────────────────────────────

    addAnnotation(annotation) {
      set((s) => {
        pushHistory(s);
        s.diagram.annotations.push(annotation);
      });
    },

    updateAnnotation(id, updates) {
      set((s) => {
        const idx = s.diagram.annotations.findIndex((a) => a.id === id);
        if (idx !== -1) Object.assign(s.diagram.annotations[idx]!, updates);
        s.view.isDirty = true;
      });
    },

    removeAnnotation(id) {
      set((s) => {
        pushHistory(s);
        s.diagram.annotations = s.diagram.annotations.filter((a) => a.id !== id);
      });
    },

    // ── Document operations ──────────────────────────────────────────────────

    loadDiagram(diagram) {
      set((s) => {
        s.history = [];
        s.future = [];
        s.diagram = normalizeDiagram(diagram);
        s.view.isDirty = false;
        s.view.scrollX = 0;
        s.view.scrollY = 0;
        s.view.paintDraft = null;
      });
    },

    clearAll() {
      set((s) => {
        pushHistory(s);
        s.diagram.signals = [];
        s.diagram.annotations = [];
      });
    },

    markClean(fileName) {
      set((s) => {
        s.view.isDirty = false;
        s.view.fileName = fileName;
      });
    },

    // ── History ──────────────────────────────────────────────────────────────

    undo() {
      set((s) => {
        if (s.history.length === 0) return;
        s.future.push(current(s.diagram));
        s.diagram = normalizeDiagram(s.history.pop()!);
        s.view.paintDraft = null;
      });
    },

    redo() {
      set((s) => {
        if (s.future.length === 0) return;
        s.history.push(current(s.diagram));
        s.diagram = normalizeDiagram(s.future.pop()!);
        s.view.paintDraft = null;
      });
    },

    setPaintDraft(draft) {
      set((s) => {
        s.view.paintDraft = draft;
      });
    },

    clearPaintDraft() {
      set((s) => {
        s.view.paintDraft = null;
      });
    },

    // ── View ─────────────────────────────────────────────────────────────────

    setZoom(zoom) {
      set((s) => {
        s.view.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
      });
    },

    setScroll(x, y) {
      set((s) => {
        s.view.scrollX = Math.max(0, x);
        s.view.scrollY = Math.max(0, y);
      });
    },

    setTool(tool) {
      set((s) => {
        s.view.selectedTool = tool;
      });
    },

    setActiveBitState(state) {
      set((s) => {
        s.view.activeBitState = state;
        s.view.paintMode = 'set';
      });
    },

    setActiveBusLabel(label) {
      set((s) => {
        s.view.activeBusLabel = label;
      });
    },

    setPaintMode(mode) {
      set((s) => {
        s.view.paintMode = mode;
      });
    },

    toggleCodePanel() {
      set((s) => {
        s.view.showCodePanel = !s.view.showCodePanel;
      });
    },

    setLabelWidth(width) {
      const next = clampLabelColumnWidth(width);
      set((s) => {
        s.view.labelWidth = next;
      });
      saveLabelColumnWidth(next);
    },

    toggleTimeAxis() {
      set((s) => {
        s.view.showTimeAxis = !s.view.showTimeAxis;
      });
    },

    setTheme(theme) {
      saveStoredTheme(theme);
      set((s) => {
        s.view.theme = theme;
      });
    },
  })),
);
