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
  });
});
