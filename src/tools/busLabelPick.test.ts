import { describe, it, expect, beforeEach } from 'vitest';
import { fillHexForColorIndex } from '../wavedromBridge/wavedromColors';
import { useStore } from '../shared/store';
import { defaultDiagram } from '../shared/store/helpers';
import type { VectorSegment } from '../shared/types';
import { pickBusLabelFromHit } from './busLabelPick';

describe('pickBusLabelFromHit', () => {
  beforeEach(() => {
    useStore.setState({
      diagram: defaultDiagram(),
      view: { ...useStore.getState().view, activeBusLabel: 'data', activeBusColorIndex: 2 },
      history: [],
      future: [],
    });
  });

  it('copies segment label and color into the paint toolbar', () => {
    const segments: VectorSegment[] = [
      {
        id: 's1',
        startStep: 0,
        endStep: 2,
        value: 'A0',
        color: fillHexForColorIndex(4),
      },
    ];
    useStore.setState((s) => {
      s.diagram.signals = [
        {
          id: 'v1',
          name: 'addr',
          type: 'vector',
          states: [],
          segments,
          color: '#4A9EFF',
          rowHeight: 40,
        },
      ];
    });

    const ok = pickBusLabelFromHit(
      { signalId: 'v1', signalType: 'vector', step: 0, half: null, isLabelArea: false, isTimeAxis: false, edgeIndex: null },
      useStore.getState().diagram,
    );

    expect(ok).toBe(true);
    expect(useStore.getState().view.activeBusLabel).toBe('A0');
    expect(useStore.getState().view.activeBusColorIndex).toBe(4);
  });

  it('returns false when the step has no bus data', () => {
    useStore.setState((s) => {
      s.diagram.signals = [
        {
          id: 'v1',
          name: 'addr',
          type: 'vector',
          states: [],
          segments: [],
          color: '#4A9EFF',
          rowHeight: 40,
        },
      ];
    });

    const ok = pickBusLabelFromHit(
      { signalId: 'v1', signalType: 'vector', step: 0, half: null, isLabelArea: false, isTimeAxis: false, edgeIndex: null },
      useStore.getState().diagram,
    );

    expect(ok).toBe(false);
    expect(useStore.getState().view.activeBusLabel).toBe('data');
  });
});
