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
    signal.states = ['0', '=', 'i', 'm', 'M'];

    expect(waveDromCompatibilityFindings(diagram)).toEqual([
      expect.objectContaining({
        level: 'unsupported',
        feature: 'extended-digital-signals',
        consequence: 'The WaveDrom Editor may reject these wave strings.',
      }),
    ]);
  });
});
