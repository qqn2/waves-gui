import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import type { HitTestResult } from '../renderer/hitTest';
import { fromUndulateJSON, toUndulateJSON } from '../undulateBridge';
import { paintPointerDown, paintPointerUp } from './paintTool';

const canvas = {
  setPointerCapture: () => undefined,
  hasPointerCapture: () => true,
  releasePointerCapture: () => undefined,
} as unknown as HTMLCanvasElement;

describe('fine timing paint tool', () => {
  beforeEach(() => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.getState().setExtensionsEnabled(true);
    expect(useStore.getState().setTicksPerStep(4)).toBe(true);
    useStore.getState().setActiveBitState('1');
  });

  it('paints one timing-grid interval and updates exported JSON', () => {
    const signal = useStore.getState().diagram.signals.find(
      (candidate) => candidate.type === 'bit',
    );
    expect(signal?.type).toBe('bit');
    if (!signal || signal.type !== 'bit') return;
    expect(useStore.getState().enableDigitalTiming(signal.id)).toBe(true);
    const hit: HitTestResult = {
      signalId: signal.id,
      signalType: 'bit',
      step: 0,
      half: 'top',
      isLabelArea: false,
      isTimeAxis: false,
      edgeIndex: null,
      annotationId: null,
    };
    const event = {
      button: 0,
      pointerId: 11,
      offsetX: 10,
      offsetY: 100,
      shiftKey: false,
    } as PointerEvent;

    paintPointerDown(event, hit, canvas);
    paintPointerUp(event, canvas);

    const updated = useStore.getState().diagram.signals.find(
      (candidate) => candidate.type !== 'group' && candidate.id === signal.id,
    );
    expect(updated?.type).toBe('bit');
    if (!updated || updated.type !== 'bit') return;
    expect(updated.digitalTiming?.cells.slice(0, 3)).toEqual([
      { state: 'P', durationTicks: 1 },
      { state: '1', durationTicks: 1 },
      { state: 'P', durationTicks: 2 },
    ]);

    const exported = toUndulateJSON(useStore.getState().diagram);
    expect(exported.signal[0]).toMatchObject({
      wave: 'P1P.........',
      periods: [0.25, 0.25, 0.5, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    });
    expect(exported['x-waves-gui']).toMatchObject({ timingGridSteps: 10 });
    expect(fromUndulateJSON(exported).config.totalSteps).toBe(10);
  });
});
