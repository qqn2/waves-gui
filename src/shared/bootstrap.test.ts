import { describe, expect, it } from 'vitest';
import { toWavedromJSON } from '../wavedromBridge';
import { normalizeDiagram } from './normalizeDiagram';
import { isWaveModeLane } from '../wavedromBridge/laneWaveOps';
import { useStore } from './store';
import type { Signal } from './types';

describe('bootstrap normalizeDiagram', () => {
  it('preserves wave-mode clk and export works', () => {
    useStore.setState((s) => {
      s.diagram = normalizeDiagram(s.diagram);
    });
    const clk = useStore.getState().diagram.signals[0] as Signal;
    expect(isWaveModeLane(clk)).toBe(true);
    expect(clk.wave).toBeDefined();
    expect(() => toWavedromJSON(useStore.getState().diagram)).not.toThrow();
    const wave = (toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string })
      .wave;
    expect(wave).toMatch(/^P/);
  });
});
