import { useEffect } from 'react';
import { useStore } from '../shared/store';
import { useFileStatus } from './fileStatus';
import { BusLabelWarning } from './BusLabelWarning';
import styles from './DocumentStatus.module.css';

export function DocumentStatus() {
  const fileName = useStore((state) => state.view.fileName);
  const dirty = useStore((state) => state.view.isDirty || state.view.sourceDraftDirty);
  const { phase, confirmedFileName, error } = useFileStatus();
  const name = fileName ?? 'Untitled';
  const label = phase === 'saving' ? 'Saving to disk…'
    : phase === 'error' ? 'Save failed'
      : phase === 'download-requested' ? 'Download requested — check your downloads'
        : dirty ? 'Unsaved changes'
          : confirmedFileName && confirmedFileName === fileName ? 'Saved to disk'
            : 'Not saved to disk';

  useEffect(() => {
    document.title = `${dirty ? '• ' : ''}${name} — Waves GUI`;
  }, [dirty, name]);

  return (
    <div className={styles.documentBar} aria-label="Current document">
      <span className={styles.fileName} aria-label="Current filename" title={name}>
        {name}
      </span>
      <BusLabelWarning />
      <span
        className={phase === 'error' ? styles.error : styles.status}
        role="status"
        aria-label="Document save status"
        title={error ?? undefined}
      >
        {label}{phase === 'error' && error ? `: ${error}` : ''}
      </span>
    </div>
  );
}
