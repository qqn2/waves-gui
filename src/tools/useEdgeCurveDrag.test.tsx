// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../shared/store';
import { defaultView } from '../shared/store/helpers';
import { fromWavedromJSON } from '../wavedromBridge/fromWavedromJSON';
import {
  buildNodeIndex,
  cubicMidpoint,
  defaultCurveControl,
  parseEdge,
  resolveEdgeAnchors,
} from '../renderer/edgeLayout';
import { useEdgeCurveDrag } from './useEdgeCurveDrag';

function edgeDiagram(connector = '~>') {
  return fromWavedromJSON({
    signal: [
      { name: 'request', wave: '0.......', node: 'a.......' },
      { name: 'response', wave: '1.......', node: '.......b' },
    ],
    edge: [`a${connector}b response`],
  });
}

function midpoint() {
  const { diagram, view } = useStore.getState();
  const parsed = parseEdge(diagram.edges[0])!;
  const anchors = resolveEdgeAnchors(diagram, view, parsed, buildNodeIndex(diagram.signals))!;
  const controls = diagram.edgeCurveControls?.[0] ?? defaultCurveControl(parsed.shape);
  const dx = anchors.to.x - anchors.from.x;
  return cubicMidpoint(
    anchors.from, anchors.to,
    anchors.from.x + controls.c1x * dx, anchors.from.y,
    anchors.from.x + controls.c2x * dx, anchors.to.y,
  );
}

function pointer(
  x: number,
  y: number,
  overrides: Partial<Pick<PointerEvent, 'pointerId' | 'button' | 'buttons' | 'isPrimary'>> = {},
): PointerEvent {
  const event = new PointerEvent('pointermove', {
    pointerId: 7, button: 0, buttons: 1, isPrimary: true, ...overrides,
  });
  Object.defineProperties(event, { offsetX: { value: x }, offsetY: { value: y } });
  return event;
}

describe('edge curve dragging', () => {
  let host: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let root: Root | null;
  let handlers: ReturnType<typeof useEdgeCurveDrag>;
  let captured: Set<number>;

  beforeEach(async () => {
    const diagram = edgeDiagram();
    useStore.setState({
      diagram, savedDiagram: diagram, view: { ...defaultView(), selectedTool: 'cursor' },
      history: [], future: [],
    });
    host = document.createElement('div');
    canvas = document.createElement('canvas');
    document.body.append(host, canvas);
    captured = new Set();
    canvas.setPointerCapture = vi.fn((id: number) => { captured.add(id); });
    canvas.hasPointerCapture = vi.fn((id: number) => captured.has(id));
    canvas.releasePointerCapture = vi.fn((id: number) => { captured.delete(id); });
    const canvasRef = { current: canvas };
    function Harness() {
      handlers = useEdgeCurveDrag(canvasRef);
      return null;
    }
    root = createRoot(host);
    await act(async () => root!.render(<Harness />));
  });

  afterEach(async () => {
    if (root) await act(async () => root!.unmount());
    host.remove();
    canvas.remove();
    vi.restoreAllMocks();
  });

  async function begin(offset = 0) {
    const origin = midpoint();
    let started = false;
    await act(async () => { started = handlers.onPointerDown(pointer(origin.x + offset, origin.y)); });
    expect(started).toBe(true);
    expect(captured.has(7)).toBe(true);
    return { x: origin.x + offset, y: origin.y };
  }

  async function move(x: number, y: number, overrides: Parameters<typeof pointer>[2] = {}) {
    await act(async () => { handlers.onPointerMove(pointer(x, y, overrides)); });
  }

  it('leaves the document clean when a handle is clicked without moving', async () => {
    const before = useStore.getState().diagram;
    const start = await begin();
    await move(start.x, start.y);
    await act(async () => handlers.onPointerUp(pointer(start.x, start.y, { buttons: 0 })));
    expect(useStore.getState().diagram).toBe(before);
    expect(useStore.getState().history).toHaveLength(0);
    expect(useStore.getState().view.isDirty).toBe(false);
    expect(captured.size).toBe(0);
  });

  it('does not rewrite imported floating-point controls without an actual drag', async () => {
    const diagram = edgeDiagram();
    diagram.edgeCurveControls = { 0: { c1x: 0.85, c2x: 0.15000000000000002 } };
    await act(async () => useStore.setState({ diagram, savedDiagram: diagram }));
    const before = useStore.getState().diagram;
    const start = await begin();
    await move(start.x, start.y);
    await act(async () => handlers.onPointerUp(pointer(start.x, start.y, { buttons: 0 })));
    expect(useStore.getState().diagram).toBe(before);
    expect(useStore.getState().history).toHaveLength(0);
    expect(useStore.getState().view.isDirty).toBe(false);
  });

  it('records one undo step per drag and tracks movement from the grabbed position', async () => {
    const before = useStore.getState().diagram;
    const originalMidpoint = midpoint();
    const start = await begin(4);
    await move(start.x, start.y);
    expect(useStore.getState().diagram).toBe(before);
    await move(start.x + 12, start.y);
    expect(midpoint().x).toBeCloseTo(originalMidpoint.x + 12, 3);
    expect(useStore.getState().history).toHaveLength(1);
    await move(start.x + 20, start.y);
    expect(midpoint().x).toBeCloseTo(originalMidpoint.x + 20, 3);
    expect(useStore.getState().history).toHaveLength(1);
    expect(useStore.getState().view.isDirty).toBe(true);
    await act(async () => handlers.onPointerUp(pointer(start.x + 20, start.y, { buttons: 0 })));
    await act(async () => useStore.getState().undo());
    expect(useStore.getState().diagram).toEqual(before);
  });

  it.each(['-~>', '~->'])('keeps the fixed tangent for %s while moving its visible handle', async (connector) => {
    const diagram = edgeDiagram(connector);
    await act(async () => useStore.setState({ diagram, savedDiagram: diagram }));
    const start = await begin();
    await move(start.x + 7, start.y);
    expect(midpoint().x).toBeCloseTo(start.x + 7, 3);
    const control = useStore.getState().diagram.edgeCurveControls![0];
    if (connector === '-~>') expect(control.c2x).toBe(1);
    else expect(control.c1x).toBe(0);
  });

  it('keeps generated controls finite, bounded, and free of floating-point tails', async () => {
    const start = await begin();
    await move(start.x + 13.123456789, start.y);
    for (const value of Object.values(useStore.getState().diagram.edgeCurveControls![0])) {
      expect(value).toBe(Number(value.toFixed(6)));
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    await move(start.x + 10000, start.y);
    for (const value of Object.values(useStore.getState().diagram.edgeCurveControls![0])) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it.each(['remove', 'undo', 'replace'] as const)('stops safely if the document changes during a drag: %s', async (change) => {
    const start = await begin();
    await move(start.x + 10, start.y);
    await act(async () => {
      if (change === 'remove') useStore.getState().removeDiagramEdge(0);
      else if (change === 'undo') useStore.getState().undo();
      else useStore.getState().loadDiagram(edgeDiagram('-~>'));
    });
    const documentAfterChange = useStore.getState().diagram;
    const historyAfterChange = useStore.getState().history;
    await move(start.x + 24, start.y);
    expect(useStore.getState().diagram).toBe(documentAfterChange);
    expect(useStore.getState().history).toBe(historyAfterChange);
    expect(captured.size).toBe(0);
  });

  it('does not resume an old drag after switching tools', async () => {
    const start = await begin();
    await move(start.x + 9, start.y);
    await act(async () => useStore.getState().setTool('paint'));
    expect(captured.size).toBe(0);
    await act(async () => useStore.getState().setTool('cursor'));
    const afterSwitch = useStore.getState().diagram;
    await move(start.x + 30, start.y);
    expect(useStore.getState().diagram).toBe(afterSwitch);
  });

  it.each(['pointercancel', 'lostpointercapture'])('stops further writes after %s', async (type) => {
    const start = await begin();
    await move(start.x + 9, start.y);
    await act(async () => { canvas.dispatchEvent(new PointerEvent(type, { pointerId: 7 })); });
    const afterCancel = useStore.getState().diagram;
    await move(start.x + 30, start.y);
    expect(useStore.getState().diagram).toBe(afterCancel);
    expect(captured.size).toBe(0);
  });

  it('cancels explicitly and releases capture on unmount', async () => {
    const start = await begin();
    await act(async () => handlers.cancel());
    expect(captured.size).toBe(0);
    const afterCancel = useStore.getState().diagram;
    await move(start.x + 20, start.y);
    expect(useStore.getState().diagram).toBe(afterCancel);
    await begin();
    await act(async () => root!.unmount());
    root = null;
    expect(captured.size).toBe(0);
  });

  it('ignores secondary buttons and unrelated pointers', async () => {
    const start = midpoint();
    await act(async () => {
      expect(handlers.onPointerDown(pointer(start.x, start.y, { button: 2 }))).toBe(false);
    });
    expect(captured.size).toBe(0);
    await begin();
    const before = useStore.getState().diagram;
    await move(start.x + 20, start.y, { pointerId: 99 });
    await act(async () => handlers.onPointerUp(pointer(start.x + 20, start.y, { pointerId: 99, buttons: 0 })));
    expect(useStore.getState().diagram).toBe(before);
    expect(captured.has(7)).toBe(true);
    await move(start.x + 12, start.y);
    expect(useStore.getState().diagram).not.toBe(before);
  });
});
