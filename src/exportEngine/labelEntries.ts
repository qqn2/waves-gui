import type {
  DiagramState,
  SignalOrGroup,
  SignalStyle,
} from '../shared/types';
import { buildRowLayout } from '../renderer/rowLayout';

export interface LabelEntry {
  name: string;
  y: number;
  height: number;
  depth: number;
  isGroup: boolean;
  centerRatio: number;
  style?: SignalStyle;
}

function overlayLabelRatio(order: number | undefined): number {
  return [0.5, 0.14, 0.34, 0.66, 0.86][order ?? 0] ?? 0.5;
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
          centerRatio: 0.5,
        });
        if (!item.collapsed) walk(item.children, depth + 1);
      } else {
        entries.push({
          name: item.name,
          y: row.y,
          height: row.height,
          depth,
          isGroup: false,
          centerRatio: overlayLabelRatio(item.order),
          ...(item.style ? { style: item.style } : {}),
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
  labelWidth: number,
  axisOffset: number,
  totalHeight: number,
  labelBg: string,
  textColor: string,
): void {
  const entries = buildLabelEntries(diagram.signals);
  ctx.fillStyle = labelBg;
  ctx.fillRect(0, 0, labelWidth, totalHeight);

  ctx.fillStyle = textColor;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  for (const entry of entries) {
    const x = 8 + entry.depth * 12;
    const y = axisOffset + entry.y + entry.height * entry.centerRatio;
    const maxW = labelWidth - x - 4;
    ctx.font = entry.isGroup
      ? '600 11px sans-serif'
      : `${entry.style?.fontWeight ?? 400} `
        + `${entry.style?.fontSize ?? 12}px `
        + `${entry.style?.fontFamily ?? 'sans-serif'}`;
    ctx.fillText(entry.name, x, y, maxW);
  }
}
