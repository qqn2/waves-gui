import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DRAFT_REGISTRY_SCHEMA_VERSION = 1;
export const DRAFT_REGISTRY_CATALOG_VERSION = 'v1';
export const DRAFT_REGISTRY_RELATIVE_PATH = 'public/samples/draft-samples.v1.json';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ASSET_FORMATS = new Set([
  'wavedrom-json',
  'undulate-json',
  'undulate-yaml',
  'undulate-toml',
]);

function fail(path, message) {
  throw new Error(`Draft sample registry ${path}: ${message}`);
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

function parseEntry(value, index) {
  const path = `entries[${index}]`;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(path, 'must be an object');
  }
  for (const field of Object.keys(value)) {
    if (field !== 'sourceNumber' && field !== 'asset') {
      fail(`${path}.${field}`, 'is not allowed; draft records only declare sourceNumber and asset');
    }
  }
  if (!Number.isInteger(value.sourceNumber) || value.sourceNumber < 1 || value.sourceNumber > 832) {
    fail(`${path}.sourceNumber`, 'must be an integer in 1..832');
  }
  if (value.asset === null || typeof value.asset !== 'object' || Array.isArray(value.asset)) {
    fail(`${path}.asset`, 'must be an object');
  }
  for (const field of Object.keys(value.asset)) {
    if (field !== 'path' && field !== 'format') {
      fail(`${path}.asset.${field}`, 'is not allowed; drafts only declare path and format');
    }
  }
  const assetPath = safeRelativePath(value.asset.path, `${path}.asset.path`);
  const format = nonEmptyString(value.asset.format, `${path}.asset.format`);
  if (!ASSET_FORMATS.has(format)) {
    fail(`${path}.asset.format`, `unsupported format ${JSON.stringify(format)}`);
  }
  return {
    sourceNumber: value.sourceNumber,
    asset: { path: assetPath, format },
  };
}

/**
 * Read the human-maintained local draft registry. It only grants a curriculum
 * entry an asset and the `draft` lifecycle state; it cannot supply review
 * metadata or promote an entry. `validated-samples.v1.json` intentionally
 * overrides a same-number draft during catalog generation.
 */
export async function loadDraftSamples(options = {}) {
  const rootDir = resolve(options.rootDir ?? ROOT);
  const registryFile = resolve(options.registryFile ?? resolve(rootDir, DRAFT_REGISTRY_RELATIVE_PATH));
  let text;
  try {
    text = await readFile(registryFile, 'utf8');
  } catch (error) {
    if (error?.code === 'ENOENT' && options.allowMissing !== false) return new Map();
    throw new Error(`Could not read draft sample registry ${registryFile}: ${error.message}`);
  }

  let document;
  try {
    document = JSON.parse(text);
  } catch (error) {
    throw new Error(`Draft sample registry ${registryFile} contains invalid JSON: ${error.message}`);
  }
  if (document === null || typeof document !== 'object' || Array.isArray(document)) {
    fail('root', 'must be an object');
  }
  if (document.schemaVersion !== DRAFT_REGISTRY_SCHEMA_VERSION) {
    fail('schemaVersion', `must be ${DRAFT_REGISTRY_SCHEMA_VERSION}`);
  }
  if (document.catalogVersion !== DRAFT_REGISTRY_CATALOG_VERSION) {
    fail('catalogVersion', `must be ${JSON.stringify(DRAFT_REGISTRY_CATALOG_VERSION)}`);
  }
  if (!Array.isArray(document.entries)) fail('entries', 'must be an array');

  const records = new Map();
  for (const [index, value] of document.entries.entries()) {
    const record = parseEntry(value, index);
    if (records.has(record.sourceNumber)) {
      fail(`entries[${index}].sourceNumber`, `duplicates sourceNumber ${record.sourceNumber}`);
    }
    records.set(record.sourceNumber, record);
  }
  return records;
}
