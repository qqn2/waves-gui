import { current } from 'immer';
import { cancelPendingCodeToDiagramDebounce } from '../../codePanel/flushRegistry';
import {
  allocateNodeChars,
  findSignalInDiagram,
  formatArrowEdge,
  pruneUnusedNodeAnchorsAfterEdgeRemoval,
  setNodeCharAt,
  visibleNodeCharAt,
} from '../../wavedromBridge/nodeString';
import type {
  AppState,
  DiagramState,
  EdgeAnchorPending,
  PaintDraft,
  SignalOrGroup,
} from '../types';
import { normalizeDiagram } from '../normalizeDiagram';
import type { ImmerSet, StoreActions } from './storeActions';
import { diagramsEqual, pushHistory } from './helpers';

function resetTransientDocumentView(s: AppState & StoreActions): void {
  s.view.scrollX = 0;
  s.view.scrollY = 0;
  s.view.paintDraft = null;
  s.view.edgeAnchorPending = null;
  s.view.edgeToolHover = null;
}

function disableExtensionView(s: AppState & StoreActions): void {
  s.view.activeAnnotationId = null;
  s.view.activeSignalIds = [];
  if (
    s.view.activeBitState === 'h'
    || s.view.activeBitState === 'H'
    || s.view.activeBitState === 'l'
    || s.view.activeBitState === 'L'
  ) {
    s.view.activeBitState = '1';
  }
  if (
    s.view.selectedTool === 'annotation'
    || s.view.selectedTool === 'vertical-line'
    || s.view.selectedTool === 'horizontal-line'
    || s.view.selectedTool === 'global-compression'
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

export function createEdgeActions(set: ImmerSet): Pick<
  StoreActions,
  | 'addDiagramEdge'
  | 'addDiagramArrow'
  | 'updateDiagramEdge'
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
        if (
          from.step < 0
          || from.step >= totalSteps
          || to.step < 0
          || to.step >= totalSteps
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
        resetTransientDocumentView(s);
      });
    },

    applyDiagramEdit(diagram: DiagramState) {
      set((s) => {
        const normalized = normalizeDiagram(diagram);
        if (diagramsEqual(current(s.diagram), normalized)) return;
        pushHistory(s);
        s.diagram = normalized;
        s.view.paintDraft = null;
        s.view.edgeAnchorPending = null;
        s.view.edgeToolHover = null;
      });
    },

    clearAll() {
      set((s) => {
        pushHistory(s);
        s.diagram.signals = [];
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

    removeUndulateFeatures() {
      set((s) => {
        pushHistory(s);
        s.diagram.annotations = [];
        s.diagram.signals = removeAnalogueSignals(s.diagram.signals);
        s.diagram.version = 2;
        s.diagram.compatibility = {
          ...s.diagram.compatibility,
          extensionsEnabled: false,
          sourceFormat: 'wavedrom-json',
        };
        delete s.diagram.compatibility.sourceRevision;
        disableExtensionView(s);
      });
    },

    markClean(fileName) {
      set((s) => {
        s.savedDiagram = normalizeDiagram(current(s.diagram));
        s.view.isDirty = false;
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
