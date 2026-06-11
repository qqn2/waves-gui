import { describe, expect, it } from 'vitest';
import { svgStepGap } from './drawStepGap';

describe('svgStepGap', () => {
  it('emits WaveDrom-style mask and twin discontinuity curves', () => {
    const svg = svgStepGap(100, 100, 10, 34, '#eee', '#111');
    expect(svg).toContain('M7,-2');
    expect(svg).toContain('M-7,22');
    expect(svg).toContain('M-3,22');
    expect(svg).not.toContain('<line');
  });
});
