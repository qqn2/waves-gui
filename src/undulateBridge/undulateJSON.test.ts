import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import type { UndulateRoot } from './types';
import {
  fromUndulateJSON,
  toUndulateJSON,
  validateUndulateJSON,
} from './undulateJSON';

describe('Undulate JSON bridge', () => {
  it('exports and reimports text annotations semantically', () => {
    const diagram = createDefaultDiagram();
    const signal = diagram.signals.find((item) => item.type === 'bit')!;
    diagram.compatibility = { extensionsEnabled: true };
    diagram.annotations = [
      {
        id: 'note-1',
        type: 'text',
        text: 'Setup',
        tick: 3,
        signalId: signal.id,
        yOffset: -4,
      },
    ];

    const exported = toUndulateJSON(diagram);
    expect(exported.annotations).toEqual([
      { text: 'Setup', x: 3.5, y: 0.4 },
    ]);

    const reimported = fromUndulateJSON(exported);
    expect(reimported.compatibility).toMatchObject({
      extensionsEnabled: true,
      sourceFormat: 'undulate-json',
    });
    expect(reimported.annotations?.[0]).toMatchObject({
      type: 'text',
      text: 'Setup',
      tick: 3,
      yOffset: -4,
    });
  });

  it('imports a free text annotation using upstream x/y fields', () => {
    const root: UndulateRoot = {
      signal: [{ name: 'a', wave: '01' }],
      annotations: [{ text: 'note', x: 1.5, y: 3.25 }],
    };
    const diagram = fromUndulateJSON(root);
    expect(diagram.annotations?.[0]).toMatchObject({
      text: 'note',
      tick: 1,
      yOffset: 130,
    });
  });

  it('rejects unsupported shapes and non-finite coordinates explicitly', () => {
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: '|', x: 1 }],
    })).toContain('Unsupported Undulate annotation shape');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'bad', x: Number.NaN, y: 1 }],
    })).toContain('finite x and y');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'styled', x: 1, y: 1, fill: '#fff' }],
    })).toContain('Unsupported Undulate text annotation field: fill');
  });

  it('imports and exports finite analogue step, capacitive, and sample cells', () => {
    const root = {
      signal: [{
        name: 'vin',
        wave: '0sca',
        analogue: [
          0.6,
          1.2,
          [[0, 1.2], [2, 0.4]],
        ],
        slewing: 32,
        vscale: 2,
      }],
    } satisfies UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    const signal = diagram.signals[0];
    expect(signal).toMatchObject({
      type: 'analogue',
      name: 'vin',
      slewing: 32,
      vscale: 2,
      rowHeight: 80,
    });
    if (!signal || signal.type !== 'analogue') return;
    expect(signal.analogueCells).toEqual([
      expect.objectContaining({ kind: 'hold', value: 0 }),
      expect.objectContaining({ kind: 'step', value: 0.6 }),
      expect.objectContaining({ kind: 'capacitive', value: 1.2 }),
      expect.objectContaining({
        kind: 'samples',
        value: 0.4,
        samples: [
          { offset: 0, value: 1.2 },
          { offset: 1, value: 0.4 },
        ],
      }),
    ]);

    expect(toUndulateJSON(diagram).signal[0]).toMatchObject({
      name: 'vin',
      wave: '0sca',
      analogue: [
        0.6,
        1.2,
        [[0, 1.2], [1, 0.4]],
      ],
      slewing: 32,
      vscale: 2,
    });
  });

  it('rejects executable analogue expressions instead of evaluating them', () => {
    expect(validateUndulateJSON({
      signal: [{
        name: 'unsafe',
        wave: 's',
        analogue: ['VDDA * 0.5'],
      }],
    })).toContain('expressions are not executed');
    expect(validateUndulateJSON({
      signal: [{
        name: 'styled',
        wave: 's',
        analogue: [0.5],
        stroke: '#f00',
      }],
    })).toContain('Unsupported Undulate analogue field: stroke');
  });
});
