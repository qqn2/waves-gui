import { describe, expect, it } from 'vitest';
import {
  parseUndulateYAML,
  stringifyUndulateYAML,
  updateUndulateYAMLSource,
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

  it('aliases ambiguous signal keys while preserving visible names', () => {
    const root = {
      signal: [
        { name: 'sig', wave: '0' },
        { name: 'sig', wave: '1' },
        { name: 'edges', wave: '0' },
        { name: '__proto__', wave: '1' },
      ],
    };
    const yaml = stringifyUndulateYAML(root);

    expect(yaml).toContain('sig:');
    expect(yaml).toContain('signal_0:');
    expect(yaml).toContain('name: sig');
    expect(parseUndulateYAML(yaml)).toEqual(root);
  });

  it('aliases ambiguous group keys while preserving visible names', () => {
    const root = {
      signal: [
        ['same', { name: 'nested', wave: '0' }],
        ['same', { name: 'nested', wave: '1' }],
        ['edges', { name: 'nested', wave: '0' }],
        ['__proto__', { name: 'nested', wave: '1' }],
        ['', { name: 'nested', wave: '0' }],
      ],
    } as const;
    const yaml = stringifyUndulateYAML(root as never);

    expect(yaml).toContain('group_0:');
    expect(yaml).toContain('signal:');
    expect(parseUndulateYAML(yaml)).toEqual(root);
  });

  it('preserves comments, key order, and scalar quote style while updating values', () => {
    const source = `# timing diagram
clk:
  # keep the clock note
  wave: "p..."
  period: 2
annotations: []
`;
    const root = parseUndulateYAML(source);
    const clock = root.signal[0];
    if (!clock || Array.isArray(clock)) throw new Error('expected clock signal');
    clock.wave = 'n...';

    const updated = updateUndulateYAMLSource(source, root);

    expect(updated).toContain('# timing diagram');
    expect(updated).toContain('# keep the clock note');
    expect(updated).toContain('wave: "n..."');
    expect(updated.indexOf('clk:')).toBeLessThan(updated.indexOf('annotations:'));
    expect(parseUndulateYAML(updated)).toEqual(root);
  });
});
