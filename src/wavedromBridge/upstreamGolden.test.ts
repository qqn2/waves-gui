import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSON5 from 'json5';
import { describe, it, expect } from 'vitest';
import { fromWavedromJSON, validateWavedromJSON } from './index';
import type { WdRoot } from './wdTypes';

const upstreamDir = join(
  process.cwd(),
  'docs',
  'wavedrom-ref',
  'upstream-tests',
);

function loadJson5(file: string): unknown {
  const raw = readFileSync(join(upstreamDir, file), 'utf8');
  return JSON5.parse(raw);
}

function countImportableSignals(
  diagram: ReturnType<typeof fromWavedromJSON>,
): number {
  let n = 0;
  const walk = (items: typeof diagram.signals): void => {
    for (const item of items) {
      if (item.type === 'group') walk(item.children);
      else if (item.type !== 'spacer') n++;
    }
  };
  walk(diagram.signals);
  return n;
}

/** Upstream timing diagrams (signal array). Import-only until edge/node round-trip exists. */
const timingFixtures = [
  'signal-step4.json5',
  'signal-arcs.json5',
  'signal-arcs1.json5',
] as const;

/** Register / assign diagrams — not timing; bridge targets signal-only. */
const nonTimingFixtures = ['reg-vl.json5', 'assign.json5'] as const;

describe('upstream WaveDrom JSON5 golden (timing)', () => {
  it.each(timingFixtures)('%s parses, validates, and imports', (file) => {
    const json = loadJson5(file);
    expect(validateWavedromJSON(json)).toBeNull();

    const diagram = fromWavedromJSON(json as WdRoot);
    expect(countImportableSignals(diagram)).toBeGreaterThan(0);
    expect(diagram.config.totalSteps).toBeGreaterThan(0);
    // Full round-trip deferred: edge[] and node strings are not exported yet.
  });
});

describe('upstream WaveDrom JSON5 (non-timing)', () => {
  it.each(nonTimingFixtures)(
    '%s fails validate (no signal array)',
    (file) => {
      const json = loadJson5(file);
      const err = validateWavedromJSON(json);
      expect(err).not.toBeNull();
      expect(err).toMatch(/signal/i);
    },
  );
});
