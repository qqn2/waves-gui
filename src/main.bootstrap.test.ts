/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { useStore } from './shared/store';
import { normalizeDiagram } from './shared/normalizeDiagram';
import { applyThemeSettings, themeSettingsFromView } from './shared/theme';

describe('main bootstrap', () => {
  it('matches main.tsx startup without throwing', () => {
    expect(() => {
      useStore.setState((s) => {
        s.diagram = normalizeDiagram(s.diagram);
      });
      applyThemeSettings(themeSettingsFromView(useStore.getState().view));
    }).not.toThrow();
  });
});
