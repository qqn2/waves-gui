import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSON5 from 'json5';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from './index';
import type { Signal } from '../shared/types';
import type { WdRoot } from './wdTypes';

const path = join(
  process.cwd(),
  'docs/wavedrom-ref/upstream-tests/signal-step4.json5',
);

describe('signal-step4.json5', () => {
  it('imports pipe gaps and round-trips wave strings', () => {
    const wd = JSON5.parse(readFileSync(path, 'utf8')) as WdRoot;
    const diagram = fromWavedromJSON(wd);
    const clk = diagram.signals.find(
      (s): s is Signal => s.type === 'bit' && s.name === 'clk',
    );
    expect(clk?.stepGaps?.some(Boolean)).toBe(true);

    const data = diagram.signals.find(
      (s): s is Signal => s.type === 'vector' && s.name === 'Data',
    );
    expect(data?.stepGaps?.some(Boolean)).toBe(true);

    const back = toWavedromJSON(diagram);
    const clkWd = back.signal?.find(
      (e) => typeof e === 'object' && !Array.isArray(e) && (e as { name?: string }).name === 'clk',
    ) as { wave?: string };
    expect(clkWd.wave).toContain('|');
  });
});
