import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from './index';
import { segmentsToWaveAndData } from '../shared/vectorSegments';
import type { WdRoot, WdSignal } from './wdTypes';
import type { Signal } from '../shared/types';

const goldenDir = join(process.cwd(), 'public', 'golden');

/** WaveDrom: one data[] entry per bus-start character (= or 2–9 after idle). */
export function countBusDataSlots(wave: string): number {
  let n = 0;
  for (let i = 0; i < wave.length; i++) {
    const ch = wave[i]!;
    if (ch === '=' || (ch >= '2' && ch <= '9')) {
      if (i === 0 || wave[i - 1] === '.') n++;
    }
  }
  return n;
}

function findVectorSignal(
  diagram: ReturnType<typeof fromWavedromJSON>,
  name: string,
): Signal | undefined {
  let found: Signal | undefined;
  const walk = (list: typeof diagram.signals) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else if (item.name === name && item.type === 'vector') found = item;
    }
  };
  walk(diagram.signals);
  return found;
}

function wdVectorEntry(root: WdRoot, name: string): WdSignal | undefined {
  for (const entry of root.signal) {
    if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
      const sig = entry as WdSignal;
      if (sig.name === name && sig.wave && /[=2-9]/.test(sig.wave)) return sig;
    }
  }
  return undefined;
}

describe('bus data[] round-trip', () => {
  it('data-bus.json vector lanes preserve wave/data alignment', () => {
    const raw = readFileSync(join(goldenDir, 'data-bus.json'), 'utf8');
    const wd = JSON.parse(raw) as WdRoot;
    const diagram = fromWavedromJSON(wd);
    const exported = toWavedromJSON(diagram);

    for (const name of ['addr', 'data']) {
      const orig = wdVectorEntry(wd, name);
      const out = wdVectorEntry(exported, name);
      expect(orig?.wave).toBeTruthy();
      expect(out?.wave).toBe(orig?.wave);
      expect(out?.data).toEqual(orig?.data);
      expect(out?.data?.length ?? 0).toBe(countBusDataSlots(out?.wave ?? ''));
    }
  });

  it('segmentsToWaveAndData does not emit data for idle dots', () => {
    const { wave, data } = segmentsToWaveAndData([], 8);
    expect(wave).toBe('........');
    expect(data).toEqual([]);
  });

  it('re-export does not invent spurious zero labels on bus lanes', () => {
    const raw = readFileSync(join(goldenDir, 'data-bus.json'), 'utf8');
    const diagram = fromWavedromJSON(JSON.parse(raw) as WdRoot);
    const addr = findVectorSignal(diagram, 'addr');
    expect(addr?.type).toBe('vector');
    if (addr?.type !== 'vector') return;

    const { data } = segmentsToWaveAndData(addr.segments, diagram.config.totalSteps);
    expect(data).not.toContain('0');
    expect(data.every((d) => d !== '0' || d === '0')).toBe(true);
    expect(data.filter((d) => d === '0')).toHaveLength(0);
  });
});
