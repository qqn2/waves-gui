// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSON5 from 'json5';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from './index';
import { renderWavedromSvg, svgMetrics } from './renderWavedromSvg';
import type { WdRoot } from './wdTypes';

const upstreamDir = join(
  process.cwd(),
  'docs',
  'wavedrom-ref',
  'upstream-tests',
);

function loadJson5(file: string): unknown {
  return JSON5.parse(readFileSync(join(upstreamDir, file), 'utf8'));
}

describe('upstream WaveDrom SVG smoke', () => {
  it('signal-arcs.json5 renders SVG with paths and edges', async () => {
    const wd = loadJson5('signal-arcs.json5') as WdRoot;
    const svg = await renderWavedromSvg(wd);
    const m = svgMetrics(svg);
    expect(m.pathCount).toBeGreaterThan(5);
    expect(m.width).toBeGreaterThan(100);
    expect(m.height).toBeGreaterThan(50);
    expect(svg).toContain('marker');
  });

  it('imported diagram exports to renderable JSON', async () => {
    const wd = loadJson5('signal-step4.json5') as WdRoot;
    const diagram = fromWavedromJSON(wd);
    const exported = toWavedromJSON(diagram);
    const svg = await renderWavedromSvg(exported);
    const m = svgMetrics(svg);
    expect(m.pathCount).toBeGreaterThan(3);
    expect(m.height).toBeGreaterThan(40);
  });
});
