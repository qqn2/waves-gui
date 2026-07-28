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
  Signal,
  SignalOrGroup,
} from '../types';
import { normalizeDiagram } from '../normalizeDiagram';
import type { ImmerSet, StoreActions } from './storeActions';
import { diagramsEqual, findSignal, pushHistory } from './helpers';
import { parseUndulateEdge } from '../edgeSyntax';

function resetTransientDocumentView(s: AppState & StoreActions): void {
  s.view.scrollX = 0;
  s.view.scrollY = 0;
  s.view.paintDraft = null;
  s.view.edgeAnchorPending = null;
  s.view.structuredArrowPending = null;
  s.view.edgeToolHover = null;
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

function removeDigitalTiming(signals: SignalOrGroup[]): void {
  for (const signal of signals) {
    if (signal.type === 'group') {
      removeDigitalTiming(signal.children);
      continue;
    }
    if (signal.type !== 'bit' || !signal.digitalTiming) continue;
    const timing = signal.digitalTiming;
    const firstDuration = timing.cells[0]?.durationTicks;
    const uniformDuration = firstDuration !== undefined
      && timing.cells.every((cell) => cell.durationTicks === firstDuration);
    const exactIntegerPeriod = uniformDuration
      && firstDuration % timing.ticksPerStep === 0
      ? firstDuration / timing.ticksPerStep
      : null;
    if (exactIntegerPeriod !== null && exactIntegerPeriod >= 1) {
      signal.period = exactIntegerPeriod;
    } else {
      delete signal.period;
    }
    const phase = timing.phaseTicks / timing.ticksPerStep;
    if (phase === 0) delete signal.phase;
    else signal.phase = phase;
    delete signal.digitalTiming;
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
        const activeSignalIds = reconcileSignalSelection(
          s.diagram.signals,
          normalized.signals,
          s.view.activeSignalIds,
        );
        pushHistory(s);
        s.diagram = normalized;
        s.view.activeSignalIds = activeSignalIds;
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
        removeDigitalTiming(s.diagram.signals);
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
