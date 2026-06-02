import { Component, type ErrorInfo, type ReactNode } from 'react';
import { clearDraft } from './soloDesk/localDraft';
import { isBrowserStoragePersistent } from './soloDesk/safeStorage';
import styles from './shell.module.css';

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

function formatError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === 'string' && error.length > 0) {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    const msg = (error as { message: unknown }).message;
    if (typeof msg === 'string' && msg.length > 0) {
      return msg;
    }
  }
  try {
    return String(error);
  } catch {
    return 'An unexpected error occurred.';
  }
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error('[WaveDrom GUI] render error', error, info.componentStack);
  }

  private handleClearDraft = (): void => {
    clearDraft();
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.error) {
      return this.props.children;
    }

    const storageHint = isBrowserStoragePersistent()
      ? 'An outdated autosave in local storage can also cause this.'
      : 'Firefox reported storage errors (IndexedDB/SQLite busy). Draft autosave may be disabled in this session.';

    return (
      <div className={styles.errorFallback}>
        <h1 className={styles.errorTitle}>Editor failed to load</h1>
        <p className={styles.errorMessage}>{formatError(this.state.error)}</p>
        <p className={styles.errorHint}>
          {storageHint} Try <strong>Clear draft &amp; reload</strong>, or delete{' '}
          <code>wavedrom-gui-draft</code> in DevTools → Application → Local Storage.
          If Firefox logs many <code>NS_ERROR_STORAGE_BUSY</code> errors, restart the browser
          or use a private window.
        </p>
        <div className={styles.errorActions}>
          <button type="button" className={styles.errorBtn} onClick={this.handleClearDraft}>
            Clear draft &amp; reload
          </button>
          <button
            type="button"
            className={styles.errorBtnSecondary}
            onClick={() => window.location.reload()}
          >
            Reload only
          </button>
        </div>
      </div>
    );
  }
}
