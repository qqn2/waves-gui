import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  CATALOG_VERSION,
  PUBLISHED_SAMPLES,
  SHARDS,
} from './sample-catalog-source.mjs';
import {
  loadValidatedSamples,
  validationReference,
  validationReviewNote,
} from './validated-samples.mjs';
import { loadDraftSamples } from './draft-samples.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'docs', 'SAMPLE_BROWSER_PHASE_2_FULL_CATALOG.md');
const outputRoot = path.join(root, 'public', 'samples');
const shardRoot = path.join(outputRoot, 'catalog');
const sourceDocument = 'docs/SAMPLE_BROWSER_PHASE_2_FULL_CATALOG.md';
const ADVANCED_STUDY_SHARDS = new Set([
  'cache-coherency-noc',
  'memory-ddr',
  'pcie-chiplets',
  'networking-media',
]);
const PROTOCOL_TAGS = new Set([
  'apb', 'ahb', 'axi', 'ddr', 'sram', 'spi', 'i²c', 'i3c', 'uart', 'can',
  'pcie', 'cxl', 'ucie', 'ethernet', 'usb', 'dma', 'iommu',
]);

const MOJIBAKE = new Map([
  ['\u00c2\u00b2', '²'],
  ['\u00e2\u20ac\u201d', '—'],
  ['\u00e2\u20ac\u0153', '“'],
  ['\u00e2\u20ac\u009d', '”'],
]);

function normalizeUiText(value) {
  let normalized = value;
  for (const [broken, repaired] of MOJIBAKE) normalized = normalized.split(broken).join(repaired);
  return normalized.normalize('NFC');
}

function slugify(value) {
  return normalizeUiText(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('en-US')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function stripMarkdown(value) {
  return normalizeUiText(value)
    .replace(/^[-*]\s+/, '')
    .replace(/^\*\*Authoring note:\*\*\s*/, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .trim();
}

function shardForNumber(sourceNumber) {
  const shard = SHARDS.find(({ start, end }) => sourceNumber >= start && sourceNumber <= end);
  if (!shard) throw new Error(`No canonical shard for sourceNumber ${sourceNumber}`);
  return shard;
}

function descriptionFromBody(body) {
  const candidates = body
    .filter((line) => /^[-*]\s+/.test(line))
    .filter((line) => !/^-\s+#+\s+/.test(line))
    .filter((line) => !/\*\*Source number:\*\*/.test(line))
    .filter((line) => !/\*\*Initial status:\*\*/.test(line))
    .map(stripMarkdown)
    .filter(Boolean);
  return candidates.join(' ');
}

function tagsFor(shard, title, description) {
  const tags = new Set([shard.id]);
  const text = `${title} ${description}`.toLocaleLowerCase('en-US');
  const tokens = new Set(text.match(/[a-z0-9²]+/g) ?? []);
  const concepts = [
    'clock', 'reset', 'cdc', 'fifo', 'buffer', 'apb', 'ahb', 'axi', 'cache',
    'coherency', 'noc', 'ddr', 'sram', 'spi', 'i²c', 'i3c', 'uart', 'can',
    'pcie', 'cxl', 'ucie', 'ethernet', 'usb', 'power', 'security', 'safety',
    'firmware', 'verification', 'dma', 'iommu', 'stress', 'failure',
  ];
  for (const concept of concepts) if (tokens.has(concept)) tags.add(concept);
  return [...tags];
}

function tierFor(shard, title, description) {
  const text = `${title} ${description}`.toLocaleLowerCase('en-US');
  if (/\b(illegal|incorrect|failure|violation|unsafe|underflow|overflow|deadlock|lost|error)\b/.test(text)) return 'failure';
  if (/\b(stress|regression|gallery|maximum-step|many lanes|many short|duplicate)\b/.test(text)) return 'stress';
  if (['cache-coherency-noc', 'memory-ddr', 'pcie-chiplets'].includes(shard.id)) return 'advanced';
  return 'intermediate';
}

function commonFields() {
  return {
    owner: null,
    lastReviewed: null,
    waveformFeatures: [],
    prerequisites: [],
    next: [],
    pairWith: [],
    references: [],
    artifactPrompt: null,
  };
}

function promoteValidatedEntry(entry, validation) {
  const reviewNotes = entry.reviewNotes.filter((note) =>
    note !== 'Planned curriculum entry; waveform and technical content have not been reviewed.'
    && note !== 'Draft waveform has been checked for internal timing and SVG rendering consistency; formal content review is still pending.',
  );
  return {
    ...entry,
    contentStatus: validation.status,
    owner: validation.reviewedBy,
    lastReviewed: validation.reviewedOn,
    reviewNotes: [...reviewNotes, validationReviewNote(validation)],
    references: [validationReference(validation)],
    asset: validation.asset === undefined
      ? entry.asset
      : {
        path: validation.asset.path,
        format: validation.asset.format,
        previewVersion: 'v1',
        support: 'supported',
        supportNote: null,
      },
  };
}

function promoteDraftEntry(entry, draft) {
  return {
    ...entry,
    contentStatus: 'draft',
    reviewNotes: ['Draft waveform is available for local review; it has not been content-validated.'],
    asset: {
      path: draft.asset.path,
      format: draft.asset.format,
      previewVersion: 'v1',
      support: 'supported',
      supportNote: null,
    },
  };
}

function classifications(shard, tags) {
  return {
    protocols: tags.filter((tag) => PROTOCOL_TAGS.has(tag)),
    concepts: tags.filter((tag) => tag !== shard.id && !PROTOCOL_TAGS.has(tag)),
  };
}

function parseCurriculum(markdown, validatedSamples, draftSamples) {
  const inventoryMarker = '## Complete 832-entry source inventory';
  const inventoryStart = markdown.indexOf(inventoryMarker);
  if (inventoryStart < 0) throw new Error(`Missing ${inventoryMarker}`);
  const inventory = markdown.slice(inventoryStart);
  const heading = /^### (\d+)\. (.+)$/gm;
  const matches = [...inventory.matchAll(heading)];
  const entries = matches.map((match, index) => {
    const sourceNumber = Number(match[1]);
    const rawTitle = match[2].trim();
    const bodyStart = match.index + match[0].length;
    const bodyEnd = matches[index + 1]?.index ?? inventory.length;
    const body = inventory.slice(bodyStart, bodyEnd)
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !/^## /.test(line));
    const declared = body.find((line) => /\*\*Source number:\*\*/.test(line));
    if (!declared || Number(declared.match(/(\d+)/)?.[1]) !== sourceNumber) {
      throw new Error(`Source-number mismatch in inventory entry ${sourceNumber}`);
    }
    const shard = shardForNumber(sourceNumber);
    const title = normalizeUiText(rawTitle);
    const description = descriptionFromBody(body) || `Planned curriculum lesson for ${title}.`;
    const slug = slugify(title);
    const tier = tierFor(shard, title, description);
    const tags = tagsFor(shard, title, description);
    return {
      id: `${shard.id}/${slug}`,
      slug,
      sourceNumber,
      title,
      description,
      shardId: shard.id,
      tier,
      contentStatus: 'index-only',
      contentKind: tier === 'stress' ? 'stress' : ADVANCED_STUDY_SHARDS.has(shard.id) ? 'study' : 'lesson',
      ...commonFields(),
      reviewNotes: ['Planned curriculum entry; waveform and technical content have not been reviewed.'],
      tags,
      ...classifications(shard, tags),
      sourceRecord: {
        document: sourceDocument,
        title: rawTitle,
        body,
      },
      pairWithSourceNumbers: [],
    };
  });
  const idsBySourceNumber = new Map(entries.map((entry) => [entry.sourceNumber, entry.id]));
  return entries.map(({ pairWithSourceNumbers, ...entry }) => {
    const resolved = {
      ...entry,
      pairWith: pairWithSourceNumbers.map((sourceNumber) => {
      const id = idsBySourceNumber.get(sourceNumber);
      if (!id) throw new Error(`Unknown pairWith sourceNumber ${sourceNumber} for ${entry.id}`);
      return id;
      }),
    };
    const validation = validatedSamples.get(resolved.sourceNumber);
    // A reviewed/featured record is deliberately authoritative. Keeping a
    // same-number draft record lets a contributor retain local authoring
    // history without ever downgrading the reviewed catalog entry.
    if (validation !== undefined) return promoteValidatedEntry(resolved, validation);
    const draft = draftSamples.get(resolved.sourceNumber);
    return draft === undefined ? resolved : promoteDraftEntry(resolved, draft);
  });
}

function publishedEntries(validatedSamples) {
  const slugCounts = new Map();
  for (const sample of PUBLISHED_SAMPLES) {
    const baseSlug = sample.id.split('/').at(-1);
    const key = `${sample.shard}/${baseSlug}`;
    slugCounts.set(key, (slugCounts.get(key) ?? 0) + 1);
  }
  return PUBLISHED_SAMPLES.map((sample) => {
    const shard = SHARDS.find(({ id }) => id === sample.shard);
    if (!shard) throw new Error(`Unknown published-sample shard: ${sample.shard}`);
    const baseSlug = sample.id.split('/').at(-1);
    const slug = slugCounts.get(`${sample.shard}/${baseSlug}`) > 1
      ? sample.id.split('/').slice(1).join('-')
      : baseSlug;
    const tags = tagsFor(shard, `${sample.id} ${sample.title}`, sample.description);
    const entry = {
      id: sample.id,
      slug,
      sourceNumber: null,
      title: normalizeUiText(sample.title),
      description: normalizeUiText(sample.description),
      shardId: sample.shard,
      tier: sample.contentKind === 'compatibility-fixture' ? 'stress' : 'intermediate',
      contentStatus: 'draft',
      contentKind: sample.contentKind === 'compatibility-fixture' ? 'fixture' : 'lesson',
      ...commonFields(),
      reviewNotes: [sample.contentKind === 'compatibility-fixture'
        ? 'Bundled upstream compatibility fixture; not a reviewed curriculum lesson.'
        : 'Bundled Phase 1 template; protocol and rendering review are still pending.'],
      tags,
      ...classifications(shard, tags),
      sourceRecord: null,
      asset: {
        path: sample.file,
        format: sample.format,
        previewVersion: 'v1',
        support: sample.support,
        supportNote: sample.supportNote,
      },
    };
    const validation = validatedSamples.get(sample.id);
    return validation === undefined ? entry : promoteValidatedEntry(entry, validation);
  });
}

function validateEntries(curriculum, published, validatedSamples, draftSamples) {
  if (curriculum.length !== 832) throw new Error(`Expected 832 curriculum entries, found ${curriculum.length}`);
  const numbers = curriculum.map(({ sourceNumber }) => sourceNumber).sort((a, b) => a - b);
  for (let expected = 1; expected <= 832; expected += 1) {
    if (numbers[expected - 1] !== expected) throw new Error(`Missing or duplicate sourceNumber ${expected}`);
  }
  if (published.length !== 37) throw new Error(`Expected 37 published entries, found ${published.length}`);
  const all = [...curriculum, ...published];
  const ids = new Set();
  for (const entry of all) {
    if (ids.has(entry.id)) throw new Error(`Duplicate catalog ID: ${entry.id}`);
    ids.add(entry.id);
    if (/[ÂÃ]|â(?:€”|€œ|€)/.test(`${entry.title} ${entry.description}`)) {
      throw new Error(`Mojibake remains in UI fields for ${entry.id}`);
    }
    if (entry.contentStatus === 'reviewed' || entry.contentStatus === 'featured') {
      const validation = validatedSamples.get(entry.sourceNumber === null ? entry.id : entry.sourceNumber);
      if (validation === undefined) {
        throw new Error(`Only validated registry entries may emit ${entry.contentStatus}: ${entry.id}`);
      }
      if (entry.contentStatus !== validation.status
        || entry.owner !== validation.reviewedBy
        || entry.lastReviewed !== validation.reviewedOn) {
        throw new Error(`Validation registry metadata was not applied consistently: ${entry.id}`);
      }
      if (validation.asset !== undefined && (
        entry.asset?.path !== validation.asset.path
        || entry.asset?.format !== validation.asset.format
      )) {
        throw new Error(`Validation registry asset metadata was not applied consistently: ${entry.id}`);
      }
    }
  }
  for (const sample of PUBLISHED_SAMPLES) {
    if (!ids.has(sample.id)) throw new Error(`Published ID was not migrated: ${sample.id}`);
  }
  const curriculumNumbers = new Set(curriculum.map((entry) => entry.sourceNumber));
  const publishedIds = new Set(published.map((entry) => entry.id));
  for (const target of validatedSamples.keys()) {
    if (typeof target === 'number' && !curriculumNumbers.has(target)) {
      throw new Error(`Validated registry refers to missing sourceNumber ${target}`);
    }
    if (typeof target === 'string' && !publishedIds.has(target)) {
      throw new Error(`Validated registry refers to missing legacyId ${target}`);
    }
  }
  const entriesBySourceNumber = new Map(curriculum.map((entry) => [entry.sourceNumber, entry]));
  for (const [sourceNumber, draft] of draftSamples) {
    const entry = entriesBySourceNumber.get(sourceNumber);
    if (!entry) throw new Error(`Draft registry refers to missing sourceNumber ${sourceNumber}`);
    // Validated records win, so a retained draft mapping has no effect here.
    if (validatedSamples.has(sourceNumber)) continue;
    if (entry.contentStatus !== 'draft' || entry.owner !== null || entry.lastReviewed !== null) {
      throw new Error(`Draft registry metadata was not applied consistently: ${entry.id}`);
    }
    if (entry.asset?.path !== draft.asset.path || entry.asset?.format !== draft.asset.format) {
      throw new Error(`Draft registry asset metadata was not applied consistently: ${entry.id}`);
    }
  }
}

const toJson = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function main() {
  const markdown = await readFile(sourcePath, 'utf8');
  const validatedSamples = await loadValidatedSamples({ rootDir: root, allowMissing: false });
  const draftSamples = await loadDraftSamples({ rootDir: root, allowMissing: false });
  const curriculum = parseCurriculum(markdown, validatedSamples, draftSamples);
  const published = publishedEntries(validatedSamples);
  validateEntries(curriculum, published, validatedSamples, draftSamples);
  const entries = [...curriculum, ...published];
  await mkdir(shardRoot, { recursive: true });

  const shardDescriptors = [];
  for (const shard of SHARDS) {
    const shardEntries = entries.filter(({ shardId }) => shardId === shard.id);
    const curriculumCount = shardEntries.filter(({ sourceNumber }) => sourceNumber !== null).length;
    const assetEntryCount = shardEntries.filter((entry) => Object.hasOwn(entry, 'asset')).length;
    const descriptor = {
      id: shard.id,
      label: shard.label,
      path: `catalog/${shard.id}.json`,
      sourceNumberRange: { start: shard.start, end: shard.end },
      curriculumCount,
      entryCount: shardEntries.length,
      assetEntryCount,
    };
    shardDescriptors.push(descriptor);
    await writeFile(path.join(shardRoot, `${shard.id}.json`), toJson({
      schemaVersion: 1,
      catalogVersion: CATALOG_VERSION,
      shard: descriptor,
      entries: shardEntries,
    }));
  }

  const index = {
    schemaVersion: 1,
    catalogVersion: CATALOG_VERSION,
    generatedFrom: sourceDocument,
    curriculumCount: curriculum.length,
    entryCount: entries.length,
    assetEntryCount: entries.filter((entry) => Object.hasOwn(entry, 'asset')).length,
    shardCount: shardDescriptors.length,
    aliases: {},
    shards: shardDescriptors,
  };
  await writeFile(path.join(outputRoot, 'catalog.v1.json'), toJson(index));
  console.log(`Generated ${curriculum.length} curriculum entries, ${published.length} bundled entries, ${draftSamples.size} draft records, and ${validatedSamples.size} validated entries across ${shardDescriptors.length} shards.`);
}

await main();
