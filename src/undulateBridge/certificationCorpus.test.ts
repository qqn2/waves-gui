// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildSVGString } from '../exportEngine/exportSVG';
import {
  normalizeUndulateColor,
  parseAnnotationFontSize,
} from '../shared/annotations';
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
import { normalizeUndulateEdge } from './edges';
import { UNDULATE_TARGET_REVISION } from './validation';
import { decodeWaveString } from '../wavedromBridge';

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

function canonicalizeStyle(record: Record<string, unknown>): void {
  const fill = normalizeUndulateColor(record.fill);
  const stroke = normalizeUndulateColor(record.stroke)
    ?? normalizeUndulateColor(record.color);
  if (fill !== undefined) record.fill = fill;
  if (stroke !== undefined) record.stroke = stroke;
  delete record.color;
  const fontSize = parseAnnotationFontSize(record['font-size']);
  if (fontSize !== undefined) record['font-size'] = `${fontSize}px`;
}

/**
 * Canonical transformations are intentionally explicit here. This keeps the
 * first import/export assertion independent from the bridge output, so a field
 * dropped on that first pass cannot be hidden by comparing two lossy exports.
 */
function flatSignalRecords(entries: unknown[]): Array<Record<string, unknown>> {
  return entries.flatMap((entry) => (
    Array.isArray(entry)
      ? flatSignalRecords(entry.slice(1))
      : entry && typeof entry === 'object'
        ? [entry as Record<string, unknown>]
        : []
  ));
}

function expectFirstExportToRetainSource(
  source: UndulateRoot,
  exported: UndulateRoot,
): void {
  const sourceSignals = flatSignalRecords(source.signal ?? []);
  const exportedSignals = flatSignalRecords(exported.signal ?? []);
  expect(exportedSignals).toHaveLength(sourceSignals.length);
  sourceSignals.forEach((rawSource, index) => {
    const expected = JSON.parse(JSON.stringify(rawSource)) as Record<string, unknown>;
    canonicalizeStyle(expected);
    const actual = exportedSignals[index]!;
    for (const [field, value] of Object.entries(expected)) {
      if (field === 'wave' && typeof value === 'string') {
        const sourceStates = decodeWaveString(value);
        expect(decodeWaveString(String(actual.wave)).slice(0, sourceStates.length))
          .toEqual(sourceStates);
      } else if (field === 'data' && Array.isArray(value)) {
        for (const label of value) expect(actual.data).toContain(label);
      } else if (
        (field === 'periods' || field === 'duty_cycles')
        && Array.isArray(value)
      ) {
        expect((actual[field] as unknown[]).slice(0, value.length)).toEqual(value);
      } else {
        expect(actual[field], `signal[${index}].${field}`).toEqual(value);
      }
    }
  });

  for (const [field, value] of Object.entries(source.config ?? {})) {
    expect((exported.config as Record<string, unknown> | undefined)?.[field])
      .toEqual(value);
  }
  if (source.head) expect(exported.head).toMatchObject(source.head);
  if (source.foot) expect(exported.foot).toMatchObject(source.foot);
  const sourceEdges = source.edges ?? source.edge;
  if (sourceEdges) {
    expect(exported.edges).toEqual(sourceEdges.map((edge) => normalizeUndulateEdge(edge)));
  }
  const expectedAnnotations = JSON.parse(
    JSON.stringify(source.annotations ?? []),
  ) as Array<Record<string, unknown>>;
  expectedAnnotations.forEach(canonicalizeStyle);
  expect(exported.annotations ?? []).toEqual(expectedAnnotations);
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
      expectFirstExportToRetainSource(document, exported);
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
