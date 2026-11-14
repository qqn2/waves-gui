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
} from './flushRegistry';

export function useCodeToDiagram(onApplied?: (code: string) => void) {
  const applyDiagramEdit = useStore((s) => s.applyDiagramEdit);
  const setSourceDraftStatus = useStore((s) => s.setSourceDraftStatus);
  const suppressDiagramToCodeSyncRef = useRef<number | null>(null);

  const applyCodeToDiagram = useCallback(
    (newCode: string): string | null => {
      const format = diagramCodeFormat(useStore.getState().diagram);
      const result = parseCodeToDiagram(newCode, {
        preferUndulate: format !== 'wavedrom',
        preferYAML: format === 'undulate-yaml',
        preferTOML: format === 'undulate-toml',
      });
      if (result.ok === false) {
        setSourceDraftStatus(true, result.error, newCode);
        return result.error;
      }
      applyDiagramEdit(result.diagram);
      suppressDiagramToCodeSyncRef.current = useStore.getState().view.diagramRevision;
      setSourceDraftStatus(false, null);
      onApplied?.(newCode);
      return null;
    },
    [applyDiagramEdit, onApplied, setSourceDraftStatus],
  );

  const debouncedApply = useDebouncedCallback((newCode: string) => {
    applyCodeToDiagram(newCode);
  }, CODE_DEBOUNCE_MS);

  useEffect(() => {
    return registerCodeFlush(() => {
      debouncedApply.cancel();
      const { sourceDraftDirty, sourceDraft } = useStore.getState().view;
      if (!sourceDraftDirty || sourceDraft == null) return { ok: true };
      // Restored drafts have no scheduled debounce or cached validation result.
      // Always validate the current draft before a document action.
      const error = applyCodeToDiagram(sourceDraft);
      return error === null ? { ok: true } : { ok: false, error };
    });
  }, [applyCodeToDiagram, debouncedApply]);

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
