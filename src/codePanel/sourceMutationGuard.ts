import { flushPendingCodeToDiagram } from './flushRegistry';

/** Run a document mutation only after the Source draft has been applied. */
export function runAfterSourceFlush(action: () => void): boolean {
  if (!flushPendingCodeToDiagram().ok) return false;
  action();
  return true;
}
