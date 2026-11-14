import { useRecoveryStatus } from './recoveryStatus';
import styles from './RecoveryStatus.module.css';

export function RecoveryStatus() {
  const { status, savedAt, restored } = useRecoveryStatus();
  const message = status === 'saved'
    ? 'Recovery saved in browser'
    : status === 'unavailable'
      ? 'Recovery unavailable — save a file'
      : 'Saving recovery…';
  const description = status === 'unavailable'
    ? 'Browser storage is unavailable or full. Save your work to a file before closing this page.'
    : `A recovery copy stays in this browser. Use File → Save to save a file.${
      savedAt ? ` Last recovery save: ${new Date(savedAt).toLocaleTimeString()}.` : ''
    }`;

  return (
    <span className={styles.recovery}>
      <span
        role="status"
        aria-label="Browser recovery status"
        className={status === 'unavailable' ? styles.unavailable : undefined}
        title={description}
      >
        {message}
      </span>
      {restored ? (
        <span className={styles.restored} role="status">
          Restored browser draft
          <button
            type="button"
            aria-label="Dismiss recovery notice"
            title="Dismiss recovery notice"
            onClick={() => useRecoveryStatus.setState({ restored: false })}
          >
            ×
          </button>
        </span>
      ) : null}
    </span>
  );
}
