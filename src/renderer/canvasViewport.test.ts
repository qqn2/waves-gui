import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { defaultView } from '../shared/store/helpers';
import type { Signal } from '../shared/types';
import { canvasWheelDelta, clampCanvasScroll, measureCanvasViewport, revealCanvasCell } from './canvasViewport';

const lane: Signal = {
  id: 'data', name: 'data', type: 'bit', states: ['0', '1', '0', '1'],
  segments: [], color: '#4af', rowHeight: 40,
};

function fixture() {
  const diagram = createDefaultDiagram();
  diagram.config.totalSteps = 4;
  diagram.config.hscale = 1;
  diagram.config.head = undefined;
  diagram.config.foot = undefined;
  diagram.signals = [{ ...lane }];
  return diagram;
}

describe('canvas viewport scrolling', () => {
  it('includes stretched and negatively phased lanes in horizontal bounds', () => {
    const diagram = fixture();
    diagram.signals = [{ ...lane, period: 3, phase: -0.5 }];
    diagram.config.hscale = 2;
    const viewport = measureCanvasViewport(diagram, { ...defaultView(), zoom: 1.5 }, 300, 200);
    expect(viewport.contentWidth).toBe((4 * 40 * 3 + 20) * 2 * 1.5);
    expect(viewport.maxX).toBe(1200);
    expect(viewport.maxY).toBe(0);
  });

  it('keeps axis, title and footer bands unscaled while zooming signal rows', () => {
    const diagram = fixture();
    diagram.config.head = { text: 'Header', tick: 0 };
    diagram.config.foot = { text: 'Footer', tock: 1 };
    const viewport = measureCanvasViewport(diagram, { ...defaultView(), zoom: 2 }, 100, 100);
    expect(viewport.waveformTop).toBe(24 + 24 + 16);
    expect(viewport.contentHeight).toBe(24 + 40 + 80 + 40);
    expect(viewport.maxY).toBe(84);
  });

  it('clamps both offsets after shrinking a diagram or collapsing a group', () => {
    const diagram = fixture();
    diagram.signals = [{ id: 'group', type: 'group', name: 'Group', children: Array.from({ length: 10 }, (_, i) => ({ ...lane, id: `lane-${i}` })) }];
    const expanded = measureCanvasViewport(diagram, defaultView(), 100, 100);
    expect(expanded.maxY).toBe(352);
    const collapsed = measureCanvasViewport(diagram, { ...defaultView(), collapsedGroupIds: ['group'] }, 400, 200);
    expect(clampCanvasScroll(200, 300, collapsed)).toEqual({ x: 0, y: 0 });
    expect(clampCanvasScroll(-3, -4, expanded)).toEqual({ x: 0, y: 0 });
  });

  it('reveals keyboard focus within the signal viewport below the fixed header', () => {
    const diagram = fixture();
    diagram.signals = Array.from({ length: 20 }, (_, i) => ({ ...lane, id: `lane-${i}` }));
    diagram.config.totalSteps = 100;
    diagram.config.head = { text: 'Title' };
    const viewport = measureCanvasViewport(diagram, defaultView(), 200, 200);
    expect(revealCanvasCell({ left: 360, right: 400, top: 360, bottom: 400 }, { x: 0, y: 0 }, viewport))
      .toEqual({ x: 200, y: 248 });
    expect(revealCanvasCell({ left: 220, right: 260, top: 260, bottom: 300 }, { x: 200, y: 248 }, viewport))
      .toEqual({ x: 200, y: 248 });
    expect(revealCanvasCell({ left: 0, right: 40, top: 0, bottom: 40 }, { x: 200, y: 248 }, viewport))
      .toEqual({ x: 0, y: 0 });
  });

  it('allows the last label to clear a taller signal-list footer', () => {
    const diagram = fixture();
    diagram.signals = Array.from({ length: 20 }, (_, i) => ({ ...lane, id: `lane-${i}` }));
    const viewport = measureCanvasViewport(diagram, defaultView(), 200, 400, 350);
    expect(viewport.maxY).toBe(800 - 350);
    expect(viewport.contentHeight).toBe(850);
  });

  it('handles pixels, line/page wheels and browser-translated Shift+wheel', () => {
    const viewport = { width: 500, height: 300 };
    expect(canvasWheelDelta({ deltaX: 2, deltaY: 3, deltaMode: 0, shiftKey: false }, viewport)).toEqual({ x: 2, y: 3 });
    expect(canvasWheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1, shiftKey: true }, viewport)).toEqual({ x: 48, y: 0 });
    expect(canvasWheelDelta({ deltaX: 20, deltaY: 20, deltaMode: 0, shiftKey: true }, viewport)).toEqual({ x: 20, y: 0 });
    expect(canvasWheelDelta({ deltaX: 1, deltaY: 1, deltaMode: 2, shiftKey: false }, viewport)).toEqual({ x: 500, y: 300 });
  });
});
