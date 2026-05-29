export { CodePanel } from './CodePanel';
export { flushPendingCodeToDiagram } from './flushRegistry';

/**
 * Wire point: Track C calls flushPendingCodeToDiagram() from tools/codeFlush.ts
 * (re-export). CodePanel mounts useCodeToDiagram, which registers
 * debouncedApply.flush() via registerCodeFlush on mount.
 */
