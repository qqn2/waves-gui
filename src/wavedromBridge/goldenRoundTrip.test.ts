import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  fromWavedromJSON,
  toWavedromJSON,
  validateWavedromJSON,
} from './index';
import type { WdRoot } from './wdTypes';

const goldenDir = join(process.cwd(), 'public', 'golden');

function signalNames(diagram: ReturnType<typeof fromWavedromJSON>): string[] {
  const names: string[] = [];
  const walk = (items: typeof diagram.signals): void => {
    for (const item of items) {
      if (item.type === 'group') walk(item.children);
      else names.push(item.name);
    }
  };
  walk(diagram.signals);
  return names;
}

const fixtures = readdirSync(goldenDir).filter((f) => f.endsWith('.json'));

describe('golden WaveDrom round-trip', () => {
  it.each(fixtures)('%s validates, imports, and round-trips', (file) => {
    const raw = readFileSync(join(goldenDir, file), 'utf8');
    const json = JSON.parse(raw) as unknown;
    expect(validateWavedromJSON(json)).toBeNull();

    const diagram = fromWavedromJSON(json as WdRoot);
    const before = signalNames(diagram);
    expect(before.length).toBeGreaterThan(0);

    const exported = toWavedromJSON(diagram);
    const reimported = fromWavedromJSON(exported);
    expect(signalNames(reimported)).toEqual(before);
    expect(reimported.config.totalSteps).toBe(diagram.config.totalSteps);
  });
});
