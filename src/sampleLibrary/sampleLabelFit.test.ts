import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { parseCodeToDiagram } from '../codePanel/codeSync';
import { stepLogicalX, stepLogicalXEnd } from '../renderer/laneTiming';
import { BUS_DIAGONAL, MAX_HSCALE, MIN_HSCALE, ROW_HEIGHT } from '../shared/constants';
import type { Signal, SignalOrGroup } from '../shared/types';

const sampleDirectory = join(process.cwd(), 'public/samples');
const sampleFiles = readdirSync(sampleDirectory).filter((file) => file.endsWith('.json'));

function vectorSignals(items: SignalOrGroup[]): Signal[] {
  return items.flatMap((item) => item.type === 'group'
    ? vectorSignals(item.children)
    : item.type === 'vector' ? [item] : []);
}

const widthCache = new Map<string, Promise<number>>();

/** Use real font metrics in Node, where Canvas measureText is unavailable. */
function textWidth(text: string, font: string): Promise<number> {
  const key = `${font}\0${text}`;
  let cached = widthCache.get(key);
  if (!cached) {
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    cached = sharp({ text: { text: escaped, font, dpi: 72 } })
      .metadata()
      // Pango returns the ink bounds; reserve two more pixels for side bearings.
      .then(({ width }) => (width ?? 0) + 2);
    widthCache.set(key, cached);
  }
  return cached;
}

describe('bundled sample label readability', () => {
  it.each(sampleFiles)('%s fits bus labels at its authored scale without compression', async (file) => {
    const source = readFileSync(join(sampleDirectory, file), 'utf8');
    const parsed = parseCodeToDiagram(source, { preferUndulate: file.startsWith('undulate-') });
    if (parsed.ok === false) throw new Error(`${file}: ${parsed.error}`);
    const { diagram } = parsed;
    const hscale = diagram.config.hscale;
    expect(hscale).toBeGreaterThanOrEqual(MIN_HSCALE);
    expect(hscale).toBeLessThanOrEqual(MAX_HSCALE);
    const overflows: string[] = [];

    for (const signal of vectorSignals(diagram.signals)) {
      const fontPx = signal.style?.fontSize ?? Math.max(10, (signal.rowHeight ?? ROW_HEIGHT) * 0.35);
      const weight = signal.style?.fontWeight ?? 400;
      // Generic sans-serif resolves differently on developer machines and CI.
      // DejaVu Sans reproduces the wider Linux runner metrics explicitly.
      const fonts = [...new Set([signal.style?.fontFamily ?? 'sans-serif', 'DejaVu Sans'])]
        .map((family) => `${family} ${weight >= 600 ? 'bold ' : ''}${fontPx}`);
      for (const segment of signal.segments) {
        if (!segment.value.trim() || segment.value === 'x') continue;
        // Use the rendered cell boundaries, including native fine timing and lane period.
        const span = (stepLogicalXEnd(signal, segment.endStep - 1)
          - stepLogicalX(signal, segment.startStep)) * hscale;
        const diagonal = BUS_DIAGONAL * hscale;
        const available = span - 2 * diagonal - 8;
        const context = `${file}, ${signal.name}, ${JSON.stringify(segment.value)}`;
        expect(span, `${context}: bus shape`).toBeGreaterThanOrEqual(3 * diagonal);
        for (const line of segment.value.split('\n')) {
          if (!line.trim()) continue;
          // Deliberately exclude vectorLabelFit's overflow slack and Canvas's maxWidth compression.
          for (const font of fonts) {
            const width = await textWidth(line, font);
            if (width > available) overflows.push(`${context}: ${font} needs ${width}px, has ${available}px`);
          }
        }
      }
    }
    // Report every overflowing label in the asset, not just the first lane.
    expect(overflows).toEqual([]);
  });
});
