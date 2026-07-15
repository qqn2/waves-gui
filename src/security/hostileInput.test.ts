// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { buildSVGString } from '../exportEngine/exportSVG';
import { defaultDiagram, defaultView } from '../shared/store/helpers';
import { renderWavedromSvg } from '../wavedromBridge/renderWavedromSvg';

const payloads = [
  '<script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<foreignObject><iframe src="javascript:alert(1)"></iframe></foreignObject>',
  '" onload="alert(1)',
  'javascript:alert(1)',
  'https://example.invalid/%zz',
];

function assertInertSvg(svg: string): void {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  expect(doc.querySelector('parsererror')).toBeNull();
  expect(doc.querySelector('script, foreignObject, image, img, iframe, object, embed, a')).toBeNull();
  for (const element of Array.from(doc.querySelectorAll('*'))) {
    for (const attribute of Array.from(element.attributes)) {
      expect(attribute.name.toLowerCase()).not.toMatch(/^on/);
      if (/^(href|src|xlink:href)$/i.test(attribute.name)) {
        expect(attribute.value).toMatch(/^#/);
      }
    }
  }
}

describe('hostile labels remain inert', () => {
  it('preserves safe bundled skin CSS and rejects active or remote CSS', async () => {
    const svg = await renderWavedromSvg({ signal: [{ name: 'clk', wave: 'P...' }] });
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('style')?.textContent).toContain('.s1{fill:none;stroke:#000');

    const root = document.createElement('div');
    const svgRoot = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const safeStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    safeStyle.textContent = '.safe { fill: #fff; stroke: #000 }';
    const unsafeStyle = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    unsafeStyle.textContent = '@import url(https://example.invalid/evil.css)';
    const safePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    safePath.setAttribute('class', 'safe');
    safePath.setAttribute('style', 'fill:#fff;marker-end:url(#arrowhead)');
    const unsafePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    unsafePath.setAttribute('style', 'fill:url(https://example.invalid/evil.svg)');
    svgRoot.append(safeStyle, unsafeStyle, safePath, unsafePath);
    root.append(svgRoot);
    const { sanitizeDetachedSvg } = await import('./sanitizeSvg');
    sanitizeDetachedSvg(root);
    expect(root.querySelectorAll('style')).toHaveLength(1);
    expect(root.querySelector('path.safe')?.getAttribute('style')).toBe(
      'fill:#fff;marker-end:url(#arrowhead)',
    );
    expect(root.querySelectorAll('path')[1]?.hasAttribute('style')).toBe(false);
  });

  it.each(payloads)('escapes exported SVG label: %s', (payload) => {
    const diagram = defaultDiagram();
    diagram.signals[0]!.name = payload;
    diagram.config.head = { text: payload };
    diagram.config.foot = { text: payload };
    diagram.edges = [`a->b ${payload}`];
    const svg = buildSVGString(diagram, defaultView());
    assertInertSvg(svg);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<img');
    expect(svg).not.toContain('<foreignObject');
  });

  it.each(payloads)('sanitizes the local WaveDrom preview: %s', async (payload) => {
    const svg = await renderWavedromSvg({
      signal: [
        { name: payload, wave: '0.1.' },
        { name: 'bus', wave: '=...', data: [payload] },
      ],
      head: { text: payload },
      foot: { text: payload },
      edge: [`a->b ${payload}`],
    });
    assertInertSvg(svg);
  });
});
