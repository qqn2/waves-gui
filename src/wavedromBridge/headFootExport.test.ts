import { describe, expect, it } from 'vitest';
import type { DiagramState } from '../shared/types';
import { fromWavedromJSON, toWavedromJSON } from './index';

describe('head/foot export', () => {
  const diagram: DiagramState = {
    version: 1,
    config: {
      totalSteps: 8,
      hscale: 2,
      head: { text: 'Title', tick: 0, every: 2 },
      foot: { text: 'Fig 1', tock: 1 },
    },
    edges: [],
    annotations: [],
    signals: [{ id: '1', name: 'clk', type: 'bit', states: ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'], segments: [], color: '#4A9EFF', rowHeight: 40 }],
  };

  it('exports head and foot at JSON root (WaveDrom canonical)', () => {
    const root = toWavedromJSON(diagram);
    expect(root.head).toEqual({ text: 'Title', tick: 0, every: 2 });
    expect(root.foot).toEqual({ text: 'Fig 1', tock: 1 });
    expect(root.config?.head).toBeUndefined();
    expect(root.config?.foot).toBeUndefined();
    expect(root.config?.hscale).toBe(2);
  });

  it('round-trips root-level head/foot', () => {
    const reimported = fromWavedromJSON(toWavedromJSON(diagram));
    expect(reimported.config.head).toEqual(diagram.config.head);
    expect(reimported.config.foot).toEqual(diagram.config.foot);
  });

  it('imports legacy config.head / config.foot', () => {
    const legacy = fromWavedromJSON({
      signal: [{ name: 'a', wave: '10' }],
      config: { hscale: 1, head: { tick: 5 }, foot: { tock: 9 } },
    });
    expect(legacy.config.head).toEqual({ tick: 5 });
    expect(legacy.config.foot).toEqual({ tock: 9 });
  });
});
