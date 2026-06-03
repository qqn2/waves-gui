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
  const diagram = useStore((s) => s.diagram);
  const [code, setCode] = useState(() => diagramToCodeString(diagram));
  const { debouncedApply, isEditorDrivenRef } = useCodeToDiagram();
  const diagramSyncGenRef = useRef(0);
  const [previewCode] = useDebounce(code, PREVIEW_DEBOUNCE_MS);

  const error = useMemo(() => validateCodeString(code), [code]);

  useEffect(() => {
    if (isEditorDrivenRef.current) {
      isEditorDrivenRef.current = false;
      return;
    }
    const gen = ++diagramSyncGenRef.current;
    queueMicrotask(() => {
      if (gen !== diagramSyncGenRef.current) return;
      const next = diagramToCodeString(useStore.getState().diagram);
      startTransition(() => {
        setCode((prev) => (prev === next ? prev : next));
      });
    });
  }, [diagram, isEditorDrivenRef]);

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
