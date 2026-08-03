import { describe, it, expect } from 'vitest';
import { nanoid } from 'nanoid';
import type { DiagramState, Signal } from '../shared/types';
import {
  detectCodeFormat,
  diagramCodeFormat,
  diagramToCodeString,
  diagramWithUndulateCodeFormat,
  validateCodeString,
  parseCodeToDiagram,
} from './codeSync';
import { flushPendingCodeToDiagram, registerCodeFlush, cancelPendingCodeToDiagramDebounce, registerCodeDebounceCancel } from './flushRegistry';
import { runAfterSourceFlush } from './sourceMutationGuard';
import { toWavedromJSON } from '../wavedromBridge';
import { useStore } from '../shared/store';

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

  it('edits an opened Undulate YAML document as YAML', () => {
    const result = parseCodeToDiagram(`
clk:
  wave: p...
annotations:
  - text: Setup
    x: 1.5
    y: 0.5
`, { preferUndulate: true, preferYAML: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.diagram.compatibility?.sourceFormat).toBe('undulate-yaml');
    const code = diagramToCodeString(result.diagram);
    expect(code).toContain('clk:');
    expect(code).toContain('annotations:');
    expect(code).not.toContain('"signal"');
    expect(validateCodeString(code, {
      preferUndulate: true,
      preferYAML: true,
    })).toBeNull();
  });

  it('switches Undulate editor syntax without mutating diagram content', () => {
    const diagram = sampleDiagram();
    diagram.compatibility = {
      extensionsEnabled: true,
      sourceFormat: 'undulate-json',
      sourceText: '{"signal":[]}',
    };

    const yaml = diagramWithUndulateCodeFormat(diagram, 'undulate-yaml');
    expect(yaml).not.toBe(diagram);
    expect(yaml.signals).toBe(diagram.signals);
    expect(yaml.compatibility).toMatchObject({
      extensionsEnabled: true,
      sourceFormat: 'undulate-yaml',
    });
    expect(yaml.compatibility?.sourceText).toBeUndefined();
    expect(diagram.compatibility.sourceFormat).toBe('undulate-json');
  });

  it('switches duplicate sig names from JSON to YAML to TOML safely', () => {
    const diagram = sampleDiagram();
    const first = diagram.signals[0];
    expect(first?.type).toBe('bit');
    if (!first || first.type !== 'bit') return;
    first.name = 'sig';
    diagram.signals.push({
      ...first,
      id: nanoid(),
      name: 'sig',
      states: [...first.states],
      segments: [],
    });
    diagram.compatibility = {
      extensionsEnabled: true,
      sourceFormat: 'undulate-json',
    };

    const yamlDiagram =
      diagramWithUndulateCodeFormat(diagram, 'undulate-yaml');
    const yamlCode = diagramToCodeString(yamlDiagram);
    expect(validateCodeString(yamlCode, {
      preferUndulate: true,
      preferYAML: true,
    })).toBeNull();
    const parsedYaml = parseCodeToDiagram(yamlCode, {
      preferUndulate: true,
      preferYAML: true,
    });
    expect(parsedYaml.ok).toBe(true);
    if (!parsedYaml.ok) return;
    expect(parsedYaml.diagram.signals.map((signal) => signal.name))
      .toEqual(['sig', 'sig']);

    const tomlDiagram =
      diagramWithUndulateCodeFormat(parsedYaml.diagram, 'undulate-toml');
    const tomlCode = diagramToCodeString(tomlDiagram);
    expect(validateCodeString(tomlCode, {
      preferUndulate: true,
      preferTOML: true,
    })).toBeNull();
    const parsedToml = parseCodeToDiagram(tomlCode, {
      preferUndulate: true,
      preferTOML: true,
    });
    expect(parsedToml.ok).toBe(true);
    if (!parsedToml.ok) return;
    expect(parsedToml.diagram.signals.map((signal) => signal.name))
      .toEqual(['sig', 'sig']);
  });

  it('edits an opened Undulate TOML document as TOML', () => {
    const result = parseCodeToDiagram(`
clk.wave = "p..."

[[annotations]]
text = "Setup"
x = 1.5
y = 0.5
`, { preferUndulate: true, preferTOML: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.diagram.compatibility?.sourceFormat).toBe('undulate-toml');
    const code = diagramToCodeString(result.diagram);
    expect(code).toContain('[clk]');
    expect(code).toContain('[[annotations]]');
    expect(code).not.toContain('"signal"');
    expect(validateCodeString(code, {
      preferUndulate: true,
      preferTOML: true,
    })).toBeNull();

    const yaml = diagramWithUndulateCodeFormat(result.diagram, 'undulate-yaml');
    const toml = diagramWithUndulateCodeFormat(yaml, 'undulate-toml');
    expect(toml.compatibility?.sourceFormat).toBe('undulate-toml');
    expect(toml.signals).toEqual(result.diagram.signals);
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

  it('accepts extended digital states only in Undulate mode', () => {
    const code = JSON.stringify({
      signal: [{
        name: 'digital',
        wave: '01.zx=ud.2.3.45XziIzmzM',
      }],
    });

    expect(validateCodeString(code)).toMatch(/Invalid wave characters/);
    expect(parseCodeToDiagram(code)).toEqual({
      ok: false,
      error: expect.stringMatching(/Invalid wave characters/),
    });
    expect(validateCodeString(code, { preferUndulate: true })).toBeNull();
    const result = parseCodeToDiagram(code, { preferUndulate: true });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.diagram.compatibility?.extensionsEnabled).toBe(true);
  });

  it('accepts plural edges while preserving safe unknown fields opaquely', () => {
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
    expect(validateCodeString(code)).toBeNull();
    const parsed = parseCodeToDiagram(code);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const signal = parsed.diagram.signals[0];
    expect(signal?.type).not.toBe('group');
    if (!signal || signal.type === 'group') return;
    expect(parsed.diagram.compatibility?.opaqueUndulate?.signals?.[signal.id])
      .toEqual({ unknown_lane_field: true });
    const configOnly = JSON.stringify({
      signal: [{ name: 'clk', wave: 'p' }],
      config: { hscale: 1, vscale: 2 },
    });
    expect(detectCodeFormat(configOnly)).toBe('undulate');
    expect(validateCodeString(configOnly)).toBeNull();
    const configParsed = parseCodeToDiagram(configOnly);
    expect(configParsed.ok).toBe(true);
    if (!configParsed.ok) return;
    expect(configParsed.diagram.compatibility?.opaqueUndulate?.config)
      .toEqual({ vscale: 2 });
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

  it('runAfterSourceFlush blocks mutations when Source parsing fails', () => {
    let mutated = false;
    const unregister = registerCodeFlush(() => ({
      ok: false as const,
      error: 'invalid source',
    }));
    expect(runAfterSourceFlush(() => { mutated = true; })).toBe(false);
    expect(mutated).toBe(false);
    unregister();
  });

  it('cancels a mutation when flushing replaces the diagram revision', () => {
    let mutated = false;
    const unregister = registerCodeFlush(() => {
      useStore.setState((state) => {
        state.view.diagramRevision += 1;
      });
      return { ok: true as const };
    });
    expect(runAfterSourceFlush(() => { mutated = true; })).toBe(false);
    expect(mutated).toBe(false);
    unregister();
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
