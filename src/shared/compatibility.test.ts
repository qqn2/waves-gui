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
});
