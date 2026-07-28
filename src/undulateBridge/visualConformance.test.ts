// @vitest-environment happy-dom
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildSVGString } from '../exportEngine/exportSVG';
import { defaultView } from '../shared/store/helpers';
import type { UndulateRoot } from './types';
import { fromUndulateJSON } from './undulateJSON';

interface Crop {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Mask {
  pixels: Uint8Array;
  width: number;
  height: number;
}

const referenceDirectory = join(
  process.cwd(),
  'tests/fixtures/undulate/visual/reference',
);
const artifactDirectory = join(
  process.cwd(),
  'test-results/undulate-visual',
);
const outputWidth = 920;
const outputHeight = 40;

function geometryOnlySvg(svg: string): string {
  const overrides = `
    <style>
      text, .tick, line { display: none !important; }
      svg > rect { display: none !important; }
      path, polygon, rect {
        fill: none !important;
        stroke: #000 !important;
        stroke-width: 1px !important;
      }
    </style>`;
  return svg.replace('</svg>', `${overrides}</svg>`);
}

async function renderMask(
  svg: string,
  crop: Crop,
  width: number,
  height: number,
): Promise<Mask> {
  const { data, info } = await sharp(Buffer.from(geometryOnlySvg(svg)))
    .extract(crop)
    .resize(width, height, { fit: 'fill' })
    .flatten({ background: '#fff' })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return {
    pixels: Uint8Array.from(data, (pixel) => pixel < 160 ? 1 : 0),
    width: info.width,
    height: info.height,
  };
}

function hasPixelWithin(
  mask: Mask,
  x: number,
  y: number,
  radius: number,
): boolean {
  for (let dy = -radius; dy <= radius; dy++) {
    const candidateY = y + dy;
    if (candidateY < 0 || candidateY >= mask.height) continue;
    for (let dx = -radius; dx <= radius; dx++) {
      const candidateX = x + dx;
      if (candidateX < 0 || candidateX >= mask.width) continue;
      if (mask.pixels[candidateY * mask.width + candidateX]) return true;
    }
  }
  return false;
}

function unmatchedRatio(source: Mask, target: Mask, radius: number): number {
  let foreground = 0;
  let unmatched = 0;
  source.pixels.forEach((pixel, index) => {
    if (!pixel) return;
    foreground++;
    const x = index % source.width;
    const y = Math.floor(index / source.width);
    if (!hasPixelWithin(target, x, y, radius)) unmatched++;
  });
  return foreground === 0 ? 1 : unmatched / foreground;
}

function geometryDrift(reference: Mask, local: Mask, radius: number): number {
  return Math.max(
    unmatchedRatio(reference, local, radius),
    unmatchedRatio(local, reference, radius),
  );
}

async function writeDiff(
  id: string,
  reference: Mask,
  local: Mask,
): Promise<string> {
  mkdirSync(artifactDirectory, { recursive: true });
  const rgba = Buffer.alloc(reference.width * reference.height * 4, 255);
  for (let index = 0; index < reference.pixels.length; index++) {
    const refPixel = reference.pixels[index] === 1;
    const localPixel = local.pixels[index] === 1;
    if (!refPixel && !localPixel) continue;
    const offset = index * 4;
    if (refPixel && localPixel) {
      rgba[offset] = 40;
      rgba[offset + 1] = 40;
      rgba[offset + 2] = 40;
    } else if (refPixel) {
      rgba[offset] = 220;
      rgba[offset + 1] = 40;
      rgba[offset + 2] = 40;
    } else {
      rgba[offset] = 30;
      rgba[offset + 1] = 100;
      rgba[offset + 2] = 230;
    }
  }
  const path = join(artifactDirectory, `${id}-diff.png`);
  await sharp(rgba, {
    raw: { width: reference.width, height: reference.height, channels: 4 },
  }).png().toFile(path);
  return path;
}

async function expectVisualMatch(options: {
  id: string;
  document: UndulateRoot;
  referenceFile: string;
  referenceCrop: Crop;
  localCrop: Crop;
  width?: number;
  maximumDrift: number;
}): Promise<void> {
  const referenceSvg = readFileSync(
    join(referenceDirectory, options.referenceFile),
    'utf8',
  );
  const view = { ...defaultView(), labelWidth: 160, theme: 'light' as const };
  const localSvg = buildSVGString(fromUndulateJSON(options.document), view);
  const width = options.width ?? outputWidth;
  const [reference, local] = await Promise.all([
    renderMask(referenceSvg, options.referenceCrop, width, outputHeight),
    renderMask(localSvg, options.localCrop, width, outputHeight),
  ]);
  // Preserve the same source-space tolerance when a narrow fixture is enlarged
  // for comparison (sampled curves are rendered at 8x for useful diff images).
  const toleranceRadius = Math.max(
    4,
    Math.ceil(1.5 * width / options.localCrop.width),
  );
  const drift = geometryDrift(reference, local, toleranceRadius);
  if (drift > options.maximumDrift) {
    const artifact = await writeDiff(options.id, reference, local);
    throw new Error(
      `${options.id} geometry drift ${(drift * 100).toFixed(1)}% exceeds `
      + `${(options.maximumDrift * 100).toFixed(1)}%; `
      + `red=upstream-only, blue=local-only: ${artifact}`,
    );
  }
  expect(drift).toBeLessThanOrEqual(options.maximumDrift);
}

describe('Undulate visual conformance against pinned upstream SVGs', () => {
  it('matches the extended digital-symbol tutorial geometry', async () => {
    await expectVisualMatch({
      id: 'extended-digital-symbols',
      document: {
        signal: [
          { name: 'digital', wave: '01.zx=ud.2.3.45XziIzmzM' },
        ],
        config: { hscale: 1 },
      },
      referenceFile: 'step_1_dig.json.svg',
      referenceCrop: { left: 81, top: 1, width: 920, height: 20 },
      localCrop: { left: 160, top: 32, width: 920, height: 24 },
      maximumDrift: 0.36,
    });
  });

  it('matches analogue step and capacitive tutorial geometry', async () => {
    await expectVisualMatch({
      id: 'analogue-step-capacitive',
      document: {
        signal: [
          {
            name: 'gbf',
            wave: '0ssssccc',
            analogue: [0.9, 1.08, 1.26, 1.62, 0.36, 1.44, 0.54],
          },
        ],
        config: { hscale: 1 },
      },
      referenceFile: 'step_1_ana.json.svg',
      referenceCrop: { left: 41, top: 1, width: 320, height: 20 },
      localCrop: { left: 160, top: 32, width: 320, height: 24 },
      width: 640,
      maximumDrift: 0.20,
    });
  });

  it('matches an explicit sampled slice of the analogue tutorial curve', async () => {
    const samples = Array.from({ length: 41 }, (_, x) => [
      x,
      1.8 * (1 + Math.sin(2 * Math.PI * 3.5 * x / 160)) / 2,
    ] as [number, number]);
    await expectVisualMatch({
      id: 'analogue-sampled-curve',
      document: {
        signal: [{ name: 'sampled', wave: 'a', analogue: [samples] }],
        config: { hscale: 1 },
      },
      referenceFile: 'step_1_ana.json.svg',
      referenceCrop: { left: 367, top: 1, width: 34, height: 20 },
      localCrop: { left: 166, top: 32, width: 34, height: 24 },
      width: 272,
      maximumDrift: 0.18,
    });
  });
});
