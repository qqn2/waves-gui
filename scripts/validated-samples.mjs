import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VALIDATION_REGISTRY_SCHEMA_VERSION = 1;
export const VALIDATION_REGISTRY_CATALOG_VERSION = 'v1';
export const VALIDATION_REGISTRY_RELATIVE_PATH = 'public/samples/validated-samples.v1.json';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ASSET_FORMATS = new Set([
  'wavedrom-json',
  'undulate-json',
  'undulate-yaml',
  'undulate-toml',
]);
const REVIEW_STATUSES = new Set(['reviewed', 'featured']);
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(path, message) {
  throw new Error(`Validated sample registry ${path}: ${message}`);
}

function nonEmptyString(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail(path, 'must be a non-empty string');
  }
  return value.trim();
}

function safeRelativePath(value, path) {
  const parsed = nonEmptyString(value, path);
  if (
    parsed.includes('\\')
    || parsed.startsWith('/')
    || parsed.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    fail(path, 'must be a safe relative forward-slash path');
  }
  return parsed;
}

function reviewDate(value, path) {
  const parsed = nonEmptyString(value, path);
  const date = new Date(`${parsed}T00:00:00Z`);
  if (!ISO_DATE.test(parsed) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== parsed) {
    fail(path, 'must use a valid YYYY-MM-DD date');
  }
  return parsed;
}

function legacyId(value, path) {
  const parsed = nonEmptyString(value, path);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/.test(parsed)) {
    fail(path, 'must be a stable slash-separated legacy sample ID');
  }
  return parsed;
}

function parseEntry(value, index) {
  const path = `entries[${index}]`;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  const hasSourceNumber = Object.hasOwn(value, 'sourceNumber');
  const hasLegacyId = Object.hasOwn(value, 'legacyId');
  if (hasSourceNumber === hasLegacyId) {
    fail(path, 'must target exactly one of sourceNumber or legacyId');
  }

  let target;
  let asset;
  if (hasSourceNumber) {
    if (!Number.isInteger(value.sourceNumber) || value.sourceNumber < 1 || value.sourceNumber > 832) {
      fail(`${path}.sourceNumber`, 'must be an integer in 1..832');
    }
    if (value.asset === null || typeof value.asset !== 'object' || Array.isArray(value.asset)) {
      fail(`${path}.asset`, 'must be an object');
    }
    const assetPath = safeRelativePath(value.asset.path, `${path}.asset.path`);
    const format = nonEmptyString(value.asset.format, `${path}.asset.format`);
    if (!ASSET_FORMATS.has(format)) {
      fail(`${path}.asset.format`, `unsupported format ${JSON.stringify(format)}`);
    }
    target = value.sourceNumber;
    asset = { path: assetPath, format };
  } else {
    if (Object.hasOwn(value, 'asset')) {
      fail(`${path}.asset`, 'must be omitted for a legacyId; the frozen bundled asset mapping is authoritative');
    }
    target = legacyId(value.legacyId, `${path}.legacyId`);
  }
  const status = value.status === undefined ? 'reviewed' : nonEmptyString(value.status, `${path}.status`);
  if (!REVIEW_STATUSES.has(status)) {
    fail(`${path}.status`, 'must be "reviewed" or "featured"');
  }
  return {
    ...(hasSourceNumber ? { sourceNumber: target, asset } : { legacyId: target }),
    status,
    reviewedBy: nonEmptyString(value.reviewedBy, `${path}.reviewedBy`),
    reviewedOn: reviewDate(value.reviewedOn, `${path}.reviewedOn`),
    validationEvidence: nonEmptyString(value.validationEvidence, `${path}.validationEvidence`),
  };
}

/**
 * Read the human-maintained validation registry.  The returned map is keyed by
 * source number or frozen legacy ID, so catalog generation can promote the
 * matching entry without hand-editing generated manifest shards. Curriculum
 * records carry their asset because they introduce a new file. Legacy records
 * deliberately do not: their frozen PUBLISHED_SAMPLES mapping remains the
 * single source of truth for the already-published asset path and format.
 */
export async function loadValidatedSamples(options = {}) {
  const rootDir = resolve(options.rootDir ?? ROOT);
  const registryFile = resolve(options.registryFile ?? resolve(rootDir, VALIDATION_REGISTRY_RELATIVE_PATH));
  let text;
  try {
    text = await readFile(registryFile, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT' && options.allowMissing !== false) return new Map();
    throw new Error(`Could not read validated sample registry ${registryFile}: ${error.message}`);
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`Validated sample registry ${registryFile} contains invalid JSON: ${error.message}`);
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    fail('root', 'must be an object');
  }
  if (document.schemaVersion !== VALIDATION_REGISTRY_SCHEMA_VERSION) {
    fail('schemaVersion', `must be ${VALIDATION_REGISTRY_SCHEMA_VERSION}`);
  }
  if (document.catalogVersion !== VALIDATION_REGISTRY_CATALOG_VERSION) {
    fail('catalogVersion', `must be ${JSON.stringify(VALIDATION_REGISTRY_CATALOG_VERSION)}`);
  }
  if (!Array.isArray(document.entries)) fail('entries', 'must be an array');

  const records = new Map();
  for (const [index, value] of document.entries.entries()) {
    const record = parseEntry(value, index);
    const target = record.sourceNumber ?? record.legacyId;
    const targetField = record.sourceNumber === undefined ? 'legacyId' : 'sourceNumber';
    if (records.has(target)) {
      fail(`entries[${index}].${targetField}`, `duplicates ${targetField} ${JSON.stringify(target)}`);
    }
    records.set(target, record);
  }
  return records;
}

export function validationReference(record) {
  return {
    name: 'Validation evidence',
    edition: record.reviewedOn,
    section: record.validationEvidence,
  };
}

export function validationReviewNote(record) {
  return `Validated by ${record.reviewedBy} on ${record.reviewedOn}: ${record.validationEvidence}`;
}
