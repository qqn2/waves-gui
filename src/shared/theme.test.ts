import { describe, expect, it, beforeEach } from 'vitest';
import {
  isDarkTheme,
  isLightTheme,
  loadStoredTheme,
  saveStoredTheme,
  THEME_STORAGE_KEY,
} from './theme';
import { getSafeStorage } from '../shell/soloDesk/safeStorage';

describe('theme helpers', () => {
  beforeEach(() => {
    getSafeStorage().removeItem(THEME_STORAGE_KEY);
  });

  it('classifies light vs dark variants', () => {
    expect(isLightTheme('light')).toBe(true);
    expect(isLightTheme('light-hc')).toBe(true);
    expect(isDarkTheme('dark')).toBe(true);
    expect(isDarkTheme('dark-hc')).toBe(true);
    expect(isLightTheme('dark-hc')).toBe(false);
  });

  it('persists theme choice', () => {
    saveStoredTheme('dark-hc');
    expect(getSafeStorage().getItem(THEME_STORAGE_KEY)).toBe('dark-hc');
    expect(loadStoredTheme()).toBe('dark-hc');
  });

  it('rejects invalid stored theme', () => {
    getSafeStorage().setItem(THEME_STORAGE_KEY, 'neon');
    expect(loadStoredTheme()).toBeNull();
  });
});
