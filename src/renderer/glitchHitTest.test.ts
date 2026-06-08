import { describe, it, expect } from 'vitest';
import { ROW_HEIGHT, TIME_AXIS_HEIGHT } from '../shared/constants';
import type { DiagramState, Signal, ViewState } from '../shared/types';
import { hitTest } from './hitTest';
import { hitTestStepGlitchBoundary } from './glitchHitTest';
import { stepLogicalXEnd } from './laneTiming';

function diagramWithGlitch(): DiagramState {
  return {
    version: 1,
    signals: [
      {
        id: 'sig0',
        type: 'bit',
        name: 'DATA',
        states: ['0', '0', '0', '0'],
        segments: [],
        color: '#4A9EFF',
        rowHeight: ROW_HEIGHT,
        stepGlitches: [true, false, false],
      },
    ],
    config: { totalSteps: 4, hscale: 1 },
    edges: [],
  };
}

function defaultView(overrides: Partial<ViewState> = {}): ViewState {
  return {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    selectedTool: 'erase',
    paintMode: 'set',
    activeBitState: '0',
    activeBusLabel: '',
    activeTimespanLabel: '',
    activeBusColorIndex: 2,
    activeSignalIds: [],
    showCodePanel: false,
    showRenderPanel: false,
    labelWidth: 160,
    showTimeAxis: true,
    theme: 'light-grey',
    accentColor: null,
    canvasColor: null,
    uiFontScale: 1,
    isDirty: false,
    fileName: null,
    paintDraft: null,
    edgeAnchorPending: null,
    edgeToolHover: null,
    activeEdgeShape: '',
    showAnchorLetters: false,
    diagramRevision: 0,
    ...overrides,
  };
}

function bitSignal(diagram: DiagramState): Signal {
  return diagram.signals[0] as Signal;
}

describe('hitTestStepGlitchBoundary', () => {
  it('hits the notch between same-level steps', () => {
    const diagram = diagramWithGlitch();
    const sig = bitSignal(diagram);
    const xEdge = stepLogicalXEnd(sig, 0);
    const y = TIME_AXIS_HEIGHT + 10;
    const hit = hitTestStepGlitchBoundary(xEdge + 2, y, diagram, defaultView());
    expect(hit).toEqual({ signalId: 'sig0', boundaryIndex: 0 });
  });
});

describe('hitTest glitch erase', () => {
  it('returns a step when clicking on a glitch boundary in a column gap', () => {
    const diagram = diagramWithGlitch();
    const sig = bitSignal(diagram);
    const xEdge = stepLogicalXEnd(sig, 0);
    const y = TIME_AXIS_HEIGHT + 10;
    const hit = hitTest(xEdge, y, diagram, defaultView());
    expect(hit.signalId).toBe('sig0');
    expect(hit.step).not.toBeNull();
  });
});
