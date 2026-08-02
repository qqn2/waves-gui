/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach } from 'vitest';
import {
  applyThemeSettings,
  canvasColorForTheme,
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

  it('migrates legacy dark themes to the dark preset', () => {
    expect(migrateLegacyTheme('dark')).toBe('dark');
    expect(migrateLegacyTheme('dark-hc')).toBe('dark');
    expect(migrateLegacyTheme('light-hc')).toBe('light');
  });

  it('uses the dark canvas default instead of retained light presets', () => {
    expect(canvasColorForTheme('dark', '#ffffff')).toBeNull();
    expect(canvasColorForTheme('dark', '#f5f8fa')).toBeNull();
    expect(canvasColorForTheme('dark', '#16202e')).toBe('#16202e');
    expect(canvasColorForTheme('light', '#ffffff')).toBe('#ffffff');
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
    expect(loadThemeSettings().theme).toBe('dark');
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
