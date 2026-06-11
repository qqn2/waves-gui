import { describe, expect, it } from 'vitest';
import type { Signal } from '../shared/types';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { fromWavedromJSON, toWavedromJSON } from './index';
import type { WdRoot } from './wdTypes';
import {
  getBitLaneWave,
  isRepeatingClockLane,
  isWaveModeLane,
  mutateBitWave,
  resizeWaveByDelta,
} from './laneWaveOps';

describe('laneWaveOps', () => {
  it('imports clk as wave-canonical lane', () => {
    const diagram = createDefaultDiagram();
    const clk = diagram.signals[0] as Signal;
    expect(isWaveModeLane(clk)).toBe(true);
    expect(clk.laneMode).toBe('wave');
    expect(clk.wave).toMatch(/^P\.+$/);
    expect(clk.states).toHaveLength(diagram.config.totalSteps);
    expect(isRepeatingClockLane(clk)).toBe(true);
  });

  it('exports clk from stored wave not re-encoded states', () => {
    const diagram = createDefaultDiagram();
    const clk = diagram.signals[0] as Signal;
    const beforeLen = getBitLaneWave(clk).length;
    const newLen = diagram.config.totalSteps + 1;
    mutateBitWave(clk, (w) => resizeWaveByDelta(w, 1, newLen), newLen);
    const exported = toWavedromJSON({
      ...diagram,
      config: { ...diagram.config, totalSteps: newLen },
    }).signal[0] as { wave: string };
    expect(exported.wave).toBe(getBitLaneWave(clk));
    expect(exported.wave.length).toBe(beforeLen + 1);
    expect(exported.wave).toMatch(/^P\.+$/);
  });

  it('imports level lanes as states mode', () => {
    const diagram = createDefaultDiagram();
    const reset = diagram.signals[1] as Signal;
    expect(isWaveModeLane(reset)).toBe(false);
    expect(reset.laneMode).toBeUndefined();
  });

  it('imports handshake clk as wave mode', () => {
    const wd: WdRoot = {
      signal: [{ name: 'clk', wave: 'P.......' }],
      config: { hscale: 1 },
    };
    const diagram = fromWavedromJSON(wd);
    const clk = diagram.signals[0] as Signal;
    expect(clk.laneMode).toBe('wave');
    expect(clk.wave).toBe('P.......');
  });
});
