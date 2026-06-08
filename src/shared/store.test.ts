import { describe, it, expect, beforeEach } from 'vitest';
import type { BitState, DiagramState } from './types';
import { DEFAULT_STEPS } from './constants';
import { createDefaultDiagram } from './defaultDiagram';
import { toWavedromJSON } from '../wavedromBridge';
import { useStore } from './store';

function emptyDiagram(): DiagramState {
  return {
    version: 1,
    signals: [],
    config: { totalSteps: DEFAULT_STEPS, hscale: 1 },
    edges: [],
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

  it('setHscale keeps fractional values in range', () => {
    useStore.getState().setHscale(1.5);
    expect(useStore.getState().diagram.config.hscale).toBe(1.5);
    useStore.getState().setHscale(4.2);
    expect(useStore.getState().diagram.config.hscale).toBe(4);
    useStore.getState().setHscale(0.5);
    expect(useStore.getState().diagram.config.hscale).toBe(1);
  });

  it('loadDiagram increments diagramRevision', () => {
    const rev0 = useStore.getState().view.diagramRevision;
    useStore.getState().addSignal('bit');
    expect(useStore.getState().view.diagramRevision).toBeGreaterThan(rev0);

    const revBeforeLoad = useStore.getState().view.diagramRevision;
    useStore.getState().loadDiagram(createDefaultDiagram());
    expect(useStore.getState().view.diagramRevision).toBe(revBeforeLoad + 1);
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
      edges: [],
    });

    useStore.getState().removeSignal('nested-sig');

    const group = useStore.getState().diagram.signals[0];
    expect(group?.type).toBe('group');
    if (group?.type === 'group') {
      expect(group.children).toHaveLength(0);
      expect(group.children.find((c) => c.id === 'nested-sig')).toBeUndefined();
    }
  });

  it('setVectorSpanRange paints bus data across steps', () => {
    useStore.getState().addSignal('vector');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().setVectorSpanRange(id, 1, 3, 'NONSEQ');
    const sig = useStore.getState().diagram.signals[0];
    expect(sig?.type).toBe('vector');
    if (sig?.type === 'vector') {
      const seg = sig.segments.find((s) => s.value === 'NONSEQ');
      expect(seg?.startStep).toBe(1);
      expect(seg?.endStep).toBe(4);
    }
  });

  it('moveSignalToParent nests a signal inside a section', () => {
    useStore.getState().addGroup(undefined, 'Datapath');
    const groupId = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().addSignal('bit');
    const signalId = useStore.getState().diagram.signals[1]!.id;
    useStore.getState().moveSignalToParent(signalId, groupId);
    const root = useStore.getState().diagram.signals;
    expect(root).toHaveLength(1);
    const group = root[0];
    expect(group?.type).toBe('group');
    if (group?.type === 'group') {
      expect(group.children).toHaveLength(1);
      expect(group.children[0]?.id).toBe(signalId);
    }
  });

  it('moveSignalToParent returns signal to root', () => {
    useStore.getState().addGroup(undefined, 'G');
    const groupId = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().addSignal('bit');
    const signalId = useStore.getState().diagram.signals[1]!.id;
    useStore.getState().moveSignalToParent(signalId, groupId);
    useStore.getState().moveSignalToParent(signalId, undefined);
    expect(useStore.getState().diagram.signals).toHaveLength(2);
    expect(useStore.getState().diagram.signals[1]?.id).toBe(signalId);
  });

  it('addGroup inserts an empty WaveDrom section', () => {
    useStore.getState().addGroup();
    const g = useStore.getState().diagram.signals[0];
    expect(g?.type).toBe('group');
    if (g?.type === 'group') {
      expect(g.name).toBe('Section');
      expect(g.children).toHaveLength(0);
      expect(g.collapsed).toBe(false);
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

  it('setTotalSteps resizes bit states and skips no-op', () => {
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().setSignalState(id, 19, '1');
    const beforeHist = useStore.getState().history.length;
    useStore.getState().setTotalSteps(24);
    expect(useStore.getState().diagram.config.totalSteps).toBe(24);
    const sig = useStore.getState().diagram.signals[0] as { states: BitState[] };
    expect(sig.states).toHaveLength(24);
    expect(sig.states[23]).toBe('1');
    useStore.getState().setTotalSteps(24);
    expect(useStore.getState().history.length).toBe(beforeHist + 1);
  });

  it('toggleSignalStateRange leaves x/z and flips p/n', () => {
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().setSignalState(id, 0, 'x');
    useStore.getState().setSignalState(id, 1, 'z');
    useStore.getState().setSignalState(id, 2, 'p');
    useStore.getState().setSignalState(id, 3, 'n');
    useStore.getState().toggleSignalStateRange(id, 0, 3);
    const sig = useStore.getState().diagram.signals[0] as { states: BitState[] };
    expect(sig.states[0]).toBe('x');
    expect(sig.states[1]).toBe('z');
    expect(sig.states[2]).toBe('n');
    expect(sig.states[3]).toBe('p');
  });

  it('toggleSignalStateRange inverts clock-reset clk lane from one step', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const clk = useStore.getState().diagram.signals[0] as { id: string; states: BitState[] };
    useStore.getState().toggleSignalStateRange(clk.id, 0, 0);
    const after = (useStore.getState().diagram.signals[0] as { states: BitState[] }).states;
    expect(after[0]).toBe('n');
    expect(after[1]).toBe('p');
  });

  it('painting 0 into clk does not export Pn0..nPnPn spam', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const clk = useStore.getState().diagram.signals[0] as { id: string; states: BitState[] };
    useStore.getState().setSignalStateRange(clk.id, 2, 2, '0');
    const wave = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave;
    expect(wave).not.toMatch(/Pn|nP|pN|Np/);
  });

  it('eraseSignalStateRange clears step glitches on touched boundaries', () => {
    useStore.getState().addSignal('bit');
    const id = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().setSignalState(id, 0, '0');
    useStore.getState().setSignalState(id, 1, '0');
    useStore.getState().toggleStepGlitchRange(id, 0, 1);
    expect(
      (useStore.getState().diagram.signals[0] as { stepGlitches?: boolean[] })
        .stepGlitches?.[0],
    ).toBe(true);

    useStore.getState().eraseSignalStateRange(id, 1, 1);
    const sig = useStore.getState().diagram.signals[0] as {
      stepGlitches?: boolean[];
    };
    expect(sig.stepGlitches).toBeUndefined();
  });

  it('paintDraft does not grow history length', () => {
    useStore.getState().addSignal('bit');
    const signalId = useStore.getState().diagram.signals[0]!.id;
    const historyAfterAdd = useStore.getState().history.length;

    useStore.getState().setPaintDraft({
      signalId,
      startStep: 0,
      endStep: 2,
      lane: 'bit',
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

  it('duplicateSignal clones a bit signal and inserts it after the original', () => {
    useStore.getState().addSignal('bit');
    const root = useStore.getState().diagram.signals;
    expect(root).toHaveLength(1);
    const orig = root[0]!;
    useStore.getState().setSignalState(orig.id, 2, '1');

    useStore.getState().duplicateSignal(orig.id);
    const updated = useStore.getState().diagram.signals;
    expect(updated).toHaveLength(2);
    expect(updated[0]?.id).toBe(orig.id);
    const clone = updated[1]!;
    expect(clone.id).not.toBe(orig.id);
    expect(clone.name).toBe(orig.name);
    expect(clone.type).toBe('bit');
    expect((clone as { states: BitState[] }).states[2]).toBe('1');
  });

  it('duplicateSignal clones a vector signal with segment IDs regenerated', () => {
    useStore.getState().addSignal('vector');
    const root = useStore.getState().diagram.signals;
    expect(root).toHaveLength(1);
    const orig = root[0]!;
    useStore.getState().setVectorSpanRange(orig.id, 1, 3, 'SEQ');

    useStore.getState().duplicateSignal(orig.id);
    const updated = useStore.getState().diagram.signals;
    expect(updated).toHaveLength(2);
    const clone = updated[1]!;
    expect(clone.id).not.toBe(orig.id);
    expect(clone.type).toBe('vector');
    
    // segments should be copied and have different IDs
    const origSig = updated[0] as { segments: { id: string; value: string }[] };
    const cloneSig = clone as { segments: { id: string; value: string }[] };
    expect(cloneSig.segments).toHaveLength(origSig.segments.length);
    for (let i = 0; i < cloneSig.segments.length; i++) {
      expect(cloneSig.segments[i]?.id).not.toBe(origSig.segments[i]?.id);
      expect(cloneSig.segments[i]?.value).toBe(origSig.segments[i]?.value);
    }
  });

  it('duplicateSignal duplicates a signal inside a group', () => {
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
              id: 'nested-sig-1',
              name: 'nested1',
              type: 'bit',
              states: bitStates(),
              segments: [],
              color: '#4A9EFF',
              rowHeight: 40,
            },
            {
              id: 'nested-sig-2',
              name: 'nested2',
              type: 'bit',
              states: bitStates(),
              segments: [],
              color: '#4A9EFF',
              rowHeight: 40,
            },
          ],
        },
      ],
      edges: [],
    });

    useStore.getState().duplicateSignal('nested-sig-1');
    const group = useStore.getState().diagram.signals[0];
    expect(group?.type).toBe('group');
    if (group?.type === 'group') {
      expect(group.children).toHaveLength(3);
      expect(group.children[0]?.id).toBe('nested-sig-1');
      expect(group.children[1]?.id).not.toBe('nested-sig-1');
      expect(group.children[1]?.name).toBe('nested1');
      expect(group.children[2]?.id).toBe('nested-sig-2');
    }
  });
});
