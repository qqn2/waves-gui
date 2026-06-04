/** Registered by CodePanel on mount — see useCodeToDiagram.registerFlush */
let flushFn: (() => void) | null = null;
let cancelDebounceFn: (() => void) | null = null;

export function registerCodeFlush(fn: () => void): () => void {
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
export function flushPendingCodeToDiagram(): void {
  flushFn?.();
}

/** Drop a pending JSON → diagram apply (template load, file open, New). */
export function cancelPendingCodeToDiagramDebounce(): void {
  cancelDebounceFn?.();
}
