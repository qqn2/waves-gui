// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSVGString } from '../exportEngine/exportSVG';
import { defaultView } from '../shared/store/helpers';
import type { UndulateRoot } from './types';
import {
  UNDULATE_TARGET_REVISION,
  fromUndulateJSON,
  toUndulateJSON,
  validateUndulateJSON,
} from './undulateJSON';

interface SupportedRoundTripCase {
  id: string;
  features: string[];
  source: string;
  document: UndulateRoot;
  expectedCanonical: UndulateRoot;
  renderIncludes: string[];
}

interface SupportedRoundTripManifest {
  revision: string;
  license: string;
  repository: string;
  cases: SupportedRoundTripCase[];
}

const fixturePath = join(
  process.cwd(),
  'tests/fixtures/undulate/supported-roundtrip-cases.json',
);
const manifest = JSON.parse(
  readFileSync(fixturePath, 'utf8'),
) as SupportedRoundTripManifest;

describe('pinned Undulate supported-subset fixtures', () => {
  it('records revision, provenance, and a non-empty feature list for every case', () => {
    expect(manifest.revision).toBe(UNDULATE_TARGET_REVISION);
    expect(manifest.license).toBe('MIT');
    expect(manifest.repository).toBe('https://github.com/LudwigCRON/undulate');
    expect(manifest.cases.length).toBeGreaterThanOrEqual(6);
    for (const fixture of manifest.cases) {
      expect(fixture.id).toMatch(/^[a-z0-9-]+$/);
      expect(fixture.features.length).toBeGreaterThan(0);
      expect(fixture.source).toMatch(/^(docs-srcs|docs\/wavedrom-ref)\//);
      expect(fixture.renderIncludes.length).toBeGreaterThan(0);
    }
  });

  it.each(manifest.cases)(
    '$id validates, imports, renders, and round-trips canonically',
    (fixture) => {
      expect(validateUndulateJSON(fixture.document)).toBeNull();

      const imported = fromUndulateJSON(fixture.document);
      const exported = toUndulateJSON(imported);
      expect(exported).toEqual(fixture.expectedCanonical);
      expect(validateUndulateJSON(exported)).toBeNull();

      const reimported = fromUndulateJSON(exported);
      expect(toUndulateJSON(reimported)).toEqual(exported);

      const svg = buildSVGString(imported, defaultView());
      expect(svg).toContain('<svg');
      for (const text of fixture.renderIncludes) {
        expect(svg).toContain(text);
      }
      if (fixture.id === 'extended-digital-states') {
        for (const state of ['z', 'u', 'd']) {
          const path = svg.match(
            new RegExp(`<path data-wave-state="${state}"[^>]+>`),
          )?.[0];
          expect(path, `${state} should use a connected Undulate path`).toContain(' C');
          expect(path).not.toContain('stroke-dasharray');
        }
      }
    },
  );

  it('uses unique case ids and does not claim the same feature twice', () => {
    const ids = manifest.cases.map((fixture) => fixture.id);
    expect(new Set(ids).size).toBe(ids.length);
    const features = manifest.cases.flatMap((fixture) => fixture.features);
    expect(new Set(features).size).toBe(features.length);
  });
});
