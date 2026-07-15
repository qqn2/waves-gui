import { Copy } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { useDiagramCode } from './useDiagramCode';
import styles from './CodePanel.module.css';

export function CodePanel() {
  const { code, error, onCodeChange, flushCodeToDiagram } = useDiagramCode();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // clipboard may be unavailable
    }
  };

  return (
    <div className={styles.panel}>
      <div className={`${styles.toolbar} ${styles.toolbarCompact}`}>
        <div className={styles.toolbarActions}>
          <button type="button" className={styles.iconBtn} onClick={handleCopy} title="Copy">
            <Copy size={14} aria-hidden />
            <span>Copy</span>
          </button>
        </div>
      </div>
      <div className={styles.editorArea}>
        <div className={styles.editorPane}>
          <CodeEditor
            code={code}
            onChange={onCodeChange}
            onBlur={flushCodeToDiagram}
            error={error}
          />
        </div>
      </div>
    </div>
  );
}
