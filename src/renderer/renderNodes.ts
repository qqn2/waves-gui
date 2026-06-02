import type { DiagramState } from '../shared/types';
import { isVisibleNodeChar } from '../wavedromBridge/nodeVisibility';
import { NODE_PAD_CHAR } from '../wavedromBridge/nodeString';
import { stepLogicalCenter } from './laneTiming';
import type { ViewTransform } from './coordinates';
import { logicalToCanvasY } from './coordinates';

export function renderSignalNodes(
  ctx: CanvasRenderingContext2D,
  diagram: DiagramState,
  signalId: string,
  rowY: number,
  rowHeight: number,
  transform: ViewTransform,
  totalSteps: number,
  nodeStr: string | undefined,
): void {
  if (!nodeStr) return;

  const findSignal = (): import('../shared/types').Signal | null => {
    let found: import('../shared/types').Signal | null = null;
    const walk = (list: typeof diagram.signals) => {
      for (const item of list) {
        if (item.type === 'group') walk(item.children);
        else if (item.id === signalId) found = item;
      }
    };
    walk(diagram.signals);
    return found;
  };

  const signal = findSignal();
  if (!signal) return;

  const scale = transform.zoom * transform.hscale;
  const y =
    logicalToCanvasY(rowY, transform) + rowHeight * transform.zoom * 0.5;

  ctx.save();
  ctx.font = `600 ${Math.max(10, 11 * transform.zoom)}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle =
    getComputedStyle(document.documentElement).getPropertyValue('--edge-stroke').trim() ||
    '#d4a84b';

  for (let step = 0; step < totalSteps && step < nodeStr.length; step++) {
    const ch = nodeStr[step]!;
    if (ch === NODE_PAD_CHAR || ch === ' ' || !isVisibleNodeChar(ch)) continue;
    const x = stepLogicalCenter(signal, step) * scale - transform.scrollX;
    if (x + 8 < 0) continue;
    ctx.fillText(ch, x, y);
  }
  ctx.restore();
}
