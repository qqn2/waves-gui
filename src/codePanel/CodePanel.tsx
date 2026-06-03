import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDebounce } from 'use-debounce';
import { Copy, ExternalLink, Eye } from 'lucide-react';
import { useStore } from '../shared/store';
import { PanelResizeHandle } from '../shell/PanelResizeHandle';
import {
  CODE_PANEL_PREVIEW_SPLIT_DEFAULT,
  useCodePanelLayout,
} from '../shell/codePanelLayout';
import { CodeEditor } from './CodeEditor';
import { WavedromPreview } from './WavedromPreview';
import { diagramToCodeString, validateCodeString } from './codeSync';
import { useCodeToDiagram } from './useCodeToDiagram';
import styles from './CodePanel.module.css';

/** WaveDrom preview is expensive; keep JSON editor on the fast path. */
const PREVIEW_DEBOUNCE_MS = 300;

function wavedromEditorUrl(code: string): string {
  return `https://wavedrom.com/editor.html?${encodeURIComponent(code)}`;
}

export interface CodePanelProps {
  /** Hide the panel title (shown on layout chrome when docked). */
  hideTitle?: boolean;
}

export function CodePanel({ hideTitle = false }: CodePanelProps) {
  const diagram = useStore((s) => s.diagram);
  const [codeLayout, updateCodeLayout] = useCodePanelLayout();
  const editorAreaRef = useRef<HTMLDivElement>(null);
  const splitResizeBase = useRef(CODE_PANEL_PREVIEW_SPLIT_DEFAULT);
  const splitAreaSize = useRef(0);
  const [code, setCode] = useState(() => diagramToCodeString(diagram));
  const [showPreview, setShowPreview] = useState(true);
  const { debouncedApply, isEditorDrivenRef } = useCodeToDiagram();
  const diagramSyncGenRef = useRef(0);
  const [previewCode] = useDebounce(code, PREVIEW_DEBOUNCE_MS);

  const error = useMemo(() => validateCodeString(code), [code]);
  const splitAxis = codeLayout.placement === 'right' ? 'x' : 'y';
  const editorShare = `${codeLayout.previewSplit * 100}%`;

  // GUI → JSON: export after paint (not in render). Skip one cycle after JSON → GUI.
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

  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode);
      debouncedApply(newCode);
    },
    [debouncedApply],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // clipboard may be unavailable
    }
  }, [code]);

  const handleOpenExternal = useCallback(() => {
    window.open(wavedromEditorUrl(code), '_blank', 'noopener,noreferrer');
  }, [code]);

  const onPreviewSplitResizeStart = useCallback(() => {
    const el = editorAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    splitAreaSize.current = splitAxis === 'x' ? rect.width : rect.height;
    splitResizeBase.current = codeLayout.previewSplit;
  }, [codeLayout.previewSplit, splitAxis]);

  const onPreviewSplitResizeDelta = useCallback(
    (delta: number) => {
      const total = splitAreaSize.current;
      if (total <= 0) return;
      updateCodeLayout({
        previewSplit: splitResizeBase.current + delta / total,
      });
    },
    [updateCodeLayout],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        {hideTitle ? null : <span className={styles.title}>WaveDrom JSON</span>}
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={`${styles.iconBtn} ${showPreview ? styles.iconBtnActive : ''}`}
            onClick={() => setShowPreview((v) => !v)}
            title="Render with bundled WaveDrom (same JSON as editor.wavedrom.com)"
            aria-pressed={showPreview}
          >
            <Eye size={14} aria-hidden />
            <span>Preview</span>
          </button>
          <button type="button" className={styles.iconBtn} onClick={handleCopy} title="Copy">
            <Copy size={14} aria-hidden />
            <span>Copy</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleOpenExternal}
            title="Open in wavedrom.com editor (optional)"
          >
            <ExternalLink size={14} aria-hidden />
            <span>Web</span>
          </button>
        </div>
      </div>
      <div
        ref={editorAreaRef}
        className={
          showPreview
            ? splitAxis === 'x'
              ? `${styles.editorArea} ${styles.editorAreaSplitRow}`
              : `${styles.editorArea} ${styles.editorAreaSplitCol}`
            : styles.editorArea
        }
      >
        <div
          className={styles.editorPane}
          style={showPreview ? { flex: `0 0 ${editorShare}` } : undefined}
        >
          <CodeEditor
            code={code}
            onChange={handleCodeChange}
            onBlur={() => debouncedApply.flush()}
            error={error}
          />
        </div>
        {showPreview ? (
          <>
            <PanelResizeHandle
              axis={splitAxis}
              title={
                splitAxis === 'x'
                  ? 'Resize JSON / preview columns'
                  : 'Resize JSON / preview rows'
              }
              onResizeStart={onPreviewSplitResizeStart}
              onResizeDelta={onPreviewSplitResizeDelta}
            />
            <div className={styles.previewPane}>
              <WavedromPreview code={previewCode} error={error} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
