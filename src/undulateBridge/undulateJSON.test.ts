import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import type { UndulateRoot } from './types';
import {
  fromUndulateJSON,
  toUndulateJSON,
  validateUndulateJSON,
} from './undulateJSON';

describe('Undulate JSON bridge', () => {
  it('round-trips the pinned styled compression fixture', () => {
    const root = JSON.parse(readFileSync(
      join(process.cwd(), 'tests/fixtures/undulate/annotations-styles.json'),
      'utf8',
    )) as UndulateRoot;
    expect(validateUndulateJSON(root)).toBeNull();
    expect(toUndulateJSON(fromUndulateJSON(root))).toEqual(root);
  });

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
      x: 3.5,
      y: 0.4,
      coordinateMode: 'diagram',
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
      x: 1.5,
      y: 3.25,
      coordinateMode: 'diagram',
    });
  });

  it('preserves fractional annotation coordinates without snapping', () => {
    const root: UndulateRoot = {
      signal: [{ name: 'a', wave: '01' }],
      annotations: [
        { text: 'fractional', x: 1.125, y: 0.375 },
        { shape: '|', x: 0.625 },
        { shape: '-', y: 1.875 },
        { shape: '||', x: 1.75 },
      ],
      config: { hscale: 1 },
    };
    const diagram = fromUndulateJSON(root);
    expect(diagram.annotations).toEqual([
      expect.objectContaining({ type: 'text', x: 1.125, y: 0.375 }),
      expect.objectContaining({ type: 'vertical-line', x: 0.625 }),
      expect.objectContaining({ type: 'horizontal-line', y: 1.875 }),
      expect.objectContaining({ type: 'global-compression', x: 1.75 }),
    ]);
    expect(toUndulateJSON(diagram)).toEqual(root);
  });

  it('imports and exports line, compression, and safe annotation styles', () => {
    const root: UndulateRoot = {
      signal: [{ name: 'a', wave: '01' }],
      annotations: [
        {
          shape: '|',
          x: 1.5,
          stroke: '#123456',
          'stroke-width': 2,
          'stroke-dasharray': [3, 2],
        },
        { shape: '-', y: 0.5 },
        { shape: '||', x: 0.5, fill: 'rgba(1, 2, 3, 0.5)' },
      ],
    };
    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    expect(diagram.annotations).toEqual([
      expect.objectContaining({ type: 'vertical-line', tick: 1 }),
      expect.objectContaining({ type: 'horizontal-line' }),
      expect.objectContaining({ type: 'global-compression', tick: 0 }),
    ]);
    expect(toUndulateJSON(diagram).annotations).toEqual(root.annotations);
  });

  it('rejects unsupported shapes and non-finite coordinates explicitly', () => {
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: 'box', x: 1 }],
    })).toContain('Unsupported Undulate annotation shape');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: '|', x: Number.NaN }],
    })).toContain('finite x');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: '||', x: 10_001 }],
    })).toContain('finite x');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'bad', x: Number.NaN, y: 1 }],
    })).toContain('finite x and y');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'styled', x: 1, y: 1, fill: '#fff' }],
    })).toBeNull();
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'hostile', x: 1, y: 1, fill: 'url(https://x)' }],
    })).toContain('safe hex');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: '||', x: 1, from: 0 }],
    })).toContain('[WIP]');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: '|', x: 1, 'stroke-dasharray': [1, -2] }],
    })).toContain('1 to 16');
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
