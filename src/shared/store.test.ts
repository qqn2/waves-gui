import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, findSignal, removeFromTree } from './store';
import type { Signal, SignalGroup } from './types';

function resetStore() {
  useStore.setState({
    diagram: {
      version: 1,
      signals: [],
      config: { totalSteps: 20, hscale: 1 },
      annotations: [],
    },
    view: {
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
      selectedTool: 'paint',
      activeBitState: '1',
      activeSignalIds: [],
      showCodePanel: false,
      showTimeAxis: true,
      theme: 'dark',
      isDirty: false,
      fileName: null,
      paintDraft: null,
    },
    history: [],
    future: [],
  });
}

describe('useStore', () => {
  beforeEach(() => {
    resetStore();
  });

  it('addSignal, setSignalState, undo, redo', () => {
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0].id;
    useStore.getState().setSignalState(id, 3, '1');
    expect(
      (useStore.getState().diagram.signals[0] as Signal).states[3],
    ).toBe('1');

    useStore.getState().undo();
    expect(
      (useStore.getState().diagram.signals[0] as Signal).states[3],
    ).toBe('0');

    useStore.getState().redo();
    expect(
      (useStore.getState().diagram.signals[0] as Signal).states[3],
    ).toBe('1');
  });

  it('setPaintDraft does not push history', () => {
    useStore.getState().addSignal('bit');
    const histAfterAdd = useStore.getState().history.length;
    const id = useStore.getState().diagram.signals[0].id;
    useStore.getState().setPaintDraft({
      signalId: id,
      startStep: 0,
      endStep: 2,
      bitState: '1',
      mode: 'paint',
    });
    expect(useStore.getState().history.length).toBe(histAfterAdd);
    useStore.getState().clearPaintDraft();
    expect(useStore.getState().history.length).toBe(histAfterAdd);
  });

  it('removeSignal removes nested signal via removeFromTree', () => {
    const nested: Signal = {
      id: 'nested-sig',
      name: 'inner',
      type: 'bit',
      states: new Array(20).fill('0') as Signal['states'],
      segments: [],
      color: '#4A9EFF',
      rowHeight: 40,
    };
    const group: SignalGroup = {
      id: 'grp',
      name: 'G',
      type: 'group',
      children: [nested],
      collapsed: false,
    };
    useStore.setState((s) => {
      s.diagram.signals = [group];
    });

    expect(findSignal(useStore.getState().diagram.signals, 'nested-sig', () => {})).toBe(
      true,
    );
    useStore.getState().removeSignal('nested-sig');
    const grp = useStore.getState().diagram.signals[0] as SignalGroup;
    expect(grp.children).toHaveLength(0);
  });

  it('removeFromTree helper', () => {
    const sig: Signal = {
      id: 'a',
      name: 'a',
      type: 'bit',
      states: [],
      segments: [],
      color: '#000',
      rowHeight: 40,
    };
    const tree = removeFromTree(
      [{ id: 'g', name: 'g', type: 'group', children: [sig], collapsed: false }],
      'a',
    );
    expect((tree[0] as SignalGroup).children).toHaveLength(0);
  });
});
