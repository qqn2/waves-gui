import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const samplesDir = join(root, 'public', 'samples');
const previewsDir = join(samplesDir, 'previews');

function previewFileName(sampleFile, theme) {
  return sampleFile.replace(/\.[^.]+$/i, `.${theme}.svg`);
}

function legacyPreviewFileName(sampleFile) {
  return sampleFile.replace(/\.[^.]+$/i, '.svg');
}

function lightPreviewSvg(svg) {
  return svg
    .replaceAll('#111111', '#ffffff')
    .replaceAll('#242424', '#f8fafc')
    .replaceAll('#e8e8e8', '#111827')
    .replaceAll('#333333', '#cbd5e1')
    .replaceAll('#999999', '#475569');
}

function safeRelativePath(value, label) {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.includes('\\')
    || value.startsWith('/')
    || value.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw new Error(`${label} must be a safe relative path`);
  }
  return value;
}

async function catalogAssetEntries() {
  const indexPath = join(samplesDir, 'catalog.v1.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  if (!Array.isArray(index.shards)) throw new Error('Sample catalog index has no shard list');
  const shardDocuments = await Promise.all(index.shards.map(async (descriptor) => {
    const shardPath = safeRelativePath(descriptor.path, 'Catalog shard path');
    return JSON.parse(await readFile(join(samplesDir, shardPath), 'utf8'));
  }));
  const assetEntries = shardDocuments
    .flatMap((document) => document.entries ?? [])
    .filter((entry) => entry.asset !== undefined);
  if (assetEntries.length !== index.assetEntryCount) {
    throw new Error(`Catalog declares ${index.assetEntryCount} assets but shards contain ${assetEntries.length}`);
  }
  const paths = new Set();
  for (const entry of assetEntries) {
    const assetPath = safeRelativePath(entry.asset.path, `Asset path for ${entry.id}`);
    if (paths.has(assetPath)) throw new Error(`Duplicate sample asset path: ${assetPath}`);
    paths.add(assetPath);
  }
  return assetEntries.filter((entry) => entry.asset.support !== 'future');
}

const server = await createServer({
  root,
  logLevel: 'error',
  server: { middlewareMode: true, watch: null },
  appType: 'custom',
  resolve: {
    alias: {
      'file-saver': fileURLToPath(
        new URL('./file-saver-ssr-stub.mjs', import.meta.url),
      ),
    },
  },
});

try {
  const { parseCodeToDiagram } = await server.ssrLoadModule('/src/codePanel/codeSync.ts');
  const { sampleParseOptions } = await server.ssrLoadModule('/src/sampleLibrary/sampleSource.ts');
  const { buildSVGString } = await server.ssrLoadModule('/src/exportEngine/exportSVG.ts');
  const { defaultView } = await server.ssrLoadModule('/src/shared/store/helpers.ts');
  const previewView = {
    ...defaultView(),
    labelWidth: 104,
    showAnchorLetters: false,
  };
  const entries = (await catalogAssetEntries())
    .sort((left, right) => left.asset.path.localeCompare(right.asset.path));

  await mkdir(previewsDir, { recursive: true });
  for (const entry of entries) {
    const sampleFile = entry.asset.path;
    const source = await readFile(join(samplesDir, sampleFile), 'utf8');
    const parsed = parseCodeToDiagram(
      source,
      sampleParseOptions(entry.asset.format),
    );
    if (parsed.ok === false) {
      throw new Error(`Could not generate ${sampleFile}: ${parsed.error}`);
    }
    const svg = buildSVGString(parsed.diagram, previewView);
    const darkPreview = join(previewsDir, previewFileName(sampleFile, 'dark'));
    const lightPreview = join(previewsDir, previewFileName(sampleFile, 'light'));
    await Promise.all([mkdir(dirname(darkPreview), { recursive: true }), mkdir(dirname(lightPreview), { recursive: true })]);
    await Promise.all([
      writeFile(darkPreview, svg, 'utf8'),
      writeFile(
        lightPreview,
        lightPreviewSvg(svg),
        'utf8',
      ),
      rm(join(previewsDir, legacyPreviewFileName(sampleFile)), { force: true }),
    ]);
  }
  console.log(`Generated ${entries.length} sample previews.`);
} finally {
  await server.close();
}
