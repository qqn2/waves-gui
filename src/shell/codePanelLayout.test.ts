import { describe, it, expect } from 'vitest';
import {
  defaultCodePanelLayout,
  normalizeCodePanelLayout,
  CODE_PANEL_DOCK_DEFAULT_BOTTOM,
} from './codePanelLayout';

describe('codePanelLayout', () => {
  it('defaults to bottom dock', () => {
    const layout = defaultCodePanelLayout();
    expect(layout.placement).toBe('bottom');
    expect(layout.dockSize).toBe(CODE_PANEL_DOCK_DEFAULT_BOTTOM);
  });

  it('normalizes right placement dock width', () => {
    const layout = normalizeCodePanelLayout({
      placement: 'right',
      dockSize: 400,
    });
    expect(layout.placement).toBe('right');
    expect(layout.dockSize).toBeGreaterThanOrEqual(140);
  });

  it('clamps invalid placement', () => {
    const layout = normalizeCodePanelLayout({
      placement: 'invalid' as 'bottom',
      dockSize: 50,
    });
    expect(layout.placement).toBe('bottom');
    expect(layout.dockSize).toBeGreaterThanOrEqual(140);
  });

  it('preserves float rect fields', () => {
    const layout = normalizeCodePanelLayout({
      placement: 'float',
      floatRect: { x: 10, y: 20, w: 400, h: 300 },
    });
    expect(layout.placement).toBe('float');
    expect(layout.floatRect.w).toBeGreaterThanOrEqual(320);
    expect(layout.dockSize).toBe(CODE_PANEL_DOCK_DEFAULT_BOTTOM);
  });
});
