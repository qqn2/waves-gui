import type { DiagramState, Signal, SignalOrGroup, ViewState } from '../shared/types';
import { CELL_WIDTH, TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout } from './rowLayout';
import { measureHeadFoot } from './renderHeadFoot';
import { canvasCellWidth } from './coordinates';

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

  const cellW = canvasCellWidth(diagram.config.hscale, view.zoom);
  const top = waveformTopPx(view, diagram);
  const x = (step + 0.5) * cellW - view.scrollX;
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

/** SVG path `d` from anchors using a simple Manhattan / curve heuristic. */
export function buildEdgePathD(
  from: CanvasAnchor,
  to: CanvasAnchor,
  shape: string,
): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  if (shape.includes('~')) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const k = 0.35;
    const cx = mx - dy * k;
    const cy = my + dx * k;
    return `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  }

  if (shape.includes('/')) {
    return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
  }

  const verticalFirst = shape.includes('|') && !shape.includes('-');
  const horizontalFirst = shape.includes('-') && !shape.includes('|');

  if (verticalFirst) {
    return `M ${from.x} ${from.y} L ${from.x} ${to.y} L ${to.x} ${to.y}`;
  }

  if (horizontalFirst || shape.length === 0) {
    const midX = from.x + dx / 2;
    return `M ${from.x} ${from.y} L ${midX} ${from.y} L ${midX} ${to.y} L ${to.x} ${to.y}`;
  }

  const midY = from.y + dy / 2;
  return `M ${from.x} ${from.y} L ${from.x} ${midY} L ${to.x} ${midY} L ${to.x} ${to.y}`;
}

export function labelPositionOnPath(
  from: CanvasAnchor,
  to: CanvasAnchor,
  shape: string,
): CanvasAnchor {
  if (shape.includes('#')) {
    return { x: (from.x * 2 + to.x) / 3, y: (from.y * 2 + to.y) / 3 };
  }
  return { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
}

export function waveformLogicalWidth(diagram: DiagramState): number {
  return diagram.config.totalSteps * CELL_WIDTH * diagram.config.hscale;
}
