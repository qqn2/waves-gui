/** Shared SVG marker geometry for WaveDrom-style edge arrowheads (tip at path end, centered on stroke). */
export const EDGE_ARROW_VIEWBOX = '0 0 10 10';
export const EDGE_ARROW_PATH = 'M0,0 L10,5 L0,10 z';

export const edgeArrowMarkerProps = {
  viewBox: EDGE_ARROW_VIEWBOX,
  markerWidth: 10,
  markerHeight: 10,
  refX: 10,
  refY: 5,
  orient: 'auto' as const,
  markerUnits: 'userSpaceOnUse' as const,
};

export function edgeArrowMarkerSvgDef(id: string, fill: string): string {
  const p = edgeArrowMarkerProps;
  return `<marker id="${id}" viewBox="${p.viewBox}" markerWidth="${p.markerWidth}" markerHeight="${p.markerHeight}" refX="${p.refX}" refY="${p.refY}" orient="${p.orient}" markerUnits="${p.markerUnits}"><path d="${EDGE_ARROW_PATH}" fill="${fill}"/></marker>`;
}
