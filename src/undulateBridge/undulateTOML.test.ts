import { describe, expect, it } from 'vitest';
import {
  parseUndulateTOML,
  stringifyUndulateTOML,
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

  it('blocks ambiguous mapping exports', () => {
    expect(() => stringifyUndulateTOML({
      signal: [
        { name: 'same', wave: '0' },
        { name: 'same', wave: '1' },
      ],
    })).toThrow(/duplicate/);
    expect(() => stringifyUndulateTOML({
      signal: [{ name: 'edges', wave: '0' }],
    })).toThrow(/reserved/);
  });
});
