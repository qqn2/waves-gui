import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { UNDULATE_PROPERTY_MANIFEST, UNDULATE_TARGET_REVISION } from './validation';

interface MatrixProperty {
  id: string;
  path: string;
  scope: string;
  classification: 'modeled' | 'opaque' | 'rejected';
  evidence: string[];
}

interface PropertyMatrix {
  revision: string;
  license: string;
  properties: MatrixProperty[];
}

const matrixPath = join(
  process.cwd(),
  'tests/fixtures/undulate/property-matrix.json',
);
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as PropertyMatrix;

const SCOPE_TO_MANIFEST: Record<string, keyof typeof UNDULATE_PROPERTY_MANIFEST> = {
  root: 'root',
  config: 'config',
  head: 'head',
  foot: 'foot',
  digitalSignal: 'digitalSignal',
  analogueSignal: 'analogueSignal',
  annotation: 'annotation',
};

function fieldName(path: string): string {
  const leaf = path.split('.').pop() ?? path;
  return leaf.replace('[]', '');
}

describe('pinned Undulate property matrix consistency', () => {
  it('pins the target revision and classifies every row', () => {
    expect(matrix.revision).toBe(UNDULATE_TARGET_REVISION);
    expect(matrix.license).toBe('MIT');
    expect(matrix.properties.length).toBeGreaterThan(40);
    for (const property of matrix.properties) {
      expect(property.id).toMatch(/^[a-z0-9.+:_-]+$/i);
      expect(['modeled', 'opaque', 'rejected']).toContain(property.classification);
      expect(property.evidence.length).toBeGreaterThan(0);
    }
    console.log(`property-matrix count: ${matrix.properties.length}`);
  });

  it('keeps unique property ids and no unexplained gaps versus the TypeScript manifest', () => {
    const ids = matrix.properties.map((property) => property.id);
    expect(new Set(ids).size).toBe(ids.length);

    const digitalModeled = new Set(
      matrix.properties
        .filter((property) => (
          property.scope === 'digitalSignal' && property.classification === 'modeled'
        ))
        .map((property) => fieldName(property.path)),
    );

    for (const [scope, key] of Object.entries(SCOPE_TO_MANIFEST)) {
      const section = UNDULATE_PROPERTY_MANIFEST[key];
      const modeled = new Set(
        matrix.properties
          .filter((property) => property.scope === scope && property.classification === 'modeled')
          .map((property) => fieldName(property.path)),
      );
      const opaque = new Set(
        matrix.properties
          .filter((property) => property.scope === scope && property.classification === 'opaque')
          .map((property) => fieldName(property.path)),
      );
      const rejected = new Set(
        matrix.properties
          .filter((property) => property.scope === scope && property.classification === 'rejected')
          .map((property) => fieldName(property.path)),
      );

      for (const field of section.supported) {
        const covered = modeled.has(field)
          || (scope === 'analogueSignal' && digitalModeled.has(field));
        expect(covered, `${scope}.${field} should be modeled`).toBe(true);
        expect(opaque.has(field), `${scope}.${field} must not also be opaque`).toBe(false);
      }
      for (const field of section.opaque) {
        expect(opaque.has(field), `${scope}.${field} should be opaque`).toBe(true);
        expect(modeled.has(field), `${scope}.${field} must not also be modeled`).toBe(false);
      }
      if ('unsupportedByDesign' in section) {
        for (const field of section.unsupportedByDesign) {
          expect(rejected.has(field), `${scope}.${field} should be rejected`).toBe(true);
        }
      }
    }
  });

  it('does not retain a WIP classification for any pinned safe property', () => {
    for (const section of Object.values(UNDULATE_PROPERTY_MANIFEST)) {
      expect('wip' in section).toBe(false);
    }
    expect(
      matrix.properties.every((property) => property.classification !== 'rejected'
        || property.path.includes('reg')
        || property.scope === 'security'
        || ('reason' in property)),
    ).toBe(true);
  });
});
