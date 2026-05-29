import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ExternalLink } from 'lucide-react';
import { useStore } from '../shared/store';
import { CodeEditor } from './CodeEditor';
import { diagramToCodeString, validateCodeString } from './codeSync';
import { useCodeToDiagram } from './useCodeToDiagram';
import styles from './CodePanel.module.css';

function wavedromEditorUrl(code: string): string {
  return `https://wavedrom.com/editor.html?${encodeURIComponent(code)}`;
}

export function CodePanel() {
  const diagram = useStore((s) => s.diagram);
  const isEditorFocusedRef = useRef(false);
  const [code, setCode] = useState(() => diagramToCodeString(diagram));
  const { debouncedApply, isEditorDrivenRef } = useCodeToDiagram();

  const error = useMemo(() => validateCodeString(code), [code]);

  useEffect(() => {
    if (isEditorDrivenRef.current) {
      isEditorDrivenRef.current = false;
      return;
    }
    if (isEditorFocusedRef.current) return;
    setCode(diagramToCodeString(diagram));
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

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <span className={styles.title}>WaveDrom JSON</span>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.iconBtn} onClick={handleCopy} title="Copy">
            <Copy size={14} aria-hidden />
            <span>Copy</span>
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={handleOpenExternal}
            title="Open in WaveDrom Editor"
          >
            <ExternalLink size={14} aria-hidden />
            <span>Open</span>
          </button>
        </div>
      </div>
      <div className={styles.editorArea}>
        <CodeEditor
          code={code}
          onChange={handleCodeChange}
          error={error}
          onFocusChange={(focused) => {
            isEditorFocusedRef.current = focused;
          }}
        />
      </div>
    </div>
  );
}
