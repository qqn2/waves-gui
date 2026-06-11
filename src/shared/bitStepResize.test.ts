import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from '../wavedromBridge';
import type { WdRoot } from '../wavedromBridge/wdTypes';
import { createDefaultDiagram } from './defaultDiagram';
import { useStore } from './store';

function expectClockDotsOnly(wave: string): void {
  expect(wave.length).toBeGreaterThan(0);
  expect(wave).toMatch(/^[pPnN]/);
  expect(wave.slice(1)).not.toMatch(/[pPnN]/);
  expect(wave.slice(1)).toMatch(/^\.+$/);
}

describe('bitStepResize via diagram step controls', () => {
  it('setTotalSteps extends and shrinks clk with trailing dots only', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const clkWave0 = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    expectClockDotsOnly(clkWave0);

    useStore.getState().setTotalSteps(clkWave0.length + 3);
    const clkWave1 = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    expectClockDotsOnly(clkWave1);
    expect(clkWave1.length).toBe(clkWave0.length + 3);

    useStore.getState().setTotalSteps(clkWave0.length);
    const clkWave2 = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    expect(clkWave2).toBe(clkWave0);
  });

  it('repeated grow/shrink cycles never emit explicit n/p in clk wave', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const base = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    for (let i = 0; i < 5; i++) {
      useStore.getState().setTotalSteps(base.length + 4);
      useStore.getState().setTotalSteps(base.length + 1);
      useStore.getState().setTotalSteps(base.length);
      const wave = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
        .wave;
      expectClockDotsOnly(wave);
    }
  });

  it('+ steps on handshake clk appends dot not n (P....... to P........)', () => {
    const raw = JSON.parse(
      readFileSync(join(process.cwd(), 'public/samples/handshake.json'), 'utf8'),
    ) as WdRoot;
    useStore.getState().loadDiagram(fromWavedromJSON(raw));
    const before = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    expect(before).toBe('P.......');

    useStore.getState().setTotalSteps(useStore.getState().diagram.config.totalSteps + 1);

    const after = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave;
    expect(after).toBe('P........');
    expect(after).not.toMatch(/[pPnN]$/);
  });

  it('clock lane with gap flags still grows via wave dots not hold-fill n', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.setState((s) => {
      const clk = s.diagram.signals[0] as { states: unknown[]; stepGaps?: boolean[] };
      clk.stepGaps = Array(clk.states.length).fill(false);
      clk.stepGaps[clk.stepGaps.length - 1] = true;
    });
    const steps = useStore.getState().diagram.config.totalSteps;
    useStore.getState().setTotalSteps(steps + 1);
    const wave = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave;
    expectClockDotsOnly(wave.replace(/\|/g, ''));
    expect(wave).not.toMatch(/[pPnN]$/);
  });

  it('DiagramSteps + bump repairs broken clk alternation with a dot not n', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    useStore.setState((s) => {
      (s.diagram.signals[0] as { states: string[] }).states = [
        'P',
        'n',
        'P',
        'n',
        'P',
        'n',
        'P',
        'n',
        'n',
        'n',
      ];
    });
    const steps = useStore.getState().diagram.config.totalSteps;
    expect((useStore.getState().diagram.signals[0] as { states: string[] }).states.slice(-2)).toEqual(
      ['n', 'n'],
    );

    useStore.getState().setTotalSteps(steps + 1);

    const wave = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave;
    expectClockDotsOnly(wave);
    expect(wave.length).toBe(steps + 1);
    expect(wave.endsWith('.')).toBe(true);
  });

  it('insertStepAt and deleteStepAt keep clk as P... wave', () => {
    useStore.getState().loadDiagram(createDefaultDiagram());
    const before = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    useStore.getState().insertStepAt(3);
    const mid = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave;
    expectClockDotsOnly(mid);
    expect(mid.length).toBe(before.length + 1);
    useStore.getState().deleteStepAt(3);
    const after = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    expect(after).toBe(before);
  });
});
