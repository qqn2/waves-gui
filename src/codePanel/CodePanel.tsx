import { Copy, ExternalLink } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { confirmAndOpenInWavedrom } from './openInWavedrom';
import { useDiagramCode } from './useDiagramCode';
import styles from './CodePanel.module.css';

export function CodePanel() {
  const {
    code,
    format,
    error,
    onCodeChange,
    flushCodeToDiagram,
  } = useDiagramCode();

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
        <span className={styles.title}>
          {format === 'undulate' ? 'Undulate JSON' : 'WaveDrom JSON'}
        </span>
        <span className={styles.toolbarSpacer} />
        <div className={styles.toolbarActions}>
          {format === 'wavedrom' ? (
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => confirmAndOpenInWavedrom(code)}
              title="Open this JSON in the external WaveDrom Editor (privacy warning shown first)"
            >
              <ExternalLink size={14} aria-hidden />
              <span>Open in WaveDrom Editor</span>
            </button>
          ) : null}
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
            format={format}
          />
        </div>
      </div>
    </div>
  );
}
