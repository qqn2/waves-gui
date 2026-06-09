import { describe, it, expect } from 'vitest';
import { fillHexForColorIndex } from '../wavedromBridge/wavedromColors';
import {
  applyVectorSpan,
  segmentAtStep,
  segmentsToWaveAndData,
  VECTOR_UNKNOWN_LABEL,
} from './vectorSegments';
import type { VectorSegment } from './types';

describe('vectorSegments', () => {
  it('segmentsToWaveAndData emits WaveDrom color digits per segment', () => {
    const segments: VectorSegment[] = [
      {
        id: 'a',
        startStep: 0,
        endStep: 1,
        value: 'NONSEQ',
        color: fillHexForColorIndex(3),
      },
      {
        id: 'b',
        startStep: 1,
        endStep: 2,
        value: 'BUSY',
        color: fillHexForColorIndex(4),
      },
      {
        id: 'c',
        startStep: 2,
        endStep: 4,
        value: 'SEQ',
        color: fillHexForColorIndex(5),
      },
    ];
    const { wave, data } = segmentsToWaveAndData(segments, 8);
    expect(data).toEqual(['NONSEQ', 'BUSY', 'SEQ']);
    expect(wave[0]).toBe('3');
    expect(wave[1]).toBe('4');
    expect(wave[2]).toBe('5');
    expect(wave[3]).toBe('.');
  });

  it('segmentsToWaveAndData emits x without data entry', () => {
    const segments: VectorSegment[] = [
      { id: 'u', startStep: 0, endStep: 1, value: VECTOR_UNKNOWN_LABEL },
      { id: 'd', startStep: 2, endStep: 3, value: '0x20' },
    ];
    const { wave, data } = segmentsToWaveAndData(segments, 4);
    expect(wave[0]).toBe('x');
    expect(data).toEqual(['0x20']);
  });

  it('segmentsToWaveAndData encodes multi-step unknown as x.', () => {
    const segments: VectorSegment[] = [
      { id: 'u', startStep: 0, endStep: 2, value: VECTOR_UNKNOWN_LABEL },
      { id: 'd', startStep: 2, endStep: 3, value: '0x2000' },
    ];
    const { wave, data } = segmentsToWaveAndData(segments, 6);
    expect(wave.startsWith('x.')).toBe(true);
    expect(data).toEqual(['0x2000']);
  });

  it('applyVectorSpan paints and erase clears', () => {
    const base: VectorSegment[] = [
      { id: '1', startStep: 0, endStep: 8, value: 'idle' },
    ];
    const painted = applyVectorSpan(base, 2, 4, 'SEQ', 8);
    const { data } = segmentsToWaveAndData(painted, 8);
    expect(data).toContain('SEQ');
    const cleared = applyVectorSpan(painted, 2, 4, null, 8);
    expect(segmentsToWaveAndData(cleared, 8).data).not.toContain('SEQ');
  });

  it('applyVectorSpan preserveExistingLabels keeps occupied step labels', () => {
    const base: VectorSegment[] = [
      { id: '1', startStep: 0, endStep: 2, value: 'A0' },
      { id: '2', startStep: 4, endStep: 5, value: 'A1' },
    ];
    const painted = applyVectorSpan(base, 0, 4, 'NEW', 8, undefined, {
      preserveExistingLabels: true,
    });
    const { data } = segmentsToWaveAndData(painted, 8);
    expect(data).toContain('A0');
    expect(data).toContain('NEW');
    expect(data).toContain('A1');
    expect(data.filter((d) => d === 'A0')).toHaveLength(1);
  });

  it('segmentAtStep finds the segment covering a step', () => {
    const segments: VectorSegment[] = [
      { id: '1', startStep: 2, endStep: 5, value: 'MID' },
    ];
    expect(segmentAtStep(segments, 1)).toBeUndefined();
    expect(segmentAtStep(segments, 3)?.value).toBe('MID');
  });

  it('segmentsToWaveAndData serializes empty string and "0" as = and pushes to data', () => {
    const segments: VectorSegment[] = [
      { id: '1', startStep: 0, endStep: 2, value: '' },
      { id: '2', startStep: 2, endStep: 4, value: '0' },
    ];
    const { wave, data } = segmentsToWaveAndData(segments, 4);
    expect(wave).toBe('=.=.');
    expect(data).toEqual(['', '0']);
  });
});
