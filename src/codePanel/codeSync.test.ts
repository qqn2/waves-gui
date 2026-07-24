import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import type { DiagramState, Signal } from '../shared/types';
import {
  detectCodeFormat,
  diagramCodeFormat,
  diagramToCodeString,
  validateCodeString,
  parseCodeToDiagram,
} from './codeSync';
import { flushPendingCodeToDiagram, registerCodeFlush, cancelPendingCodeToDiagramDebounce, registerCodeDebounceCancel } from './flushRegistry';
import { toWavedromJSON } from '../wavedromBridge';

function sampleDiagram(): DiagramState {
  const signal: Signal = {
    id: nanoid(),
    name: 'clk',
    type: 'bit',
    states: ['1', '0', '1', '0'],
    segments: [],
    color: '#4A9EFF',
    rowHeight: 40,
  };
  return {
    version: 1,
    signals: [signal],
    config: { totalSteps: 4, hscale: 1 },
    edges: [],
  };
}

describe('codeSync', () => {
  it('diagramToCodeString produces parseable WaveDrom JSON', () => {
    const diagram = sampleDiagram();
    const code = diagramToCodeString(diagram);
    expect(validateCodeString(code)).toBeNull();
    const parsed = JSON.parse(code) as { signal: unknown[] };
    expect(Array.isArray(parsed.signal)).toBe(true);
  });

  it('validateCodeString rejects invalid JSON and schema errors', () => {
    expect(validateCodeString('{not json')).toMatch(/Invalid JSON/);
    expect(validateCodeString('{"foo":1}')).toMatch(/signal/);
    expect(validateCodeString('{"annotations":[]}')).toMatch(/signal/);
  });

  it('parseCodeToDiagram round-trips diagram state', () => {
    const diagram = sampleDiagram();
    const code = diagramToCodeString(diagram);
    const result = parseCodeToDiagram(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toWavedromJSON(result.diagram)).toEqual(toWavedromJSON(diagram));
  });

  it('accepts WaveDrom JSON5 and retains comments through GUI edits', () => {
    const source = `{ signal : [
    // clock signal
    { name: "clk",  wave: "p......" },
    // bus data
    { name: "bus",  wave: "x.34.5x", data: "head body tail" },
    // request signal
    { name: "wire", wave: "0.1..0." },
] }`;

    expect(validateCodeString(source)).toBeNull();
    expect(detectCodeFormat(source)).toBe('wavedrom');
    const result = parseCodeToDiagram(source);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.compatibility?.sourceText).toBe(source);

    const clock = result.diagram.signals[0];
    expect(clock?.type).toBe('bit');
    if (!clock || clock.type === 'group') return;
    clock.name = 'system clock';

    const updated = diagramToCodeString(result.diagram);
    expect(updated).toContain('// clock signal');
    expect(updated).toContain('// bus data');
    expect(updated).toContain('// request signal');
    expect(updated).toContain('signal : [');
    expect(updated).toContain('name: "system clock"');
    expect(validateCodeString(updated)).toBeNull();
  });

  it('parseCodeToDiagram returns error without throwing on bad input', () => {
    const result = parseCodeToDiagram('[]');
    expect(result.ok).toBe(false);
    if (result.ok !== false) return;
    expect(result.error.length).toBeGreaterThan(0);
  });

  it('shows and round-trips Undulate annotations in the JSON editor', () => {
    const diagram = sampleDiagram();
    diagram.compatibility = { extensionsEnabled: true };
    diagram.annotations = [
      {
        id: 'note',
        type: 'text',
        text: 'Setup window',
        tick: 1,
        signalId: diagram.signals[0]!.id,
      },
      { id: 'deadline', type: 'vertical-line', tick: 2 },
    ];

    const code = diagramToCodeString(diagram);
    expect(diagramCodeFormat(diagram)).toBe('undulate');
    expect(detectCodeFormat(code)).toBe('undulate');
    expect(validateCodeString(code)).toBeNull();
    expect(JSON.parse(code)).toMatchObject({
      annotations: [
        { text: 'Setup window', x: 1.5 },
        { shape: '|', x: 2.5 },
      ],
    });

    const result = parseCodeToDiagram(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.annotations).toEqual([
      expect.objectContaining({ type: 'text', text: 'Setup window', tick: 1 }),
      expect.objectContaining({ type: 'vertical-line', tick: 2 }),
    ]);
  });

  it('shows and applies Undulate analogue cells from JSON', () => {
    const code = JSON.stringify({
      signal: [
        {
          name: 'supply',
          wave: 'sc.',
          analogue: [0.6, 1.2],
          slewing: 4,
        },
      ],
    });

    expect(detectCodeFormat(code)).toBe('undulate');
    expect(validateCodeString(code)).toBeNull();
    const result = parseCodeToDiagram(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.signals[0]).toMatchObject({
      name: 'supply',
      type: 'analogue',
      slewing: 4,
      analogueCells: [
        expect.objectContaining({ kind: 'step', value: 0.6 }),
        expect.objectContaining({ kind: 'capacitive', value: 1.2 }),
        expect.objectContaining({ kind: 'hold', value: 1.2 }),
      ],
    });
  });

  it('keeps Undulate mode while editing a shared-subset document', () => {
    const code = JSON.stringify({
      signal: [{ name: 'clk', wave: '01' }],
    });
    expect(detectCodeFormat(code, { preferUndulate: true })).toBe('undulate');
    const result = parseCodeToDiagram(code, { preferUndulate: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.compatibility?.extensionsEnabled).toBe(true);
    expect(result.diagram.compatibility?.sourceFormat).toBe('undulate-json');
  });

  it('routes known WIP and unknown fields through loss-safe validation', () => {
    const code = JSON.stringify({
      signal: [{
        name: 'clk',
        wave: 'p',
        repeat: 8,
        unknown_lane_field: true,
      }],
      edges: ['a->b'],
    });
    expect(detectCodeFormat(code)).toBe('undulate');
    const error = validateCodeString(code);
    expect(error).toContain('[WIP] edges');
    expect(error).toContain('[WIP] signal[0].repeat');
    expect(error).toContain('Unknown Undulate property signal[0].unknown_lane_field');
    expect(parseCodeToDiagram(code)).toEqual({
      ok: false,
      error,
    });
    const configOnly = JSON.stringify({
      signal: [{ name: 'clk', wave: 'p' }],
      config: { hscale: 1, vscale: 2 },
    });
    expect(detectCodeFormat(configOnly)).toBe('undulate');
    expect(validateCodeString(configOnly)).toContain('[WIP] config.vscale');
  });
});

describe('flushRegistry', () => {
  it('flushPendingCodeToDiagram is no-op when nothing registered', () => {
    expect(() => flushPendingCodeToDiagram()).not.toThrow();
  });

  it('flushPendingCodeToDiagram calls registered flush handler', () => {
    let flushed = false;
    const unregister = registerCodeFlush(() => {
      flushed = true;
    });
    flushPendingCodeToDiagram();
    expect(flushed).toBe(true);
    unregister();
    flushed = false;
    flushPendingCodeToDiagram();
    expect(flushed).toBe(false);
  });

  it('cancelPendingCodeToDiagramDebounce is no-op when nothing registered', () => {
    expect(() => cancelPendingCodeToDiagramDebounce()).not.toThrow();
  });

  it('cancelPendingCodeToDiagramDebounce calls registered cancel handler', () => {
    let cancelled = false;
    const unregister = registerCodeDebounceCancel(() => {
      cancelled = true;
    });
    cancelPendingCodeToDiagramDebounce();
    expect(cancelled).toBe(true);
    unregister();
    cancelled = false;
    cancelPendingCodeToDiagramDebounce();
    expect(cancelled).toBe(false);
  });
});
