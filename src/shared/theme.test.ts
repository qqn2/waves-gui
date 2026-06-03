/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyThemeSettings,
  defaultThemeSettings,
  loadThemeSettings,
  migrateLegacyTheme,
  normalizeThemeSettings,
  saveThemeSettings,
  THEME_STORAGE_KEY,
} from './theme';
import { getSafeStorage } from '../shell/soloDesk/safeStorage';

describe('theme helpers', () => {
  beforeEach(() => {
    getSafeStorage().removeItem(THEME_STORAGE_KEY);
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.style.cssText = '';
  });

  it('defaults to light preset', () => {
    expect(defaultThemeSettings().theme).toBe('light');
  });

  it('migrates legacy dark themes to light-grey', () => {
    expect(migrateLegacyTheme('dark')).toBe('light-grey');
    expect(migrateLegacyTheme('dark-hc')).toBe('light-grey');
    expect(migrateLegacyTheme('light-hc')).toBe('light');
  });

  it('persists full settings envelope', () => {
    saveThemeSettings({
      version: 2,
      theme: 'light-grey',
      accentColor: '#0d9488',
      canvasColor: '#ffffff',
      uiFontScale: 1.1,
    });
    const loaded = loadThemeSettings();
    expect(loaded.theme).toBe('light-grey');
    expect(loaded.accentColor).toBe('#0d9488');
    expect(loaded.canvasColor).toBe('#ffffff');
    expect(loaded.uiFontScale).toBe(1.1);
  });

  it('migrates v1 plain string storage', () => {
    getSafeStorage().setItem(THEME_STORAGE_KEY, 'dark-hc');
    expect(loadThemeSettings().theme).toBe('light-grey');
  });

  it('rejects invalid stored values', () => {
    getSafeStorage().setItem(THEME_STORAGE_KEY, 'neon');
    expect(loadThemeSettings().theme).toBe('light');
  });

  it('applyThemeSettings sets data-theme and custom properties', () => {
    applyThemeSettings(
      normalizeThemeSettings({
        theme: 'light',
        accentColor: '#ea580c',
        canvasColor: '#faf8f5',
        uiFontScale: 1.1,
      }),
    );
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#ea580c');
    expect(document.documentElement.style.getPropertyValue('--bg-canvas')).toBe('#faf8f5');
    expect(document.documentElement.style.getPropertyValue('--ui-font-scale')).toBe('1.1');
  });
});
