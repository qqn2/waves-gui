import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import type { DiagramState, Signal } from '../shared/types';
import {
  diagramToCodeString,
  validateCodeString,
  parseCodeToDiagram,
} from './codeSync';
import { flushPendingCodeToDiagram, registerCodeFlush } from './flushRegistry';
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
    annotations: [],
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
  });

  it('parseCodeToDiagram round-trips diagram state', () => {
    const diagram = sampleDiagram();
    const code = diagramToCodeString(diagram);
    const result = parseCodeToDiagram(code);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(toWavedromJSON(result.diagram)).toEqual(toWavedromJSON(diagram));
  });

  it('parseCodeToDiagram returns error without throwing on bad input', () => {
    const result = parseCodeToDiagram('[]');
    expect(result.ok).toBe(false);
    if (result.ok !== false) return;
    expect(result.error.length).toBeGreaterThan(0);
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
});
