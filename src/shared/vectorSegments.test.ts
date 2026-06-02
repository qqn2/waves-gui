import { describe, it, expect } from 'vitest';
import {
  applyVectorSpan,
  segmentsToWaveAndData,
  VECTOR_UNKNOWN_LABEL,
} from './vectorSegments';
import type { VectorSegment } from './types';

describe('vectorSegments', () => {
  it('segmentsToWaveAndData uses = and . for multi-cycle spans (no color digits)', () => {
    const segments: VectorSegment[] = [
      { id: 'a', startStep: 0, endStep: 1, value: 'NONSEQ' },
      { id: 'b', startStep: 1, endStep: 2, value: 'BUSY' },
      { id: 'c', startStep: 2, endStep: 4, value: 'SEQ' },
      { id: 'd', startStep: 4, endStep: 7, value: 'SEQ-long' },
    ];
    const { wave, data } = segmentsToWaveAndData(segments, 8);
    expect(data).toEqual(['NONSEQ', 'BUSY', 'SEQ', 'SEQ-long']);
    expect(wave).not.toMatch(/[2-9]/);
    expect(wave).toContain('=..');
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
});
