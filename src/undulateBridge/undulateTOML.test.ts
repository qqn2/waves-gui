import { describe, expect, it } from 'vitest';
import {
  parseUndulateTOML,
  stringifyUndulateTOML,
  updateUndulateTOMLSource,
} from './undulateTOML';

describe('Undulate TOML adapter', () => {
  it('imports upstream dotted signals, groups, and annotation tables', () => {
    const root = parseUndulateTOML(`
clk.wave = "p..."
"bus group".request.wave = "01"
"bus group".spacer_0 = {}
edges = ["a -> b"]

[[annotations]]
shape = "~>"
from = "(1.5, 2)"
to = "node_b"
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

  it('emits deterministic upstream mapping form and round-trips it', () => {
    const root = {
      signal: [
        { name: 'clk', wave: 'p...' },
        ['CPU', { name: 'request', wave: '01' }, {}],
      ],
      annotations: [{ text: 'Setup', x: 1.5, y: 0.5 }],
    } as const;
    const toml = stringifyUndulateTOML(root as never);

    expect(toml).toContain('[clk]');
    expect(toml).toContain('[CPU.request]');
    expect(toml).toContain('[[annotations]]');
    expect(parseUndulateTOML(toml)).toEqual(root);
  });

  it.each([
    ['duplicate keys', 'clk.wave = "0"\nclk.wave = "1"'],
    ['date values', 'clk.wave = 1979-05-27'],
    ['non-finite numbers', 'clk.period = nan'],
    ['unsafe keys', '"__proto__".wave = "0"'],
    ['oversized integers', 'clk.period = 9007199254740992'],
  ])('rejects %s', (_name, source) => {
    expect(() => parseUndulateTOML(source)).toThrow(/Invalid Undulate TOML/);
  });

  it('does not pollute Object.prototype while rejecting unsafe keys', () => {
    expect(() =>
      parseUndulateTOML('"__proto__".polluted = true')
    ).toThrow(/unsafe mapping key/);
    expect((Object.prototype as { polluted?: boolean }).polluted).toBeUndefined();
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
    const toml = stringifyUndulateTOML(root);

    expect(toml).toContain('[sig]');
    expect(toml).toContain('[signal_0]');
    expect(toml).toContain('name = "sig"');
    expect(parseUndulateTOML(toml)).toEqual(root);
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
    const toml = stringifyUndulateTOML(root as never);

    expect(toml).toContain('[group_0]');
    expect(toml).toContain('[group_0.signal.nested]');
    expect(parseUndulateTOML(toml)).toEqual(root);
  });

  it('preserves comments, table layout, and quote style for scalar edits', () => {
    const source = `# timing diagram
[clk]
wave = 'p...' # keep the clock note
period = 2
`;
    const root = parseUndulateTOML(source);
    const clock = root.signal[0];
    if (!clock || Array.isArray(clock)) throw new Error('expected clock signal');
    clock.wave = 'n...';

    const updated = updateUndulateTOMLSource(source, root);

    expect(updated).toContain('# timing diagram');
    expect(updated).toContain("wave = 'n...' # keep the clock note");
    expect(updated).toContain('[clk]');
    expect(parseUndulateTOML(updated)).toEqual(root);
  });

  it('relocates comments when a structural edit requires canonical TOML', () => {
    const source = `# timing diagram
[clk]
wave = "0" # lane comment
`;
    const root = parseUndulateTOML(source);
    const clock = root.signal[0];
    if (!clock || Array.isArray(clock)) throw new Error('expected clock signal');
    clock.name = 'renamed';

    const updated = updateUndulateTOMLSource(source, root);

    expect(updated).toContain('# timing diagram');
    expect(updated).toContain('# lane comment');
    expect(updated).toContain('[renamed]');
    expect(parseUndulateTOML(updated)).toEqual(root);
  });
});
