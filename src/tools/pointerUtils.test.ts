import { describe, it, expect } from 'vitest';
import { stepAtCanvasX, timingTickAtCanvasX } from './pointerUtils';
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
    collapsedGroupIds: [],
    showInspector: false,
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

  it('selects the tick interval at exact substep boundaries', () => {
    const { diagram, view } = minimal();
    diagram.config = { totalSteps: 2, hscale: 1, ticksPerStep: 4 };

    expect(timingTickAtCanvasX(9.999, diagram, view)).toBe(0);
    expect(timingTickAtCanvasX(10, diagram, view)).toBe(1);
    expect(timingTickAtCanvasX(19.999, diagram, view)).toBe(1);
    expect(timingTickAtCanvasX(20, diagram, view)).toBe(2);
  });

  it('clamps precision paint to a negatively phased lane tail', () => {
    const { diagram, view } = minimal();
    diagram.config = { totalSteps: 4, hscale: 1, ticksPerStep: 4 };
    diagram.signals = [{
      id: 'timed',
      name: 'timed',
      type: 'bit',
      states: ['0', '0', '0', '0'],
      segments: [],
      color: '#000',
      rowHeight: 40,
      digitalTiming: {
        ticksPerStep: 4,
        phaseTicks: -4,
        cells: Array.from({ length: 4 }, () => ({ state: '0' as const, durationTicks: 4 })),
      },
    }];

    expect(timingTickAtCanvasX(199.999, diagram, view, 'timed')).toBe(19);
  });
});
