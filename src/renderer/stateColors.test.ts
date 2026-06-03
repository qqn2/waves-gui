/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { DEFAULT_SIGNAL_COLOR } from '../shared/constants';
import { resolveSignalColor, themeSignalColor } from './stateColors';

describe('resolveSignalColor', () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.documentElement;
    root.style.setProperty('--signal-default', '#ea580c');
  });

  afterEach(() => {
    root.style.removeProperty('--signal-default');
  });

  it('maps theme-linked default blues to --signal-default', () => {
    expect(resolveSignalColor(DEFAULT_SIGNAL_COLOR)).toBe('#ea580c');
    expect(resolveSignalColor('#2563eb')).toBe('#ea580c');
    expect(resolveSignalColor('#1D4ED8')).toBe('#ea580c');
  });

  it('keeps custom per-signal colors', () => {
    expect(resolveSignalColor('#ff00ff')).toBe('#ff00ff');
  });

  it('themeSignalColor reads --signal-default', () => {
    expect(themeSignalColor()).toBe('#ea580c');
  });
});
