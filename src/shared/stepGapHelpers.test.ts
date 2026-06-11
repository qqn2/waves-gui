import { describe, expect, it } from 'vitest';
import { useStore } from './store';
import { toWavedromJSON } from '../wavedromBridge';
import { createDefaultDiagram } from './defaultDiagram';

describe('gap column insert', () => {
  it('inserts a gap column at the painted index', () => {
    useStore.setState({
      diagram: createDefaultDiagram(),
      history: [],
      future: [],
      view: { ...useStore.getState().view, activeSignalIds: [] },
    });
    useStore.getState().clearAll();
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    const before = useStore.getState().diagram.config.totalSteps;
    useStore.getState().paintGapRange(id, 2, 2, 'additive');

    const sig = useStore.getState().diagram.signals[0] as {
      states: string[];
      stepGaps?: boolean[];
    };
    expect(useStore.getState().diagram.config.totalSteps).toBe(before + 1);
    expect(sig.stepGaps?.[2]).toBe(true);
  });

  it('inserts consecutive gap columns for multi-column paint', () => {
    useStore.setState({
      diagram: createDefaultDiagram(),
      history: [],
      future: [],
      view: { ...useStore.getState().view, activeSignalIds: [] },
    });
    useStore.getState().clearAll();
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().paintGapRange(id, 1, 3, 'additive');

    const sig = useStore.getState().diagram.signals[0] as {
      stepGaps?: boolean[];
    };
    expect(sig.stepGaps?.[1]).toBe(true);
    expect(sig.stepGaps?.[2]).toBe(true);
    expect(sig.stepGaps?.[3]).toBe(true);
  });

  it('emits |1 in wave without replacing the 1 state', () => {
    useStore.setState({
      diagram: createDefaultDiagram(),
      history: [],
      future: [],
      view: { ...useStore.getState().view, activeSignalIds: [] },
    });
    useStore.getState().clearAll();
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().setSignalStateRange(id, 0, 4, '0');
    useStore.getState().setSignalState(id, 2, '1');
    useStore.getState().paintGapRange(id, 2, 2, 'additive');

    const sig = useStore.getState().diagram.signals[0] as {
      states: string[];
      stepGaps?: boolean[];
    };
    expect(sig.states[2]).toBe('0');
    expect(sig.states[3]).toBe('1');
    expect(sig.stepGaps?.[2]).toBe(true);

    const wd = toWavedromJSON(useStore.getState().diagram);
    const entry = wd.signal.find((s) => 'wave' in s && (s as { wave: string }).wave.includes('|'));
    expect(entry).toBeDefined();
    const wave = (entry as { wave: string }).wave;
    expect(wave).toMatch(/\|1/);
    expect(wave).not.toMatch(/\|[^01pPnNxzud.]/);
  });
});

describe('paint style replace vs additive', () => {
  function resetStore(): string {
    useStore.setState({
      diagram: createDefaultDiagram(),
      history: [],
      future: [],
      view: { ...useStore.getState().view, activeSignalIds: [], paintStyle: 'replace' },
    });
    useStore.getState().clearAll();
    useStore.getState().addSignal('bit');
    return useStore.getState().diagram.signals[0]!.id;
  }

  it('replace paints 0 over a gap column', () => {
    const id = resetStore();
    const steps = useStore.getState().diagram.config.totalSteps;
    useStore.getState().paintGapRange(id, 2, 2, 'replace');
    useStore.getState().paintBitStateRange(id, 2, 2, '0', 'replace');
    const sig = useStore.getState().diagram.signals[0] as {
      states: string[];
      stepGaps?: boolean[];
    };
    expect(useStore.getState().diagram.config.totalSteps).toBe(steps);
    expect(sig.stepGaps?.[2]).toBeFalsy();
    expect(sig.states[2]).toBe('0');
  });

  it('additive paints 0 after a gap column', () => {
    const id = resetStore();
    const steps = useStore.getState().diagram.config.totalSteps;
    useStore.getState().paintGapRange(id, 2, 2, 'replace');
    useStore.getState().paintBitStateRange(id, 2, 2, '0', 'additive');
    const sig = useStore.getState().diagram.signals[0] as {
      states: string[];
      stepGaps?: boolean[];
    };
    expect(useStore.getState().diagram.config.totalSteps).toBe(steps + 1);
    expect(sig.stepGaps?.[2]).toBe(true);
    expect(sig.states[3]).toBe('0');
  });

  it('replace gap paint toggles without inserting columns', () => {
    const id = resetStore();
    const steps = useStore.getState().diagram.config.totalSteps;
    useStore.getState().paintGapRange(id, 3, 3, 'replace');
    const sig = useStore.getState().diagram.signals[0] as {
      stepGaps?: boolean[];
    };
    expect(useStore.getState().diagram.config.totalSteps).toBe(steps);
    expect(sig.stepGaps?.[3]).toBe(true);
    useStore.getState().paintGapRange(id, 3, 3, 'replace');
    expect(
      (useStore.getState().diagram.signals[0] as { stepGaps?: boolean[] }).stepGaps,
    ).toBeUndefined();
  });
});
