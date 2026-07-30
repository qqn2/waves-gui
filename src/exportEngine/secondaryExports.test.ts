import { describe, expect, it } from 'vitest';
import { createDefaultDiagram } from '../shared/defaultDiagram';
import { buildRasterPdf } from './exportPDF';
import { buildRasterEPS } from './exportEPS';
import { buildTerminalDiagram } from './exportTerminal';

describe('secondary exports', () => {
  it('builds a one-page PDF with an embedded JPEG stream and valid xref', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildRasterPdf(jpeg, 640, 320);
    const text = new TextDecoder('latin1').decode(pdf);

    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/Type /Page');
    expect(text).toContain('/Subtype /Image');
    expect(text).toContain('/Width 640 /Height 320');
    expect(text).toContain('xref');
    expect(text).toContain('%%EOF');
    expect(Array.from(pdf)).toEqual(expect.arrayContaining(Array.from(jpeg)));
  });

  it('builds a transport-safe Level 2 EPS with an embedded JPEG stream', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0x01, 0x2a, 0xff, 0xd9]);
    const eps = buildRasterEPS(jpeg, 640, 320);

    expect(eps.startsWith('%!PS-Adobe-3.0 EPSF-3.0')).toBe(true);
    expect(eps).toContain('%%BoundingBox: 0 0 640 320');
    expect(eps).toContain('/ASCIIHexDecode filter /DCTDecode filter');
    expect(eps).toContain('false 3 colorimage');
    expect(eps).toContain('FFD8012AFFD9');
    expect(eps.endsWith('%%EOF\n')).toBe(true);
  });

  it('renders digital, vector, analogue, groups, and annotations as terminal text', () => {
    const diagram = createDefaultDiagram();
    diagram.config.totalSteps = 3;
    diagram.signals = [
      {
        id: 'group',
        name: 'Inputs',
        type: 'group',
        collapsed: false,
        children: [{
          id: 'bit',
          name: 'clk',
          type: 'bit',
          states: ['0', '1', 'x'],
          segments: [],
          color: '#4A9EFF',
          rowHeight: 40,
        }],
      },
      {
        id: 'ana',
        name: 'voltage',
        type: 'analogue',
        states: [],
        segments: [],
        analogueMin: 0,
        analogueMax: 1,
        analogueCells: [
          { id: 'a', kind: 'step', value: 0 },
          { id: 'b', kind: 'step', value: 0.5 },
          { id: 'c', kind: 'step', value: 1 },
        ],
        color: '#4A9EFF',
        rowHeight: 40,
      },
    ];
    diagram.annotations = [{
      id: 'note',
      type: 'text',
      text: 'sample here',
      tick: 1,
    }];

    const text = buildTerminalDiagram(diagram);
    expect(text).toContain('[Inputs]');
    expect(text).toContain('clk');
    expect(text).toContain('0 1 x');
    expect(text).toContain('voltage');
    expect(text).toContain('▁');
    expect(text).toContain('█');
    expect(text).toContain('Annotations:');
    expect(text).toContain('sample here');
  });
});
