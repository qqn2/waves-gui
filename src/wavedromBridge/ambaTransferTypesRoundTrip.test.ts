import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from './index';

const fixture = join(
  process.cwd(),
  'public',
  'samples',
  'amba-ahb-transfer-types.json',
);

describe('AHB transfer types sample (WaveDrom-faithful)', () => {
  it('imports and round-trips wave/data for bus lanes', () => {
    const json = JSON.parse(readFileSync(fixture, 'utf8'));
    const diagram = fromWavedromJSON(json);
    expect(diagram.config.totalSteps).toBeGreaterThanOrEqual(8);

    const exported = toWavedromJSON(diagram);
    const htrans = (exported.signal as object[]).find(
      (e) => !Array.isArray(e) && (e as { name?: string }).name === 'HTRANS[1:0]',
    ) as { wave?: string; data?: string[] };
    expect(htrans?.data).toContain('NONSEQ');
    expect(htrans?.data).toContain('BUSY');
    expect(htrans?.wave).toMatch(/[x.=2-9]/);
  });
});
