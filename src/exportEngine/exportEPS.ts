import { saveAs } from 'file-saver';
import type { DiagramState, ViewState } from '../shared/types';
import { exportBaseName } from './fileName';
import { renderDiagramImage } from './exportImage';

function hexLines(bytes: Uint8Array): string {
  let line = '';
  const lines: string[] = [];
  for (const byte of bytes) {
    line += byte.toString(16).padStart(2, '0').toUpperCase();
    if (line.length >= 72) {
      lines.push(line);
      line = '';
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

/**
 * Build a self-contained Level 2 EPS document around a JPEG image.
 *
 * ASCIIHex keeps the PostScript source transport-safe, while DCTDecode avoids
 * expanding the raster into a very large uncompressed RGB payload.
 */
export function buildRasterEPS(
  jpeg: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
): string {
  const width = Math.max(1, Math.round(pixelWidth));
  const height = Math.max(1, Math.round(pixelHeight));
  return [
    '%!PS-Adobe-3.0 EPSF-3.0',
    '%%Creator: Waves GUI',
    `%%BoundingBox: 0 0 ${width} ${height}`,
    `%%HiResBoundingBox: 0 0 ${width} ${height}`,
    '%%LanguageLevel: 2',
    '%%Pages: 1',
    '%%EndComments',
    'gsave',
    `${width} ${height} scale`,
    `${width} ${height} 8`,
    `[${width} 0 0 -${height} 0 ${height}]`,
    '{ currentfile /ASCIIHexDecode filter /DCTDecode filter }',
    'false 3 colorimage',
    hexLines(jpeg),
    '>',
    'grestore',
    'showpage',
    '%%EOF',
    '',
  ].join('\n');
}

export async function exportEPS(
  diagram: DiagramState,
  view: ViewState,
  background: string,
): Promise<void> {
  const rendered = await renderDiagramImage(diagram, view, {
    format: 'jpg',
    scale: 2,
    background,
  });
  const jpeg = new Uint8Array(await rendered.blob.arrayBuffer());
  const eps = buildRasterEPS(jpeg, rendered.width, rendered.height);
  saveAs(
    new Blob([eps], { type: 'application/postscript;charset=us-ascii' }),
    `${exportBaseName(view)}.eps`,
  );
}
