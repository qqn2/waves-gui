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
import { diagramToCodeString, validateCodeString } from './codeSync';
import { useCodeToDiagram } from './useCodeToDiagram';

const PREVIEW_DEBOUNCE_MS = 300;

export interface DiagramCodeContextValue {
  code: string;
  setCode: (code: string) => void;
  previewCode: string;
  error: string | null;
  onCodeChange: (code: string) => void;
  flushCodeToDiagram: () => void;
}

const DiagramCodeContext = createContext<DiagramCodeContextValue | null>(null);

export function DiagramCodeProvider({ children }: { children: ReactNode }) {
  const diagramRevision = useStore((s) => s.view.diagramRevision);
  const [code, setCode] = useState(() => diagramToCodeString(useStore.getState().diagram));
  const { debouncedApply, suppressDiagramToCodeSyncRef } = useCodeToDiagram();
  const [previewCode] = useDebounce(code, PREVIEW_DEBOUNCE_MS);

  const error = useMemo(() => validateCodeString(code), [code]);

  useEffect(() => {
    if (suppressDiagramToCodeSyncRef.current === diagramRevision) {
      suppressDiagramToCodeSyncRef.current = null;
      return;
    }
    const next = diagramToCodeString(useStore.getState().diagram);
    startTransition(() => {
      setCode((prev) => (prev === next ? prev : next));
    });
  }, [diagramRevision, suppressDiagramToCodeSyncRef]);

  const onCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      debouncedApply(newCode);
    },
    [debouncedApply],
  );

  const value = useMemo<DiagramCodeContextValue>(
    () => ({
      code,
      setCode,
      previewCode,
      error,
      onCodeChange,
      flushCodeToDiagram: () => debouncedApply.flush(),
    }),
    [code, previewCode, error, onCodeChange, debouncedApply],
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
