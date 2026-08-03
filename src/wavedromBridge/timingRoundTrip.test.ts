import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSON5 from 'json5';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from './index';
import { VECTOR_UNKNOWN_LABEL } from '../shared/vectorSegments';
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
      data.segments
        .map((s) => s.value)
        .filter((v) => v !== '0' && v !== VECTOR_UNKNOWN_LABEL),
    );
    expect(labels).toEqual(new Set(['head', 'body', 'tail', 'data']));
  });

  it('keeps period-bearing source cells when another lane is longer', () => {
    const diagram = fromWavedromJSON({
      signal: [
        { name: 'long', wave: '01010101' },
        { name: 'slow', wave: '01', period: 2 },
      ],
    });
    const slow = diagram.signals[1];
    expect(slow.type).toBe('bit');
    if (slow.type !== 'bit') return;
    expect(slow.states).toHaveLength(2);
    const exported = toWavedromJSON(diagram).signal[1] as { wave: string; period?: number };
    expect(exported.wave).toBe('01');
    expect(exported.period).toBe(2);
  });

  it('persists app-only edge curve controls through both bridges', () => {
    const diagram = fromWavedromJSON({ signal: [{ name: 'a', wave: '0' }] });
    diagram.edges = ['a~>b'];
    diagram.edgeCurveControls = { 0: { c1x: 0.2, c2x: 0.8 } };
    const wavedrom = toWavedromJSON(diagram);
    expect(wavedrom['x-waves-gui']?.edgeCurveControls?.['0']).toEqual({ c1x: 0.2, c2x: 0.8 });
    expect(fromWavedromJSON(wavedrom).edgeCurveControls).toEqual(diagram.edgeCurveControls);
  });

  it('persists event-compressed VCD provenance through WaveDrom JSON', () => {
    const diagram = fromWavedromJSON({ signal: [{ name: 'a', wave: '0' }] });
    diagram.compatibility = {
      ...diagram.compatibility,
      importMode: 'event-compressed-vcd',
    };
    const wavedrom = toWavedromJSON(diagram);
    expect(wavedrom['x-waves-gui']?.importMode).toBe('event-compressed-vcd');
    expect(fromWavedromJSON(wavedrom).compatibility?.importMode)
      .toBe('event-compressed-vcd');
  });
});
