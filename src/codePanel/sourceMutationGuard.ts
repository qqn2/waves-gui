import { flushPendingCodeToDiagram } from './flushRegistry';
import { useStore } from '../shared/store';

/** Run a document mutation only after the Source draft has been applied. */
export function runAfterSourceFlush(action: () => void): boolean {
  const revisionBeforeFlush = useStore.getState().view.diagramRevision;
  if (!flushPendingCodeToDiagram().ok) return false;
  // A successful flush may have replaced the document and invalidated an
  // index/ID captured by the rendered control. Require the user to retry
  // against the refreshed view; canvas pointer-down has its own re-hit-test.
  if (useStore.getState().view.diagramRevision !== revisionBeforeFlush) return false;
  action();
  return true;
}
