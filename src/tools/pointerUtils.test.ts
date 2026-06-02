import { describe, it, expect } from 'vitest';
import { stepAtCanvasX } from './pointerUtils';
import type { DiagramState, ViewState } from '../shared/types';

function minimal(overrides?: Partial<ViewState>): {
  diagram: DiagramState;
  view: ViewState;
} {
  const diagram: DiagramState = {
    version: 1,
    signals: [],
    config: { totalSteps: 10, hscale: 1 },
    edges: [],
    annotations: [],
  };
  const view: ViewState = {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    selectedTool: 'cursor',
    paintMode: 'set',
    activeBitState: '1',
    activeBusLabel: 'data',
    activeBusColorIndex: 2,
    activeSignalIds: [],
    showCodePanel: true,
    labelWidth: 160,
    showTimeAxis: true,
    theme: 'light',
    isDirty: false,
    fileName: null,
    paintDraft: null,
    edgeAnchorPending: null,
    edgeToolHover: null,
    activeTimespanLabel: '5 ms',
    ...overrides,
  };
  return { diagram, view };
}

describe('stepAtCanvasX', () => {
  it('maps canvas X to step index with scroll', () => {
    const { diagram, view } = minimal({ scrollX: 80 });
    expect(stepAtCanvasX(0, diagram, view)).toBe(2);
  });

  it('clamps to diagram bounds', () => {
    const { diagram, view } = minimal();
    expect(stepAtCanvasX(-100, diagram, view)).toBe(0);
    expect(stepAtCanvasX(9999, diagram, view)).toBe(9);
  });
});
