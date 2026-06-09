import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import { SAMPLE_DIAGRAMS, SAMPLE_LIBRARY, collectSampleLeaves } from './samples';

const samplesDir = join(process.cwd(), 'public', 'samples');

describe('sample library tree', () => {
  it('has unique leaf ids', () => {
    const ids = collectSampleLeaves().map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uses path-style ids for nested samples', () => {
    expect(collectSampleLeaves(SAMPLE_LIBRARY).some((s) => s.id === 'amba/apb/write')).toBe(
      true,
    );
    expect(collectSampleLeaves(SAMPLE_LIBRARY).some((s) => s.id === 'amba/axi/read')).toBe(
      true,
    );
  });
});

describe('bundled sample diagrams', () => {
  it.each(SAMPLE_DIAGRAMS.map((s) => [s.id, s.file] as const))(
    '%s validates and imports',
    (_id, file) => {
      const raw = readFileSync(join(samplesDir, file), 'utf8');
      const json = JSON.parse(raw) as unknown;
      expect(validateWavedromJSON(json)).toBeNull();
      const diagram = fromWavedromJSON(json as Parameters<typeof fromWavedromJSON>[0]);
      expect(diagram.signals.length).toBeGreaterThan(0);
      expect(diagram.config.totalSteps).toBeGreaterThan(0);
    },
  );
});
