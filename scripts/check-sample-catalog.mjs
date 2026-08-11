import { access, readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadValidatedSamples, validationReference, validationReviewNote } from './validated-samples.mjs';

const EXPECTED_SCHEMA_VERSION = 1;
const EXPECTED_CATALOG_VERSION = 'v1';
const EXPECTED_CURRICULUM_COUNT = 832;

const CANONICAL_SHARDS = new Map([
  ['fundamentals', [1, 32]],
  ['clocking-reset', [33, 54]],
  ['cdc', [55, 80]],
  ['buffering', [81, 100]],
  ['amba', [101, 192]],
  ['axi-stream-other-buses', [193, 235]],
  ['cache-coherency-noc', [236, 310]],
  ['memory-ddr', [311, 364]],
  ['serial-peripherals', [365, 515]],
  ['pcie-chiplets', [516, 579]],
  ['networking-media', [580, 647]],
  ['power-security-safety', [648, 695]],
  ['firmware-verification-stress', [696, 832]],
]);

const CONTENT_STATUSES = new Set([
  'index-only',
  'draft',
  'reviewed',
  'featured',
  'deprecated',
]);
const TIERS = new Set(['essential', 'intermediate', 'advanced', 'failure', 'stress']);
const CONTENT_KINDS = new Set(['lesson', 'study', 'fixture', 'stress']);
const ASSET_FORMATS = new Set([
  'wavedrom-json',
  'undulate-json',
  'undulate-yaml',
  'undulate-toml',
]);
const ASSET_SUPPORT = new Set(['supported', 'future']);
const FORMAT_EXTENSIONS = new Map([
  ['wavedrom-json', new Set(['.json'])],
  ['undulate-json', new Set(['.json', '.jsonml'])],
  ['undulate-yaml', new Set(['.yaml', '.yml'])],
  ['undulate-toml', new Set(['.toml'])],
]);
const RELATIONSHIP_FIELDS = ['prerequisites', 'next', 'pairWith'];

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function addError(errors, location, message) {
  errors.push(`${location}: ${message}`);
}

async function readJson(file, location, errors) {
  let source;
  try {
    source = await readFile(file, 'utf8');
  } catch (error) {
    addError(errors, location, `cannot read ${file}: ${error.message}`);
    return null;
  }
  try {
    return JSON.parse(source);
  } catch (error) {
    addError(errors, location, `invalid JSON in ${file}: ${error.message}`);
    return null;
  }
}

function validateVersion(document, location, index, errors) {
  if (document.schemaVersion !== EXPECTED_SCHEMA_VERSION) {
    addError(
      errors,
      location,
      `schemaVersion must be ${EXPECTED_SCHEMA_VERSION}, got ${JSON.stringify(document.schemaVersion)}`,
    );
  }
  if (document.catalogVersion !== EXPECTED_CATALOG_VERSION) {
    addError(
      errors,
      location,
      `catalogVersion must be ${JSON.stringify(EXPECTED_CATALOG_VERSION)}, got ${JSON.stringify(document.catalogVersion)}`,
    );
  }
  if (
    index &&
    (document.schemaVersion !== index.schemaVersion ||
      document.catalogVersion !== index.catalogVersion)
  ) {
    addError(errors, location, 'schema/catalog versions do not match catalog.v1.json');
  }
}

function validateStringArray(entry, field, location, errors) {
  const value = entry[field];
  if (!Array.isArray(value)) {
    addError(errors, location, `${field} must be an array of IDs`);
    return [];
  }
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    if (!isNonEmptyString(item)) {
      addError(errors, location, `${field}[${index}] must be a non-empty string`);
    } else if (seen.has(item)) {
      addError(errors, location, `${field} contains duplicate target ${JSON.stringify(item)}`);
    } else {
      seen.add(item);
    }
  }
  return value.filter(isNonEmptyString);
}

function validateNullableString(value, field, location, errors) {
  if (value !== null && typeof value !== 'string') {
    addError(errors, location, `${field} must be a string or null`);
  }
}

function validateReference(reference, location, errors) {
  if (!isObject(reference)) {
    addError(errors, location, 'reference must be an object');
    return;
  }
  if (!isNonEmptyString(reference.name)) {
    addError(errors, location, 'name must be a non-empty string');
  }
  for (const field of ['edition', 'section']) {
    validateNullableString(reference[field], field, location, errors);
  }
  if (Object.hasOwn(reference, 'url')) validateNullableString(reference.url, 'url', location, errors);
}

function validateRelativePath(path, location, samplesDir, errors) {
  if (!isNonEmptyString(path)) {
    addError(errors, location, 'must be a non-empty relative path');
    return null;
  }
  if (isAbsolute(path) || path.includes('\\')) {
    addError(errors, location, 'must use a relative forward-slash path');
    return null;
  }
  const resolved = resolve(samplesDir, path);
  const rel = relative(samplesDir, resolved);
  if (rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    addError(errors, location, 'escapes public/samples');
    return null;
  }
  return resolved;
}

async function requireRegularFile(file, location, errors) {
  if (!file) return;
  try {
    await access(file);
    if (!(await stat(file)).isFile()) addError(errors, location, 'does not name a regular file');
  } catch {
    addError(errors, location, `declared file does not exist: ${file}`);
  }
}

function validateEntrySchema(entry, location, descriptor, errors) {
  if (!isObject(entry)) {
    addError(errors, location, 'entry must be an object');
    return;
  }
  for (const field of ['id', 'slug', 'title', 'description', 'shardId']) {
    if (!isNonEmptyString(entry[field])) addError(errors, location, `${field} must be a non-empty string`);
  }
  if (isNonEmptyString(entry.slug) && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.slug)) {
    addError(errors, location, `slug is not canonical kebab-case: ${JSON.stringify(entry.slug)}`);
  }
  if (entry.sourceNumber !== null && !Number.isInteger(entry.sourceNumber)) {
    addError(errors, location, 'sourceNumber must be an integer or null');
  }
  if (entry.shardId !== descriptor.id) {
    addError(
      errors,
      location,
      `shardId ${JSON.stringify(entry.shardId)} does not match containing shard ${JSON.stringify(descriptor.id)}`,
    );
  }
  if (!TIERS.has(entry.tier)) addError(errors, location, `unsupported tier ${JSON.stringify(entry.tier)}`);
  if (!CONTENT_STATUSES.has(entry.contentStatus)) {
    addError(errors, location, `unsupported contentStatus ${JSON.stringify(entry.contentStatus)}`);
  }
  if (!CONTENT_KINDS.has(entry.contentKind)) {
    addError(errors, location, `unsupported contentKind ${JSON.stringify(entry.contentKind)}`);
  }
  for (const field of ['protocols', 'concepts', 'waveformFeatures', 'reviewNotes', 'tags']) {
    validateStringArray(entry, field, location, errors);
  }
  if (!Array.isArray(entry.references)) {
    addError(errors, location, 'references must be an array');
  } else {
    entry.references.forEach((reference, index) =>
      validateReference(reference, `${location}.references[${index}]`, errors),
    );
  }
  for (const field of RELATIONSHIP_FIELDS) validateStringArray(entry, field, location, errors);
  for (const field of ['owner', 'lastReviewed', 'artifactPrompt']) {
    validateNullableString(entry[field], field, location, errors);
  }
  if (Number.isInteger(entry.sourceNumber)) {
    if (!isObject(entry.sourceRecord)) {
      addError(errors, location, 'curriculum entries require sourceRecord');
    } else {
      for (const field of ['document', 'title']) {
        if (!isNonEmptyString(entry.sourceRecord[field])) {
          addError(errors, `${location}.sourceRecord`, `${field} must be a non-empty string`);
        }
      }
      if (!Array.isArray(entry.sourceRecord.body)) {
        addError(errors, `${location}.sourceRecord`, 'body must be a string array');
      } else if (entry.sourceRecord.body.some((line) => typeof line !== 'string')) {
        addError(errors, `${location}.sourceRecord`, 'body must contain only strings');
      }
    }
  } else {
    if (entry.sourceNumber !== null) addError(errors, location, 'sourceNumber must be an integer or null');
    if (entry.sourceRecord !== null) {
      addError(errors, location, 'non-curriculum entries must have sourceRecord=null');
    }
  }

  if (entry.contentStatus === 'index-only') {
    if (Object.hasOwn(entry, 'asset')) addError(errors, location, 'index-only entries must omit asset');
    if (entry.lastReviewed !== null) {
      addError(errors, location, 'index-only entries must have lastReviewed=null');
    }
  }
  if (entry.contentStatus === 'draft' && !isObject(entry.asset)) {
    addError(errors, location, 'draft entries must declare an asset');
  }
  if (entry.contentStatus === 'draft' && entry.lastReviewed !== null) {
    addError(errors, location, 'draft entries must have lastReviewed=null');
  }
  if (entry.contentStatus === 'reviewed' || entry.contentStatus === 'featured') {
    if (!isObject(entry.asset)) addError(errors, location, 'reviewed/featured entries require an asset');
    if (!isNonEmptyString(entry.owner)) addError(errors, location, 'reviewed/featured entries require owner');
    if (!isNonEmptyString(entry.lastReviewed) || Number.isNaN(Date.parse(entry.lastReviewed))) {
      addError(errors, location, 'reviewed/featured entries require a valid lastReviewed date');
    }
    if (!Array.isArray(entry.references) || entry.references.length === 0) {
      addError(errors, location, 'reviewed/featured entries require references');
    }
    if (
      !Array.isArray(entry.reviewNotes) || entry.reviewNotes.length === 0
    ) {
      addError(errors, location, 'reviewed/featured entries require reviewNotes');
    }
  }
}

function collectAliases(index, shards, errors) {
  const aliases = new Map();
  const consume = (value, location) => {
    if (value === undefined) return;
    if (isObject(value)) {
      for (const [alias, target] of Object.entries(value)) {
        if (!isNonEmptyString(alias) || !isNonEmptyString(target)) {
          addError(errors, location, 'alias map keys and targets must be non-empty strings');
        } else if (aliases.has(alias)) {
          addError(errors, location, `duplicate alias ${JSON.stringify(alias)}`);
        } else {
          aliases.set(alias, target);
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      for (const [i, item] of value.entries()) {
        if (!isObject(item) || !isNonEmptyString(item.alias) || !isNonEmptyString(item.target)) {
          addError(errors, `${location}[${i}]`, 'must contain non-empty alias and target strings');
        } else if (aliases.has(item.alias)) {
          addError(errors, `${location}[${i}]`, `duplicate alias ${JSON.stringify(item.alias)}`);
        } else {
          aliases.set(item.alias, item.target);
        }
      }
      return;
    }
    addError(errors, location, 'aliases must be an object map or array');
  };
  consume(index.aliases, 'catalog.aliases');
  for (const { descriptor, document } of shards) {
    consume(document.aliases, `shard ${descriptor.id}.aliases`);
    for (const [i, entry] of document.entries.entries()) {
      if (entry.aliases === undefined) continue;
      if (!Array.isArray(entry.aliases)) {
        addError(errors, `shard ${descriptor.id}.entries[${i}]`, 'aliases must be an array');
        continue;
      }
      for (const alias of entry.aliases) {
        if (!isNonEmptyString(alias)) {
          addError(errors, `shard ${descriptor.id}.entries[${i}]`, 'aliases must contain strings');
        } else if (aliases.has(alias)) {
          addError(errors, `shard ${descriptor.id}.entries[${i}]`, `duplicate alias ${JSON.stringify(alias)}`);
        } else {
          aliases.set(alias, entry.id);
        }
      }
    }
  }
  return aliases;
}

function validateRelationships(entriesById, aliases, errors) {
  const resolveTarget = (id) => {
    const visited = new Set();
    let current = id;
    while (aliases.has(current)) {
      if (visited.has(current)) return { cycle: [...visited, current] };
      visited.add(current);
      current = aliases.get(current);
    }
    return { id: current };
  };

  for (const alias of aliases.keys()) {
    if (entriesById.has(alias)) addError(errors, `alias ${alias}`, 'collides with an entry ID');
    const resolved = resolveTarget(alias);
    if (resolved.cycle) {
      addError(errors, `alias ${alias}`, `alias cycle: ${resolved.cycle.join(' -> ')}`);
    } else if (!entriesById.has(resolved.id)) {
      addError(errors, `alias ${alias}`, `target does not resolve to an entry: ${resolved.id}`);
    }
  }

  for (const entry of entriesById.values()) {
    for (const field of RELATIONSHIP_FIELDS) {
      for (const target of Array.isArray(entry[field]) ? entry[field] : []) {
        const resolved = resolveTarget(target);
        if (resolved.cycle || !entriesById.has(resolved.id)) {
          addError(errors, `entry ${entry.id}.${field}`, `unknown target ${JSON.stringify(target)}`);
        }
        if (field === 'pairWith' && resolved.id === entry.id) {
          addError(errors, `entry ${entry.id}.pairWith`, 'self-pairs are not allowed');
        }
      }
    }
  }

  for (const entry of entriesById.values()) {
    for (const target of Array.isArray(entry.pairWith) ? entry.pairWith : []) {
      const resolved = resolveTarget(target);
      const peer = entriesById.get(resolved.id);
      if (!peer) continue;
      const peerTargets = new Set(
        (Array.isArray(peer.pairWith) ? peer.pairWith : []).map((id) => resolveTarget(id).id),
      );
      if (!peerTargets.has(entry.id)) {
        addError(
          errors,
          `entry ${entry.id}.pairWith`,
          `pair with ${peer.id} is not symmetric`,
        );
      }
    }
  }
}

export async function validateSampleCatalog(options = {}) {
  const rootDir = resolve(options.rootDir ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
  const publicDir = resolve(rootDir, 'public');
  const samplesDir = resolve(publicDir, 'samples');
  const indexFile = resolve(options.indexFile ?? resolve(samplesDir, 'catalog.v1.json'));
  const errors = [];
  let validatedSamples = new Map();
  try {
    validatedSamples = await loadValidatedSamples({ rootDir });
  } catch (error) {
    addError(errors, 'validated samples', error.message);
  }
  const index = await readJson(indexFile, 'catalog', errors);
  if (!isObject(index)) {
    if (index !== null) addError(errors, 'catalog', 'root must be an object');
    return { errors, stats: null };
  }
  validateVersion(index, 'catalog', null, errors);
  if (!Array.isArray(index.shards)) {
    addError(errors, 'catalog', 'shards must be an array');
    return { errors, stats: null };
  }
  if (index.curriculumCount !== EXPECTED_CURRICULUM_COUNT) {
    addError(errors, 'catalog', `curriculumCount must be ${EXPECTED_CURRICULUM_COUNT}`);
  }
  if (index.shardCount !== index.shards.length) {
    addError(errors, 'catalog', `shardCount ${index.shardCount} does not match ${index.shards.length} descriptors`);
  }

  const shardIds = new Set();
  const shardDocuments = [];
  for (const [i, descriptor] of index.shards.entries()) {
    const location = `catalog.shards[${i}]`;
    if (!isObject(descriptor)) {
      addError(errors, location, 'must be an object');
      continue;
    }
    for (const field of ['id', 'label', 'path']) {
      if (!isNonEmptyString(descriptor[field])) addError(errors, location, `${field} must be a non-empty string`);
    }
    if (shardIds.has(descriptor.id)) addError(errors, location, `duplicate shard ID ${descriptor.id}`);
    shardIds.add(descriptor.id);
    const expectedRange = CANONICAL_SHARDS.get(descriptor.id);
    if (!expectedRange) {
      addError(errors, location, `unknown canonical shard ${JSON.stringify(descriptor.id)}`);
    } else if (
      !isObject(descriptor.sourceNumberRange) ||
      descriptor.sourceNumberRange.start !== expectedRange[0] ||
      descriptor.sourceNumberRange.end !== expectedRange[1]
    ) {
      addError(errors, location, `sourceNumberRange must be ${expectedRange[0]}..${expectedRange[1]}`);
    }
    const shardFile = validateRelativePath(descriptor.path, `${location}.path`, samplesDir, errors);
    const document = shardFile ? await readJson(shardFile, `shard ${descriptor.id}`, errors) : null;
    if (!isObject(document)) continue;
    validateVersion(document, `shard ${descriptor.id}`, index, errors);
    if (!isObject(document.shard)) {
      addError(errors, `shard ${descriptor.id}`, 'shard descriptor must be an object');
    } else {
      for (const field of ['id', 'path', 'curriculumCount', 'entryCount', 'assetEntryCount']) {
        if (document.shard[field] !== descriptor[field]) {
          addError(errors, `shard ${descriptor.id}`, `embedded descriptor ${field} does not match index`);
        }
      }
    }
    if (!Array.isArray(document.entries)) {
      addError(errors, `shard ${descriptor.id}`, 'entries must be an array');
      continue;
    }
    shardDocuments.push({ descriptor, document });
  }
  for (const id of CANONICAL_SHARDS.keys()) {
    if (!shardIds.has(id)) addError(errors, 'catalog', `missing canonical shard ${id}`);
  }

  const entriesById = new Map();
  const sourceNumbers = new Map();
  const shardSlugs = new Set();
  const previewNames = new Map();
  let assetCount = 0;
  for (const { descriptor, document } of shardDocuments) {
    let shardCurriculumCount = 0;
    let shardAssetCount = 0;
    for (const [i, entry] of document.entries.entries()) {
      const location = `shard ${descriptor.id}.entries[${i}]`;
      validateEntrySchema(entry, location, descriptor, errors);
      if (!isObject(entry)) continue;
      if (isNonEmptyString(entry.id)) {
        if (entriesById.has(entry.id)) addError(errors, location, `duplicate ID ${JSON.stringify(entry.id)}`);
        else entriesById.set(entry.id, entry);
      }
      if (entry.sourceNumber !== null && Number.isInteger(entry.sourceNumber)) {
        shardCurriculumCount += 1;
        if (sourceNumbers.has(entry.sourceNumber)) {
          addError(errors, location, `duplicate sourceNumber ${entry.sourceNumber}`);
        } else {
          sourceNumbers.set(entry.sourceNumber, entry.id);
        }
        const expectedRange = CANONICAL_SHARDS.get(descriptor.id);
        if (
          !expectedRange ||
          entry.sourceNumber < expectedRange[0] ||
          entry.sourceNumber > expectedRange[1]
        ) {
          addError(errors, location, `sourceNumber ${entry.sourceNumber} is outside canonical shard range`);
        }
      }
      if (isNonEmptyString(entry.slug)) {
        const key = `${descriptor.id}/${entry.slug}`;
        if (shardSlugs.has(key)) addError(errors, location, `duplicate (shardId, slug) ${key}`);
        shardSlugs.add(key);
      }
      if (isObject(entry.asset)) {
        assetCount += 1;
        shardAssetCount += 1;
        if (!ASSET_FORMATS.has(entry.asset.format)) {
          addError(errors, `${location}.asset`, `unsupported format ${JSON.stringify(entry.asset.format)}`);
        }
        if (!isNonEmptyString(entry.asset.previewVersion)) {
          addError(errors, `${location}.asset`, 'previewVersion must be a non-empty string');
        }
        if (entry.asset.support !== undefined && !ASSET_SUPPORT.has(entry.asset.support)) {
          addError(errors, `${location}.asset`, `unsupported support value ${JSON.stringify(entry.asset.support)}`);
        }
        if (entry.asset.supportNote !== undefined) {
          validateNullableString(entry.asset.supportNote, 'supportNote', `${location}.asset`, errors);
        }
        if (entry.asset.support === 'future' && !isNonEmptyString(entry.asset.supportNote)) {
          addError(errors, `${location}.asset`, 'future support requires a non-empty supportNote');
        }
        for (const obsoleteField of ['url', 'previews']) {
          if (Object.hasOwn(entry.asset, obsoleteField)) {
            addError(
              errors,
              `${location}.asset`,
              `${obsoleteField} is not allowed; asset locations are derived from path`,
            );
          }
        }
        const assetFile = validateRelativePath(entry.asset.path, `${location}.asset.path`, samplesDir, errors);
        if (isNonEmptyString(entry.asset.path) && ASSET_FORMATS.has(entry.asset.format)) {
          const extension = entry.asset.path.slice(entry.asset.path.lastIndexOf('.')).toLowerCase();
          if (!FORMAT_EXTENSIONS.get(entry.asset.format).has(extension)) {
            addError(
              errors,
              `${location}.asset.path`,
              `extension ${JSON.stringify(extension)} is incompatible with ${entry.asset.format}`,
            );
          }
        }
        await requireRegularFile(assetFile, `${location}.asset.path`, errors);
        if (isNonEmptyString(entry.asset.path)) {
          for (const theme of ['light', 'dark']) {
            const previewPath = `previews/${entry.asset.path.replace(/\.[^.]+$/i, `.${theme}.svg`)}`;
            const previewFile = validateRelativePath(
              previewPath,
              `${location}.asset preview ${theme}`,
              samplesDir,
              errors,
            );
            await requireRegularFile(previewFile, `${location}.asset preview ${theme}`, errors);
            if (previewNames.has(previewPath)) {
                addError(
                  errors,
                  `${location}.asset preview ${theme}`,
                  `preview collision with ${previewNames.get(previewPath)}`,
                );
            } else {
              previewNames.set(previewPath, entry.id);
            }
          }
        }
      }
    }
    if (descriptor.entryCount !== document.entries.length) {
      addError(errors, `shard ${descriptor.id}`, `entryCount ${descriptor.entryCount} does not match ${document.entries.length}`);
    }
    if (descriptor.curriculumCount !== shardCurriculumCount) {
      addError(errors, `shard ${descriptor.id}`, `curriculumCount ${descriptor.curriculumCount} does not match ${shardCurriculumCount}`);
    }
    if (descriptor.assetEntryCount !== shardAssetCount) {
      addError(errors, `shard ${descriptor.id}`, `assetEntryCount ${descriptor.assetEntryCount} does not match ${shardAssetCount}`);
    }
  }

  for (let number = 1; number <= EXPECTED_CURRICULUM_COUNT; number += 1) {
    if (!sourceNumbers.has(number)) addError(errors, 'catalog', `missing curriculum sourceNumber ${number}`);
  }
  for (const number of sourceNumbers.keys()) {
    if (number < 1 || number > EXPECTED_CURRICULUM_COUNT) {
      addError(errors, 'catalog', `sourceNumber ${number} is outside 1..${EXPECTED_CURRICULUM_COUNT}`);
    }
  }
  if (index.entryCount !== entriesById.size) {
    addError(errors, 'catalog', `entryCount ${index.entryCount} does not match ${entriesById.size}`);
  }
  if (index.assetEntryCount !== assetCount) {
    addError(errors, 'catalog', `assetEntryCount ${index.assetEntryCount} does not match ${assetCount}`);
  }
  if (index.entryCount !== index.shards.reduce((sum, shard) => sum + (shard.entryCount ?? 0), 0)) {
    addError(errors, 'catalog', 'entryCount does not equal the sum of shard entryCount values');
  }
  if (index.assetEntryCount !== index.shards.reduce((sum, shard) => sum + (shard.assetEntryCount ?? 0), 0)) {
    addError(errors, 'catalog', 'assetEntryCount does not equal the sum of shard assetEntryCount values');
  }
  if (index.curriculumCount !== index.shards.reduce((sum, shard) => sum + (shard.curriculumCount ?? 0), 0)) {
    addError(errors, 'catalog', 'curriculumCount does not equal the sum of shard curriculumCount values');
  }

  const aliases = collectAliases(index, shardDocuments, errors);
  validateRelationships(entriesById, aliases, errors);

  for (const [target, validation] of validatedSamples) {
    const isCurriculum = typeof target === 'number';
    const entryId = isCurriculum ? sourceNumbers.get(target) : target;
    const entry = entryId === undefined ? undefined : entriesById.get(entryId);
    const location = `validated samples ${isCurriculum ? `sourceNumber ${target}` : `legacyId ${target}`}`;
    if (entry === undefined) {
      addError(errors, location, `does not resolve to a generated ${isCurriculum ? 'curriculum' : 'legacy'} entry`);
      continue;
    }
    if (!isCurriculum && entry.sourceNumber !== null) {
      addError(errors, location, 'must resolve to a non-curriculum legacy entry');
    }
    if (entry.contentStatus !== validation.status) {
      addError(errors, location, `generated status must be ${validation.status}`);
    }
    if (validation.asset !== undefined && (!isObject(entry.asset)
      || entry.asset.path !== validation.asset.path
      || entry.asset.format !== validation.asset.format)) {
      addError(errors, location, 'generated asset path and format must match the validation registry');
    }
    if (entry.owner !== validation.reviewedBy || entry.lastReviewed !== validation.reviewedOn) {
      addError(errors, location, 'generated reviewer and review date must match the validation registry');
    }
    const expectedReference = validationReference(validation);
    if (!Array.isArray(entry.references) || !entry.references.some((reference) =>
      isObject(reference)
      && reference.name === expectedReference.name
      && reference.edition === expectedReference.edition
      && reference.section === expectedReference.section,
    )) {
      addError(errors, location, 'generated validation evidence reference is missing');
    }
    const expectedNote = validationReviewNote(validation);
    if (!Array.isArray(entry.reviewNotes) || !entry.reviewNotes.includes(expectedNote)) {
      addError(errors, location, 'generated validation review note is missing');
    }
  }

  return {
    errors,
    stats: {
      entries: entriesById.size,
      curriculumEntries: sourceNumbers.size,
      assetEntries: assetCount,
      shards: shardDocuments.length,
    },
  };
}

export async function runSampleCatalogCheck(options = {}) {
  const result = await validateSampleCatalog(options);
  if (result.errors.length > 0) {
    console.error(`Sample catalog validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) console.error(`- ${error}`);
    return 1;
  }
  const { entries, curriculumEntries, assetEntries, shards } = result.stats;
  console.log(
    `Sample catalog valid: ${entries} entries (${curriculumEntries} curriculum, ${assetEntries} assets) across ${shards} shards.`,
  );
  return 0;
}

const isCli = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCli) process.exitCode = await runSampleCatalogCheck();
