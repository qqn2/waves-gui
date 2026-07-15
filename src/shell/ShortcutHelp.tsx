import styles from './shell.module.css';

export interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'V / D / E', action: 'Pointer / draw / erase tool' },
  { keys: 'G / | / T', action: 'Glitch / timeline gap / toggle mode' },
  { keys: '1 / 0 / P / N / Z / X', action: 'Primary paint values' },
  { keys: 'Ctrl+Z / Ctrl+Y', action: 'Undo / redo' },
  { keys: 'Ctrl+S', action: 'Save to the opened file, or Save As' },
  { keys: 'Ctrl+A', action: 'Select all signals' },
  { keys: 'Del / Backspace', action: 'Clear steps or remove selected rows' },
  { keys: 'Esc', action: 'Cancel drag or edge placement' },
  { keys: 'Ctrl + + / − / 0', action: 'Zoom in / out / reset' },
];

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  if (!open) return null;

  return (
    <div
      className={styles.shortcutBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-about-title"
      onClick={onClose}
    >
      <div className={styles.shortcutDialog} onClick={(event) => event.stopPropagation()}>
        <header className={styles.shortcutHeader}>
          <h2 id="help-about-title" className={styles.shortcutTitle}>Help &amp; About</h2>
          <button type="button" aria-label="Close help" className={styles.shortcutClose} onClick={onClose}>
            ×
          </button>
        </header>

        <h3 className={styles.shortcutSectionTitle}>Keyboard shortcuts</h3>
        <table className={styles.shortcutTable}>
          <tbody>
            {SHORTCUTS.map((row) => (
              <tr key={row.keys}>
                <td className={styles.shortcutKeys}>{row.keys}</td>
                <td>{row.action}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className={styles.shortcutSectionTitle}>Privacy</h3>
        <p className={styles.shortcutText}>
          Editing and rendering stay in this browser. The full recovery draft and recent filenames are stored in localStorage, do not synchronize, and disappear when site data is cleared. No diagram is sent to WaveDrom or another service.
        </p>
        <p className={styles.shortcutText}>
          This is an independent community project and is not affiliated with or endorsed by WaveDrom or its maintainers.
        </p>
        <nav className={styles.shortcutLinks} aria-label="Project links">
          <a href="https://github.com/qqn2/waves-gui" target="_blank" rel="noreferrer">Source</a>
          <a href="https://github.com/qqn2/waves-gui/issues/new/choose" target="_blank" rel="noreferrer">Report a bug</a>
          <a href="/licenses/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer">Licenses</a>
        </nav>
      </div>
    </div>
  );
}
