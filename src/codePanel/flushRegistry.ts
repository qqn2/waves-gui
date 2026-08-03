export type CodeFlushResult =
  | { ok: true }
  | { ok: false; error: string };

/** Registered by CodePanel on mount — see useCodeToDiagram.registerFlush */
let flushFn: (() => void | CodeFlushResult) | null = null;
let cancelDebounceFn: (() => void) | null = null;

export function registerCodeFlush(
  fn: () => void | CodeFlushResult,
): () => void {
  flushFn = fn;
  return () => {
    if (flushFn === fn) flushFn = null;
  };
}

export function registerCodeDebounceCancel(fn: () => void): () => void {
  cancelDebounceFn = fn;
  return () => {
    if (cancelDebounceFn === fn) cancelDebounceFn = null;
  };
}

/** Flush pending debounced editor → diagram sync (canvas pointerdown / focus). */
export function flushPendingCodeToDiagram(): CodeFlushResult {
  const result = flushFn?.();
  return result && 'ok' in result
    ? result
    : { ok: true };
}

/** Drop a pending JSON → diagram apply (template load, file open, New). */
export function cancelPendingCodeToDiagramDebounce(): void {
  cancelDebounceFn?.();
}
