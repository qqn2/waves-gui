import { useState } from 'react';
import { useStore } from '../shared/store';
import { THEME_OPTIONS } from '../shared/theme';
import styles from './shell.module.css';

export function ThemeMenu() {
  const theme = useStore((s) => s.view.theme);
  const setTheme = useStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.addWrap}>
      <button
        type="button"
        className={`${styles.toolBtn} ${open ? styles.toolActive : ''}`}
        title="Appearance — high-contrast options help on TN panels"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Theme ▾
      </button>
      {open && (
        <div className={styles.themeDropdown} role="menu">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={theme === opt.id}
              className={theme === opt.id ? styles.themeOptionActive : undefined}
              title={opt.description}
              onClick={() => {
                setTheme(opt.id);
                setOpen(false);
              }}
            >
              <span className={styles.themeOptionLabel}>
                {theme === opt.id ? '✓ ' : ''}
                {opt.label}
              </span>
              <span className={styles.themeOptionHint}>{opt.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
