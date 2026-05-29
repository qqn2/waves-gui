/** Registered by CodePanel on mount — see useCodeToDiagram.registerFlush */
let flushFn: (() => void) | null = null;

export function registerCodeFlush(fn: () => void): () => void {
  flushFn = fn;
  return () => {
    if (flushFn === fn) flushFn = null;
  };
}

/** Flush pending debounced editor → diagram sync (canvas pointerdown / focus). */
export function flushPendingCodeToDiagram(): void {
  flushFn?.();
}
