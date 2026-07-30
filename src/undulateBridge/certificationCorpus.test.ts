// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSVGString } from '../exportEngine/exportSVG';
import { undulateCompatibilityFindings } from '../shared/compatibility';
import { defaultView } from '../shared/store/helpers';
import type { UndulateRoot } from './types';
import {
  fromUndulateJSON,
  toUndulateJSON,
  validateUndulateFindings,
  validateUndulateJSON,
} from './undulateJSON';
import { parseUndulateTOML, stringifyUndulateTOML } from './undulateTOML';
import { parseUndulateYAML, stringifyUndulateYAML } from './undulateYAML';
import { UNDULATE_TARGET_REVISION } from './validation';

interface Provenance {
  repository: string;
  commit: string;
  path: string;
  section?: string;
  license: string;
  adaptation: string;
}

interface CorpusCase {
  id: string;
  kind: 'round-trip' | 'cross-format' | 'opaque' | 'reject';
  formats: Array<'json' | 'yaml' | 'toml'>;
  source: Provenance;
  features: string[];
  document: UndulateRoot | Record<string, unknown>;
  yaml?: string;
  toml?: string;
  opaquePaths?: string[];
  expectedKind?: string;
  expectedPath?: string;
  expectedFill?: string;
  expectedStroke?: string;
  expectedAnnotationStroke?: string;
}

interface CorpusManifest {
  revision: string;
  wavedromRevision: string;
  cases: CorpusCase[];
}

function expandDocument(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(expandDocument);
  if (!value || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (
    typeof record.$repeat === 'string'
    && typeof record.count === 'number'
  ) {
    return record.$repeat.repeat(record.count);
  }
  return Object.fromEntries(
    Object.entries(record).map(([key, child]) => [key, expandDocument(child)]),
  );
}

function semanticCore(root: UndulateRoot): unknown {
  return JSON.parse(JSON.stringify({
    signal: root.signal,
    ...(root.config ? { config: root.config } : {}),
    ...(root.head ? { head: root.head } : {}),
    ...(root.foot ? { foot: root.foot } : {}),
    ...(root.edges || root.edge
      ? { edges: root.edges ?? root.edge }
      : {}),
    ...(root.annotations ? { annotations: root.annotations } : {}),
  }));
}

const corpusPath = join(
  process.cwd(),
  'tests/fixtures/undulate/certification-corpus.json',
);
const corpus = JSON.parse(readFileSync(corpusPath, 'utf8')) as CorpusManifest;
const matrixPath = join(
  process.cwd(),
  'tests/fixtures/undulate/property-matrix.json',
);
const matrix = JSON.parse(readFileSync(matrixPath, 'utf8')) as {
  properties: Array<{ evidence: string[] }>;
};

describe('pinned Undulate certification corpus', () => {
  it('records provenance for every case and covers the property matrix', () => {
    expect(corpus.revision).toBe(UNDULATE_TARGET_REVISION);
    expect(corpus.wavedromRevision).toMatch(/^[0-9a-f]{40}$/);
    expect(corpus.cases.length).toBeGreaterThanOrEqual(12);
    for (const fixture of corpus.cases) {
      expect(fixture.source.repository).toMatch(/^https:\/\//);
      expect(fixture.source.commit.length).toBeGreaterThan(0);
      expect(fixture.source.path.length).toBeGreaterThan(0);
      expect(fixture.source.license).toBe('MIT');
      expect(fixture.source.adaptation.length).toBeGreaterThan(0);
      expect(fixture.features.length).toBeGreaterThan(0);
    }
    const evidenceIds = new Set(
      corpus.cases.flatMap((fixture) => [
        `certification-corpus#${fixture.id}`,
        fixture.id,
      ]),
    );
    for (const property of matrix.properties) {
      const covered = property.evidence.some((entry) => (
        evidenceIds.has(entry)
        || entry.startsWith('supported-roundtrip-cases')
        || entry.startsWith('blocked-features')
        || entry.startsWith('annotations-styles')
        || entry.includes('.test.ts')
      ));
      expect(covered, `matrix evidence missing for ${property.evidence.join(',')}`).toBe(true);
    }
    console.log(`certification fixture count: ${corpus.cases.length}`);
  });

  it.each(corpus.cases.filter((fixture) => fixture.kind === 'round-trip'))(
    '$id validates, imports, exports, and reimports without silent loss',
    (fixture) => {
      const document = expandDocument(fixture.document) as UndulateRoot;
      expect(validateUndulateJSON(document)).toBeNull();
      const imported = fromUndulateJSON(document);
      const exported = toUndulateJSON(imported);
      expect(validateUndulateJSON(exported)).toBeNull();
      const reimported = fromUndulateJSON(exported);
      expect(semanticCore(toUndulateJSON(reimported))).toEqual(semanticCore(exported));

      const svg = buildSVGString(imported, defaultView());
      expect(svg).toContain('<svg');
      expect(svg).toMatch(/width="\d+(\.\d+)?"/);
      expect(svg).toMatch(/height="\d+(\.\d+)?"/);

      if (fixture.expectedFill) {
        const annotation = exported.annotations?.[0] as { fill?: string } | undefined;
        expect(annotation?.fill).toBe(fixture.expectedFill);
      }
      if (fixture.expectedStroke) {
        const signal = exported.signal?.[0] as { stroke?: string } | undefined;
        expect(signal?.stroke).toBe(fixture.expectedStroke);
      }
      if (fixture.expectedAnnotationStroke) {
        const annotation = exported.annotations?.[0] as { stroke?: string } | undefined;
        expect(annotation?.stroke).toBe(fixture.expectedAnnotationStroke);
      }

      if (fixture.formats.includes('yaml')) {
        const yaml = stringifyUndulateYAML(document);
        const fromYaml = parseUndulateYAML(yaml) as UndulateRoot;
        expect(validateUndulateJSON(fromYaml)).toBeNull();
        expect(semanticCore(toUndulateJSON(fromUndulateJSON(fromYaml))))
          .toEqual(semanticCore(exported));
      }
      if (fixture.formats.includes('toml')) {
        const toml = stringifyUndulateTOML(document);
        const fromToml = parseUndulateTOML(toml) as UndulateRoot;
        expect(validateUndulateJSON(fromToml)).toBeNull();
        expect(semanticCore(toUndulateJSON(fromUndulateJSON(fromToml))))
          .toEqual(semanticCore(exported));
      }
    },
  );

  it.each(corpus.cases.filter((fixture) => fixture.kind === 'cross-format'))(
    '$id preserves semantics across JSON, YAML, and TOML',
    (fixture) => {
      const document = expandDocument(fixture.document) as UndulateRoot;
      const fromJson = fromUndulateJSON(document);
      const jsonExport = toUndulateJSON(fromJson);
      expect(fixture.yaml).toBeTruthy();
      expect(fixture.toml).toBeTruthy();
      const fromYaml = fromUndulateJSON(parseUndulateYAML(fixture.yaml!) as UndulateRoot);
      const fromToml = fromUndulateJSON(parseUndulateTOML(fixture.toml!) as UndulateRoot);
      expect(semanticCore(toUndulateJSON(fromYaml))).toEqual(semanticCore(jsonExport));
      expect(semanticCore(toUndulateJSON(fromToml))).toEqual(semanticCore(jsonExport));
    },
  );

  it.each(corpus.cases.filter((fixture) => fixture.kind === 'opaque'))(
    '$id preserves opaque fields and reports them',
    (fixture) => {
      const document = expandDocument(fixture.document) as UndulateRoot;
      const findings = validateUndulateFindings(document);
      expect(validateUndulateJSON(document)).toBeNull();
      for (const path of fixture.opaquePaths ?? []) {
        expect(findings.some((finding) => (
          finding.kind === 'opaque' && finding.path === path
        ))).toBe(true);
      }
      const diagram = fromUndulateJSON(document);
      const exported = toUndulateJSON(diagram);
      for (const path of fixture.opaquePaths ?? []) {
        const match = path.match(/^signal\[(\d+)\]\.(.+)$/);
        if (match) {
          const signal = exported.signal?.[Number(match[1])] as Record<string, unknown>;
          expect(signal?.[match[2]!]).toEqual(
            (document.signal as Array<Record<string, unknown>>)[Number(match[1])]?.[match[2]!],
          );
        } else if (path.startsWith('config.')) {
          const field = path.slice('config.'.length);
          expect((exported.config as Record<string, unknown> | undefined)?.[field])
            .toEqual((document.config as Record<string, unknown> | undefined)?.[field]);
        } else {
          expect(exported).toMatchObject({
            [path]: (document as unknown as Record<string, unknown>)[path],
          });
        }
      }
      const report = undulateCompatibilityFindings(diagram);
      expect(report.some((finding) => finding.level === 'opaque')).toBe(true);
    },
  );

  it.each(corpus.cases.filter((fixture) => fixture.kind === 'reject'))(
    '$id rejects with an explicit finding',
    (fixture) => {
      const document = expandDocument(fixture.document);
      const findings = validateUndulateFindings(document);
      expect(validateUndulateJSON(document)).not.toBeNull();
      expect(findings.some((finding) => (
        finding.kind === fixture.expectedKind
        && (
          !fixture.expectedPath
          || finding.path === fixture.expectedPath
          || finding.path.startsWith(`${fixture.expectedPath}`)
          || finding.message.includes(fixture.expectedPath)
        )
      ))).toBe(true);
    },
  );

  it('strict upstream export strips app metadata and resolves expressions', () => {
    const root: UndulateRoot = {
      signal: [{
        name: "noise",
        wave: 'ss',
        analogue: ['0.5*VDDA', 'rnd()*VDDA'],
      }],
      'x-waves-gui': {
        analogueContext: { vssa: 0, vdda: 1.8 },
        randomSeed: 42,
      },
    };
    const diagram = fromUndulateJSON(root);
    const saved = toUndulateJSON(diagram);
    expect(saved['x-waves-gui']).toEqual(root['x-waves-gui']);
    expect((saved.signal[0] as { analogue?: unknown[] }).analogue)
      .toEqual(['0.5*VDDA', 'rnd()*VDDA']);
    const strict = toUndulateJSON(diagram, { includeAppMetadata: false });
    expect(strict['x-waves-gui']).toBeUndefined();
    const values = (strict.signal[0] as { analogue?: unknown[] }).analogue;
    expect(values?.[0]).toBeCloseTo(0.9);
    expect(typeof values?.[1]).toBe('number');
  });
});
