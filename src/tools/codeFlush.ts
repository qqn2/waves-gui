/**
 * Re-export for Track C — implementation in src/codePanel/flushRegistry.ts.
 * CodePanel registers debouncedApply.flush() on mount via useCodeToDiagram.
 */
export { flushPendingCodeToDiagram } from '../codePanel/flushRegistry';
