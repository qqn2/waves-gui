/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { CELL_WIDTH } from '../shared/constants';
import { renderGrid } from './renderGrid';

function contextStub() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    strokeStyle: '',
    lineWidth: 1,
  } as unknown as CanvasRenderingContext2D;
}

describe('renderGrid', () => {
  it('draws dotted timing subdivisions behind the major step grid', () => {
    const ctx = contextStub();

    renderGrid(
      ctx,
      2,
      100,
      { zoom: 1, hscale: 1, scrollX: 0, scrollY: 0 },
      CELL_WIDTH * 2,
      4,
    );

    expect(ctx.setLineDash).toHaveBeenCalledWith([1, 3]);
    expect(ctx.setLineDash).toHaveBeenLastCalledWith([]);
    const xPositions = vi.mocked(ctx.moveTo).mock.calls.map(([x]) => x);
    expect(xPositions).toEqual([
      CELL_WIDTH / 4,
      CELL_WIDTH / 2,
      CELL_WIDTH * 3 / 4,
      CELL_WIDTH * 5 / 4,
      CELL_WIDTH * 3 / 2,
      CELL_WIDTH * 7 / 4,
      0,
      CELL_WIDTH,
      CELL_WIDTH * 2,
    ]);
  });

  it('hides subdivisions when they would be too dense to read', () => {
    const ctx = contextStub();

    renderGrid(
      ctx,
      1,
      100,
      { zoom: 1, hscale: 1, scrollX: 0, scrollY: 0 },
      CELL_WIDTH,
      64,
    );

    expect(ctx.setLineDash).not.toHaveBeenCalledWith([1, 3]);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
  });
});
