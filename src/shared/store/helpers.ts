import { current } from 'immer';
import { resizeBitSignalToLength } from '../bitStepResize';
import { resizeAnalogueCells } from '../analogue';
import { canResizeTimingToDuration, resizeTimingToDuration } from '../timedStepResize';
import type { AppState, DiagramState, Signal, SignalGroup, SignalOrGroup } from '../types';
import { MAX_HISTORY } from '../constants';
import { createDefaultDiagram } from '../defaultDiagram';
import { loadLabelColumnWidth } from '../../shell/labelColumnLayout';
import type { ViewState } from '../types';
import { normalizeTimedVectorSegments } from '../vectorSegments';

/** Notify derived views after a diagram mutation without creating undo history. */
export function markDiagramChanged(state: AppState): void {
  state.view.isDirty = true;
  state.view.diagramRevision += 1;
}

/** Snapshot diagram for undo. Use immer `current()` — do NOT structuredClone. */
export function pushHistory(state: AppState): void {
  state.history.push(current(state.diagram));
  if (state.history.length > MAX_HISTORY) state.history.shift();
  state.future = [];
  markDiagramChanged(state);
}

export function diagramsEqual(a: DiagramState, b: DiagramState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isDocumentDirty(
  state: Pick<AppState, 'diagram' | 'savedDiagram'>,
): boolean {
  return !diagramsEqual(state.diagram, state.savedDiagram);
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
    paintStyle: 'replace',
    activeBitState: '1',
    activeAnalogueKind: 'step',
    activeAnalogueValue: 0.9,
    activeBusLabel: 'data',
    activeTimespanLabel: '5 ms',
    activeEdgeLabel: '',
    activeBusColorIndex: 2,
    activeSignalIds: [],
    activeTimingCellIndex: null,
    activeAnnotationId: null,
    collapsedGroupIds: [],
    showInspector: false,
    showCodePanel: true,
    showRenderPanel: true,
    labelWidth: loadLabelColumnWidth(),
    theme: 'light',
    accentColor: null,
    canvasColor: null,
    uiFontScale: 1,
    isDirty: false,
    sourceDraftDirty: false,
    sourceDraft: null,
    sourceDraftError: null,
    fileName: null,
    paintDraft: null,
    edgeAnchorPending: null,
    structuredArrowPending: null,
    annotationSnapToGrid: true,
    edgeToolHover: null,
    activeEdgeConnector: '~>',
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
      resizeBitSignalToLength(sg, newLen, oldLen);
    } else if (sg.type === 'vector') {
      if (sg.vectorTiming) {
        resizeTimingToDuration(
          sg.vectorTiming,
          newLen * Math.max(1, sg.vectorTiming.ticksPerStep),
        );
        sg.segments = normalizeTimedVectorSegments(
          sg.segments,
          sg.vectorTiming.cells.length,
        );
        continue;
      }
      for (const seg of sg.segments) {
        if (seg.endStep > newLen) seg.endStep = newLen;
        if (seg.startStep >= newLen) seg.startStep = Math.max(0, newLen - 1);
      }
      const last = sg.segments[sg.segments.length - 1];
      if (last && last.endStep < newLen) last.endStep = newLen;
    } else if (sg.type === 'analogue') {
      resizeAnalogueCells(sg, newLen);
    }
  }
}

export function canResizeAllStates(
  signals: SignalOrGroup[],
  newLen: number,
): boolean {
  return signals.every((sg) => {
    if (sg.type === 'group') return canResizeAllStates(sg.children, newLen);
    const timing = sg.type === 'bit'
      ? sg.digitalTiming
      : sg.type === 'vector'
        ? sg.vectorTiming
        : undefined;
    return !timing || canResizeTimingToDuration(
      timing,
      newLen * Math.max(1, timing.ticksPerStep),
    );
  });
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
