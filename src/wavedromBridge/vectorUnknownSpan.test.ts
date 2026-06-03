import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON } from './fromWavedromJSON';
import { VECTOR_UNKNOWN_LABEL } from '../shared/vectorSegments';
import type { DiagramState, Signal } from '../shared/types';
import type { WdRoot } from './wdTypes';

const samplesDir = join(process.cwd(), 'public', 'samples');

function findVector(diagram: DiagramState, name: string): Signal | undefined {
  let found: Signal | undefined;
  const walk = (list: typeof diagram.signals) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else if (item.name === name && item.type === 'vector') found = item;
    }
  };
  walk(diagram.signals);
  return found;
}

function unknownSpans(signal: Signal) {
  if (signal.type !== 'vector') return [];
  return signal.segments.filter((s) => s.value === VECTOR_UNKNOWN_LABEL);
}

describe('vector x. continuation on import', () => {
  it('APB read PADDR and PRDATA extend leading x through dots', () => {
    const raw = readFileSync(join(samplesDir, 'amba-apb-read.json'), 'utf8');
    const diagram = fromWavedromJSON(JSON.parse(raw) as WdRoot);

    const paddr = findVector(diagram, 'PADDR');
    expect(paddr?.type).toBe('vector');
    expect(unknownSpans(paddr!)[0]).toMatchObject({ startStep: 0, endStep: 2 });

    const prdata = findVector(diagram, 'PRDATA');
    expect(prdata?.type).toBe('vector');
    expect(unknownSpans(prdata!)[0]).toMatchObject({ startStep: 0, endStep: 3 });
  });
});
