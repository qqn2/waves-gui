import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import JSON5 from 'json5';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, toWavedromJSON } from './index';
import type { Signal } from '../shared/types';
import type { WdRoot } from './wdTypes';

const arcsPath = join(
  process.cwd(),
  'docs/wavedrom-ref/upstream-tests/signal-arcs.json5',
);

function isSignal(s: unknown): s is Signal {
  return typeof s === 'object' && s !== null && (s as Signal).type !== undefined;
}

describe('edge and node round-trip', () => {
  it('preserves edge[] and node strings from signal-arcs.json5', () => {
    const raw = readFileSync(arcsPath, 'utf8');
    const wd = JSON5.parse(raw) as WdRoot;
    const diagram = fromWavedromJSON(wd);
    expect(diagram.edges).toEqual(wd.edge);
    const names = ['A', 'B', 'C', 'D', 'E'];
    for (const name of names) {
      const sig = diagram.signals.find((s) => isSignal(s) && s.name === name);
      expect(sig && isSignal(sig) ? sig.node : undefined).toBeTruthy();
    }
    const back = toWavedromJSON(diagram);
    expect(back.edge).toEqual(wd.edge);
    const re = fromWavedromJSON(back);
    expect(re.edges).toEqual(diagram.edges);
  });
});
