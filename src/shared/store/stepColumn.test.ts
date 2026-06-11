import { describe, expect, it, beforeEach } from 'vitest';
import { useStore } from './index';
import { createDefaultDiagram } from '../defaultDiagram';

describe('step column actions', () => {
  beforeEach(() => {
    useStore.setState({
      diagram: createDefaultDiagram(),
      history: [],
      future: [],
      view: { ...useStore.getState().view, activeSignalIds: [] },
    });
  });

  it('insertStepAt adds a column and clears edges', () => {
    useStore.getState().addDiagramEdge('a->b');
    const before = useStore.getState().diagram.config.totalSteps;
    useStore.getState().insertStepAt(1);
    const after = useStore.getState().diagram;
    expect(after.config.totalSteps).toBe(before + 1);
    expect(after.edges).toEqual([]);
  });

  it('deleteStepAt removes a column', () => {
    useStore.getState().insertStepAt(0);
    const steps = useStore.getState().diagram.config.totalSteps;
    useStore.getState().deleteStepAt(0);
    expect(useStore.getState().diagram.config.totalSteps).toBe(steps - 1);
  });

  it('insertGapColumnsRange sets gap column on one lane', () => {
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().insertGapColumnsRange(id, 2, 1);
    const sig = useStore.getState().diagram.signals[0] as {
      stepGaps?: boolean[];
    };
    expect(sig.stepGaps?.[2]).toBe(true);
  });

  it('eraseSignalStateRange removes gap columns in range', () => {
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().insertGapColumnsRange(id, 1, 1);
    useStore.getState().eraseSignalStateRange(id, 1, 1);
    const sig = useStore.getState().diagram.signals[0] as {
      stepGaps?: boolean[];
    };
    expect(sig.stepGaps).toBeUndefined();
  });
});
