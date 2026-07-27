import { beforeEach, describe, expect, it } from 'vitest';
import { measureHeadFoot } from '../renderer/renderHeadFoot';
import { ROW_HEIGHT, TIME_AXIS_HEIGHT } from '../shared/constants';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import type { HitTestResult } from '../renderer/hitTest';
import {
  nudgeSelectedAnnotation,
  selectPointerDown,
  selectPointerMove,
  selectPointerUp,
} from './selectTool';

const canvas = {
  setPointerCapture: () => undefined,
  hasPointerCapture: () => true,
  releasePointerCapture: () => undefined,
} as unknown as HTMLCanvasElement;

describe('annotation direct dragging', () => {
  beforeEach(() => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().setTool('cursor');
  });

  it('preserves fractional X/Y and records the drag as one undo step', () => {
    const id = useStore.getState().addTextAnnotation({
      text: 'move me',
      tick: 0,
    })!;
    const hit: HitTestResult = {
      signalId: null,
      signalType: null,
      step: null,
      half: null,
      isLabelArea: false,
      isTimeAxis: false,
      edgeIndex: null,
      annotationId: id,
    };
    const pointer = (offsetX: number, offsetY: number) => ({
      pointerId: 7,
      offsetX,
      offsetY,
      shiftKey: true,
    } as PointerEvent);
    const { headHeight } = measureHeadFoot(useStore.getState().diagram.config);

    selectPointerDown(pointer(20, 20), canvas, hit);
    selectPointerMove(pointer(
      45,
      TIME_AXIS_HEIGHT + headHeight + ROW_HEIGHT * 1.25,
    ));
    selectPointerMove(pointer(
      47,
      TIME_AXIS_HEIGHT + headHeight + ROW_HEIGHT * 1.5,
    ));
    selectPointerUp(pointer(47, 20), canvas);

    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      id,
      x: 1.18,
      y: 1.5,
      coordinateMode: 'diagram',
    });

    useStore.getState().undo();
    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      id,
      tick: 0,
    });
    expect(useStore.getState().diagram.annotations?.[0]).not.toHaveProperty('x');
  });

  it('nudges selected annotations coarsely and finely', () => {
    const id = useStore.getState().addTextAnnotation({
      text: 'nudge me',
      tick: 0,
      y: 1,
      coordinateMode: 'diagram',
      snapToGrid: false,
    })!;
    useStore.getState().setActiveAnnotationId(id);

    expect(nudgeSelectedAnnotation('ArrowRight', false)).toBe(true);
    expect(nudgeSelectedAnnotation('ArrowDown', true)).toBe(true);
    expect(useStore.getState().diagram.annotations?.[0]).toMatchObject({
      x: 0.6,
      y: 1.01,
      coordinateMode: 'diagram',
    });
  });
});
