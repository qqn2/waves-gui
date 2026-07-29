import { describe, expect, it } from 'vitest';
import {
  parseUndulateYAML,
  stringifyUndulateYAML,
} from './undulateYAML';

describe('Undulate YAML adapter', () => {
  it('imports upstream mapping-based signals, groups, edges, and tuple anchors', () => {
    const root = parseUndulateYAML(`
clk:
  wave: "p..."
bus group:
  request:
    wave: "01"
  spacer_0: {}
edges:
  - "a -> b"
annotations:
  - shape: "~>"
    from: (1.5, 2)
    to: node_b
`);

    expect(root.signal).toEqual([
      { name: 'clk', wave: 'p...' },
      ['bus group', { name: 'request', wave: '01' }, {}],
    ]);
    expect(root.edges).toEqual(['a -> b']);
    expect(root.annotations?.[0]).toMatchObject({
      from: [1.5, 2],
      to: 'node_b',
    });
  });

  it('accepts JSON-shaped YAML and emits canonical upstream mapping form', () => {
    const root = parseUndulateYAML(`
signal:
  - name: clk
    wave: p...
annotations: []
`);
    const yaml = stringifyUndulateYAML(root);

    expect(yaml).toContain('clk:');
    expect(yaml).toContain('  wave: p...');
    expect(yaml).not.toContain('signal:');
    expect(parseUndulateYAML(yaml)).toEqual(root);
  });

  it('round-trips nested groups and creates deterministic spacer keys', () => {
    const yaml = stringifyUndulateYAML({
      signal: [
        ['CPU', { name: 'clk', wave: 'p.' }, {}],
        { name: '', wave: '' },
      ],
    });

    expect(yaml).toContain('CPU:');
    expect(yaml).toContain('spacer_0: {}');
    expect(parseUndulateYAML(yaml).signal).toEqual([
      ['CPU', { name: 'clk', wave: 'p.' }, {}],
      {},
    ]);
  });

  it.each([
    ['duplicate keys', 'clk: { wave: "0" }\nclk: { wave: "1" }'],
    ['aliases', 'clk: &lane { wave: "0" }\ncopy: *lane'],
    ['explicit tags', 'clk: { wave: !!str "0" }'],
    ['merge keys', 'clk:\n  <<: { wave: "0" }'],
    ['unsafe keys', '__proto__: { wave: "0" }'],
  ])('rejects %s', (_name, source) => {
    expect(() => parseUndulateYAML(source)).toThrow(/Invalid Undulate YAML/);
  });

  it('blocks ambiguous mapping exports', () => {
    expect(() => stringifyUndulateYAML({
      signal: [
        { name: 'same', wave: '0' },
        { name: 'same', wave: '1' },
      ],
    })).toThrow(/duplicate/);
    expect(() => stringifyUndulateYAML({
      signal: [{ name: 'edges', wave: '0' }],
    })).toThrow(/reserved/);
    for (const name of ['__proto__', 'prototype', 'constructor']) {
      expect(() => stringifyUndulateYAML({
        signal: [[name, { name: 'nested', wave: '0' }]],
      })).toThrow(/unsafe/);
    }
  });
});
