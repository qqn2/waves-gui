import { useCallback, useEffect, useRef } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useStore } from '../shared/store';
import {
  CODE_DEBOUNCE_MS,
  diagramCodeFormat,
  parseCodeToDiagram,
} from './codeSync';
import {
  registerCodeDebounceCancel,
  registerCodeFlush,
  type CodeFlushResult,
} from './flushRegistry';

export function useCodeToDiagram(onApplied?: () => void) {
  const applyDiagramEdit = useStore((s) => s.applyDiagramEdit);
  const setSourceDraftStatus = useStore((s) => s.setSourceDraftStatus);
  const suppressDiagramToCodeSyncRef = useRef<number | null>(null);
  const lastApplyResultRef = useRef<CodeFlushResult>({ ok: true });

  const applyCodeToDiagram = useCallback(
    (newCode: string): string | null => {
      const format = diagramCodeFormat(useStore.getState().diagram);
      const result = parseCodeToDiagram(newCode, {
        preferUndulate: format !== 'wavedrom',
        preferYAML: format === 'undulate-yaml',
        preferTOML: format === 'undulate-toml',
      });
      if (result.ok === false) {
        lastApplyResultRef.current = { ok: false, error: result.error };
        setSourceDraftStatus(true, result.error, newCode);
        return result.error;
      }
      applyDiagramEdit(result.diagram);
      suppressDiagramToCodeSyncRef.current = useStore.getState().view.diagramRevision;
      lastApplyResultRef.current = { ok: true };
      setSourceDraftStatus(false, null);
      onApplied?.();
      return null;
    },
    [applyDiagramEdit, onApplied, setSourceDraftStatus],
  );

  const debouncedApply = useDebouncedCallback((newCode: string) => {
    applyCodeToDiagram(newCode);
  }, CODE_DEBOUNCE_MS);

  useEffect(() => {
    return registerCodeFlush(() => {
      debouncedApply.flush();
      return lastApplyResultRef.current;
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
