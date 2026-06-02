import type { DiagramState, ViewState } from '../shared/types';
import { buildEdgeDrawItems } from '../renderer/edgeLayout';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function edgeStroke(): string {
  if (typeof document === 'undefined') return '#d4a84b';
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--edge-stroke').trim() ||
    '#d4a84b'
  );
}

export function svgEdges(
  diagram: DiagramState,
  view: ViewState,
  labelOffsetX: number,
): string {
  const edges = diagram.edges ?? [];
  if (edges.length === 0) return '';

  const exportView: ViewState = {
    ...view,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
  };
  const items = buildEdgeDrawItems(diagram, exportView, edges);
  const stroke = esc(edgeStroke());
  const parts: string[] = [
    `<defs>
      <marker id="wd-export-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L8,4 L0,8 z" fill="${stroke}"/>
      </marker>
    </defs>`,
  ];

  for (const item of items) {
    const markers = [
      item.hasArrow ? 'marker-end="url(#wd-export-arrow)"' : '',
      item.bidirectional ? 'marker-start="url(#wd-export-arrow)"' : '',
    ]
      .filter(Boolean)
      .join(' ');
    parts.push(
      `<path d="${item.d}" fill="none" stroke="${stroke}" stroke-width="2" ${markers}/>`,
    );
    if (item.label) {
      parts.push(
        `<text x="${item.labelX + labelOffsetX}" y="${item.labelY}" fill="${stroke}" font-size="11" font-family="sans-serif" text-anchor="middle">${esc(item.label)}</text>`,
      );
    }
  }
  return parts.join('\n');
}

export function drawEdgesOnCanvas(
  ctx: CanvasRenderingContext2D,
  diagram: DiagramState,
  view: ViewState,
  labelOffsetX: number,
): void {
  const edges = diagram.edges ?? [];
  if (edges.length === 0) return;

  const exportView: ViewState = {
    ...view,
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
  };
  const items = buildEdgeDrawItems(diagram, exportView, edges);
  const stroke = edgeStroke();

  ctx.save();
  ctx.translate(labelOffsetX, 0);
  ctx.strokeStyle = stroke;
  ctx.fillStyle = stroke;
  ctx.lineWidth = 2;

  for (const item of items) {
    const path = new Path2D(item.d);
    ctx.stroke(path);
    if (item.hasArrow || item.bidirectional) {
      drawArrowheadAtEnd(ctx, item.d, stroke);
      if (item.bidirectional) {
        drawArrowheadAtStart(ctx, item.d, stroke);
      }
    }
    if (item.label) {
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, item.labelX, item.labelY);
    }
  }
  ctx.restore();
}

function drawArrowheadAtEnd(
  ctx: CanvasRenderingContext2D,
  d: string,
  fill: string,
): void {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 4) return;
  const x2 = nums[nums.length - 2]!;
  const y2 = nums[nums.length - 1]!;
  const x1 = nums[nums.length - 4] ?? x2;
  const y1 = nums[nums.length - 3] ?? y2;
  drawArrowTip(ctx, x1, y1, x2, y2, fill);
}

function drawArrowheadAtStart(
  ctx: CanvasRenderingContext2D,
  d: string,
  fill: string,
): void {
  const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 4) return;
  const x1 = nums[0]!;
  const y1 = nums[1]!;
  const x2 = nums[2] ?? x1;
  const y2 = nums[3] ?? y1;
  drawArrowTip(ctx, x2, y2, x1, y1, fill);
}

function drawArrowTip(
  ctx: CanvasRenderingContext2D,
  xFrom: number,
  yFrom: number,
  xTo: number,
  yTo: number,
  fill: string,
): void {
  const dx = xTo - xFrom;
  const dy = yTo - yFrom;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(xTo, yTo);
  ctx.lineTo(xTo - ux * 8 + px * 4, yTo - uy * 8 + py * 4);
  ctx.lineTo(xTo - ux * 8 - px * 4, yTo - uy * 8 - py * 4);
  ctx.closePath();
  ctx.fill();
}
