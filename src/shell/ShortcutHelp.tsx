import styles from './shell.module.css';

export interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'V', action: 'Pointer tool' },
  { keys: 'D', action: 'Draw (paint) tool' },
  { keys: 'E', action: 'Erase tool' },
  { keys: 'G', action: 'Draw + glitch mode' },
  { keys: '1 / 0 / P / N / Z / X', action: 'Primary paint values' },
  { keys: 'p / n / U', action: 'More paint values (toolbar More ▾)' },
  { keys: 'T', action: 'Draw + toggle (NOT) mode' },
  { keys: 'Shift+N', action: 'Clock N (arrow negedge)' },
  { keys: 'Ctrl+Z / Ctrl+Y', action: 'Undo / redo' },
  { keys: 'Ctrl+A', action: 'Select all signals' },
  { keys: 'Del / Backspace', action: 'Clear selected steps or remove selected rows' },
  { keys: 'Esc', action: 'Cancel drag / edge placement' },
  { keys: 'Ctrl + +/−/0', action: 'Zoom in / out / reset' },
];

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  if (!open) return null;

  return (
    <div
      className={styles.shortcutBackdrop}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={onClose}
    >
      <div
        className={styles.shortcutDialog}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={styles.shortcutHeader}>
          <h2 className={styles.shortcutTitle}>Keyboard shortcuts</h2>
          <button type="button" className={styles.shortcutClose} onClick={onClose}>
            ×
          </button>
        </header>
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
      </div>
    </div>
  );
}
