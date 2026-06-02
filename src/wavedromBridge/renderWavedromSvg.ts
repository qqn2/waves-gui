/** Render WaveJSON to SVG string via bundled `wavedrom` (Node / Vitest). */
export async function renderWavedromSvg(json: unknown): Promise<string> {
  const WaveDrom = await import('wavedrom');
  const el = document.createElementNS(
    'http://www.w3.org/2000/svg',
    'svg',
  ) as unknown as HTMLElement;
  WaveDrom.renderWaveElement(0, json, el, WaveDrom.waveSkin, false);
  return el.outerHTML;
}

export function svgMetrics(svg: string): {
  pathCount: number;
  width: number;
  height: number;
} {
  const pathCount = (svg.match(/<path\b/gi) ?? []).length;
  const wMatch = svg.match(/\bwidth="([0-9.]+)"/);
  const hMatch = svg.match(/\bheight="([0-9.]+)"/);
  return {
    pathCount,
    width: wMatch ? Number(wMatch[1]) : 0,
    height: hMatch ? Number(hMatch[1]) : 0,
  };
}
