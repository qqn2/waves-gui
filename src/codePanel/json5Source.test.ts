import { describe, expect, it } from 'vitest';
import {
  parseJSON5Source,
  updateJSON5Source,
} from './json5Source';

describe('JSON5 source preservation', () => {
  it('preserves comments and local quote style while changing values', () => {
    const source = `{
  // clock signal
  signal: [{ name: 'clk', wave: '01' }],
}`;
    const value = parseJSON5Source(source) as {
      signal: Array<{ name: string; wave: string }>;
    };
    value.signal[0]!.name = 'system clock';

    const updated = updateJSON5Source(source, value);

    expect(updated).toContain('// clock signal');
    expect(updated).toContain("name: 'system clock'");
    expect(updated).toContain("wave: '01'");
  });

  it('relocates comments orphaned by deleted array entries', () => {
    const source = `{ signal: [
  // clock signal
  { name: 'clk', wave: '01' },
  // bus data
  { name: 'bus', wave: 'x=' },
  // request signal
  { name: 'request', wave: '0.1' },
] }`;
    const value = parseJSON5Source(source) as {
      signal: Array<{ name: string; wave: string }>;
    };
    value.signal.splice(1, 1);

    const updated = updateJSON5Source(source, value);

    expect(updated.match(/\/\/ clock signal/g)).toHaveLength(1);
    expect(updated.match(/\/\/ bus data/g)).toHaveLength(1);
    expect(updated.match(/\/\/ request signal/g)).toHaveLength(1);
    expect(parseJSON5Source(updated)).toEqual(value);
  });

  it('relocates comments orphaned by deleted properties', () => {
    const source =
      `{ signal: [{ name: 'clk', wave: '01', `
      + `/* custom color */ color: 'red' }] }`;
    const value = parseJSON5Source(source) as {
      signal: Array<{ name: string; wave: string; color?: string }>;
    };
    delete value.signal[0]!.color;

    const updated = updateJSON5Source(source, value);

    expect(updated.match(/\/\* custom color \*\//g)).toHaveLength(1);
    expect(parseJSON5Source(updated)).toEqual(value);
  });

  it('rejects reserved prototype keys', () => {
    expect(() => parseJSON5Source('{ __proto__: { polluted: true } }')).toThrow(
      /reserved key/i,
    );
  });
});
