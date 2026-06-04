/**
 * WaveDrom edge[] layout — dependency arrows between node anchors.
 *
 * Edge string format (one entry per edge[] element):
 *   "<path> [<label>]"
 *
 * Path word:
 *   First char  — from-node letter (must exist in some signal's `node` string at that step)
 *   Last char   — to-node letter
 *   ...~>...    — '>' before the to-node draws an arrowhead; chars between are the "shape"
 *                 (e.g. "a~>b", "a~b", "a-b>c" for timespan-style paths)
 *
 * Canvas hit-test and SVG export both use parseEdgeString / resolveEdgeAnchors from here.
 */
import type { DiagramState, Signal, SignalOrGroup, ViewState } from '../shared/types';
import { CELL_WIDTH, TIME_AXIS_HEIGHT } from '../shared/constants';
import { stepLogicalCenter } from './laneTiming';
import { buildRowLayout } from './rowLayout';
import { measureHeadFoot } from './renderHeadFoot';
export interface NodeAnchor {
  signalId: string;
  step: number;
  char: string;
}

/** Parsed WaveDrom edge[] entry (path word + optional label). */
export interface ParsedEdge {
  fromNode: string;
  toNode: string;
  hasArrow: boolean;
  shape: string;
  label: string;
}

export interface CanvasAnchor {
  x: number;
  y: number;
}

/** First word = path; remainder = label (WaveDrom edge string). */
export function parseEdgeString(edge: string): { path: string; label: string } {
  const trimmed = edge.trim();
  const gap = trimmed.search(/\s/);
  if (gap === -1) return { path: trimmed, label: '' };
  return { path: trimmed.slice(0, gap), label: trimmed.slice(gap + 1).trim() };
}

export function parsePathEndpoints(path: string): { from: string; to: string } | null {
  if (path.length < 2) return null;
  return { from: path[0]!, to: path[path.length - 1]! };
}

/** First char = from node, last = to; `>` before to enables arrowhead. */
export function parseEdgePath(pathWord: string): Omit<ParsedEdge, 'label'> {
  const fromNode = pathWord[0]!;
  const toNode = pathWord[pathWord.length - 1]!;
  let hasArrow = false;
  let shapeEnd = pathWord.length - 1;
  if (pathWord.length >= 3 && pathWord[pathWord.length - 2] === '>') {
    hasArrow = true;
    shapeEnd = pathWord.length - 2;
  }
  const shape = pathWord.slice(1, shapeEnd);
  return { fromNode, toNode, hasArrow, shape };
}

export function parseEdge(edge: string): ParsedEdge | null {
  const { path, label } = parseEdgeString(edge);
  if (path.length < 2) return null;
  return { ...parseEdgePath(path), label };
}

/** Endpoint node letters referenced by edge[] (from/to path chars). */
export function collectEdgeEndpointChars(edges: string[]): Set<string> {
  const used = new Set<string>();
  for (const edge of edges) {
    const parsed = parseEdge(edge);
    if (!parsed) continue;
    used.add(parsed.fromNode);
    used.add(parsed.toNode);
  }
  return used;
}

/** Map node letter → first signal/step occurrence in tree order. */
export function buildNodeIndex(signals: SignalOrGroup[]): Map<string, NodeAnchor> {
  const map = new Map<string, NodeAnchor>();
  const walk = (list: SignalOrGroup[]) => {
    for (const item of list) {
      if (item.type === 'group') {
        walk(item.children);
      } else if (item.type !== 'spacer' && item.node) {
        for (let step = 0; step < item.node.length; step++) {
          const ch = item.node[step]!;
          if (ch === '.' || ch === ' ') continue;
          if (map.has(ch)) continue;
          map.set(ch, { signalId: item.id, step, char: ch });
        }
      }
    }
  };
  walk(signals);
  return map;
}

export function isBitOrVector(sig: SignalOrGroup): sig is Signal {
  return sig.type === 'bit' || sig.type === 'vector';
}

function waveformTopPx(view: ViewState, diagram: DiagramState): number {
  const axis = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
  const { headHeight } = measureHeadFoot(diagram.config);
  return axis + headHeight;
}

/** Canvas-pixel anchor at cell center for a signal row and step. */
export function resolveNodeAnchor(
  diagram: DiagramState,
  view: ViewState,
  signalId: string,
  step: number,
): CanvasAnchor | null {
  const rows = buildRowLayout(diagram.signals);
  const row = rows.find((r) => r.id === signalId);
  if (!row || row.type === 'group') return null;

  let signal: Signal | null = null;
  const walk = (list: typeof diagram.signals) => {
    for (const item of list) {
      if (item.type === 'group') walk(item.children);
      else if (item.id === signalId) signal = item;
    }
  };
  walk(diagram.signals);
  if (!signal) return null;

  const scale = view.zoom * diagram.config.hscale;
  const top = waveformTopPx(view, diagram);
  const x = stepLogicalCenter(signal, step) * scale - view.scrollX;
  const y = (row.y + row.height / 2) * view.zoom - view.scrollY + top;
  return { x, y };
}

export function resolveEdgeAnchors(
  diagram: DiagramState,
  view: ViewState,
  parsed: ParsedEdge,
  nodeIndex: Map<string, NodeAnchor>,
): { from: CanvasAnchor; to: CanvasAnchor } | null {
  const fromLoc = nodeIndex.get(parsed.fromNode);
  const toLoc = nodeIndex.get(parsed.toNode);
  if (!fromLoc || !toLoc) return null;
  const from = resolveNodeAnchor(diagram, view, fromLoc.signalId, fromLoc.step);
  const to = resolveNodeAnchor(diagram, view, toLoc.signalId, toLoc.step);
  if (!from || !to) return null;
  return { from, to };
}

/**
 * SVG path `d` aligned with WaveDrom `lib/arc-shape.js` (shape = middle of edge word).
 */
export function buildEdgePathD(
  from: CanvasAnchor,
  to: CanvasAnchor,
  shape: string,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const key = shape.length > 0 ? shape : '-';

  switch (key) {
    case '~':
      return `M ${from.x} ${from.y} C ${from.x + 0.7 * dx} ${from.y} ${from.x + 0.3 * dx} ${from.y + dy} ${to.x} ${to.y}`;
    case '-~':
      return `M ${from.x} ${from.y} C ${from.x + 0.7 * dx} ${from.y} ${to.x} ${from.y + dy} ${to.x} ${to.y}`;
    case '~-':
      return `M ${from.x} ${from.y} C ${from.x} ${from.y} ${from.x + 0.3 * dx} ${from.y + dy} ${to.x} ${to.y}`;
    case '-|':
      return `M ${from.x} ${from.y} l ${dx} 0 0 ${dy}`;
    case '|-':
      return `M ${from.x} ${from.y} l 0 ${dy} ${dx} 0`;
    case '-|-':
      return `M ${from.x} ${from.y} l ${dx / 2} 0 0 ${dy} ${dx / 2} 0`;
    case '~>':
      return `M ${from.x} ${from.y} C ${from.x + 0.7 * dx} ${from.y} ${from.x + 0.3 * dx} ${from.y + dy} ${to.x} ${to.y}`;
    case '-~>':
      return `M ${from.x} ${from.y} C ${from.x + 0.7 * dx} ${from.y} ${to.x} ${from.y + dy} ${to.x} ${to.y}`;
    case '~->':
      return `M ${from.x} ${from.y} C ${from.x} ${from.y} ${from.x + 0.3 * dx} ${from.y + dy} ${to.x} ${to.y}`;
    case '-|>':
      return `M ${from.x} ${from.y} l ${dx} 0 0 ${dy}`;
    case '|->':
      return `M ${from.x} ${from.y} l 0 ${dy} ${dx} 0`;
    case '-|->':
      return `M ${from.x} ${from.y} l ${dx / 2} 0 0 ${dy} ${dx / 2} 0`;
    case '<~>':
      return `M ${from.x} ${from.y} C ${from.x + 0.7 * dx} ${from.y} ${from.x + 0.3 * dx} ${from.y + dy} ${to.x} ${to.y}`;
    case '<-~>':
      return `M ${from.x} ${from.y} C ${from.x + 0.7 * dx} ${from.y} ${to.x} ${from.y + dy} ${to.x} ${to.y}`;
    case '<-|>':
      return `M ${from.x} ${from.y} l ${dx} 0 0 ${dy}`;
    case '<-|->':
      return `M ${from.x} ${from.y} l ${dx / 2} 0 0 ${dy} ${dx / 2} 0`;
    case '+':
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    case '-':
    case '->':
    case '<->':
    default:
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }
}

export function labelPositionOnPath(
  from: CanvasAnchor,
  to: CanvasAnchor,
  shape: string,
): CanvasAnchor {
  const dx = to.x - from.x;
  const key = shape.length > 0 ? shape : '-';
  let lx = (from.x + to.x) / 2;
  const ly = (from.y + to.y) / 2;

  if (key === '-~>' || key === '-~') lx = from.x + dx * 0.75;
  else if (key === '~->' || key === '~-') lx = from.x + dx * 0.25;
  else if (key === '-|>' || key === '-|') lx = to.x;
  else if (key === '|->' || key === '|-') lx = from.x;
  else if (shape.includes('#')) lx = from.x + dx / 3;

  return { x: lx, y: ly };
}

export function waveformLogicalWidth(diagram: DiagramState): number {
  return diagram.config.totalSteps * CELL_WIDTH * diagram.config.hscale;
}

export interface EdgeDrawItem {
  d: string;
  hasArrow: boolean;
  bidirectional: boolean;
  label: string;
  labelX: number;
  labelY: number;
}

/** Resolved edge paths for canvas overlay and image export. */
export function buildEdgeDrawItems(
  diagram: DiagramState,
  view: ViewState,
  edges: string[],
): EdgeDrawItem[] {
  const nodeIndex = buildNodeIndex(diagram.signals);
  const items: EdgeDrawItem[] = [];

  for (const edgeStr of edges) {
    const { path } = parseEdgeString(edgeStr);
    const parsed = parseEdge(edgeStr);
    if (!parsed) continue;
    const anchors = resolveEdgeAnchors(diagram, view, parsed, nodeIndex);
    if (!anchors) continue;
    const d = buildEdgePathD(anchors.from, anchors.to, parsed.shape);
    const labelPos = labelPositionOnPath(anchors.from, anchors.to, parsed.shape);
    const bidirectional = path.includes('<->');
    items.push({
      d,
      hasArrow: parsed.hasArrow || bidirectional,
      bidirectional,
      label: parsed.label,
      labelX: labelPos.x,
      labelY: labelPos.y - 4,
    });
  }

  return items;
}

const EDGE_HIT_PX = 8;
const CUBIC_SAMPLES = 12;

function distToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function distToPolyline(px: number, py: number, pts: CanvasAnchor[]): number {
  let min = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    min = Math.min(min, distToSegment(px, py, a.x, a.y, b.x, b.y));
  }
  return min;
}

function cubicSamples(
  p0: CanvasAnchor,
  p1: CanvasAnchor,
  p2: CanvasAnchor,
  p3: CanvasAnchor,
  n: number,
): CanvasAnchor[] {
  const out: CanvasAnchor[] = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/** Polyline approximation of `buildEdgePathD` for pointer hit-testing. */
export function edgePathPolyline(
  from: CanvasAnchor,
  to: CanvasAnchor,
  shape: string,
): CanvasAnchor[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const key = shape.length > 0 ? shape : '-';
  const pts: CanvasAnchor[] = [{ ...from }];

  const pushCubic = (c1x: number, c1y: number, c2x: number, c2y: number) => {
    pts.push(
      ...cubicSamples(
        from,
        { x: c1x, y: c1y },
        { x: c2x, y: c2y },
        to,
        CUBIC_SAMPLES,
      ),
    );
  };

  switch (key) {
    case '~':
    case '~>':
    case '<~>':
      pushCubic(from.x + 0.7 * dx, from.y, from.x + 0.3 * dx, from.y + dy);
      break;
    case '-~':
    case '-~>':
    case '<-~>':
      pushCubic(from.x + 0.7 * dx, from.y, to.x, from.y + dy);
      break;
    case '~-':
    case '~->':
    case '<-|>':
      pushCubic(from.x, from.y, from.x + 0.3 * dx, from.y + dy);
      break;
    case '-|':
    case '-|>':
      pts.push({ x: to.x, y: from.y });
      break;
    case '|-':
    case '|->':
      pts.push({ x: from.x, y: to.y });
      break;
    case '-|-':
    case '<-|->':
      pts.push({ x: from.x + dx / 2, y: from.y });
      pts.push({ x: from.x + dx / 2, y: to.y });
      break;
    case '+':
    case '-':
    case '->':
    case '<->':
    default:
      break;
  }

  const last = pts[pts.length - 1]!;
  if (last.x !== to.x || last.y !== to.y) pts.push({ ...to });
  return pts;
}

/** Topmost WaveDrom edge[] index under a canvas point, or null. */
export function hitTestDiagramEdge(
  canvasX: number,
  canvasY: number,
  diagram: DiagramState,
  view: ViewState,
): number | null {
  const edges = diagram.edges ?? [];
  if (edges.length === 0) return null;

  const nodeIndex = buildNodeIndex(diagram.signals);
  for (let i = edges.length - 1; i >= 0; i--) {
    const parsed = parseEdge(edges[i]!);
    if (!parsed) continue;
    const anchors = resolveEdgeAnchors(diagram, view, parsed, nodeIndex);
    if (!anchors) continue;
    const poly = edgePathPolyline(anchors.from, anchors.to, parsed.shape);
    if (distToPolyline(canvasX, canvasY, poly) <= EDGE_HIT_PX) return i;
  }
  return null;
}
