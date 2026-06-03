import { describe, it, expect } from 'vitest';
import { createDefaultDiagram } from './defaultDiagram';
import { CLOCK_RESET_SAMPLE } from './clockResetSample';

describe('createDefaultDiagram', () => {
  it('loads the Clock and reset starter diagram', () => {
    const diagram = createDefaultDiagram();
    expect(diagram.config.head?.text).toBe(CLOCK_RESET_SAMPLE.head?.text);
    expect(diagram.signals.map((s) => s.name)).toEqual(['clk', 'reset_n', 'enable']);
    expect(diagram.config.hscale).toBe(1);
    expect(diagram.config.totalSteps).toBeGreaterThanOrEqual(9);
  });
});
