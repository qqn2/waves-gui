import { describe, expect, it } from 'vitest';
import type { VectorSegment } from '../shared/types';
import { WAVEDROM_BUS_FILLS, WAVEDROM_COLOR_INDEXES } from '../wavedromBridge/wavedromColors';
import { segmentBusTextColor } from './vectorBusStyle';

function segment(value: string, color?: string): VectorSegment {
  return { id: `${value}-${color ?? 'default'}`, startStep: 0, endStep: 1, value, color };
}

describe('segmentBusTextColor', () => {
  it.each(WAVEDROM_COLOR_INDEXES)('uses dark ink on WaveDrom color %s', (index) => {
    expect(segmentBusTextColor(segment('data', WAVEDROM_BUS_FILLS[index]))).toBe('#172033');
  });

  it('keeps light theme ink for translucent signal-colored spans', () => {
    expect(segmentBusTextColor(segment('data'))).toBe('#e8e8e8');
  });

  it('keeps muted light ink on unknown spans', () => {
    expect(segmentBusTextColor(segment('x'))).toBe('#b0b0b0');
  });
});
