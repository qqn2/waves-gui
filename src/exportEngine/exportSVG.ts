import { saveAs } from 'file-saver';
import type {
  BitState,
  DiagramState,
  Signal,
  SignalOrGroup,
  ViewState,
} from '../shared/types';
import {
  BUS_DIAGONAL,
  CELL_WIDTH,
  TIME_AXIS_HEIGHT,
  TRACE_PADDING,
  TRANSITION_WIDTH,
} from '../shared/constants';
import { buildRowLayout, totalContentHeight } from '../renderer/rowLayout';
import { isVectorUnknownValue, X_STROKE, zStrokeColor } from '../renderer/stateColors';
import { segmentBusFill, segmentBusStroke } from '../renderer/vectorBusStyle';
import { svgEdges } from './exportEdges';
import { computeExportDimensions } from './exportDimensions';
import { buildLabelEntries } from './labelEntries';
import { exportBaseName } from './fileName';
import { clockStepEndY, clockStepSvg } from '../renderer/drawClock';
import { svgStepGap } from '../renderer/drawStepGap';
import {
  appendGlitchToSvgPath,
  canDrawGlitch,
  glitchOppositeY,
} from '../renderer/drawStepGlitch';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function themeColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v || fallback;
}

function bitY(
  st: BitState,
  yHigh: number,
  yLow: number,
  yMid: number,
): number {
  switch (st) {
    case '1':
      return yHigh;
    case '0':
      return yLow;
    case 'z':
      return yMid;
    case 'u':
      return yHigh + 4;
    case 'd':
      return yLow - 4;
    default:
      return yMid;
  }
}

function svgBitSignal(
  signal: Signal,
  rowY: number,
  rowH: number,
  totalSteps: number,
  hscale: number,
  axisOffset: number,
): string {
  const cellW = CELL_WIDTH * hscale;
  const tw = TRANSITION_WIDTH * hscale;
  const yHigh = axisOffset + rowY + TRACE_PADDING;
  const yLow = axisOffset + rowY + rowH - TRACE_PADDING;
  const yMid = axisOffset + rowY + rowH / 2;
  const states = signal.states;
  const glitches = signal.stepGlitches ?? [];
  const parts: string[] = [];
  let pathD = '';
  let prevY = bitY(states[0] ?? '0', yHigh, yLow, yMid);
  let pathOpen = false;
  const color = esc(signal.color);

  const flushPath = () => {
    if (pathOpen && pathD) {
      parts.push(
        `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2"/>`,
      );
      pathD = '';
      pathOpen = false;
    }
  };

  for (let i = 0; i < totalSteps; i++) {
    const st = states[i] ?? '0';
    const x = i * cellW;
    const nextX = (i + 1) * cellW;

    if (st === 'p' || st === 'n' || st === 'P' || st === 'N') {
      flushPath();
      parts.push(...clockStepSvg(st, x, nextX, yHigh, yLow, color));
      prevY = clockStepEndY(st, yHigh, yLow);
      continue;
    }

    if (st === 'x') {
      flushPath();
      parts.push(
        `<rect x="${x}" y="${yHigh}" width="${nextX - x}" height="${yLow - yHigh}" fill="url(#hatch-x)" stroke="${esc(X_STROKE)}" stroke-width="1"/>`,
      );
      parts.push(
        `<path d="M${x},${yHigh} L${nextX},${yHigh} M${x},${yLow} L${nextX},${yLow}" fill="none" stroke="${esc(X_STROKE)}" stroke-width="1"/>`,
      );
      continue;
    }

    if (st === 'z') {
      flushPath();
      parts.push(
        `<path d="M${x},${yMid} L${nextX},${yMid}" fill="none" stroke="${esc(zStrokeColor(signal.color))}" stroke-width="2" stroke-dasharray="4,4"/>`,
      );
      prevY = yMid;
      continue;
    }

    if (st === 'u' || st === 'd') {
      flushPath();
      const y = bitY(st, yHigh, yLow, yMid);
      parts.push(
        `<path d="M${x},${y} L${nextX},${y}" fill="none" stroke="${esc(color)}99" stroke-width="2" stroke-dasharray="3,3"/>`,
      );
      prevY = y;
      continue;
    }

    const y = bitY(st, yHigh, yLow, yMid);
    if (!pathOpen) {
      pathD = `M${x},${prevY}`;
      pathOpen = true;
    }
    if (y !== prevY) {
      pathD += ` L${x + tw / 2},${prevY} L${x + tw},${y}`;
    }
    if (glitches[i] && canDrawGlitch(st)) {
      pathD = appendGlitchToSvgPath(
        pathD,
        nextX,
        y,
        glitchOppositeY(st, yHigh, yLow, yMid),
        tw,
      );
    } else {
      pathD += ` L${nextX},${y}`;
    }
    prevY = y;
  }
  flushPath();

  const gapStroke = esc(themeColor('--text-muted', '#888'));
  const gaps = signal.stepGaps ?? [];
  for (let i = 0; i < gaps.length; i++) {
    if (!gaps[i]) continue;
    parts.push(svgStepGap(i * cellW + tw, (i + 1) * cellW, yHigh, yLow, gapStroke));
  }

  return parts.join('\n');
}

function svgVectorSignal(
  signal: Signal,
  rowY: number,
  rowH: number,
  hscale: number,
  axisOffset: number,
): string {
  const cellW = CELL_WIDTH * hscale;
  const d = BUS_DIAGONAL * hscale;
  const yMid = axisOffset + rowY + rowH / 2;
  const yHigh = axisOffset + rowY + TRACE_PADDING;
  const yLow = axisOffset + rowY + rowH - TRACE_PADDING;
  const textFill = esc(themeColor('--text-primary', '#e8e8e8'));
  const textMuted = esc(themeColor('--text-secondary', '#b0b0b0'));
  const parts: string[] = [];

  for (const seg of signal.segments) {
    const x1 = seg.startStep * cellW;
    const x2 = seg.endStep * cellW;
    const span = x2 - x1;
    const unknown = isVectorUnknownValue(seg.value);
    const stroke = esc(segmentBusStroke(seg, signal));
    const fill = esc(segmentBusFill(seg, signal));

    if (span < d * 3) {
      parts.push(
        `<path d="M${x1},${yHigh} L${x2},${yLow} M${x1},${yLow} L${x2},${yHigh}" fill="none" stroke="${stroke}" stroke-width="2"/>`,
      );
      continue;
    }

    const path = `M${x1},${yMid} L${x1 + d},${yHigh} L${x2 - d},${yHigh} L${x2},${yMid} L${x2 - d},${yLow} L${x1 + d},${yLow} Z`;
    parts.push(
      `<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`,
    );
    const maxW = span - d * 2 - 8;
    if (maxW > 4) {
      const fs = Math.max(10, rowH * 0.35);
      parts.push(
        `<text x="${(x1 + x2) / 2}" y="${yMid}" fill="${unknown ? textMuted : textFill}" font-size="${fs}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${esc(seg.value)}</text>`,
      );
    }
  }
  return parts.join('\n');
}

function svgGrid(
  totalSteps: number,
  contentH: number,
  hscale: number,
  axisOffset: number,
  gridColor: string,
): string {
  const cellW = CELL_WIDTH * hscale;
  const lines: string[] = [];
  for (let i = 0; i <= totalSteps; i++) {
    const x = i * cellW;
    lines.push(
      `<line x1="${x}" y1="${axisOffset}" x2="${x}" y2="${axisOffset + contentH}" stroke="${esc(gridColor)}" stroke-width="1"/>`,
    );
  }
  return lines.join('\n');
}

function svgTimeAxis(
  totalSteps: number,
  hscale: number,
  waveformWidth: number,
  panelBg: string,
  textColor: string,
): string {
  const cellW = CELL_WIDTH * hscale;
  const parts = [
    `<rect x="0" y="0" width="${waveformWidth}" height="${TIME_AXIS_HEIGHT}" fill="${esc(panelBg)}"/>`,
  ];
  for (let i = 0; i < totalSteps; i++) {
    const x = i * cellW + cellW / 2;
    parts.push(
      `<text x="${x}" y="${TIME_AXIS_HEIGHT / 2}" fill="${esc(textColor)}" font-size="11" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${i}</text>`,
    );
  }
  return parts.join('\n');
}

function svgLabels(
  diagram: DiagramState,
  labelWidth: number,
  axisOffset: number,
  labelBg: string,
  textColor: string,
  totalHeight: number,
): string {
  const entries = buildLabelEntries(diagram.signals);
  const parts = [
    `<rect x="0" y="0" width="${labelWidth}" height="${totalHeight}" fill="${esc(labelBg)}"/>`,
  ];
  for (const entry of entries) {
    const x = 8 + entry.depth * 12;
    const y = axisOffset + entry.y + entry.height / 2;
    const weight = entry.isGroup ? ' font-weight="600" font-size="11"' : ' font-size="12"';
    parts.push(
      `<text x="${x}" y="${y}" fill="${esc(textColor)}" font-family="sans-serif" dominant-baseline="middle"${weight}>${esc(entry.name)}</text>`,
    );
  }
  return parts.join('\n');
}

function walkSignalSvg(
  list: SignalOrGroup[],
  rows: ReturnType<typeof buildRowLayout>,
  diagram: DiagramState,
  axisOffset: number,
  rowIndex: { i: number },
): string {
  const parts: string[] = [];
  const hscale = diagram.config.hscale;

  for (const item of list) {
    const row = rows[rowIndex.i];
    if (!row) break;
    if (item.type === 'group') {
      rowIndex.i++;
      if (!item.collapsed) {
        parts.push(walkSignalSvg(item.children, rows, diagram, axisOffset, rowIndex));
      }
    } else if (item.type === 'bit') {
      parts.push(
        svgBitSignal(
          item,
          row.y,
          row.height,
          diagram.config.totalSteps,
          hscale,
          axisOffset,
        ),
      );
      rowIndex.i++;
    } else if (item.type === 'vector') {
      parts.push(
        svgVectorSignal(item, row.y, row.height, hscale, axisOffset),
      );
      rowIndex.i++;
    } else {
      rowIndex.i++;
    }
  }
  return parts.join('\n');
}

export function exportSVG(diagram: DiagramState, view: ViewState): void {
  const dims = computeExportDimensions(diagram, view);
  const rows = buildRowLayout(diagram.signals);
  const contentH = totalContentHeight(rows);
  const bg = themeColor('--bg-canvas', '#111111');
  const labelBg = themeColor('--bg-panel', '#242424');
  const textColor = themeColor('--text-primary', '#e8e8e8');
  const gridColor = themeColor('--grid-line', '#333333');
  const panelBg = themeColor('--bg-panel', '#242424');

  const waveformParts: string[] = [];
  if (view.showTimeAxis) {
    waveformParts.push(
      svgTimeAxis(
        diagram.config.totalSteps,
        diagram.config.hscale,
        dims.waveformWidth,
        panelBg,
        themeColor('--text-secondary', '#999999'),
      ),
    );
  }
  waveformParts.push(
    svgGrid(
      diagram.config.totalSteps,
      contentH,
      diagram.config.hscale,
      dims.axisOffset,
      gridColor,
    ),
  );
  waveformParts.push(
    walkSignalSvg(diagram.signals, rows, diagram, dims.axisOffset, { i: 0 }),
  );
  const edgeSvg = svgEdges(diagram, view, 0);
  if (edgeSvg) waveformParts.push(edgeSvg);

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${dims.totalWidth}" height="${dims.totalHeight}" viewBox="0 0 ${dims.totalWidth} ${dims.totalHeight}">
  <defs>
    <pattern id="hatch-x" width="8" height="8" patternUnits="userSpaceOnUse">
      <path d="M0,8 L8,0" stroke="${esc(X_STROKE)}" stroke-width="1"/>
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="${esc(bg)}"/>
  ${svgLabels(diagram, dims.labelWidth, dims.axisOffset, labelBg, textColor, dims.totalHeight)}
  <g transform="translate(${dims.labelWidth}, 0)">
    ${waveformParts.join('\n')}
  </g>
</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  saveAs(blob, `${exportBaseName(view)}.svg`);
}
