import { saveAs } from 'file-saver';
import type { DiagramState, ViewState } from '../shared/types';
import { exportBaseName } from './fileName';
import { renderDiagramImage } from './exportImage';

const encoder = new TextEncoder();

function bytes(value: string): Uint8Array {
  return encoder.encode(value);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

/** Build a small standards-compliant PDF with one JPEG-backed page. */
export function buildRasterPdf(
  jpeg: Uint8Array,
  pixelWidth: number,
  pixelHeight: number,
): Uint8Array {
  const width = Math.max(1, Math.round(pixelWidth));
  const height = Math.max(1, Math.round(pixelHeight));
  const content = bytes(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`);
  const objects = [
    bytes('<< /Type /Catalog /Pages 2 0 R >>'),
    bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>'),
    bytes(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] `
      + '/Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>',
    ),
    concat([
      bytes(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} `
        + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
      ),
      jpeg,
      bytes('\nendstream'),
    ]),
    concat([
      bytes(`<< /Length ${content.length} >>\nstream\n`),
      content,
      bytes('endstream'),
    ]),
  ];

  const parts: Uint8Array[] = [bytes('%PDF-1.4\n%WAVES\n')];
  const offsets = [0];
  let position = parts[0]!.length;
  objects.forEach((object, index) => {
    offsets.push(position);
    const wrapped = concat([
      bytes(`${index + 1} 0 obj\n`),
      object,
      bytes('\nendobj\n'),
    ]);
    parts.push(wrapped);
    position += wrapped.length;
  });
  const xrefOffset = position;
  const xref = [
    'xref',
    `0 ${objects.length + 1}`,
    '0000000000 65535 f ',
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `),
    'trailer',
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF',
    '',
  ].join('\n');
  parts.push(bytes(xref));
  return concat(parts);
}

export async function exportPDF(
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
  const pdf = buildRasterPdf(jpeg, rendered.width, rendered.height);
  saveAs(
    new Blob([pdf], { type: 'application/pdf' }),
    `${exportBaseName(view)}.pdf`,
  );
}
