import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from '../wavedromBridge';
import type { WdRoot } from '../wavedromBridge/wdTypes';
import { createDefaultDiagram } from './defaultDiagram';
import { useStore } from './store';
import { fromUndulateJSON, toUndulateJSON } from '../undulateBridge/undulateJSON';
import type { UndulateRoot } from '../undulateBridge/types';

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

  it('resizes native bit timing by major duration and restores it with one undo', () => {
    const diagram = fromUndulateJSON({
      signal: [{ name: 'fine', wave: '01010101', period: 0.5 }],
    } as UndulateRoot);
    expect(diagram.config.totalSteps).toBe(4);
    useStore.getState().loadDiagram(diagram);
    const before = useStore.getState().diagram.signals[0];
    if (!before || before.type !== 'bit' || !before.digitalTiming) throw new Error('expected timed bit');
    const states = before.digitalTiming.cells.map((cell) => cell.state);
    const durations = before.digitalTiming.cells.map((cell) => cell.durationTicks);

    useStore.getState().setTotalSteps(5);
    const grown = useStore.getState().diagram.signals[0];
    if (!grown || grown.type !== 'bit' || !grown.digitalTiming) throw new Error('expected grown timed bit');
    expect(grown.digitalTiming.cells.slice(0, 8).map((cell) => cell.state)).toEqual(states);
    expect(grown.digitalTiming.cells.slice(0, 8).map((cell) => cell.durationTicks)).toEqual(durations);
    expect(grown.digitalTiming.cells.reduce((sum, cell) => sum + cell.durationTicks, 0)).toBe(10);
    expect((toUndulateJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave)
      .toHaveLength(9);

    useStore.getState().undo();
    const restored = useStore.getState().diagram.signals[0];
    if (!restored || restored.type !== 'bit' || !restored.digitalTiming) throw new Error('expected restored timed bit');
    expect(useStore.getState().diagram.config.totalSteps).toBe(4);
    expect(restored.digitalTiming.cells.map((cell) => cell.state)).toEqual(states);
    expect(restored.digitalTiming.cells.map((cell) => cell.durationTicks)).toEqual(durations);
  });

  it('resizes native vector timing by major duration without truncating source cells', () => {
    const diagram = fromUndulateJSON({
      signal: [{
        name: 'bus',
        wave: '=.=.',
        data: ['A', 'B'],
        periods: [1, 2, 1, 2],
        duty_cycles: [0.25, 0.5, 0.75, 0.5],
      }],
    } as UndulateRoot);
    expect(diagram.config.totalSteps).toBe(6);
    useStore.getState().loadDiagram(diagram);
    const before = useStore.getState().diagram.signals[0];
    if (!before || before.type !== 'vector' || !before.vectorTiming) throw new Error('expected timed vector');
    const durations = before.vectorTiming.cells.map((cell) => cell.durationTicks);

    useStore.getState().setTotalSteps(7);
    const grown = useStore.getState().diagram.signals[0];
    if (!grown || grown.type !== 'vector' || !grown.vectorTiming) throw new Error('expected grown timed vector');
    expect(grown.vectorTiming.ticksPerStep).toBe(4);
    expect(grown.vectorTiming.cells.slice(0, 4).map((cell) => cell.durationTicks)).toEqual(durations);
    expect(grown.vectorTiming.cells.reduce((sum, cell) => sum + cell.durationTicks, 0)).toBe(28);

    useStore.getState().undo();
    const restored = useStore.getState().diagram.signals[0];
    if (!restored || restored.type !== 'vector' || !restored.vectorTiming) throw new Error('expected restored timed vector');
    expect(restored.vectorTiming.cells.map((cell) => cell.durationTicks)).toEqual(durations);
  });

  it('inserts and deletes native bit steps at major boundaries', () => {
    const diagram = fromUndulateJSON({
      signal: [{ name: 'fine', wave: '01010101', period: 0.5 }],
    } as UndulateRoot);
    useStore.getState().loadDiagram(diagram);
    useStore.getState().insertStepAt(0);
    let signal = useStore.getState().diagram.signals[0];
    if (!signal || signal.type !== 'bit' || !signal.digitalTiming) throw new Error('expected inserted timed bit');
    expect(signal.digitalTiming.cells.reduce((sum, cell) => sum + cell.durationTicks, 0)).toBe(10);
    expect(signal.digitalTiming.cells[0]?.state).toBe('0');

    useStore.getState().deleteStepAt(0);
    signal = useStore.getState().diagram.signals[0];
    if (!signal || signal.type !== 'bit' || !signal.digitalTiming) throw new Error('expected deleted timed bit');
    expect(signal.digitalTiming.cells.reduce((sum, cell) => sum + cell.durationTicks, 0)).toBe(8);
  });
});
