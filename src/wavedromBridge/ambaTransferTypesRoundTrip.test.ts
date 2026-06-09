import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from './index';
import { fillHexForColorIndex } from './wavedromColors';
import type { Signal, SignalOrGroup } from '../shared/types';

const fixture = join(
  process.cwd(),
  'public',
  'samples',
  'amba-ahb-transfer-types.json',
);

function findVectorSignal(
  signals: SignalOrGroup[],
  name: string,
): Signal | undefined {
  let found: Signal | undefined;
  const walk = (list: typeof signals) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else if (item.name === name && item.type === 'vector') found = item;
    }
  };
  walk(signals);
  return found;
}

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

  it('does not pad short bus waves with duplicate colorless segments', () => {
    const json = JSON.parse(readFileSync(fixture, 'utf8'));
    const diagram = fromWavedromJSON(json);
    const hburst = findVectorSignal(diagram.signals, 'HBURST[2:0]');
    expect(hburst?.type).toBe('vector');
    if (hburst?.type !== 'vector') return;

    expect(hburst.segments).toHaveLength(2);
    const incr = hburst.segments.find((s) => s.value === 'INCR');
    expect(incr?.color).toBe(fillHexForColorIndex(6));
    expect(hburst.segments.some((s) => s.startStep >= 5)).toBe(false);
  });

  it('preserves per-segment bus fill colors through export', () => {
    const json = JSON.parse(readFileSync(fixture, 'utf8'));
    const diagram = fromWavedromJSON(json);
    const htrans = findVectorSignal(diagram.signals, 'HTRANS[1:0]');
    expect(htrans?.type).toBe('vector');
    if (htrans?.type !== 'vector') return;

    const busy = htrans.segments.find((s) => s.value === 'BUSY');
    const seq = htrans.segments.find((s) => s.value === 'SEQ');
    expect(busy?.color).toBe(fillHexForColorIndex(2));
    expect(seq?.color).toBe(fillHexForColorIndex(3));

    const exported = toWavedromJSON(diagram);
    const outHtrans = (exported.signal as object[]).find(
      (e) => !Array.isArray(e) && (e as { name?: string }).name === 'HTRANS[1:0]',
    ) as { wave?: string; data?: string[] };
    expect(outHtrans?.data).toEqual(['NONSEQ', 'BUSY', 'SEQ']);
    expect(outHtrans?.wave).toMatch(/^x\./);
    expect(outHtrans?.wave).toContain('3');
  });
});
