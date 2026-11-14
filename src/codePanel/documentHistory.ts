import { useStore } from '../shared/store';
import { flushPendingCodeToDiagram } from './flushRegistry';

interface SourceHistory {
  undo: () => boolean;
  redo: () => boolean;
}

let sourceHistory: SourceHistory | null = null;

export function registerSourceHistory(history: SourceHistory): () => void {
  sourceHistory = history;
  return () => {
    if (sourceHistory === history) sourceHistory = null;
  };
}

/** Invalid source stays editable; it must never block undo of the text itself. */
export function undoDocument(): void {
  if (!flushPendingCodeToDiagram().ok) {
    sourceHistory?.undo();
    return;
  }
  useStore.getState().undo();
}

export function redoDocument(): void {
  if (sourceHistory?.redo()) return;
  if (!flushPendingCodeToDiagram().ok) return;
  useStore.getState().redo();
}
