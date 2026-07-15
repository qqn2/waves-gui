import { beforeEach, describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { useStore } from '../shared/store';
import type { Signal } from '../shared/types';
import { toWavedromJSON } from '../wavedromBridge';
import { applyBitPatternToSignal } from './applyPattern';

describe('applyBitPatternToSignal', () => {
  beforeEach(() => {
    useStore.getState().loadDiagram(createDefaultDiagram());
  });

  it('replaces a wave-canonical clock instead of restoring its old wave cache', () => {
    const clk = useStore.getState().diagram.signals[0] as Signal;
    const replacement = new Array(clk.states.length).fill('0') as Signal['states'];
    replacement[0] = '1';

    applyBitPatternToSignal(clk.id, replacement);

    const after = useStore.getState().diagram.signals[0] as Signal;
    expect(after.laneMode).toBeUndefined();
    expect(after.states).toEqual(replacement);
    expect((toWavedromJSON(useStore.getState().diagram).signal[0] as { wave: string }).wave)
      .toBe('10........');
  });
});
