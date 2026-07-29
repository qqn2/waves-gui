import { describe, it, expect, beforeEach } from 'vitest';
import type { BitState, DiagramState } from './types';
import { DEFAULT_STEPS } from './constants';
import { createDefaultDiagram } from './defaultDiagram';
import { toWavedromJSON } from '../wavedromBridge';
import {
  diagramToCodeString,
  parseCodeToDiagram,
} from '../codePanel/codeSync';
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

  it('adds and resizes a normalized analogue lane', () => {
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().addSignal('analogue');
    const signal = useStore.getState().diagram.signals[0];

    expect(signal).toMatchObject({
      type: 'analogue',
      name: 'analog',
      analogueMin: 0,
      analogueMax: 1.8,
    });
    if (!signal || signal.type !== 'analogue') return;
    expect(signal.analogueCells).toHaveLength(DEFAULT_STEPS);

    useStore.getState().setTotalSteps(DEFAULT_STEPS + 2);
    const resized = useStore.getState().diagram.signals[0];
    expect(resized?.type === 'analogue' && resized.analogueCells).toHaveLength(
      DEFAULT_STEPS + 2,
    );
  });

  it('edits analogue cells and properties with undo and mode locking', () => {
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().addSignal('analogue');
    const signal = useStore.getState().diagram.signals[0];
    if (!signal || signal.type !== 'analogue') return;

    useStore.getState().updateAnalogueCell(signal.id, 0, {
      kind: 'capacitive',
      value: 1.2,
    });
    useStore.getState().updateAnalogueSignal(signal.id, {
      analogueMax: 3.3,
      slewing: 8,
      vscale: 2,
    });
    expect(useStore.getState().diagram.signals[0]).toMatchObject({
      analogueMax: 3.3,
      slewing: 8,
      vscale: 2,
      rowHeight: 80,
    });
    const edited = useStore.getState().diagram.signals[0];
    expect(
      edited?.type === 'analogue' && edited.analogueCells?.[0],
    ).toMatchObject({ kind: 'capacitive', value: 1.2 });

    useStore.getState().undo();
    expect(useStore.getState().diagram.signals[0]).toMatchObject({
      analogueMax: 1.8,
      rowHeight: 40,
    });

    useStore.getState().setExtensionsEnabled(false);
    useStore.getState().updateAnalogueCell(signal.id, 0, { value: 99 });
    const locked = useStore.getState().diagram.signals[0];
    expect(
      locked?.type === 'analogue' && locked.analogueCells?.[0]?.value,
    ).toBe(1.2);
  });

  it('creates, extends, and dissolves explicit analogue overlay groups', () => {
    useStore.getState().setExtensionsEnabled(true);
    for (let index = 0; index < 5; index++) {
      useStore.getState().addSignal('analogue');
    }
    const analogues = useStore.getState().diagram.signals.filter(
      (item) => item.type === 'analogue',
    );
    expect(analogues).toHaveLength(5);

    expect(useStore.getState().extendAnalogueOverlayGroup(analogues[0]!.id)).toBe(true);
    expect(useStore.getState().extendAnalogueOverlayGroup(analogues[0]!.id)).toBe(true);
    expect(useStore.getState().extendAnalogueOverlayGroup(analogues[1]!.id)).toBe(true);
    expect(useStore.getState().extendAnalogueOverlayGroup(analogues[0]!.id)).toBe(false);

    const grouped = useStore.getState().diagram;
    expect(grouped.analogueOverlayGroups).toHaveLength(1);
    expect(grouped.analogueOverlayGroups?.[0]?.signalIds).toEqual(
      analogues.slice(0, 4).map((signal) => signal.id),
    );
    expect(analogues.slice(0, 4).map((signal) => {
      const current = grouped.signals.find((item) => item.id === signal.id);
      return current?.type === 'analogue' ? current.overlay === true : null;
    })).toEqual([true, true, true, false]);

    const groupId = grouped.analogueOverlayGroups![0]!.id;
    useStore.getState().dissolveAnalogueOverlayGroup(groupId);
    expect(useStore.getState().diagram.analogueOverlayGroups).toEqual([]);
    expect(useStore.getState().diagram.signals).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ overlay: true })]),
    );

    useStore.getState().undo();
    expect(useStore.getState().diagram.analogueOverlayGroups?.[0]?.signalIds)
      .toHaveLength(4);
  });

  it('paints an analogue cell range as one undoable brush stroke', () => {
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().addSignal('analogue');
    const signal = useStore.getState().diagram.signals[0];
    if (!signal || signal.type !== 'analogue') return;
    const historyBeforePaint = useStore.getState().history.length;

    useStore.getState().paintAnalogueCellRange(
      signal.id,
      2,
      4,
      'samples',
      1.2,
    );

    const painted = useStore.getState().diagram.signals[0];
    if (!painted || painted.type !== 'analogue') return;
    expect(useStore.getState().history).toHaveLength(historyBeforePaint + 1);
    expect(painted.analogueCells?.slice(2, 5)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'samples', value: 1.2 }),
      ]),
    );
    expect(painted.analogueCells?.[2]?.samples).toEqual([
      { offset: 0, value: 0 },
      { offset: 1, value: 1.2 },
    ]);

    useStore.getState().undo();
    const restored = useStore.getState().diagram.signals[0];
    expect(
      restored?.type === 'analogue'
        && restored.analogueCells?.slice(2, 5).map((cell) => cell.value),
    ).toEqual([0, 0, 0]);
  });

  it('paints hold cells with the previous voltage instead of the target', () => {
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().addSignal('analogue');
    const signal = useStore.getState().diagram.signals[0];
    if (!signal || signal.type !== 'analogue') return;

    useStore.getState().paintAnalogueCellRange(signal.id, 0, 0, 'step', 1.2);
    useStore.getState().paintAnalogueCellRange(signal.id, 1, 2, 'hold', 0.3);

    const painted = useStore.getState().diagram.signals[0];
    expect(
      painted?.type === 'analogue'
        ? painted.analogueCells?.slice(0, 3).map((cell) => ({
            kind: cell.kind,
            value: cell.value,
          }))
        : null,
    ).toEqual([
      { kind: 'step', value: 1.2 },
      { kind: 'hold', value: 1.2 },
      { kind: 'hold', value: 1.2 },
    ]);
  });

  it('records a raw diagram edit in unified undo history and dirtiness', () => {
    const edited = createDefaultDiagram();
    edited.config.head = { text: 'raw edit' };

    useStore.getState().applyDiagramEdit(edited);
    expect(useStore.getState().view.isDirty).toBe(true);
    expect(useStore.getState().diagram.config.head?.text).toBe('raw edit');

    useStore.getState().undo();
    expect(useStore.getState().view.isDirty).toBe(false);
    expect(useStore.getState().diagram.config.head).toBeUndefined();

    useStore.getState().redo();
    expect(useStore.getState().view.isDirty).toBe(true);
    expect(useStore.getState().diagram.config.head?.text).toBe('raw edit');
  });

  it('keeps retained JSON5 comments in undo and redo snapshots', () => {
    const source = `{
  signal: [
    // user clock note
    { name: 'clk', wave: '01' },
  ],
}`;
    const parsed = parseCodeToDiagram(source);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    useStore.getState().loadDiagram(parsed.diagram);
    const signal = useStore.getState().diagram.signals[0];
    if (!signal || signal.type === 'group') return;

    useStore.getState().renameSignal(signal.id, 'renamed');
    expect(diagramToCodeString(useStore.getState().diagram)).toContain(
      '// user clock note',
    );
    expect(diagramToCodeString(useStore.getState().diagram)).toContain(
      "name: 'renamed'",
    );

    useStore.getState().undo();
    expect(diagramToCodeString(useStore.getState().diagram)).toContain(
      "{ name: 'clk', wave: '01' }",
    );
    expect(diagramToCodeString(useStore.getState().diagram)).toContain(
      '// user clock note',
    );

    useStore.getState().redo();
    expect(diagramToCodeString(useStore.getState().diagram)).toContain(
      "name: 'renamed'",
    );
  });

  it('applies extension-aware JSON edits without preserving deleted annotations', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.getState().setExtensionsEnabled(true);
    const oldSignalId = useStore.getState().diagram.signals[0]!.id;
    useStore.getState().addTextAnnotation({
      text: 'preserved',
      tick: 1,
      signalId: oldSignalId,
    });
    const edited = createDefaultDiagram();
    edited.config.head = { text: 'code edit' };
    const newSignalId = edited.signals[0]!.id;

    useStore.getState().applyDiagramEdit(edited);

    expect(newSignalId).not.toBe(oldSignalId);
    expect(useStore.getState().diagram.annotations).toEqual([]);
    expect(useStore.getState().diagram.compatibility?.extensionsEnabled).toBe(false);
  });

  it('reevaluates expression-backed cells when the Ludwig rails change', () => {
    const diagram = emptyDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.config.analogueContext = { vssa: 0, vdda: 1.8 };
    diagram.signals = [{
      id: 'analogue-expression',
      name: 'supply',
      type: 'analogue',
      states: [],
      segments: [],
      color: '#4A9EFF',
      rowHeight: 40,
      analogueMin: 0,
      analogueMax: 1.8,
      analogueCells: [{
        id: 'expression-cell',
        kind: 'step',
        value: 0.9,
        expression: '0.5*VDDA + VSSA',
      }],
    }];
    useStore.getState().loadDiagram(diagram);

    useStore.getState().updateAnalogueContext({ vssa: 0.2, vdda: 3.3 });
    const updated = useStore.getState().diagram.signals[0];
    expect(useStore.getState().diagram.config.analogueContext)
      .toEqual({ vssa: 0.2, vdda: 3.3 });
    expect(updated).toMatchObject({ analogueMin: 0.2, analogueMax: 3.3 });
    expect(updated?.type === 'analogue' && updated.analogueCells?.[0]?.value)
      .toBeCloseTo(1.85);

    useStore.getState().updateAnalogueCell(
      'analogue-expression',
      0,
      { value: 1 },
    );
    const detached = useStore.getState().diagram.signals[0];
    expect(detached?.type === 'analogue' && detached.analogueCells?.[0]?.expression)
      .toBeUndefined();
  });

  it('keeps the corresponding signal selected across raw JSON edits', () => {
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().addSignal('bit');
    useStore.getState().addSignal('analogue');
    const previous = useStore.getState().diagram;
    const selected = previous.signals[1];
    if (!selected || selected.type !== 'analogue') return;
    useStore.getState().setActiveSignalIds([selected.id]);

    const edited = structuredClone(previous);
    edited.signals = [edited.signals[1]!];
    const replacement = edited.signals[0];
    if (!replacement || replacement.type !== 'analogue') return;
    replacement.id = 'json-replacement-id';
    replacement.name = 'supply';
    replacement.analogueMax = 3.3;
    replacement.analogueCells![2]!.value = 2.4;

    useStore.getState().applyDiagramEdit(edited);

    expect(useStore.getState().view.activeSignalIds).toEqual([
      'json-replacement-id',
    ]);
    expect(useStore.getState().diagram.signals[0]).toMatchObject({
      id: 'json-replacement-id',
      type: 'analogue',
      analogueMax: 3.3,
    });
  });

  it('toggles Undulate extensions as an undoable document edit', () => {
    expect(useStore.getState().diagram.compatibility?.extensionsEnabled).toBe(false);

    useStore.getState().setExtensionsEnabled(true);
    expect(useStore.getState().diagram.version).toBe(2);
    expect(useStore.getState().diagram.compatibility?.extensionsEnabled).toBe(true);
    expect(useStore.getState().view.isDirty).toBe(true);

    useStore.getState().undo();
    expect(useStore.getState().diagram.compatibility?.extensionsEnabled).toBe(false);

    useStore.getState().redo();
    expect(useStore.getState().diagram.compatibility?.extensionsEnabled).toBe(true);
  });

  it('hides Undulate features without changing their JSON', () => {
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().addSignal('bit');
    useStore.getState().addSignal('analogue');
    const withNodes = structuredClone(useStore.getState().diagram);
    const bit = withNodes.signals[0]!;
    if (bit.type !== 'group') {
      bit.node = '....';
      bit.nodeNames = { 1: 'request.ready' };
      withNodes.edges = ['request.ready->b remove', 'a-#b marked'];
    }
    useStore.getState().loadDiagram(withNodes);
    useStore.getState().addTextAnnotation({
      text: 'preserved',
      tick: 1,
      signalId: bit.id,
    });
    const before = diagramToCodeString(useStore.getState().diagram);

    useStore.getState().setExtensionsEnabled(false);

    expect(useStore.getState().diagram.compatibility?.extensionsEnabled).toBe(false);
    expect(diagramToCodeString(useStore.getState().diagram)).toBe(before);
    expect(useStore.getState().diagram.annotations).toHaveLength(1);
    expect(useStore.getState().diagram.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'analogue' })]),
    );
  });

  it('removes all supported Undulate features as one undoable edit', () => {
    useStore.getState().setExtensionsEnabled(true);
    useStore.getState().addSignal('bit');
    useStore.getState().addSignal('analogue');
    const withNodes = structuredClone(useStore.getState().diagram);
    const bit = withNodes.signals[0]!;
    if (bit.type !== 'group') {
      bit.node = '....';
      bit.nodeNames = { 1: 'request.ready' };
      withNodes.edges = ['request.ready->b remove', 'a-#b marked'];
    }
    useStore.getState().loadDiagram(withNodes);
    useStore.getState().addTextAnnotation({
      text: 'remove me',
      tick: 1,
      signalId: bit.id,
    });

    useStore.getState().removeUndulateFeatures();

    const stripped = useStore.getState().diagram;
    expect(stripped.compatibility).toMatchObject({
      extensionsEnabled: false,
      sourceFormat: 'wavedrom-json',
    });
    expect(stripped.compatibility).not.toHaveProperty('sourceRevision');
    expect(stripped.annotations).toEqual([]);
    expect(stripped.edges).toEqual([]);
    expect(stripped.signals[0]).not.toHaveProperty('nodeNames');
    expect(stripped.signals).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'analogue' })]),
    );
    const json = JSON.parse(diagramToCodeString(stripped)) as Record<string, unknown>;
    expect(json).not.toHaveProperty('annotations');
    expect(JSON.stringify(json)).not.toContain('"analogue"');

    useStore.getState().undo();
    expect(useStore.getState().diagram.annotations).toHaveLength(1);
    expect(useStore.getState().diagram.edges).toEqual([
      'request.ready->b remove',
      'a-#b marked',
    ]);
    expect(useStore.getState().diagram.signals[0]).toHaveProperty(
      'nodeNames.1',
      'request.ready',
    );
    expect(useStore.getState().diagram.signals).toEqual(
      expect.arrayContaining([expect.objectContaining({ type: 'analogue' })]),
    );
  });

  it('removes fine digital timing while preserving its compatible phase', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = {
      extensionsEnabled: true,
      sourceFormat: 'undulate-json',
      sourceRevision: 'test',
    };
    diagram.config.ticksPerStep = 4;
    const bit = diagram.signals.find((item) => item.type === 'bit');
    expect(bit?.type).toBe('bit');
    if (!bit || bit.type !== 'bit') return;
    bit.digitalTiming = {
      ticksPerStep: 4,
      phaseTicks: 1,
      slewing: 0.1,
      cells: bit.states.map((state, index) => ({
        state,
        durationTicks: index === 0 ? 2 : 4,
        dutyTicks: index === 0 ? 1 : 2,
      })),
    };
    useStore.getState().loadDiagram(diagram);

    useStore.getState().removeUndulateFeatures();

    const stripped = useStore.getState().diagram.signals.find(
      (item) => item.type === 'bit' && item.id === bit.id,
    );
    expect(stripped?.type).toBe('bit');
    if (!stripped || stripped.type !== 'bit') return;
    expect(stripped.digitalTiming).toBeUndefined();
    expect(stripped.period).toBeUndefined();
    expect(stripped.phase).toBe(0.25);
    expect(useStore.getState().diagram.config.ticksPerStep).toBeUndefined();

    useStore.getState().undo();
    const restored = useStore.getState().diagram.signals.find(
      (item) => item.type === 'bit' && item.id === bit.id,
    );
    expect(restored?.type === 'bit' ? restored.digitalTiming : undefined)
      .toMatchObject({ ticksPerStep: 4, phaseTicks: 1, slewing: 0.1 });
  });

  it('rescales the document timebase without changing represented timing', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.config.ticksPerStep = 4;
    const bit = diagram.signals.find((item) => item.type === 'bit');
    expect(bit?.type).toBe('bit');
    if (!bit || bit.type !== 'bit') return;
    bit.digitalTiming = {
      ticksPerStep: 4,
      phaseTicks: 1,
      cells: bit.states.map((state, index) => ({
        state,
        durationTicks: index === 0 ? 2 : 4,
        dutyTicks: index === 0 ? 1 : 2,
      })),
    };
    useStore.getState().loadDiagram(diagram);

    expect(useStore.getState().setTicksPerStep(8)).toBe(true);
    const scaled = useStore.getState().diagram.signals.find(
      (item) => item.type === 'bit' && item.id === bit.id,
    );
    const timing = scaled?.type === 'bit' ? scaled.digitalTiming : undefined;
    expect(timing).toMatchObject({ ticksPerStep: 8, phaseTicks: 2 });
    expect(timing?.cells[0]).toMatchObject({ durationTicks: 4, dutyTicks: 2 });
    expect(timing?.cells[1]).toMatchObject({ durationTicks: 8, dutyTicks: 4 });

    useStore.getState().undo();
    expect(useStore.getState().diagram.config.ticksPerStep).toBe(4);
  });

  it('rejects a sub-step resolution that would round a timing boundary', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.config.ticksPerStep = 4;
    const bit = diagram.signals.find((item) => item.type === 'bit');
    expect(bit?.type).toBe('bit');
    if (!bit || bit.type !== 'bit') return;
    bit.digitalTiming = {
      ticksPerStep: 4,
      phaseTicks: 1,
      cells: bit.states.map((state) => ({
        state,
        durationTicks: 4,
        dutyTicks: 2,
      })),
    };
    useStore.getState().loadDiagram(diagram);
    const before = structuredClone(useStore.getState().diagram);

    expect(useStore.getState().setTicksPerStep(2)).toBe(false);
    expect(useStore.getState().diagram).toEqual(before);
    expect(useStore.getState().history).toHaveLength(0);
  });

  it('returns clean when undo reaches the saved snapshot', () => {
    useStore.getState().addSignal('bit');
    useStore.getState().markClean('saved.json');
    const savedSignalCount = useStore.getState().diagram.signals.length;

    useStore.getState().addSignal('vector');
    expect(useStore.getState().view.isDirty).toBe(true);

    useStore.getState().undo();
    expect(useStore.getState().diagram.signals).toHaveLength(savedSignalCount);
    expect(useStore.getState().view.isDirty).toBe(false);
  });

  it('becomes dirty when undo moves before the saved snapshot', () => {
    useStore.getState().addSignal('bit');
    useStore.getState().markClean('saved.json');
    expect(useStore.getState().view.isDirty).toBe(false);

    useStore.getState().undo();
    expect(useStore.getState().diagram.signals).toHaveLength(0);
    expect(useStore.getState().view.isDirty).toBe(true);
  });

  it('restores recovery data as unsaved instead of treating it as a file load', () => {
    const draft = createDefaultDiagram();
    draft.config.head = { text: 'recovered' };

    useStore.getState().restoreDraft(draft);

    expect(useStore.getState().diagram.config.head?.text).toBe('recovered');
    expect(useStore.getState().view.isDirty).toBe(true);
    expect(useStore.getState().history).toHaveLength(0);
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

  it('adds a WaveDrom arrow and both node anchors as one undoable edit', () => {
    useStore.getState().addSignal('bit');
    useStore.getState().addSignal('bit');
    const [from, to] = useStore.getState().diagram.signals;
    const historyBefore = useStore.getState().history.length;

    useStore.getState().addDiagramArrow(
      { signalId: from!.id, step: 1 },
      { signalId: to!.id, step: 4 },
      '~>',
    );

    const after = useStore.getState();
    expect(after.history).toHaveLength(historyBefore + 1);
    expect(after.diagram.edges).toEqual(['A~>B']);
    expect(after.diagram.signals[0]).toMatchObject({ node: '.A..................' });
    expect(after.diagram.signals[1]).toMatchObject({ node: '....B...............' });
    expect(toWavedromJSON(after.diagram)).toMatchObject({
      edge: ['A~>B'],
      signal: [
        { node: '.A..................' },
        { node: '....B...............' },
      ],
    });

    useStore.getState().undo();
    expect(useStore.getState().diagram.edges).toEqual([]);
    expect(useStore.getState().diagram.signals[0]).not.toHaveProperty('node');
    expect(useStore.getState().diagram.signals[1]).not.toHaveProperty('node');
  });

  it('adds labeled edges without forcing an arrowhead', () => {
    useStore.getState().addSignal('bit');
    useStore.getState().addSignal('bit');
    const [from, to] = useStore.getState().diagram.signals;

    useStore.getState().addDiagramArrow(
      { signalId: from!.id, step: 2 },
      { signalId: to!.id, step: 5 },
      '-~',
      't2',
    );

    expect(useStore.getState().diagram.edges).toEqual(['A-~B t2']);
  });

  it('does not create an arrow when press and release resolve to one cell', () => {
    useStore.getState().addSignal('bit');
    const signal = useStore.getState().diagram.signals[0]!;
    const historyBefore = useStore.getState().history.length;

    useStore.getState().addDiagramArrow(
      { signalId: signal.id, step: 2 },
      { signalId: signal.id, step: 2 },
      '~',
    );

    expect(useStore.getState().history).toHaveLength(historyBefore);
    expect(useStore.getState().diagram.edges).toEqual([]);
    expect(useStore.getState().diagram.signals[0]).not.toHaveProperty('node');
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

  it('removeSignal deletes a section with its children and supports undo', () => {
    useStore.getState().loadDiagram({
      version: 1,
      config: { totalSteps: DEFAULT_STEPS, hscale: 1 },
      signals: [
        {
          id: 'section-1',
          name: 'Section',
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

    useStore.getState().removeSignal('section-1');
    expect(useStore.getState().diagram.signals).toEqual([]);

    useStore.getState().undo();
    expect(useStore.getState().diagram.signals).toEqual([
      expect.objectContaining({
        id: 'section-1',
        type: 'group',
        children: [expect.objectContaining({ id: 'nested-sig' })],
      }),
    ]);
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

  it('toggleSignalStateRange inverts only the selected clock cycle', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const clk = useStore.getState().diagram.signals[0] as { id: string; states: BitState[] };
    useStore.getState().toggleSignalStateRange(clk.id, 0, 0);
    const after = (useStore.getState().diagram.signals[0] as { states: BitState[] }).states;
    expect(after[0]).toBe('N');
    expect(after[1]).toBe('P');
  });

  it('painting 0 into clk does not export Pn0..nPnPn spam', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const clk = useStore.getState().diagram.signals[0] as { id: string; states: BitState[] };
    useStore.getState().setSignalStateRange(clk.id, 2, 2, '0');
    const wave = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave;
    expect(wave).not.toMatch(/Pn|nP|pN|Np/);
  });

  it('setTotalSteps on default diagram keeps clk as P... after grow and shrink', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const clkBefore = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    useStore.getState().setTotalSteps(clkBefore.length + 2);
    useStore.getState().setTotalSteps(clkBefore.length);
    const clkAfter = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    expect(clkAfter).toBe(clkBefore);
    expect(clkAfter).toMatch(/^P\.+$/);
  });

  it('erase on clk replaces only that cycle with its inactive level', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const clk = useStore.getState().diagram.signals[0] as { id: string };
    const stepsBefore = useStore.getState().diagram.config.totalSteps;
    const waveBefore = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    useStore.getState().eraseSignalStateRange(clk.id, 5, 5);
    const after = useStore.getState().diagram;
    const waveAfter = (toWavedromJSON(after).signal[0] as { wave: string }).wave;
    expect(after.config.totalSteps).toBe(stepsBefore);
    expect(waveAfter).toBe('P....0P...');
    expect(waveAfter).toHaveLength(waveBefore.length);
  });

  it('erase on data lane does not shorten clk wave', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const clkWaveBefore = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    const stepsBefore = useStore.getState().diagram.config.totalSteps;
    const enable = useStore.getState().diagram.signals[2] as { id: string };
    useStore.getState().eraseSignalStateRange(enable.id, 3, 3);
    const after = useStore.getState().diagram;
    const clkWaveAfter = (toWavedromJSON(after).signal[0] as { wave: string }).wave;
    expect(after.config.totalSteps).toBe(stepsBefore);
    expect(clkWaveAfter).toBe(clkWaveBefore);
  });

  it('erase gap on one lane clears flag without removing timeline columns', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const reset = useStore.getState().diagram.signals[1] as { id: string };
    const clkWaveBefore = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    const stepsBefore = useStore.getState().diagram.config.totalSteps;
    useStore.getState().paintGapRange(reset.id, 2, 2, 'replace');
    useStore.getState().eraseSignalStateRange(reset.id, 2, 2);
    const after = useStore.getState().diagram;
    const resetSig = after.signals[1] as { stepGaps?: boolean[] };
    const clkWaveAfter = (toWavedromJSON(after).signal[0] as { wave: string }).wave;
    expect(after.config.totalSteps).toBe(stepsBefore);
    expect(resetSig.stepGaps).toBeUndefined();
    expect(clkWaveAfter).toBe(clkWaveBefore);
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

  it('promotes an edge shorthand to an inspector-editable Undulate arrow', () => {
    useStore.getState().loadDiagram({
      version: 2,
      compatibility: { extensionsEnabled: true, sourceFormat: 'undulate-json' },
      signals: [],
      config: { totalSteps: DEFAULT_STEPS, hscale: 1 },
      edges: ['request.ready <~> response.done latency'],
      edgeCurveControls: { 0: { c1x: 0.25, c2x: 0.75 } },
      annotations: [],
    });

    const id = useStore.getState().promoteDiagramEdgeToAnnotation(0);
    expect(id).not.toBeNull();
    expect(useStore.getState().diagram.edges).toEqual([]);
    expect(useStore.getState().diagram.edgeCurveControls).toBeUndefined();
    expect(useStore.getState().diagram.annotations).toEqual([
      expect.objectContaining({
        id,
        type: 'arrow',
        shape: '<~>',
        from: { kind: 'node', node: 'request.ready' },
        to: { kind: 'node', node: 'response.done' },
        text: 'latency',
      }),
    ]);
    expect(useStore.getState().view.activeAnnotationId).toBe(id);

    useStore.getState().undo();
    expect(useStore.getState().diagram.edges).toEqual([
      'request.ready <~> response.done latency',
    ]);
    expect(useStore.getState().diagram.annotations).toEqual([]);
  });
});
