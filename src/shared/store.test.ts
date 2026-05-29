import { describe, it, expect, beforeEach } from 'vitest';
import type { BitState, DiagramState } from './types';
import { DEFAULT_STEPS } from './constants';
import { useStore } from './store';

function emptyDiagram(): DiagramState {
  return {
    version: 1,
    signals: [],
    config: { totalSteps: DEFAULT_STEPS, hscale: 1 },
    annotations: [],
  };
}

function resetStore(): void {
  useStore.getState().loadDiagram(emptyDiagram());
}

function bitStates(fill: BitState = '0'): BitState[] {
  return new Array<BitState>(DEFAULT_STEPS).fill(fill);
}

describe('useStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('addSignal, setSignalState, undo, redo', () => {
    useStore.getState().addSignal('bit');
    const signalId = useStore.getState().diagram.signals[0]!.id;

    useStore.getState().setSignalState(signalId, 3, '1');
    expect(useStore.getState().diagram.signals[0]).toMatchObject({
      type: 'bit',
      states: expect.arrayContaining(['1'] as BitState[]),
    });
    expect(
      (useStore.getState().diagram.signals[0] as { states: BitState[] }).states[3],
    ).toBe('1');

    useStore.getState().undo();
    expect(
      (useStore.getState().diagram.signals[0] as { states: BitState[] }).states[3],
    ).toBe('0');

    useStore.getState().redo();
    expect(
      (useStore.getState().diagram.signals[0] as { states: BitState[] }).states[3],
    ).toBe('1');
  });

  it('removeSignal removes a signal nested inside a group', () => {
    useStore.getState().loadDiagram({
      version: 1,
      config: { totalSteps: DEFAULT_STEPS, hscale: 1 },
      signals: [
        {
          id: 'group-1',
          name: 'Group',
          type: 'group',
          collapsed: false,
          children: [
            {
              id: 'nested-sig',
              name: 'nested',
              type: 'bit',
              states: bitStates(),
              segments: [],
              color: '#4A9EFF',
              rowHeight: 40,
            },
          ],
        },
      ],
      annotations: [],
    });

    useStore.getState().removeSignal('nested-sig');

    const group = useStore.getState().diagram.signals[0];
    expect(group?.type).toBe('group');
    if (group?.type === 'group') {
      expect(group.children).toHaveLength(0);
      expect(group.children.find((c) => c.id === 'nested-sig')).toBeUndefined();
    }
  });

  it('toggleSignalStateRange flips each step', () => {
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().setSignalState(id, 2, '1');
    useStore.getState().setSignalState(id, 3, '1');
    useStore.getState().toggleSignalStateRange(id, 2, 3);
    const sig = useStore.getState().diagram.signals[0] as { states: BitState[] };
    expect(sig.states[2]).toBe('0');
    expect(sig.states[3]).toBe('0');
    useStore.getState().toggleSignalStateRange(id, 2, 2);
    const after = useStore.getState().diagram.signals[0] as { states: BitState[] };
    expect(after.states[2]).toBe('1');
  });

  it('paintDraft does not grow history length', () => {
    useStore.getState().addSignal('bit');
    const signalId = useStore.getState().diagram.signals[0]!.id;
    const historyAfterAdd = useStore.getState().history.length;

    useStore.getState().setPaintDraft({
      signalId,
      startStep: 0,
      endStep: 2,
      bitState: '1',
      apply: 'set',
      mode: 'paint',
    });
    expect(useStore.getState().history.length).toBe(historyAfterAdd);
    expect(useStore.getState().view.paintDraft).not.toBeNull();

    useStore.getState().clearPaintDraft();
    expect(useStore.getState().history.length).toBe(historyAfterAdd);
    expect(useStore.getState().view.paintDraft).toBeNull();
  });
});
