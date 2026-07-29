import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseCodeToDiagram } from '../codePanel/codeSync';
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
      const parsed = parseCodeToDiagram(raw);
      expect(parsed.ok).toBe(true);
      if (parsed.ok === false) throw new Error(parsed.error);
      const diagram = parsed.diagram;
      expect(diagram.signals.length).toBeGreaterThan(0);
      expect(diagram.config.totalSteps).toBeGreaterThan(0);
    },
  );

  it('includes task-oriented coverage for the major Undulate workflows', () => {
    const ids = collectSampleLeaves().map((sample) => sample.id);
    expect(ids).toEqual(expect.arrayContaining([
      'undulate/fine-timing',
      'undulate/analogue',
      'undulate/annotations',
      'undulate/states-and-style',
    ]));
  });
});
