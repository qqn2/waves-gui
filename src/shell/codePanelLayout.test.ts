import { describe, it, expect } from 'vitest';
import {
  defaultSidePanelsLayout,
  normalizeSidePanelsLayout,
  dockSlotsForPlacement,
  movePanelInOrder,
  DEFAULT_PANEL_ORDER,
  CODE_PANEL_DOCK_DEFAULT_BOTTOM,
  CODE_PANEL_DOCK_DEFAULT_RIGHT,
  CODE_PANEL_DOCK_DEFAULT_RENDER_BOTTOM,
} from './codePanelLayout';

describe('codePanelLayout', () => {
  it('defaults json vertically on the right and render below the workspace', () => {
    const layout = defaultSidePanelsLayout();
    expect(layout.json.placement).toBe('right');
    expect(layout.json.dockSize).toBe(CODE_PANEL_DOCK_DEFAULT_RIGHT);
    expect(layout.render.placement).toBe('bottom');
    expect(layout.render.dockSize).toBe(CODE_PANEL_DOCK_DEFAULT_RENDER_BOTTOM);
    expect(layout.panelOrder).toEqual(DEFAULT_PANEL_ORDER);
    expect(layout.bottomArrangement).toBe('stacked');
    expect(layout.bottomSplit).toBe(0.5);
  });

  it('normalizes independent panel placements', () => {
    const layout = normalizeSidePanelsLayout({
      json: { placement: 'right', dockSize: 400 },
      render: { placement: 'bottom', dockSize: 220 },
    });
    expect(layout.json.placement).toBe('right');
    expect(layout.json.dockSize).toBeGreaterThanOrEqual(140);
    expect(layout.render.placement).toBe('bottom');
    expect(layout.render.dockSize).toBeGreaterThanOrEqual(140);
  });

  it('migrates legacy single-panel layout to json only', () => {
    const layout = normalizeSidePanelsLayout({
      placement: 'bottom',
      dockSize: CODE_PANEL_DOCK_DEFAULT_BOTTOM,
    });
    expect(layout.json.placement).toBe('bottom');
    expect(layout.render.placement).toBe('bottom');
  });

  it('clamps invalid placement per panel', () => {
    const layout = normalizeSidePanelsLayout({
      json: { placement: 'invalid' as 'bottom', dockSize: 50 },
      render: { placement: 'right', dockSize: 50 },
    });
    expect(layout.json.placement).toBe('right');
    expect(layout.json.dockSize).toBeGreaterThanOrEqual(140);
    expect(layout.render.placement).toBe('right');
  });

  it('preserves float rect fields per panel', () => {
    const layout = normalizeSidePanelsLayout({
      json: {
        placement: 'float',
        floatRect: { x: 10, y: 20, w: 400, h: 300 },
      },
      render: {
        placement: 'float',
        floatRect: { x: 40, y: 50, w: 360, h: 280 },
      },
    });
    expect(layout.json.placement).toBe('float');
    expect(layout.json.floatRect.w).toBeGreaterThanOrEqual(320);
    expect(layout.render.placement).toBe('float');
    expect(layout.render.floatRect.w).toBeGreaterThanOrEqual(320);
  });

  it('normalizes the shared bottom side-by-side layout', () => {
    const layout = normalizeSidePanelsLayout({
      json: { placement: 'bottom' },
      render: { placement: 'bottom' },
      bottomArrangement: 'side-by-side',
      bottomDockSize: 320,
      bottomSplit: 0.62,
    });
    expect(layout.bottomArrangement).toBe('side-by-side');
    expect(layout.bottomDockSize).toBe(320);
    expect(layout.bottomSplit).toBe(0.62);
  });

  it('clamps an invalid shared bottom split', () => {
    const layout = normalizeSidePanelsLayout({
      json: { placement: 'bottom' },
      render: { placement: 'bottom' },
      bottomArrangement: 'side-by-side',
      bottomSplit: 0.95,
    });
    expect(layout.bottomSplit).toBe(0.75);
  });

  it('ignores legacy previewSplit field', () => {
    const layout = normalizeSidePanelsLayout({ previewSplit: 0.6 });
    expect(layout.json.placement).toBe('right');
    expect(layout.render.placement).toBe('bottom');
  });

  it('orders dock slots by panelOrder toward canvas first', () => {
    const layout = normalizeSidePanelsLayout({
      panelOrder: ['render', 'json'],
      json: { placement: 'right' },
      render: { placement: 'right' },
    });
    const slots = dockSlotsForPlacement(
      layout.panelOrder,
      'right',
      layout,
      { json: true, render: true },
    );
    expect(slots.map((s) => s.panelId)).toEqual(['render', 'json']);
  });

  it('movePanelInOrder swaps neighbors', () => {
    expect(movePanelInOrder(['render', 'json'], 'json', -1)).toEqual([
      'json',
      'render',
    ]);
    expect(movePanelInOrder(['json', 'render'], 'json', 1)).toEqual([
      'render',
      'json',
    ]);
  });
});
