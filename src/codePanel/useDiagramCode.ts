import {
  createContext,
  createElement,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import { registerSourceHistory } from './documentHistory';
import { SourceDraftHistory } from './sourceDraftHistory';

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
  const historyRef = useRef<SourceDraftHistory | null>(null);
  if (!historyRef.current) {
    historyRef.current = new SourceDraftHistory(
      diagramToCodeString(useStore.getState().diagram),
      useStore.getState().view.sourceDraft,
    );
  }
  const historyRevisionRef = useRef(diagramRevision);
  const navigatingHistoryRef = useRef(false);
  const onApplied = useCallback((acceptedCode: string) => {
    historyRef.current!.accept(acceptedCode, navigatingHistoryRef.current);
    historyRevisionRef.current = useStore.getState().view.diagramRevision;
  }, []);
  const { applyCodeToDiagram, debouncedApply, suppressDiagramToCodeSyncRef } = useCodeToDiagram(onApplied);
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
      // Recovery can arrive after this provider mounts.
      if (historyRevisionRef.current !== diagramRevision) {
        historyRef.current = new SourceDraftHistory(
          diagramToCodeString(useStore.getState().diagram), sourceDraft,
        );
        historyRevisionRef.current = diagramRevision;
      } else historyRef.current!.edit(sourceDraft);
      setCode((prev) => (prev === sourceDraft ? prev : sourceDraft));
    }
  }, [sourceDraft, sourceDraftDirty, diagramRevision]);

  useEffect(() => {
    if (sourceDraftDirty) return;
    if (suppressDiagramToCodeSyncRef.current === diagramRevision) {
      suppressDiagramToCodeSyncRef.current = null;
      return;
    }
    const next = diagramToCodeString(useStore.getState().diagram);
    if (historyRevisionRef.current !== diagramRevision) {
      historyRef.current!.accept(next);
      historyRevisionRef.current = diagramRevision;
    }
    startTransition(() => {
      setCode((prev) => (prev === next ? prev : next));
    });
    setSourceDraftStatus(false, null);
  }, [diagramRevision, sourceDraftDirty, suppressDiagramToCodeSyncRef, setSourceDraftStatus]);

  const navigateSourceHistory = useCallback((direction: 'undo' | 'redo'): boolean => {
    // A canvas edit, file replacement, or document undo invalidates text redo.
    if (historyRevisionRef.current !== useStore.getState().view.diagramRevision) return false;
    const next = historyRef.current![direction]();
    if (next === undefined) return false;
    debouncedApply.cancel();
    setCode(next);
    if (historyRef.current!.isAccepted(next)) {
      // Restoring the accepted text is a draft-only undo. Re-parsing generated
      // canvas source would add source metadata and a spurious diagram undo.
      historyRef.current!.accept(next, true);
      suppressDiagramToCodeSyncRef.current = useStore.getState().view.diagramRevision;
      setSourceDraftStatus(false, null);
      return true;
    }
    setSourceDraftStatus(true, null, next);
    navigatingHistoryRef.current = true;
    try {
      applyCodeToDiagram(next);
    } finally {
      navigatingHistoryRef.current = false;
    }
    return true;
  }, [applyCodeToDiagram, debouncedApply, setSourceDraftStatus, suppressDiagramToCodeSyncRef]);

  useEffect(() => registerSourceHistory({
    undo: () => navigateSourceHistory('undo'),
    redo: () => navigateSourceHistory('redo'),
  }), [navigateSourceHistory]);

  const onCodeChange = useCallback(
    (newCode: string) => {
      historyRef.current!.edit(newCode);
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
