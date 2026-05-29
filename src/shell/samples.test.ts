import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { fromWavedromJSON, validateWavedromJSON } from '../wavedromBridge';
import { SAMPLE_DIAGRAMS } from './samples';

const samplesDir = join(process.cwd(), 'public', 'samples');

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
