import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { parseCodeToDiagram } from '../codePanel/codeSync';
import { SAMPLE_DIAGRAMS, SAMPLE_LIBRARY, collectSampleLeaves } from './samples';
import { sampleParseOptions, samplePreviewFileName } from '../sampleLibrary/sampleSource';

const samplesDir = join(process.cwd(), 'public', 'samples');

describe('template library tree', () => {
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
  const supportedSamples = SAMPLE_DIAGRAMS.filter((sample) => sample.support !== 'future');

  it.each(supportedSamples.map((s) => [s.id, s.file] as const))(
    '%s validates and imports',
    (_id, file) => {
      const raw = readFileSync(join(samplesDir, file), 'utf8');
      const parsed = parseCodeToDiagram(
        raw,
        sampleParseOptions(supportedSamples.find((sample) => sample.file === file)?.format),
      );
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

  it.each(supportedSamples.flatMap((sample) => [
    [sample.id, sample.file, 'dark'],
    [sample.id, sample.file, 'light'],
  ] as const))('%s has a generated %s static preview', (_id, file, theme) => {
    const previewFile = samplePreviewFileName(file, theme);
    const preview = readFileSync(join(samplesDir, 'previews', previewFile), 'utf8');
    expect(preview).toContain('<svg');
  });
});
