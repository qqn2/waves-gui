import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import {
  fromWavedromJSON,
  validateWavedromJSON,
  type WdRoot,
} from '../wavedromBridge';
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

  it('preserves mixed bus/scalar wave data on immediate Undulate export', () => {
    const root: UndulateRoot = {
      signal: [
        { name: 'mixed-bit', wave: '=0', data: ['A'] },
        { name: 'mixed-clock', wave: '=P', data: ['B'] },
      ],
    };
    expect(toUndulateJSON(fromUndulateJSON(root)).signal).toEqual(root.signal);
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
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{
        text: 'styled',
        x: 1,
        y: 1,
        'font-size': '18px',
        text_background: false,
      }],
    })).toBeNull();
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'huge', x: 1, y: 1, 'font-size': '200px' }],
    })).toContain('6px to 96px');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'bad', x: 1, y: 1, text_background: 'no' }],
    })).toContain('must be a boolean');
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
    } as unknown as UndulateRoot;
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
    const compact = toUndulateJSON(diagram).signal[0];
    expect(compact).toMatchObject({
      name: 'clk',
      wave: 'p',
      repeat: 3,
      periods: [0.5, 1, 1.5],
      duty_cycles: [0.25, 0.5, 0.75],
      phase: -0.25,
      slewing: 0.1,
    });
    expect(validateUndulateJSON({ signal: [compact] })).toBeNull();
    if (!signal || signal.type === 'group') throw new Error('expected signal');
    signal.states[1] = '0';
    signal.wave = 'p0p';
    if (signal.digitalTiming) signal.digitalTiming.cells[1]!.state = '0';
    expect(toUndulateJSON(diagram).signal[0]).toMatchObject({
      wave: 'p0p',
    });
    expect(
      (toUndulateJSON(diagram).signal[0] as { repeat?: number }).repeat,
    ).toBeUndefined();
  });

  it('derives the major grid from native lane durations without app metadata', () => {
    const root = {
      signal: [
        {
          name: 'fine',
          wave: '01010101',
          periods: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5],
        },
        {
          name: 'coarse',
          wave: '01.0',
        },
        {
          name: 'timed sibling',
          wave: '10.1',
          periods: [1, 1, 1, 1],
        },
      ],
    } satisfies UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    const [fine, coarse, timedSibling] = diagram.signals;

    expect(fine?.type === 'bit' ? fine.digitalTiming?.cells : []).toHaveLength(8);
    expect(coarse?.type === 'bit' ? coarse.digitalTiming?.cells : []).toHaveLength(4);
    expect(
      timedSibling?.type === 'bit'
        ? timedSibling.digitalTiming?.cells
        : [],
    ).toHaveLength(4);
    expect(diagram.config.totalSteps).toBe(4);

    const saved = toUndulateJSON(diagram);
    expect(saved).not.toHaveProperty('x-waves-gui');
    expect(saved.signal[0]).toMatchObject({
      wave: '01010101',
      period: 0.5,
    });
    expect(saved.signal[1]).toMatchObject({ wave: '01.0' });
    expect(saved.signal[2]).toMatchObject({
      wave: '10.1',
      period: 1,
    });

    const reimported = fromUndulateJSON(saved);
    expect(reimported.config.totalSteps).toBe(4);
    expect(reimported.signals.map((signal) =>
      signal.type === 'bit' ? signal.digitalTiming?.cells.length : 0,
    )).toEqual([8, 4, 4]);
  });

  it('treats an explicit integer period as native timing without metadata', () => {
    const root = {
      signal: [{ name: 'wide', wave: '01', period: 2 }],
    } satisfies UndulateRoot;

    const diagram = fromUndulateJSON(root);
    const signal = diagram.signals[0];
    expect(diagram.config).toMatchObject({ totalSteps: 4, ticksPerStep: 1 });
    expect(signal?.type === 'bit' ? signal.digitalTiming?.cells : []).toEqual([
      { state: '0', durationTicks: 2 },
      { state: '1', durationTicks: 2 },
    ]);

    const saved = toUndulateJSON(diagram);
    expect(saved).not.toHaveProperty('x-waves-gui');
    expect(saved.signal[0]).toMatchObject({ wave: '01', period: 2 });
    expect(fromUndulateJSON(saved).config.totalSteps).toBe(4);
  });

  it('round-trips native per-cell timing on vector lanes', () => {
    const root = {
      signal: [{
        name: 'bus',
        wave: '=.=.',
        data: ['A', 'B'],
        periods: [1, 2, 1, 2],
        duty_cycles: [0.25, 0.5, 0.75, 0.5],
        slewing: 0.25,
      }],
    } satisfies UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    const bus = diagram.signals[0];
    expect(diagram.config).toMatchObject({ totalSteps: 6, ticksPerStep: 4 });
    expect(bus?.type === 'vector' ? bus.vectorTiming?.cells : []).toMatchObject([
      { durationTicks: 4, dutyTicks: 1 },
      { durationTicks: 8, dutyTicks: 4 },
      { durationTicks: 4, dutyTicks: 3 },
      { durationTicks: 8, dutyTicks: 4 },
    ]);

    const saved = toUndulateJSON(diagram);
    expect(saved).not.toHaveProperty('x-waves-gui');
    expect(saved.signal[0]).toMatchObject({
      wave: '=.=.',
      data: ['A', 'B'],
      periods: [1, 2, 1, 2],
      duty_cycles: [0.25, 0.5, 0.75, 0.5],
      slewing: 0.25,
    });
    expect(fromUndulateJSON(saved).config.totalSteps).toBe(6);
  });

  it('enables Undulate mode for a vector-only native timing document', () => {
    const diagram = fromUndulateJSON({
      signal: [{
        name: 'timed bus',
        wave: '=.=.',
        data: ['A', 'B'],
        periods: [0.5, 0.5, 0.5, 0.5],
      }],
    } satisfies UndulateRoot);
    const signal = diagram.signals[0];
    expect(signal?.type === 'vector' ? signal.vectorTiming : undefined).toBeDefined();
    expect(diagram.compatibility?.extensionsEnabled).toBe(true);
  });

  it('expands analogue repeat with the upstream value-cycling semantics', () => {
    const root = {
      signal: [{
        name: 'repeating analogue',
        wave: 'sc.',
        analogue: [0.5, 1.25],
        repeat: 2,
      }],
    } satisfies UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    const signal = diagram.signals[0];
    expect(signal?.type === 'analogue' && signal.analogueCells).toMatchObject([
      { kind: 'step', value: 0.5 },
      { kind: 'capacitive', value: 1.25 },
      { kind: 'hold', value: 1.25 },
      { kind: 'step', value: 0.5 },
      { kind: 'capacitive', value: 1.25 },
      { kind: 'hold', value: 1.25 },
    ]);
    expect(toUndulateJSON(diagram).signal[0]).toMatchObject({
      wave: 'sc.',
      analogue: [0.5, 1.25],
      repeat: 2,
    });
    if (!signal || signal.type !== 'analogue' || !signal.analogueCells) {
      throw new Error('expected analogue signal');
    }
    signal.analogueCells[0]!.value = 0.75;
    expect(toUndulateJSON(diagram).signal[0]).toMatchObject({
      wave: 'sc.sc.',
      analogue: [0.75, 1.25, 0.5, 1.25],
    });
    expect((toUndulateJSON(diagram).signal[0] as { repeat?: number }).repeat)
      .toBeUndefined();
    expect(validateUndulateJSON({
      signal: [{
        name: 'invalid',
        wave: 's',
        analogue: [0.5],
        repeat: 0,
      }],
    })).toContain('analogue repeat');
  });

  it('models consecutive analogue overlays explicitly and enforces four lanes', () => {
    const analogue = (name: string, overlay?: boolean) => ({
      name,
      wave: 's',
      analogue: [0.5],
      ...(overlay !== undefined ? { overlay } : {}),
    });
    const root = {
      signal: [
        analogue('a', true),
        analogue('b', true),
        analogue('c'),
        analogue('separate'),
      ],
    } satisfies UndulateRoot;

    const diagram = fromUndulateJSON(root);
    expect(diagram.analogueOverlayGroups).toHaveLength(1);
    expect(diagram.analogueOverlayGroups?.[0]?.signalIds).toEqual(
      diagram.signals.slice(0, 3).map((signal) => signal.id),
    );
    expect(toUndulateJSON(diagram).signal).toMatchObject([
      { name: 'a', overlay: true },
      { name: 'b', overlay: true },
      { name: 'c' },
      { name: 'separate' },
    ]);

    expect(validateUndulateJSON({
      signal: [
        analogue('one', true),
        analogue('two', true),
        analogue('three', true),
        analogue('four', true),
        analogue('five'),
      ],
    })).toContain('at most four consecutive waves');
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
        stroke: '#336699',
        'stroke-width': 3,
        'stroke-dasharray': [5, 2],
        'font-size': '14px',
        font: 'monospace',
        'font-weight': 700,
      }],
    } satisfies UndulateRoot;
    expect(validateUndulateJSON(root)).toBeNull();
    expect(toUndulateJSON(fromUndulateJSON(root)).annotations).toEqual(
      root.annotations,
    );
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'unsafe font', x: 1, y: 1, font: 'url(remote)' }],
    })).toContain('font must be');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{ text: 'unsafe weight', x: 1, y: 1, 'font-weight': 950 }],
    })).toContain('font-weight must be');
  });

  it('imports plural Undulate edges and exports their canonical field', () => {
    const root = {
      signal: [
        { name: 'source', wave: '01', node: 'a.' },
        { name: 'target', wave: '10', node: '.b' },
      ],
      edges: [
        'a -> b request',
        'a <-> b round trip',
        'a -| b elbow',
        'a |- b return',
        'a -|- b bracket',
      ],
    } satisfies UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    expect(diagram.edges).toEqual([
      'a->b request',
      'a<->b round trip',
      'a-|b elbow',
      'a|-b return',
      'a-|-b bracket',
    ]);
    const exported = toUndulateJSON(diagram);
    expect(exported.edge).toBeUndefined();
    expect(exported.edges).toEqual(diagram.edges);
  });

  it('converts a feature-rich WaveDrom document with every edge path to valid Undulate', () => {
    const edgeVariants = [
      'A-B straight',
      'A~B curved',
      'A-~B curved late',
      'A~-B curved early',
      'A-|B horizontal then vertical',
      'A|-B vertical then horizontal',
      'A-|-B bracket',
      'A->B arrow',
      'A~>B curved arrow',
      'A-~>B curved late arrow',
      'A~->B curved early arrow',
      'A-|>B elbow arrow',
      'A|->B return arrow',
      'A-|->B bracket arrow',
      'A<->B bidirectional',
      'A<~>B curved bidirectional',
      'A<-~>B curved late bidirectional',
      'A<-|>B elbow bidirectional',
      'A<-|->B bracket bidirectional',
      'A+B 5 ms',
      'A/B diagonal',
      'A-#B positioned label',
    ];
    const wavedrom = {
      signal: [
        [
          'clocks',
          {
            name: 'clk',
            wave: 'pP.nN.....',
            node: 'A.........',
            period: 2,
            phase: 0.5,
          },
          {},
        ],
        [
          'data',
          {
            name: 'bus',
            wave: '=23456789.',
            data: ['zero', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
            node: '.....B....',
          },
          [
            'nested',
            {
              name: 'logic',
              wave: '01xXzZuUdD',
            },
          ],
        ],
      ],
      edge: edgeVariants,
      config: {
        hscale: 2,
        skin: 'lowkey',
      },
      head: {
        text: 'Feature-rich WaveDrom conversion',
        tick: 0,
        every: 2,
      },
      foot: {
        text: 'All edge paths',
        tock: 1,
        every: 2,
      },
    } satisfies WdRoot;

    expect(validateWavedromJSON(wavedrom)).toBeNull();
    const exported = toUndulateJSON(fromWavedromJSON(wavedrom));

    expect(exported.edge).toBeUndefined();
    expect(exported.edges).toEqual([
      ...edgeVariants.slice(0, 19),
      'A-B 5 ms',
      'A-B diagonal',
      'A-B positioned label',
    ]);
    expect(exported).toMatchObject({
      config: { hscale: 2, skin: 'lowkey' },
      head: wavedrom.head,
      foot: wavedrom.foot,
    });
    expect(validateUndulateJSON(exported)).toBeNull();
    expect(toUndulateJSON(fromUndulateJSON(exported))).toEqual(exported);
  });

  it('round-trips expanded long node identifiers and their edges', () => {
    const root = {
      signal: [
        {
          name: 'source',
          wave: '01..',
          node: '.#.. request.ready',
        },
        {
          name: 'target',
          wave: '10..',
          node: '..#. response.done',
        },
      ],
      edges: ['request.ready -> response.done accepted'],
    } satisfies UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    expect(isUndulateJSON(root)).toBe(true);
    const diagram = fromUndulateJSON(root);
    expect(diagram.compatibility?.extensionsEnabled).toBe(true);
    expect(diagram.signals[0]).toMatchObject({
      nodeNames: { 1: 'request.ready' },
    });
    expect(diagram.signals[1]).toMatchObject({
      nodeNames: { 2: 'response.done' },
    });
    expect(diagram.edges).toEqual([
      'request.ready->response.done accepted',
    ]);
    expect(toUndulateJSON(diagram)).toMatchObject({
      signal: [
        { node: '.#.. request.ready' },
        { node: '..#. response.done' },
      ],
      edges: ['request.ready->response.done accepted'],
    });
  });

  it('rejects malformed expanded node declarations before import', () => {
    expect(validateUndulateJSON({
      signal: [{
        name: 'bad',
        wave: '01',
        node: '.#',
      }],
    })).toContain('one safe name per # slot');
    expect(validateUndulateJSON({
      signal: [{
        name: 'bad',
        wave: '01',
        node: '.# too many',
      }],
    })).toContain('one safe name per # slot');
  });

  it('rejects ambiguous and malformed plural edge input while accepting markers', () => {
    const signal = [{ name: 'clk', wave: '01', node: 'ab' }];
    expect(validateUndulateJSON({
      signal,
      edge: ['a->b'],
      edges: ['a -> b'],
    })).toContain('cannot both be present');
    expect(validateUndulateJSON({
      signal,
      edges: ['not an edge'],
    })).toContain('NODE PATTERN NODE');
    expect(validateUndulateJSON({
      signal,
      edges: ['a -* b'],
    })).toBeNull();
    expect(toUndulateJSON(fromUndulateJSON({
      signal,
      edges: ['a #-* b marked'],
    })).edges).toEqual(['a #-* b marked']);
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
  });

  it('normalizes safe signal styles and round-trips them losslessly', () => {
    const root = {
      signal: [{
        name: 'styled',
        wave: '01',
        stroke: '#336699',
        fill: 'rgba(51, 102, 153, 0.2)',
        'stroke-width': 3,
        'stroke-dasharray': [5, 2],
        'font-size': '14px',
        font: 'monospace',
        'font-weight': 700,
      }],
    } as unknown as UndulateRoot;

    expect(validateUndulateJSON(root)).toBeNull();
    expect(isUndulateJSON(root)).toBe(true);
    const diagram = fromUndulateJSON(root);
    const signal = diagram.signals[0];
    expect(signal?.type).not.toBe('group');
    if (!signal || signal.type === 'group') throw new Error('expected signal');
    expect(signal.style).toEqual({
      stroke: '#336699',
      fill: 'rgba(51, 102, 153, 0.2)',
      strokeWidth: 3,
      strokeDasharray: [5, 2],
      fontSize: 14,
      fontFamily: 'monospace',
      fontWeight: 700,
    });
    expect(toUndulateJSON(diagram).signal[0]).toMatchObject({
      stroke: '#336699',
      fill: 'rgba(51, 102, 153, 0.2)',
      'stroke-width': 3,
      'stroke-dasharray': [5, 2],
      'font-size': '14px',
      font: 'monospace',
      'font-weight': 700,
    });
    expect(validateUndulateJSON({
      signal: [{ name: 'unsafe', wave: '0', stroke: 'url(remote.svg)' }],
    })).toContain('stroke must be a safe');
    expect(validateUndulateJSON({
      signal: [{ name: 'wide', wave: '0', 'stroke-width': 33 }],
    })).toContain('stroke-width must be');
  });

  it('preserves app-owned rails and random seeds while strict export is portable', () => {
    const root: UndulateRoot = {
      signal: [{
        name: 'random supply',
        wave: 'ss',
        analogue: ['0.5*VDDA', 'rnd()*VDDA'],
      }],
      'x-waves-gui': {
        analogueContext: { vssa: 0.2, vdda: 3.3 },
        randomSeed: 1234,
      },
    };
    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    expect(diagram.config).toMatchObject({
      analogueContext: { vssa: 0.2, vdda: 3.3 },
      analogueRandomSeed: 1234,
    });
    const saved = toUndulateJSON(diagram);
    expect(saved['x-waves-gui']).toEqual(root['x-waves-gui']);
    expect(saved.signal[0]).toMatchObject({
      name: 'random supply',
      analogue: ['0.5*VDDA', 'rnd()*VDDA'],
    });
    expect((saved.signal[0] as { wave?: string }).wave?.startsWith('ss'))
      .toBe(true);
    const strict = toUndulateJSON(diagram, { includeAppMetadata: false });
    expect(strict['x-waves-gui']).toBeUndefined();
    expect((strict.signal[0] as { analogue?: unknown[] }).analogue)
      .toEqual(expect.arrayContaining([1.65, expect.any(Number)]));
  });

  it('round-trips mixed analogue metastability and impulse states', () => {
    const root: UndulateRoot = {
      signal: [{
        name: 'mixed',
        wave: '0mMiIsc',
        analogue: [0.75, 1.25],
      }],
    };
    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    const signal = diagram.signals[0];
    expect(signal?.type === 'analogue' && signal.analogueCells?.map(
      (cell) => cell.kind,
    )).toEqual([
      'hold',
      'metastable-low',
      'metastable-high',
      'impulse-low',
      'impulse-high',
      'step',
      'capacitive',
    ]);
    expect(toUndulateJSON(diagram).signal[0]).toMatchObject(root.signal[0]!);
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

  it('preserves safe unknown root and signal properties without interpreting them', () => {
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
      ['opaque', 'signal[0].typo_style'],
      ['opaque', 'future_root'],
    ]);
    const root = {
      signal: [{ name: 'clk', wave: '01', future_lane: { mode: 'vendor-a' } }],
      future_root: { revision: 2, enabled: true },
      config: {
        hscale: 2,
        future_config: { grid: 4 },
        head: { future_nested_head: true },
      },
      head: { text: 'top', future_head: 3 },
      foot: { text: 'bottom', future_foot: false },
      annotations: [{
        text: 'opaque note',
        x: 1,
        y: 1,
        future_annotation: { alignment: 'future' },
      }],
    } as unknown as UndulateRoot;
    expect(validateUndulateJSON(root)).toBeNull();
    const diagram = fromUndulateJSON(root);
    const signal = diagram.signals[0];
    const annotation = diagram.annotations?.[0];
    expect(signal?.type).not.toBe('group');
    if (!signal || signal.type === 'group' || !annotation) {
      throw new Error('expected signal and annotation');
    }
    expect(diagram.compatibility?.opaqueUndulate).toEqual({
      root: { future_root: { revision: 2, enabled: true } },
      config: {
        future_config: { grid: 4 },
        head: { future_nested_head: true },
      },
      head: { future_head: 3 },
      foot: { future_foot: false },
      signals: { [signal.id]: { future_lane: { mode: 'vendor-a' } } },
      annotations: {
        [annotation.id]: { future_annotation: { alignment: 'future' } },
      },
    });
    expect(toUndulateJSON(diagram)).toMatchObject(root);
    expect(validateUndulateJSON({
      signal: [{ name: 'unsafe', wave: '0', future_lane: 'https://example.test/x' }],
    })).toContain('Unknown Undulate property signal[0].future_lane');
    expect(validateUndulateJSON({
      signal: [],
      config: { future_config: { src: 'local.svg' } },
    })).toContain('Unknown Undulate property config.future_config');
    expect(validateUndulateJSON({
      signal: [],
      annotations: [{
        text: 'unsafe',
        x: 1,
        y: 1,
        future_annotation: 'javascript:alert(1)',
      }],
    })).toContain('Unknown Undulate property annotations[0].future_annotation');
    expect(validateUndulateJSON(JSON.parse(
      '{"signal":[],"__proto__":{"polluted":true}}',
    ))).toContain('Unknown Undulate property __proto__');
    const directUnsafe = JSON.parse(
      '{"signal":[],"__proto__":{"polluted":true}}',
    ) as UndulateRoot;
    const directExport = toUndulateJSON(fromUndulateJSON(directUnsafe));
    expect(Object.getPrototypeOf(directExport)).toBe(Object.prototype);
    expect((directExport as unknown as Record<string, unknown>).__proto__)
      .toEqual({ polluted: true });
    expect(validateUndulateJSON({
      signal: [{ name: 'unsafe', wave: '0', style: { fill: 'red' } }],
    })).toContain('Unknown Undulate property signal[0].style');
  });

  it('classifies the pinned blocked-feature fixture in one pass', () => {
    const root = JSON.parse(readFileSync(
      join(process.cwd(), 'tests/fixtures/undulate/blocked-features.json'),
      'utf8',
    )) as unknown;
    const findings = validateUndulateFindings(root);

    expect(new Set(findings.map((finding) => finding.kind))).toEqual(new Set([
      'unsupported-by-design',
      'opaque',
    ]));
    expect(findings.map((finding) => finding.path)).toEqual(
      expect.arrayContaining([
        'reg',
        'future_root',
        'signal[0].future_lane',
        'config.vscale',
        'config.future_config',
        'annotations[0].future_annotation',
      ]),
    );
    expect(findings.every((finding) => finding.kind !== 'wip')).toBe(true);
  });

  it('preserves arbitrary finite sampled timebases and rejects truncation losses', () => {
    const timebaseRoot = {
      signal: [{
        name: 'curve',
        wave: 'a',
        analogue: [[[-2, 0], [1, 0.5], [4, 1]]],
      }],
    } satisfies UndulateRoot;
    expect(validateUndulateJSON(timebaseRoot)).toBeNull();
    const diagram = fromUndulateJSON(timebaseRoot);
    const signal = diagram.signals[0];
    expect(
      signal?.type === 'analogue' && signal.analogueCells?.[0],
    ).toMatchObject({
      samples: [
        { offset: 0, value: 0 },
        { offset: 0.5, value: 0.5 },
        { offset: 1, value: 1 },
      ],
      sampleTimebase: { start: -2, end: 4 },
    });
    expect(toUndulateJSON(diagram).signal[0]).toMatchObject({
      analogue: [[[-2, 0], [1, 0.5], [4, 1]]],
    });
    expect(validateUndulateJSON({
      signal: [{
        name: 'backwards curve',
        wave: 'a',
        analogue: [[[1, 0], [0, 1]]],
      }],
    })).toContain('ascending order');
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
