import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from './defaultDiagram';
import {
  hasBlockingFindings,
  undulateCompatibilityFindings,
  waveDromCompatibilityFindings,
} from './compatibility';

describe('source compatibility findings', () => {
  it('blocks lossless WaveDrom export when annotations exist', () => {
    const diagram = createDefaultDiagram();
    diagram.annotations = [
      { id: 'note', type: 'text', text: 'note', tick: 0 },
    ];
    const findings = waveDromCompatibilityFindings(diagram);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.level).toBe('unsupported');
    expect(hasBlockingFindings(findings)).toBe(true);
  });

  it('classifies Undulate text anchors as deterministic conversions', () => {
    const diagram = createDefaultDiagram();
    diagram.annotations = [
      { id: 'note', type: 'text', text: 'note', tick: 0 },
    ];
    expect(undulateCompatibilityFindings(diagram)).toEqual([
      expect.objectContaining({
        level: 'converted',
        objectId: 'note',
      }),
    ]);
  });

  it('reports analogue lanes for both export targets', () => {
    const diagram = createDefaultDiagram();
    diagram.signals = [{
      id: 'ana',
      name: 'vin',
      type: 'analogue',
      states: [],
      segments: [],
      color: '#4A9EFF',
      rowHeight: 40,
      analogueCells: [{ id: 'cell', kind: 'step', value: 0.9 }],
    }];

    expect(waveDromCompatibilityFindings(diagram)).toEqual([
      expect.objectContaining({
        level: 'unsupported',
        feature: 'analogue-signals',
      }),
    ]);
    expect(undulateCompatibilityFindings(diagram)).toEqual([
      expect.objectContaining({
        level: 'converted',
        feature: 'analogue-signal',
        objectId: 'ana',
      }),
    ]);
  });

  it('warns when a WaveDrom target receives Undulate-only digital states', () => {
    const diagram = createDefaultDiagram();
    const signal = diagram.signals[0];
    if (!signal || signal.type === 'group') throw new Error('Expected signal');
    signal.states = ['0', '=', 'i', 'm', 'M', 'h', 'H', 'l', 'L'];

    expect(waveDromCompatibilityFindings(diagram)).toEqual([
      expect.objectContaining({
        level: 'unsupported',
        feature: 'extended-digital-signals',
        consequence: 'The WaveDrom Editor may reject these wave strings.',
      }),
    ]);
  });

  it('blocks silent loss of expanded Undulate node identifiers', () => {
    const diagram = createDefaultDiagram();
    const signal = diagram.signals[0];
    if (!signal || signal.type === 'group') throw new Error('Expected signal');
    signal.node = '....';
    signal.nodeNames = { 1: 'request.ready' };

    expect(waveDromCompatibilityFindings(diagram)).toEqual([
      expect.objectContaining({
        level: 'unsupported',
        feature: 'expanded-node-identifiers',
        consequence: 'Long node names will be omitted from the compatible subset.',
      }),
    ]);
  });

  it('reports Undulate-only dependency edge endpoint markers', () => {
    const diagram = createDefaultDiagram();
    diagram.edges = ['a-#b', 'a-*b'];
    expect(waveDromCompatibilityFindings(diagram)).toEqual([
      expect.objectContaining({
        level: 'unsupported',
        feature: 'extended-edge-markers',
        consequence: 'WaveDrom does not support # or * edge endpoint markers.',
      }),
    ]);
  });

  it('reports preserved and orphaned opaque Undulate properties before export', () => {
    const diagram = createDefaultDiagram();
    const signal = diagram.signals[0];
    if (!signal || signal.type === 'group') throw new Error('Expected signal');
    diagram.annotations = [
      { id: 'live-note', type: 'text', text: 'note', tick: 0 },
    ];
    diagram.compatibility = {
      extensionsEnabled: true,
      opaqueUndulate: {
        root: { future_root: true },
        signals: {
          [signal.id]: { future_lane: true },
          removed: { future_lane: true },
        },
        annotations: {
          'live-note': { future_annotation: true },
          'removed-note': { future_annotation: true },
        },
      },
    };
    expect(undulateCompatibilityFindings(diagram)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: 'opaque',
        feature: 'unknown-undulate-properties',
      }),
      expect.objectContaining({
        level: 'unsupported',
        feature: 'orphaned-unknown-undulate-properties',
      }),
    ]));
    expect(waveDromCompatibilityFindings(diagram)).toEqual(expect.arrayContaining([
      expect.objectContaining({
        level: 'unsupported',
        feature: 'opaque-undulate-properties',
      }),
    ]));
  });

  it('reports every modeled extension category for target review', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    const signal = diagram.signals[0];
    if (!signal || signal.type !== 'bit') throw new Error('Expected bit signal');
    signal.digitalTiming = {
      ticksPerStep: 2,
      phaseTicks: 0,
      cells: signal.states.map((state) => ({ state, durationTicks: 2 })),
    };
    signal.style = { stroke: '#336699' };
    signal.nodeNames = { 0: 'clock.start' };
    diagram.edges = ['a-#b'];

    const findings = undulateCompatibilityFindings(diagram);
    expect(findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ feature: 'integer-digital-timing', level: 'exact' }),
      expect.objectContaining({ feature: 'signal-style', level: 'exact' }),
      expect.objectContaining({ feature: 'expanded-node-identifiers', level: 'exact' }),
      expect.objectContaining({ feature: 'extended-edge-markers', level: 'exact' }),
    ]));
  });
});
