import { describe, expect, it } from 'vitest';
import type { BitState, DiagramState, ViewState } from '../shared/types';
import { CELL_WIDTH, ROW_HEIGHT, TIME_AXIS_HEIGHT } from '../shared/constants';
import { hitTest } from './hitTest';
import { buildNodeIndex, parseEdge, resolveEdgeAnchors } from './edgeLayout';

function bitDiagram(steps = 20): DiagramState {
  const states = Array<BitState>(steps).fill('0');
  return {
    version: 1,
    config: { totalSteps: steps, hscale: 1 },
    edges: [],
    signals: [
      {
        id: 'sig1',
        name: 'a',
        type: 'bit',
        states,
        segments: [],
        color: '#4A9EFF',
        rowHeight: ROW_HEIGHT,
      },
    ],
  };
}

function defaultView(overrides: Partial<ViewState> = {}): ViewState {
  return {
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    selectedTool: 'cursor',
    paintMode: 'set',
    activeBitState: '1',
    activeBusLabel: 'data',
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
    activeTimespanLabel: '5 ms',
    activeEdgeShape: '',
    showAnchorLetters: false,
    ...overrides,
  };
}

describe('hitTest', () => {
  it('maps CSS coords to signal step and top half', () => {
    const diagram = bitDiagram();
    const y = TIME_AXIS_HEIGHT + 10;
    const hit = hitTest(CELL_WIDTH * 5 + 10, y, diagram, defaultView());
    expect(hit.signalId).toBe('sig1');
    expect(hit.step).toBe(5);
    expect(hit.half).toBe('top');
    expect(hit.signalType).toBe('bit');
  });

  it('maps bottom half of row', () => {
    const diagram = bitDiagram();
    const hit = hitTest(CELL_WIDTH * 3 + 5, TIME_AXIS_HEIGHT + 30, diagram, defaultView());
    expect(hit.step).toBe(3);
    expect(hit.half).toBe('bottom');
  });

  it('respects zoom and scroll for step index', () => {
    const diagram = bitDiagram();
    const view = defaultView({ zoom: 2, scrollX: 0 });
    const hit = hitTest(CELL_WIDTH * 2 * 2 + 20, TIME_AXIS_HEIGHT + 20, diagram, view);
    expect(hit.step).toBe(2);
  });

  it('returns null outside step columns', () => {
    const diagram = bitDiagram(10);
    const hit = hitTest(CELL_WIDTH * 12, TIME_AXIS_HEIGHT + 10, diagram, defaultView());
    expect(hit.signalId).toBeNull();
    expect(hit.step).toBeNull();
  });

  it('respects lane period when mapping step index', () => {
    const diagram: DiagramState = {
      version: 1,
      config: { totalSteps: 2, hscale: 1 },
      edges: [],
      signals: [
        {
          id: 'wide',
          name: 'clk',
          type: 'bit',
          states: Array(2).fill('0'),
          segments: [],
          color: '#4A9EFF',
          rowHeight: ROW_HEIGHT,
          period: 2,
        },
      ],
    };
    const y = TIME_AXIS_HEIGHT + 10;
    const hitStep1 = hitTest(CELL_WIDTH * 2 + 10, y, diagram, defaultView());
    expect(hitStep1.step).toBe(1);
    const hitStep0 = hitTest(CELL_WIDTH * 0 + 10, y, diagram, defaultView());
    expect(hitStep0.step).toBe(0);
    const hitPastLane = hitTest(CELL_WIDTH * 4 + 10, y, diagram, defaultView());
    expect(hitPastLane.signalId).toBeNull();
  });

  it('walks nested groups for row Y', () => {
    const diagram: DiagramState = {
      version: 1,
      config: { totalSteps: 10, hscale: 1 },
      edges: [],
      signals: [
        {
          id: 'g1',
          name: 'grp',
          type: 'group',
          collapsed: false,
          children: [
            {
              id: 'inner',
              name: 'b',
              type: 'bit',
              states: Array(10).fill('0'),
              segments: [],
              color: '#4A9EFF',
              rowHeight: ROW_HEIGHT,
            },
          ],
        },
      ],
    };
    const yInChild = TIME_AXIS_HEIGHT + 28 + 10;
    const hit = hitTest(CELL_WIDTH + 5, yInChild, diagram, defaultView());
    expect(hit.signalId).toBe('inner');
    expect(hit.step).toBe(1);
  });

  it('returns edgeIndex when pointer is on a WaveDrom edge', () => {
    const diagram: DiagramState = {
      ...bitDiagram(8),
      edges: ['a->b'],
      signals: [
        {
          id: 's0',
          name: 'A',
          type: 'bit',
          states: Array(8).fill('0'),
          segments: [],
          color: '#4A9EFF',
          rowHeight: ROW_HEIGHT,
          node: 'a.......',
        },
        {
          id: 's1',
          name: 'B',
          type: 'bit',
          states: Array(8).fill('0'),
          segments: [],
          color: '#4A9EFF',
          rowHeight: ROW_HEIGHT,
          node: '....b...',
        },
      ],
    };
    const view = defaultView();
    const parsed = parseEdge('a->b')!;
    const anchors = resolveEdgeAnchors(
      diagram,
      view,
      parsed,
      buildNodeIndex(diagram.signals),
    )!;
    const mx = (anchors.from.x + anchors.to.x) / 2;
    const my = (anchors.from.y + anchors.to.y) / 2;
    const hit = hitTest(mx, my, diagram, view);
    expect(hit.edgeIndex).toBe(0);
    expect(hit.signalId).toBeNull();
  });

  it('prefers lane hits over edges while arrow tool is active', () => {
    const diagram: DiagramState = {
      ...bitDiagram(8),
      edges: ['a->b'],
      signals: [
        {
          id: 's0',
          name: 'A',
          type: 'bit',
          states: Array(8).fill('0'),
          segments: [],
          color: '#4A9EFF',
          rowHeight: ROW_HEIGHT,
          node: 'a.......',
        },
        {
          id: 's1',
          name: 'B',
          type: 'bit',
          states: Array(8).fill('0'),
          segments: [],
          color: '#4A9EFF',
          rowHeight: ROW_HEIGHT,
          node: '....b...',
        },
      ],
    };
    const view = defaultView({ selectedTool: 'arrow' });
    const parsed = parseEdge('a->b')!;
    const anchors = resolveEdgeAnchors(
      diagram,
      view,
      parsed,
      buildNodeIndex(diagram.signals),
    )!;
    const mx = (anchors.from.x + anchors.to.x) / 2;
    const my = anchors.from.y;
    const hit = hitTest(mx, my, diagram, view);
    expect(hit.edgeIndex).toBeNull();
    expect(hit.signalId).toBe('s0');
    expect(hit.step).not.toBeNull();
  });
});
