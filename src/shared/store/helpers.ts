import { current } from 'immer';
import type { AppState, DiagramState, Signal, SignalGroup, SignalOrGroup } from '../types';
import type { BitState } from '../types';
import { MAX_HISTORY } from '../constants';
import { createDefaultDiagram } from '../defaultDiagram';
import { loadLabelColumnWidth } from '../../shell/labelColumnLayout';
import type { ViewState } from '../types';

/** Snapshot diagram for undo. Use immer `current()` — do NOT structuredClone. */
export function pushHistory(state: AppState): void {
  state.history.push(current(state.diagram));
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.future = [];
  state.view.isDirty = true;
  state.view.diagramRevision += 1;
}

export function defaultDiagram(): DiagramState {
  return createDefaultDiagram();
}

export function defaultView(): ViewState {
  return {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    selectedTool: 'paint',
    paintMode: 'set',
    activeBitState: '1',
    activeBusLabel: 'data',
    activeTimespanLabel: '5 ms',
    activeBusColorIndex: 2,
    activeSignalIds: [],
    showCodePanel: true,
    showRenderPanel: true,
    labelWidth: loadLabelColumnWidth(),
    showTimeAxis: true,
    theme: 'light',
    accentColor: null,
    canvasColor: null,
    uiFontScale: 1,
    isDirty: false,
    fileName: null,
    paintDraft: null,
    edgeAnchorPending: null,
    edgeToolHover: null,
    activeEdgeShape: '',
    showAnchorLetters: false,
    diagramRevision: 0,
  };
}

/** Clear `stepGlitches` on boundaries that touch erased steps `[lo, hi]`. */
export function clearStepGlitchesTouchingRange(
  sig: Signal,
  lo: number,
  hi: number,
): void {
  if (sig.type !== 'bit' || !sig.stepGlitches?.length) return;
  const maxBoundaries = Math.max(0, sig.states.length - 1);
  while (sig.stepGlitches.length < maxBoundaries) {
    sig.stepGlitches.push(false);
  }
  if (sig.stepGlitches.length > maxBoundaries) {
    sig.stepGlitches.length = maxBoundaries;
  }
  for (let b = 0; b < maxBoundaries; b++) {
    if (b <= hi && b + 1 >= lo) {
      sig.stepGlitches[b] = false;
    }
  }
  if (!sig.stepGlitches.some(Boolean)) delete sig.stepGlitches;
}

/** Walk the signal tree to find a signal by id. Recurses into groups. */
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

export function findGroup(
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

export function removeFromTree(signals: SignalOrGroup[], id: string): SignalOrGroup[] {
  return signals
    .filter((sg) => sg.id !== id)
    .map((sg) => {
      if (sg.type === 'group') {
        return { ...sg, children: removeFromTree(sg.children, id) };
      }
      return sg;
    });
}

export function resizeAllStates(
  signals: SignalOrGroup[],
  newLen: number,
  oldLen: number,
): void {
  for (const sg of signals) {
    if (sg.type === 'group') {
      resizeAllStates(sg.children, newLen, oldLen);
    } else if (sg.type === 'bit') {
      if (newLen > oldLen) {
        const pad: BitState = oldLen > 0 ? sg.states[oldLen - 1]! : '0';
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

export function reorderSiblingLevel(
  siblings: SignalOrGroup[],
  orderedIds: string[],
): SignalOrGroup[] {
  const map = new Map(siblings.map((sg) => [sg.id, sg]));
  return orderedIds.map((id) => map.get(id)!).filter(Boolean);
}

export function insertIndexAfter(
  signals: SignalOrGroup[],
  afterId: string | undefined,
): number {
  if (!afterId) return signals.length;
  const i = signals.findIndex((sg) => sg.id === afterId);
  return i === -1 ? signals.length : i + 1;
}
