import type { DiagramState, SignalOrGroup } from '../shared/types';
import { LABEL_WIDTH } from '../shared/constants';
import { buildRowLayout } from '../renderer/rowLayout';

export interface LabelEntry {
  name: string;
  y: number;
  height: number;
  depth: number;
  isGroup: boolean;
}

/** Visible signal/group rows aligned with `buildRowLayout` order. */
export function buildLabelEntries(signals: SignalOrGroup[]): LabelEntry[] {
  const rows = buildRowLayout(signals);
  const entries: LabelEntry[] = [];
  let rowIdx = 0;

  const walk = (list: SignalOrGroup[], depth: number) => {
    for (const item of list) {
      const row = rows[rowIdx++];
      if (!row) return;
      if (item.type === 'group') {
        entries.push({
          name: item.name,
          y: row.y,
          height: row.height,
          depth,
          isGroup: true,
        });
        if (!item.collapsed) walk(item.children, depth + 1);
      } else {
        entries.push({
          name: item.name,
          y: row.y,
          height: row.height,
          depth,
          isGroup: false,
        });
      }
    }
  };

  walk(signals, 0);
  return entries;
}

export function drawSignalLabels(
  ctx: CanvasRenderingContext2D,
  diagram: DiagramState,
  axisOffset: number,
  totalHeight: number,
  labelBg: string,
  textColor: string,
): void {
  const entries = buildLabelEntries(diagram.signals);
  ctx.fillStyle = labelBg;
  ctx.fillRect(0, 0, LABEL_WIDTH, totalHeight);

  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (const entry of entries) {
    const x = 8 + entry.depth * 12;
    const y = axisOffset + entry.y + entry.height / 2;
    const maxW = LABEL_WIDTH - x - 4;
    ctx.font = entry.isGroup ? '600 11px sans-serif' : '12px sans-serif';
    ctx.fillText(entry.name, x, y, maxW);
  }
}
