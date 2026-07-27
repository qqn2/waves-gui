import { useCallback, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useStore } from '../shared/store';
import {
  CODE_DEBOUNCE_MS,
  diagramCodeFormat,
  parseCodeToDiagram,
} from './codeSync';
import { registerCodeDebounceCancel, registerCodeFlush } from './flushRegistry';

export function useCodeToDiagram(onApplied?: () => void) {
  const applyDiagramEdit = useStore((s) => s.applyDiagramEdit);
  const suppressDiagramToCodeSyncRef = useRef<number | null>(null);

  const applyCodeToDiagram = useCallback(
    (newCode: string): string | null => {
      const preferUndulate =
        diagramCodeFormat(useStore.getState().diagram) === 'undulate';
      const result = parseCodeToDiagram(newCode, { preferUndulate });
      if (result.ok === false) return result.error;
      applyDiagramEdit(result.diagram);
      suppressDiagramToCodeSyncRef.current = useStore.getState().view.diagramRevision;
      onApplied?.();
      return null;
    },
    [applyDiagramEdit, onApplied],
  );

  const debouncedApply = useDebouncedCallback((newCode: string) => {
    applyCodeToDiagram(newCode);
  }, CODE_DEBOUNCE_MS);

  useEffect(() => {
    return registerCodeFlush(() => {
      debouncedApply.flush();
    });
  }, [debouncedApply]);

  useEffect(() => {
    return registerCodeDebounceCancel(() => {
      debouncedApply.cancel();
    });
  }, [debouncedApply]);

  return {
    applyCodeToDiagram,
    debouncedApply,
    suppressDiagramToCodeSyncRef,
  };
}
