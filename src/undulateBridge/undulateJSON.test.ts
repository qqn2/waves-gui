import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import type { UndulateRoot } from './types';
import {
  fromUndulateJSON,
  isUndulateJSON,
  toUndulateJSON,
  validateUndulateFindings,
  validateUndulateJSON,
} from './undulateJSON';

describe('Undulate JSON bridge', () => {
  it('detects timing-only Undulate documents', () => {
    expect(isUndulateJSON({
      signal: [{
        name: 'clk',
        wave: 'p',
        repeat: 2,
        periods: [1, 0.5],
      }],
    })).toBe(true);
  });

  it('rejects timing values that exceed the lossless tick ceiling', () => {
    expect(validateUndulateJSON({
      signal: [{
        name: 'clk',
        wave: 'p',
        period: 1 / 997,
        phase: 1 / 991,
      }],
    })).toContain('more than 1024 ticks per step');
  });

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
          from: 0.5,
          to: '75%',
          stroke: '#123456',
          'stroke-width': 2,
          'stroke-dasharray': [3, 2],
        },
        { shape: '-', y: 0.5, from: '10%', to: 4 },
        {
          shape: '||',
          x: 0.5,
          from: 1,
          to: '100%',
          fill: 'rgba(1, 2, 3, 0.5)',
        },
      ],
    };
    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    expect(diagram.annotations).toEqual([
      expect.objectContaining({
        type: 'vertical-line',
        tick: 1,
        rangeFrom: { unit: 'index', value: 0.5 },
        rangeTo: { unit: 'percent', value: 75 },
      }),
      expect.objectContaining({
        type: 'horizontal-line',
        rangeFrom: { unit: 'percent', value: 10 },
        rangeTo: { unit: 'index', value: 4 },
      }),
      expect.objectContaining({
        type: 'global-compression',
        tick: 0,
        rangeFrom: { unit: 'index', value: 1 },
        rangeTo: { unit: 'percent', value: 100 },
      }),
    ]);
    expect(toUndulateJSON(diagram).annotations).toEqual(root.annotations);
  });

  it('validates structured arrows and non-finite coordinates explicitly', () => {
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: 'box', x: 1 }],
    })).toContain('requires valid from and to anchors');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: '->', from: [0, 0], to: 'node' }],
    })).toBeNull();
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
    })).toBeNull();
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: '|', x: 1, from: '101%' }],
    })).toContain('percentage from 0% to 100%');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ shape: '-', y: 1, to: 'not-a-range' }],
    })).toContain('finite index');
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
          [[0, 1.2], [1, 0.4]],
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

  it('expands repeat into integer-tick periods and preserves duty and slew', () => {
    const root = {
      signal: [{
        name: 'clk',
        wave: 'p',
        repeat: 3,
        periods: [0.5, 1, 1.5],
        duty_cycles: [0.25, 0.5, 0.75],
        phase: -0.25,
        slewing: 0.1,
      }],
    } satisfies UndulateRoot;
    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    const signal = diagram.signals[0];
    expect(diagram.config.ticksPerStep).toBe(8);
    expect(signal).toMatchObject({
      type: 'bit',
      digitalTiming: {
        ticksPerStep: 8,
        phaseTicks: -2,
        cells: [
          { state: 'p', durationTicks: 4, dutyTicks: 1 },
          { state: 'p', durationTicks: 8, dutyTicks: 4 },
          { state: 'p', durationTicks: 12, dutyTicks: 9 },
        ],
        slewing: 0.1,
      },
    });
    expect(toUndulateJSON(diagram).signal[0]).toMatchObject({
      name: 'clk',
      wave: 'p..',
      periods: [0.5, 1, 1.5],
      duty_cycles: [0.25, 0.5, 0.75],
      phase: -0.25,
      slewing: 0.1,
    });
  });

  it('round-trips structured arrow anchors and label offsets', () => {
    const root = {
      signal: [{ name: 'clk', wave: '01', node: 'ab' }],
      annotations: [{
        shape: '<~>',
        from: 'a(2,-1)',
        to: ['75%', '50%'],
        text: 'latency',
        dx: 3,
        dy: -2,
      }],
    } satisfies UndulateRoot;
    expect(validateUndulateJSON(root)).toBeNull();
    expect(toUndulateJSON(fromUndulateJSON(root)).annotations).toEqual(
      root.annotations,
    );
  });

  it('accepts safe analogue expressions and rejects language escapes', () => {
    const safe = {
      signal: [{
        name: 'scalar',
        wave: 's',
        analogue: ['VDDA * 0.5'],
      }],
    } satisfies UndulateRoot;
    expect(validateUndulateJSON(safe)).toBeNull();
    const signal = fromUndulateJSON(safe).signals[0];
    expect(signal?.type === 'analogue' && signal.analogueCells?.[0])
      .toMatchObject({ value: 0.9, expression: 'VDDA * 0.5' });
    expect(toUndulateJSON(fromUndulateJSON(safe)).signal[0])
      .toMatchObject({ analogue: ['VDDA * 0.5'] });
    expect(validateUndulateJSON({
      signal: [{
        name: 'unsafe',
        wave: 's',
        analogue: ['globalThis.process'],
      }],
    })).toContain('unsupported character');
    expect(validateUndulateJSON({
      signal: [{
        name: 'styled',
        wave: 's',
        analogue: [0.5],
        stroke: '#f00',
      }],
    })).toContain('[WIP] signal[0].stroke');
  });

  it('imports Ludwig analogue tutorial JSON including the curve comprehension', () => {
    const expressions = [
      '0.5*VDDA', '0.6*VDDA', '0.7*VDDA', '0.9*VDDA',
      '0.2*VDDA', '0.8*VDDA', '0.3*VDDA',
      '[(t, (VDDA+VSSA)*(1 + sin(2*pi*t*3.5/Tmax))/2) for t in time]',
      '0.25*VDDA', 'VDDA',
    ];
    const root = {
      signal: [{
        name: 'gbf',
        wave: '0ssssccca...msMs',
        analogue: expressions,
      }],
    } satisfies UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    const signal = diagram.signals[0];
    expect(diagram.config.analogueContext).toEqual({ vssa: 0, vdda: 1.8 });
    expect(signal?.type === 'analogue' && signal.analogueCells?.[1]?.value)
      .toBeCloseTo(0.9);
    expect(signal?.type === 'analogue' && signal.analogueCells?.[8]?.samples)
      .toHaveLength(65);
    expect((toUndulateJSON(diagram).signal[0] as { analogue?: unknown[] }).analogue)
      .toEqual(expressions);
  });

  it('accepts fine timing while still reporting WIP and unknown properties', () => {
    const findings = validateUndulateFindings({
      signal: [{
        name: 'clk',
        wave: 'p',
        repeat: 8,
        duty_cycles: Array(8).fill(0.5),
        typo_style: '#f00',
      }],
      edges: ['a->b'],
      future_root: true,
    });

    expect(findings.map((finding) => [finding.kind, finding.path])).toEqual([
      ['unknown', 'signal[0].typo_style'],
      ['wip', 'edges'],
      ['unknown', 'future_root'],
    ]);
  });

  it('classifies the pinned blocked-feature fixture in one pass', () => {
    const root = JSON.parse(readFileSync(
      join(process.cwd(), 'tests/fixtures/undulate/blocked-features.json'),
      'utf8',
    )) as unknown;
    const findings = validateUndulateFindings(root);

    expect(new Set(findings.map((finding) => finding.kind))).toEqual(new Set([
      'wip',
      'unsupported-by-design',
      'unknown',
    ]));
    expect(findings.map((finding) => finding.path)).toEqual(
      expect.arrayContaining([
        'edges',
        'reg',
        'future_root',
        'signal[0].stroke',
        'signal[0].future_lane',
        'config.vscale',
        'config.future_config',
        'annotations[0].font-size',
        'annotations[0].future_annotation',
      ]),
    );
  });

  it('rejects normalization and truncation losses before import', () => {
    expect(validateUndulateJSON({
      signal: [{
        name: 'curve',
        wave: 'a',
        analogue: [[[0, 0], [2, 1]]],
      }],
    })).toContain('implicit time normalization is not lossless');
    expect(validateUndulateJSON({
      signal: [{
        name: 'curve',
        wave: 's',
        analogue: [1_000_000_001],
      }],
    })).toContain('within ±1000000000');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{
        text: 'x'.repeat(2001),
        x: 0,
        y: 0,
      }],
    })).toContain('maximum is 2000');
  });
});
