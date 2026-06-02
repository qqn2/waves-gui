import { describe, expect, it } from 'vitest';
import { appendGlitchToSvgPath } from './drawStepGlitch';

describe('appendGlitchToSvgPath', () => {
  it('adds a same-level notch before the step edge', () => {
    const d = appendGlitchToSvgPath('M0,10', 40, 10, 30, 20);
    expect(d).toContain('L30,10');
    expect(d).toContain('L35,30');
    expect(d).toContain('L40,10');
  });
});
