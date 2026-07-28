import { Copy, ExternalLink } from 'lucide-react';
import { CodeEditor } from './CodeEditor';
import { confirmAndOpenInWavedrom } from './openInWavedrom';
import { useDiagramCode } from './useDiagramCode';
import { useStore } from '../shared/store';
import { diagramWithUndulateCodeFormat } from './codeSync';
import { switchCurrentDiagramFileFormat } from '../shell/FileOperations';
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

  const handleFormatSwitch = (next: 'undulate' | 'undulate-yaml') => {
    if (error || format === next) return;
    flushCodeToDiagram();
    const store = useStore.getState();
    const sourceFormat =
      next === 'undulate-yaml' ? 'undulate-yaml' : 'undulate-json';
    switchCurrentDiagramFileFormat(sourceFormat);
    store.applyDiagramEdit(diagramWithUndulateCodeFormat(store.diagram, next));
  };

  return (
    <div className={styles.panel}>
      <div className={`${styles.toolbar} ${styles.toolbarCompact}`}>
        <span className={styles.title}>
          {format === 'undulate-yaml'
            ? 'Undulate YAML'
            : format === 'undulate' ? 'Undulate JSON' : 'WaveDrom JSON'}
        </span>
        {format !== 'wavedrom' ? (
          <div
            className={styles.formatToggle}
            role="group"
            aria-label="Undulate editor syntax"
            title={
              error
                ? 'Fix the current source before changing syntax'
                : 'Convert the current Undulate document between JSON and YAML'
            }
          >
            <button
              type="button"
              className={`${styles.formatToggleButton} ${
                format === 'undulate' ? styles.formatToggleButtonActive : ''
              }`}
              aria-pressed={format === 'undulate'}
              disabled={Boolean(error)}
              onClick={() => handleFormatSwitch('undulate')}
            >
              JSON
            </button>
            <button
              type="button"
              className={`${styles.formatToggleButton} ${
                format === 'undulate-yaml' ? styles.formatToggleButtonActive : ''
              }`}
              aria-pressed={format === 'undulate-yaml'}
              disabled={Boolean(error)}
              onClick={() => handleFormatSwitch('undulate-yaml')}
            >
              YAML
            </button>
          </div>
        ) : null}
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
