import { useCallback, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useStore } from '../shared/store';
import { CODE_DEBOUNCE_MS, parseCodeToDiagram } from './codeSync';
import { registerCodeFlush } from './flushRegistry';

export function useCodeToDiagram(onApplied?: () => void) {
  const loadDiagram = useStore((s) => s.loadDiagram);
  const isEditorDrivenRef = useRef(false);

  const applyCodeToDiagram = useCallback(
    (newCode: string): string | null => {
      const result = parseCodeToDiagram(newCode);
      if (result.ok === false) return result.error;
      isEditorDrivenRef.current = true;
      loadDiagram(result.diagram);
      onApplied?.();
      return null;
    },
    [loadDiagram, onApplied],
  );

  const debouncedApply = useDebouncedCallback((newCode: string) => {
    applyCodeToDiagram(newCode);
  }, CODE_DEBOUNCE_MS);

  useEffect(() => {
    return registerCodeFlush(() => {
      debouncedApply.flush();
    });
  }, [debouncedApply]);

  return {
    applyCodeToDiagram,
    debouncedApply,
    isEditorDrivenRef,
  };
}
