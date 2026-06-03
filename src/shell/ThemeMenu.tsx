import { useState } from 'react';
import { useStore } from '../shared/store';
import {
  ACCENT_PRESETS,
  CANVAS_PRESETS,
  THEME_OPTIONS,
  UI_FONT_SCALES,
} from '../shared/theme';
import styles from './shell.module.css';

export function ThemeMenu() {
  const theme = useStore((s) => s.view.theme);
  const accentColor = useStore((s) => s.view.accentColor);
  const canvasColor = useStore((s) => s.view.canvasColor);
  const uiFontScale = useStore((s) => s.view.uiFontScale);
  const setTheme = useStore((s) => s.setTheme);
  const setAccentColor = useStore((s) => s.setAccentColor);
  const setCanvasColor = useStore((s) => s.setCanvasColor);
  const setUiFontScale = useStore((s) => s.setUiFontScale);
  const [open, setOpen] = useState(false);

  const activeAccent = accentColor ?? ACCENT_PRESETS[0]!.hex;

  return (
    <div className={styles.addWrap}>
      <button
        type="button"
        className={`${styles.toolBtn} ${open ? styles.toolActive : ''}`}
        title="Appearance"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        Theme ▾
      </button>
      {open ? (
        <div className={styles.themePopover} role="dialog" aria-label="Appearance">
          <div className={styles.themeRow}>
            <span className={styles.themeRowLabel}>Base</span>
            <div className={styles.themePillGroup} role="group" aria-label="Base theme">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={
                    theme === opt.id
                      ? `${styles.themePill} ${styles.themePillActive}`
                      : styles.themePill
                  }
                  title={opt.description}
                  aria-pressed={theme === opt.id}
                  onClick={() => setTheme(opt.id)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.themeRow}>
            <span className={styles.themeRowLabel}>Accent</span>
            <div className={styles.themeRowControls}>
              {ACCENT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={styles.themeColorSwatch}
                  style={{ background: preset.hex }}
                  title={preset.label}
                  aria-label={`Accent ${preset.label}`}
                  aria-pressed={accentColor === preset.hex}
                  onClick={() => setAccentColor(preset.hex)}
                />
              ))}
              <label className={styles.themeColorCustom} title="Custom accent">
                <input
                  type="color"
                  value={activeAccent}
                  aria-label="Custom accent"
                  onChange={(e) => setAccentColor(e.target.value.toLowerCase())}
                />
              </label>
              <button
                type="button"
                className={styles.themeMiniBtn}
                title="Reset accent"
                onClick={() => setAccentColor(null)}
              >
                Reset
              </button>
            </div>
          </div>

          <div className={styles.themeRow}>
            <span className={styles.themeRowLabel}>Canvas</span>
            <div className={styles.themeRowControls}>
              {CANVAS_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={
                    preset.hex === ''
                      ? `${styles.themeColorSwatch} ${styles.themeColorSwatchDefault}`
                      : styles.themeColorSwatch
                  }
                  style={preset.hex ? { background: preset.hex } : undefined}
                  title={preset.label}
                  aria-label={`Canvas ${preset.label}`}
                  aria-pressed={
                    preset.hex === '' ? canvasColor === null : canvasColor === preset.hex
                  }
                  onClick={() => setCanvasColor(preset.hex || null)}
                />
              ))}
              <label className={styles.themeColorCustom} title="Custom canvas">
                <input
                  type="color"
                  value={canvasColor ?? '#fafafa'}
                  aria-label="Custom canvas"
                  onChange={(e) => setCanvasColor(e.target.value.toLowerCase())}
                />
              </label>
            </div>
          </div>

          <div className={styles.themeRow}>
            <span className={styles.themeRowLabel}>Text</span>
            <div className={styles.themePillGroup} role="group" aria-label="Text size">
              {UI_FONT_SCALES.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={
                    uiFontScale === opt.value
                      ? `${styles.themePill} ${styles.themePillActive}`
                      : styles.themePill
                  }
                  aria-pressed={uiFontScale === opt.value}
                  onClick={() => setUiFontScale(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
