import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '..');
const samplesDir = join(root, 'public', 'samples');
const previewsDir = join(samplesDir, 'previews');

function previewFileName(sampleFile, theme) {
  return sampleFile.replace(/\.json$/i, `.${theme}.svg`);
}

function legacyPreviewFileName(sampleFile) {
  return sampleFile.replace(/\.json$/i, '.svg');
}

function lightPreviewSvg(svg) {
  return svg
    .replaceAll('#111111', '#ffffff')
    .replaceAll('#242424', '#f8fafc')
    .replaceAll('#e8e8e8', '#111827')
    .replaceAll('#333333', '#cbd5e1')
    .replaceAll('#999999', '#475569');
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
  const { buildSVGString } = await server.ssrLoadModule('/src/exportEngine/exportSVG.ts');
  const { defaultView } = await server.ssrLoadModule('/src/shared/store/helpers.ts');
  const previewView = {
    ...defaultView(),
    labelWidth: 104,
    showAnchorLetters: false,
  };
  const sampleFiles = (await readdir(samplesDir))
    .filter((file) => file.endsWith('.json'))
    .sort();

  await mkdir(previewsDir, { recursive: true });
  for (const sampleFile of sampleFiles) {
    const source = await readFile(join(samplesDir, sampleFile), 'utf8');
    const parsed = parseCodeToDiagram(source);
    if (parsed.ok === false) {
      throw new Error(`Could not generate ${sampleFile}: ${parsed.error}`);
    }
    const svg = buildSVGString(parsed.diagram, previewView);
    await Promise.all([
      writeFile(join(previewsDir, previewFileName(sampleFile, 'dark')), svg, 'utf8'),
      writeFile(
        join(previewsDir, previewFileName(sampleFile, 'light')),
        lightPreviewSvg(svg),
        'utf8',
      ),
      rm(join(previewsDir, legacyPreviewFileName(sampleFile)), { force: true }),
    ]);
  }
  console.log(`Generated ${sampleFiles.length} sample previews.`);
} finally {
  await server.close();
}
