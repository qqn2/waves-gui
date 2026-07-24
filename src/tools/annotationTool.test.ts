import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import {
  annotationPointerDown,
  horizontalLinePointerDown,
  verticalLinePointerDown,
} from './annotationTool';

describe('annotation tool', () => {
  beforeEach(() => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.getState().setExtensionsEnabled(true);
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
    expect(useStore.getState().diagram.annotations).toEqual([
      expect.objectContaining({ type: 'vertical-line', tick: 2 }),
      expect.objectContaining({
        type: 'horizontal-line',
        signalId: signal.id,
      }),
    ]);
    expect(useStore.getState().view.activeAnnotationId).toBe(
      useStore.getState().diagram.annotations?.[1]?.id,
    );
  });
});
