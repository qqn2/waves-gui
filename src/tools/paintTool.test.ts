import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import type { HitTestResult } from '../renderer/hitTest';
import {
  fromUndulateJSON,
  toUndulateJSON,
  validateUndulateJSON,
} from '../undulateBridge';
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

  it('paints one static timing-grid interval as native Undulate timing', () => {
    const signal = useStore.getState().diagram.signals.find(
      (candidate) => candidate.type === 'bit' && candidate.name === 'enable',
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
      { state: '0', durationTicks: 1 },
      { state: '1', durationTicks: 1 },
      { state: '0', durationTicks: 2 },
    ]);

    const exported = toUndulateJSON(useStore.getState().diagram);
    const lane = exported.signal.find((entry) =>
      !Array.isArray(entry) && entry.name === 'enable',
    );
    expect(lane).toMatchObject({
      wave: expect.stringMatching(/^010/),
      periods: expect.arrayContaining([0.25, 0.25, 0.5]),
    });
    expect(exported).not.toHaveProperty('x-waves-gui');
    expect(validateUndulateJSON(exported)).toBeNull();
    expect(fromUndulateJSON(exported).config.totalSteps).toBe(10);
  });

  it('refuses precision painting on an unexpanded clock macro', () => {
    const signal = useStore.getState().diagram.signals.find(
      (candidate) => candidate.type === 'bit' && candidate.name === 'clk',
    );
    expect(signal?.type).toBe('bit');
    if (!signal || signal.type !== 'bit') return;
    expect(useStore.getState().enableDigitalTiming(signal.id)).toBe(true);
    const before = useStore.getState().diagram.signals.find(
      (candidate) => candidate.type !== 'group' && candidate.id === signal.id,
    );
    const originalCells = before?.type === 'bit'
      ? before.digitalTiming?.cells.map((cell) => ({ ...cell }))
      : undefined;
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
      pointerId: 12,
      offsetX: 10,
      offsetY: 100,
      shiftKey: false,
    } as PointerEvent;

    paintPointerDown(event, hit, canvas);
    paintPointerUp(event, canvas);

    const updated = useStore.getState().diagram.signals.find(
      (candidate) => candidate.type !== 'group' && candidate.id === signal.id,
    );
    expect(updated?.type === 'bit' ? updated.digitalTiming?.cells : []).toEqual(originalCells);
    const exported = toUndulateJSON(useStore.getState().diagram);
    const lane = exported.signal.find((entry) =>
      !Array.isArray(entry) && entry.name === 'clk',
    );
    expect(lane).toMatchObject({ wave: 'P.........' });
    expect(lane).not.toMatchObject({ wave: expect.stringMatching(/P1P/) });
  });
});
