import { current } from 'immer';
import { cancelPendingCodeToDiagramDebounce } from '../../codePanel/flushRegistry';
import { pruneUnusedNodeAnchorsAfterEdgeRemoval } from '../../wavedromBridge/nodeString';
import type { DiagramState, EdgeAnchorPending, PaintDraft } from '../types';
import { normalizeDiagram } from '../normalizeDiagram';
import type { ImmerSet, StoreActions } from './storeActions';
import { pushHistory } from './helpers';

export function createEdgeActions(set: ImmerSet): Pick<
  StoreActions,
  | 'addDiagramEdge'
  | 'updateDiagramEdge'
  | 'removeDiagramEdge'
  | 'setEdgeCurveControl'
  | 'setActiveEdgeShape'
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

    setActiveEdgeShape(shape) {
      set((s) => {
        s.view.activeEdgeShape = shape;
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
  | 'clearAll'
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
        s.view.diagramRevision += 1;
        s.history = [];
        s.future = [];
        s.diagram = normalizeDiagram(diagram);
        s.view.isDirty = false;
        s.view.scrollX = 0;
        s.view.scrollY = 0;
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

    markClean(fileName) {
      set((s) => {
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
