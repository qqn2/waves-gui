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
  };
  const view: ViewState = {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    selectedTool: 'cursor',
    paintMode: 'set',
    paintStyle: 'replace',
    activeBitState: '1',
    activeAnalogueKind: 'step',
    activeAnalogueValue: 0.9,
    activeBusLabel: 'data',
    activeBusColorIndex: 2,
    activeSignalIds: [],
    showCodePanel: true,
    showRenderPanel: false,
    labelWidth: 160,
    theme: 'light',
    accentColor: null,
    canvasColor: null,
    uiFontScale: 1,
    isDirty: false,
    fileName: null,
    paintDraft: null,
    edgeAnchorPending: null,
    structuredArrowPending: null,
    edgeToolHover: null,
    activeTimespanLabel: '5 ms',
    activeEdgeConnector: '~>',
    activeEdgeLabel: '',
    showAnchorLetters: false,
    diagramRevision: 0,
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
