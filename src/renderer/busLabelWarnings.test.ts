import { describe, expect, it } from 'vitest';
import type { Signal, VectorSegment } from '../shared/types';
import { busLabelWarnings, busSegmentLabelFit } from './busLabelWarnings';

const segment: VectorSegment = { id: 'label', startStep: 0, endStep: 1, value: '0xDEADBEEF' };
const bus = (overrides: Partial<Signal> = {}): Signal => ({
  id: 'bus', name: 'data', type: 'vector', states: [], segments: [segment],
  rowHeight: 40, color: '#00f', ...overrides,
});

describe('bus label warnings', () => {
  it('recommends the first column width that clears a warning without changing timing', () => {
    const signal = bus();
    const before = structuredClone(signal);
    const fit = busSegmentLabelFit(segment, signal, 1);
    expect(fit.fits).toBe(false);
    expect(fit.minHscale).toBeGreaterThan(1);
    expect(busSegmentLabelFit(segment, signal, fit.minHscale!).fits).toBe(true);
    expect(busSegmentLabelFit(segment, signal, fit.minHscale! - 0.1).fits).toBe(false);
    expect(signal).toEqual(before);
  });

  it('uses lane period and ignores phase shifts when measuring a span', () => {
    expect(busSegmentLabelFit(segment, bus({ period: 4 }), 1).fits).toBe(true);
    expect(busSegmentLabelFit(segment, bus({ period: 4, phase: 2.25 }), 1).fits).toBe(true);
  });

  it('uses each native timing cell, including a narrow later cell', () => {
    const fine = bus({ vectorTiming: {
      ticksPerStep: 4, phaseTicks: 3,
      cells: [{ durationTicks: 16 }, { durationTicks: 1 }],
    } });
    expect(busSegmentLabelFit(segment, fine, 1).fits).toBe(true);
    const later = { ...segment, startStep: 1, endStep: 2 };
    expect(busSegmentLabelFit(later, fine, 1)).toEqual({ fits: false, tooNarrowForShape: true, minHscale: null });
  });

  it('does not claim maximum width fits an excessively long label', () => {
    const huge = { ...segment, value: 'VERY_LONG_LABEL_'.repeat(20) };
    expect(busSegmentLabelFit(huge, bus(), 1).minHscale).toBeNull();
    expect(busSegmentLabelFit(huge, bus(), 4).fits).toBe(false);
  });

  it('uses renderer row height and explicit label font size', () => {
    const short = { ...segment, value: 'ABCDEFG' };
    expect(busSegmentLabelFit(short, bus(), 2).fits).toBe(true);
    expect(busSegmentLabelFit(short, bus({ rowHeight: 120 }), 2).fits).toBe(false);
    expect(busSegmentLabelFit(short, bus({ style: { fontSize: 42 } }), 2).fits).toBe(false);
  });

  it('finds labels inside groups, ignores empty labels, and clears after widening', () => {
    const signal = bus({ segments: [segment, { ...segment, id: 'empty', value: '  ' }] });
    const signals = [{ id: 'group', type: 'group' as const, name: 'Bus group', children: [signal] }];
    const warnings = busLabelWarnings(signals, 1);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ signalId: 'bus', segmentId: 'label' });
    expect(busLabelWarnings(signals, warnings[0]!.minHscale!)).toEqual([]);
  });
});
