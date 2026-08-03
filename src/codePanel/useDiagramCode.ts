import {
  createContext,
  createElement,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useDebounce } from 'use-debounce';
import { useStore } from '../shared/store';
import {
  detectCodeFormat,
  diagramCodeFormat,
  diagramToCodeString,
  validateCodeString,
  type DiagramCodeFormat,
} from './codeSync';
import { useCodeToDiagram } from './useCodeToDiagram';

const PREVIEW_DEBOUNCE_MS = 300;

export interface DiagramCodeContextValue {
  code: string;
  setCode: (code: string) => void;
  previewCode: string;
  format: DiagramCodeFormat;
  error: string | null;
  onCodeChange: (code: string) => void;
  flushCodeToDiagram: () => void;
}

const DiagramCodeContext = createContext<DiagramCodeContextValue | null>(null);

export function DiagramCodeProvider({ children }: { children: ReactNode }) {
  const diagramRevision = useStore((s) => s.view.diagramRevision);
  const sourceDraftDirty = useStore((s) => s.view.sourceDraftDirty === true);
  const sourceDraft = useStore((s) => s.view.sourceDraft);
  const setSourceDraftStatus = useStore((s) => s.setSourceDraftStatus);
  const preferredFormat = useStore((s) => diagramCodeFormat(s.diagram));
  const preferUndulate = preferredFormat !== 'wavedrom';
  const preferYAML = preferredFormat === 'undulate-yaml';
  const preferTOML = preferredFormat === 'undulate-toml';
  const [code, setCode] = useState(() => useStore.getState().view.sourceDraft ?? diagramToCodeString(useStore.getState().diagram));
  const { debouncedApply, suppressDiagramToCodeSyncRef } = useCodeToDiagram();
  const [previewCode] = useDebounce(code, PREVIEW_DEBOUNCE_MS);

  const format = useMemo(
    () => detectCodeFormat(code, { preferUndulate, preferYAML, preferTOML }),
    [code, preferUndulate, preferYAML, preferTOML],
  );
  const error = useMemo(
    () => validateCodeString(code, { preferUndulate, preferYAML, preferTOML }),
    [code, preferUndulate, preferYAML, preferTOML],
  );

  useEffect(() => {
    if (sourceDraftDirty && sourceDraft !== null && sourceDraft !== undefined) {
      setCode((prev) => (prev === sourceDraft ? prev : sourceDraft));
    }
  }, [sourceDraft, sourceDraftDirty]);

  useEffect(() => {
    if (sourceDraftDirty) return;
    if (suppressDiagramToCodeSyncRef.current === diagramRevision) {
      suppressDiagramToCodeSyncRef.current = null;
      return;
    }
    const next = diagramToCodeString(useStore.getState().diagram);
    startTransition(() => {
      setCode((prev) => (prev === next ? prev : next));
    });
    setSourceDraftStatus(false, null);
  }, [diagramRevision, sourceDraftDirty, suppressDiagramToCodeSyncRef, setSourceDraftStatus]);

  const onCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      setSourceDraftStatus(true, null, newCode);
      debouncedApply(newCode);
    },
    [debouncedApply, setSourceDraftStatus],
  );

  const value = useMemo<DiagramCodeContextValue>(
    () => ({
      code,
      setCode,
      previewCode,
      format,
      error,
      onCodeChange,
      flushCodeToDiagram: () => debouncedApply.flush(),
    }),
    [code, previewCode, format, error, onCodeChange, debouncedApply],
  );

  return createElement(DiagramCodeContext.Provider, { value }, children);
}

export function useDiagramCode(): DiagramCodeContextValue {
  const ctx = useContext(DiagramCodeContext);
  if (!ctx) {
    throw new Error('useDiagramCode requires DiagramCodeProvider');
  }
  return ctx;
}
