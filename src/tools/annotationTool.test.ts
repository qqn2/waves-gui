import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import {
  annotationPointerDown,
  cancelStructuredArrow,
  globalCompressionPointerDown,
  horizontalLinePointerDown,
  structuredArrowPointerDown,
  verticalLinePointerDown,
} from './annotationTool';
import { CELL_WIDTH, ROW_HEIGHT, TIME_AXIS_HEIGHT } from '../shared/constants';
import { measureHeadFoot } from '../renderer/renderHeadFoot';

describe('annotation tool', () => {
  beforeEach(() => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.getState().setExtensionsEnabled(true);
    cancelStructuredArrow();
  });

  it('creates and selects a text annotation on a signal cell', () => {
    const signal = useStore.getState().diagram.signals.find(
      (item) => item.type === 'bit',
    )!;
    annotationPointerDown(
      { button: 0 } as PointerEvent,
      {
        signalId: signal.id,
        signalType: 'bit',
        step: 3,
        half: 'top',
        isLabelArea: false,
        isTimeAxis: false,
        edgeIndex: null,
        annotationId: null,
      },
    );

    const state = useStore.getState();
    expect(state.diagram.annotations).toHaveLength(1);
    expect(state.diagram.annotations?.[0]).toMatchObject({
      text: 'Annotation',
      tick: 3,
      signalId: signal.id,
    });
    expect(state.view.activeAnnotationId).toBe(state.diagram.annotations?.[0]?.id);
    expect(state.view.activeSignalIds).toEqual([]);
  });

  it('ignores non-signal and secondary-button hits', () => {
    const miss = {
      signalId: null,
      signalType: null,
      step: null,
      half: null,
      isLabelArea: false,
      isTimeAxis: false,
      edgeIndex: null,
      annotationId: null,
    } as const;
    annotationPointerDown({ button: 0 } as PointerEvent, miss);
    annotationPointerDown(
      { button: 2 } as PointerEvent,
      { ...miss, signalId: 'sig', signalType: 'bit', step: 0 },
    );
    expect(useStore.getState().diagram.annotations).toEqual([]);
  });

  it('creates selectable vertical and horizontal lines', () => {
    const signal = useStore.getState().diagram.signals.find(
      (item) => item.type === 'bit',
    )!;
    const hit = {
      signalId: signal.id,
      signalType: 'bit' as const,
      step: 2,
      half: 'top' as const,
      isLabelArea: false,
      isTimeAxis: false,
      edgeIndex: null,
      annotationId: null,
    };
    verticalLinePointerDown({ button: 0 } as PointerEvent, hit);
    horizontalLinePointerDown({ button: 0 } as PointerEvent, hit);
    globalCompressionPointerDown({ button: 0 } as PointerEvent, hit);
    expect(useStore.getState().diagram.annotations).toEqual([
      expect.objectContaining({ type: 'vertical-line', tick: 2 }),
      expect.objectContaining({
        type: 'horizontal-line',
        signalId: signal.id,
      }),
      expect.objectContaining({ type: 'global-compression', tick: 2 }),
    ]);
    expect(useStore.getState().view.activeAnnotationId).toBe(
      useStore.getState().diagram.annotations?.[2]?.id,
    );
  });

  it('creates a structured arrow between two canvas points', () => {
    const { headHeight } = measureHeadFoot(useStore.getState().diagram.config);
    const pointer = (x: number, y: number) => ({
      button: 0,
      offsetX: x,
      offsetY: TIME_AXIS_HEIGHT + headHeight + y,
    } as PointerEvent);

    structuredArrowPointerDown(pointer(CELL_WIDTH, ROW_HEIGHT));
    expect(useStore.getState().diagram.annotations).toEqual([]);
    expect(useStore.getState().view.structuredArrowPending).toEqual({
      x: 1,
      y: 1,
    });

    structuredArrowPointerDown(pointer(CELL_WIDTH * 3, ROW_HEIGHT * 2));
    const annotation = useStore.getState().diagram.annotations?.[0];
    expect(annotation).toMatchObject({
      type: 'arrow',
      shape: '->',
      from: { kind: 'point', x: 1, y: 1 },
      to: { kind: 'point', x: 3, y: 2 },
    });
    expect(useStore.getState().view.activeAnnotationId).toBe(annotation?.id);
    expect(useStore.getState().view.structuredArrowPending).toBeNull();
    expect(useStore.getState().view.selectedTool).toBe('cursor');
  });
});
