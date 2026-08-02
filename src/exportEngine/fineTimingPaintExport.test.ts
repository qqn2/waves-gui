import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { defaultView } from '../shared/store/helpers';
import { fromUndulateJSON } from '../undulateBridge';
import { buildSVGString } from './exportSVG';

describe('fine timing SVG rendering', () => {
  it('renders every split timing cell at its document-tick boundary', () => {
    const diagram = createDefaultDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.config.totalSteps = 1;
    diagram.config.ticksPerStep = 4;
    const bit = diagram.signals.find((signal) => signal.type === 'bit');
    expect(bit?.type).toBe('bit');
    if (!bit || bit.type !== 'bit') return;
    bit.states = ['0', '1', '0'];
    bit.digitalTiming = {
      ticksPerStep: 4,
      phaseTicks: 0,
      cells: [
        { state: '0', durationTicks: 1 },
        { state: '1', durationTicks: 1 },
        { state: '0', durationTicks: 2 },
      ],
      slewing: 0,
    };

    const svg = buildSVGString(diagram, defaultView());

    // CELL_WIDTH is 40: quarter-step transitions must occur at x=10 and x=20.
    expect(svg).toMatch(/L10,[\d.]+ L10,[\d.]+/);
    expect(svg).toMatch(/L20,[\d.]+ L20,[\d.]+/);
    expect(svg).toContain('L40,');
  });

  it('renders imported fine and coarse siblings to the same native duration', () => {
    const diagram = fromUndulateJSON({
      signal: [
        {
          name: 'fine',
          wave: '01010101',
          periods: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        },
        { name: 'coarse', wave: '01.0' },
      ],
    });

    expect(diagram.config.totalSteps).toBe(4);
    const svg = buildSVGString(diagram, defaultView());

    // Both rows terminate at x=160 logical pixels (four major 40px cells).
    expect((svg.match(/L160,[\d.]+/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // Fine-cell transitions still appear at the half-step boundary.
    expect(svg).toContain('L20,');
  });
});
