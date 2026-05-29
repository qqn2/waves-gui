import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSON5 from 'json5';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from './index';
import type { WdRoot } from './wdTypes';

const step4Path = join(
  process.cwd(),
  'docs/wavedrom-ref/upstream-tests/signal-step4.json5',
);

describe('phase and period bridge', () => {
  it('exports phase and period when present on a signal', () => {
    const wd: WdRoot = {
      signal: [{ name: 'clk', wave: 'p...', phase: 0.25, period: 2 }],
    };
    const diagram = fromWavedromJSON(wd);
    const clk = diagram.signals[0];
    expect(clk.type).toBe('bit');
    if (clk.type === 'bit') {
      expect(clk.phase).toBe(0.25);
      expect(clk.period).toBe(2);
    }

    const back = toWavedromJSON(diagram);
    const entry = back.signal?.[0] as { phase?: number; period?: number };
    expect(entry?.phase).toBe(0.25);
    expect(entry?.period).toBe(2);
  });

  it('imports signal-step4.json5 bus labels into vector segments', () => {
    const wd = JSON5.parse(readFileSync(step4Path, 'utf8')) as WdRoot;
    const diagram = fromWavedromJSON(wd);
    const data = diagram.signals.find(
      (s) => s.type === 'vector' && s.name === 'Data',
    );
    expect(data?.type).toBe('vector');
    if (data?.type !== 'vector') return;

    const labels = new Set(
      data.segments.map((s) => s.value).filter((v) => v !== '0'),
    );
    expect(labels).toEqual(new Set(['head', 'body', 'tail', 'data']));
  });
});
