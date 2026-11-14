import { describe, expect, it } from 'vitest';
import { detectCodeFormat, diagramCodeFormat, diagramToCodeString, parseCodeToDiagram, validateCodeString } from './codeSync';
import { parseJSON5Source } from './json5Source';

const curveSource = `{
  // Keep the original WaveDrom document and its comments.
  signal: [
    { name: 'request', wave: '01......', node: '.a......' },
    { name: 'response', wave: '0....1..', node: '.....b..' },
  ],
  edge: ['a~>b latency'],
  'x-waves-gui': {
    edgeCurveControls: { '0': { c1x: 0.85, c2x: 0.15000000000000002, }, },
  },
}`;

describe('edge curve source format', () => {
  it('keeps the reported curve metadata in WaveDrom through editing and reopening', () => {
    expect(detectCodeFormat(curveSource)).toBe('wavedrom');
    expect(validateCodeString(curveSource)).toBeNull();
    const parsed = parseCodeToDiagram(curveSource);
    expect(parsed.ok).toBe(true);
    if (parsed.ok === false) throw new Error(parsed.error);
    expect(diagramCodeFormat(parsed.diagram)).toBe('wavedrom');
    expect(parsed.diagram.compatibility?.extensionsEnabled).not.toBe(true);
    expect(parsed.diagram.edgeCurveControls?.[0]).toEqual({ c1x: 0.85, c2x: 0.15000000000000002 });

    parsed.diagram.edgeCurveControls![0] = { c1x: 0.7, c2x: 0.2 };
    const changed = diagramToCodeString(parsed.diagram);
    expect(changed).toContain('// Keep the original WaveDrom document and its comments.');
    expect(detectCodeFormat(changed)).toBe('wavedrom');
    expect(parseJSON5Source(changed)).toMatchObject({
      edge: ['a~>b latency'],
      'x-waves-gui': { edgeCurveControls: { 0: { c1x: 0.7, c2x: 0.2 } } },
    });
    const reopened = parseCodeToDiagram(changed);
    expect(reopened.ok && reopened.diagram.compatibility?.sourceFormat).toBe('wavedrom-json');
  });

  it('keeps VCD provenance in WaveDrom too', () => {
    const source = JSON.stringify({ signal: [], 'x-waves-gui': { importMode: 'event-compressed-vcd' } });
    expect(detectCodeFormat(source)).toBe('wavedrom');
    expect(validateCodeString(source)).toBeNull();
    const result = parseCodeToDiagram(source);
    expect(result.ok && result.diagram.compatibility?.importMode).toBe('event-compressed-vcd');
  });

  it.each([
    { analogueContext: { vssa: 0, vdda: 1.8 } },
    { randomSeed: 1 },
  ])('still detects Undulate-specific metadata: %j', (metadata) => {
    const source = JSON.stringify({ signal: [], 'x-waves-gui': metadata });
    expect(detectCodeFormat(source)).toBe('undulate');
    expect(validateCodeString(source)).toBeNull();
  });

  it('preserves an explicitly selected Undulate format with shared curve metadata', () => {
    const result = parseCodeToDiagram(curveSource, { preferUndulate: true });
    expect(result.ok && diagramCodeFormat(result.diagram)).toBe('undulate');
    expect(result.ok && result.diagram.edgeCurveControls?.[0].c1x).toBe(0.85);
  });

  it.each([
    null, [], 'invalid',
    { 0: null }, { 0: [] }, { 0: { c1x: 0.85 } },
    { 0: { c1x: 0.85, c2x: '0.15' } }, { 0: { c1x: -1, c2x: 2 } },
    { '-1': { c1x: 0.85, c2x: 0.15 } },
    { '9007199254740992': { c1x: 0.85, c2x: 0.15 } },
  ])('reports malformed curve metadata as a source error: %j', (controls) => {
    const source = JSON.stringify({ signal: [], 'x-waves-gui': { edgeCurveControls: controls } });
    for (const preferUndulate of [false, true]) {
      expect(validateCodeString(source, { preferUndulate })).toContain('edgeCurveControls');
      expect(parseCodeToDiagram(source, { preferUndulate })).toMatchObject({ ok: false });
    }
  });
});
