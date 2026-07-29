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
import { X_STROKE } from '../renderer/stateColors';
import {
  signalStroke,
  signalStrokeDasharray,
  signalStrokeWidth,
} from '../renderer/signalStyle';
import { segmentBusFill, segmentBusStroke, segmentBusTextColor } from '../renderer/vectorBusStyle';
import { svgEdges } from './exportEdges';
import { computeExportDimensions } from './exportDimensions';
import { buildLabelEntries } from './labelEntries';
import { exportBaseName } from './fileName';
import {
  clockCycleEndY,
  clockCycleSvg,
  clockLevelEndY,
  clockLevelSvg,
  isClockLevelState,
} from '../renderer/drawClock';
import { stepLogicalX, stepLogicalXEnd } from '../renderer/laneTiming';
import { svgStepGap } from '../renderer/drawStepGap';
import {
  appendGlitchToSvgPath,
  canDrawGlitch,
  glitchOppositeY,
} from '../renderer/drawStepGlitch';
import {
  layoutLineAnnotations,
  layoutTextAnnotations,
  layoutArrowAnnotations,
} from '../renderer/annotationLayout';
import { splitEdgeConnector } from '../shared/edgeSyntax';
import {
  buildStepLabels,
  FOOT_TEXT_BAND,
  FOOT_TOCK_BAND,
  HEAD_FOOT_BAND_PAD,
  HEAD_TEXT_BAND,
  HEAD_TICK_BAND,
  measureHeadFoot,
} from '../renderer/renderHeadFoot';
import {
  analoguePathPoints,
  analogueValueRatio,
} from '../renderer/analogueGeometry';
import { fillHexForWaveChar } from '../shared/vectorSegments';

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
    case 'h':
    case 'H':
      return yHigh;
    case '0':
    case 'l':
    case 'L':
      return yLow;
    case 'z':
      return yMid;
    case 'u':
      return yHigh;
    case 'd':
      return yLow;
    default:
      return yMid;
  }
}

function isExtendedDataState(state: BitState): boolean {
  return state === 'x' || state === 'X' || state === '='
    || (state >= '2' && state <= '9');
}

function isExtendedTransientState(state: BitState): boolean {
  return state === 'i' || state === 'I' || state === 'm' || state === 'M';
}

function svgExtendedDataCell(
  state: BitState,
  x: number,
  nextX: number,
  yHigh: number,
  yLow: number,
  bevel: number,
  fillOverride?: string,
  strokeOverride?: string,
): string {
  const d = Math.min(bevel, Math.max(1, (nextX - x) * 0.2));
  const yMid = (yHigh + yLow) / 2;
  const path =
    `M${x},${yMid} L${x + d},${yHigh} L${nextX - d},${yHigh} `
    + `L${nextX},${yMid} L${nextX - d},${yLow} L${x + d},${yLow} Z`;
  const unknown = state === 'x' || state === 'X';
  const fill = fillOverride ? esc(fillOverride) : unknown
    ? 'url(#hatch-x)'
    : esc(fillHexForWaveChar(state) ?? '#ffffff');
  const stroke = strokeOverride
    ? esc(strokeOverride)
    : unknown ? esc(X_STROKE) : '#6b7280';
  return `<path data-wave-state="${esc(state)}" d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
}

function svgTransientCell(
  state: BitState,
  x: number,
  nextX: number,
  yHigh: number,
  yLow: number,
  previousY: number,
  color: string,
  slew: number,
  dutyCycle: number,
): { svg: string; endY: number } {
  const width = nextX - x;
  if (state === 'i' || state === 'I') {
    const baseY = state === 'i' ? yHigh : yLow;
    const pulseY = state === 'i' ? yLow : yHigh;
    const pulseX = x + width * Math.max(0, Math.min(1, dutyCycle));
    const span = Math.max(1, yLow - yHigh);
    const settleX = Math.min(
      pulseX,
      x + Math.abs(baseY - previousY) * slew / span,
    );
    const d =
      `M${x},${previousY} L${settleX},${baseY} L${pulseX},${baseY} `
      + `L${pulseX},${pulseY} L${pulseX},${baseY} L${nextX},${baseY}`;
    return {
      svg: `<path data-wave-state="${state}" d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`,
      endY: baseY,
    };
  }

  const resolvesHigh = state === 'M';
  const samples = 28;
  let d = `M${x},${previousY}`;
  for (let sample = 0; sample <= samples; sample++) {
    const t = (sample / samples) * 0.75;
    const amplitude = Math.exp(2 * (t - 1));
    const phase = resolvesHigh ? Math.PI : 0;
    const normalized = (1 + amplitude * Math.sin(phase + 8 * Math.PI * t)) / 2;
    d += ` L${x + t * width},${yHigh + normalized * (yLow - yHigh)}`;
  }
  const targetY = resolvesHigh ? yHigh : yLow;
  d +=
    ` C${x + width * 0.85},${targetY} ${x + width * 0.9},${targetY} `
    + `${nextX},${targetY}`;
  return {
    svg: `<path data-wave-state="${state}" d="${d}" fill="none" stroke="${color}" stroke-width="2"/>`,
    endY: targetY,
  };
}

function svgRelaxedDigitalCell(
  state: 'z' | 'u' | 'd',
  x: number,
  nextX: number,
  previousY: number,
  yHigh: number,
  yLow: number,
  yMid: number,
  slew: number,
  hscale: number,
  color: string,
): { svg: string; endY: number } {
  const targetY = state === 'z' ? yMid : state === 'u' ? yHigh : yLow;
  const span = Math.max(1, yLow - yHigh);
  const dt = Math.abs(targetY - previousY) * slew * hscale / span;
  const settleX = Math.min(nextX, x + 20 * hscale);
  const curve = state === 'z'
    ? `C${x + dt},${targetY} ${x + dt},${targetY} ${settleX},${targetY}`
    : `C${x},${previousY} ${x + dt},${targetY} ${settleX},${targetY}`;
  return {
    svg: `<path data-wave-state="${state}" d="M${x},${previousY} ${curve} L${nextX},${targetY}" fill="none" stroke="${color}" stroke-width="2"/>`,
    endY: targetY,
  };
}

function svgBitSignal(
  signal: Signal,
  rowY: number,
  rowH: number,
  totalSteps: number,
  hscale: number,
  axisOffset: number,
): string {
  const yHigh = axisOffset + rowY + TRACE_PADDING;
  const yLow = axisOffset + rowY + rowH - TRACE_PADDING;
  const yMid = axisOffset + rowY + rowH / 2;
  const states = signal.states;
  const glitches = signal.stepGlitches ?? [];
  const parts: string[] = [];
  let pathD = '';
  let prevY = bitY(states[0] ?? '0', yHigh, yLow, yMid);
  let pathOpen = false;
  let resumeAtCurrentState = false;
  const color = esc(signalStroke(signal));
  const strokeWidth = signalStrokeWidth(signal);
  const extendedDigital = states.some(
    (state) => state === 'X' || state === '='
      || (state >= '2' && state <= '9')
      || state === 'u' || state === 'd'
      || isClockLevelState(state)
      || isExtendedTransientState(state),
  );
  const slewLogical = signal.digitalTiming?.slewing !== undefined
    ? Math.max(0, signal.digitalTiming.slewing)
    : extendedDigital ? 0 : TRANSITION_WIDTH;
  const clockSlewLogical = Math.max(0, signal.digitalTiming?.slewing ?? 0);
  const tw = slewLogical * hscale;

  const flushPath = () => {
    if (pathOpen && pathD) {
      parts.push(
        `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`,
      );
      pathD = '';
      pathOpen = false;
    }
  };

  for (let i = 0; i < totalSteps; i++) {
    const st = states[i] ?? '0';
    const x = stepLogicalX(signal, i) * hscale;
    const nextX = stepLogicalXEnd(signal, i) * hscale;

    if (extendedDigital && isExtendedDataState(st)) {
      flushPath();
      let runEnd = i + 1;
      while (
        runEnd < totalSteps
        && states[runEnd] === st
        && !signal.stepGaps?.[runEnd]
      ) {
        runEnd++;
      }
      const dataNextX = stepLogicalXEnd(signal, runEnd - 1) * hscale;
      parts.push(svgExtendedDataCell(
        st,
        x,
        dataNextX,
        yHigh,
        yLow,
        3 * hscale,
        signal.style?.fill,
        signal.style?.stroke,
      ));
      i = runEnd - 1;
      resumeAtCurrentState = true;
      continue;
    }

    if (isExtendedTransientState(st)) {
      flushPath();
      const transient = svgTransientCell(
        st,
        x,
        nextX,
        yHigh,
        yLow,
        resumeAtCurrentState ? yMid : prevY,
        color,
        clockSlewLogical * hscale,
        signal.digitalTiming?.cells[i]?.dutyTicks === undefined
          ? 0.5
          : signal.digitalTiming.cells[i]!.dutyTicks!
            / signal.digitalTiming.cells[i]!.durationTicks,
      );
      parts.push(transient.svg);
      prevY = transient.endY;
      resumeAtCurrentState = false;
      continue;
    }

    if (isClockLevelState(st)) {
      flushPath();
      const targetY = clockLevelEndY(st, yHigh, yLow);
      parts.push(...clockLevelSvg(
        st,
        x,
        nextX,
        resumeAtCurrentState ? targetY : prevY,
        yHigh,
        yLow,
        color,
        i > 0,
        clockSlewLogical * hscale,
      ));
      prevY = targetY;
      resumeAtCurrentState = false;
      continue;
    }

    if (st === 'p' || st === 'n' || st === 'P' || st === 'N') {
      flushPath();
      const timingCell = signal.digitalTiming?.cells[i];
      parts.push(...clockCycleSvg(
        st,
        x,
        nextX,
        yHigh,
        yLow,
        color,
        timingCell?.dutyTicks === undefined
          ? 0.5
          : timingCell.dutyTicks / timingCell.durationTicks,
        clockSlewLogical * hscale,
      ));
      prevY = clockCycleEndY(st, yHigh, yLow);
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

    if (st === 'z' || st === 'u' || st === 'd') {
      flushPath();
      const relaxed = svgRelaxedDigitalCell(
        st,
        x,
        nextX,
        resumeAtCurrentState ? yMid : prevY,
        yHigh,
        yLow,
        yMid,
        slewLogical,
        hscale,
        color,
      );
      parts.push(relaxed.svg);
      prevY = relaxed.endY;
      resumeAtCurrentState = false;
      continue;
    }

    const y = bitY(st, yHigh, yLow, yMid);
    if (!pathOpen) {
      if (resumeAtCurrentState) prevY = y;
      pathD = `M${x},${prevY}`;
      pathOpen = true;
      resumeAtCurrentState = false;
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

  const gapStroke = esc(themeColor('--text-primary', '#e8e8e8'));
  const gapFill = esc(themeColor('--bg-canvas', '#121212'));
  for (let i = 0; i < totalSteps; i++) {
    if (!signal.stepGaps?.[i]) continue;
    const x1 = stepLogicalX(signal, i) * hscale;
    const x2 = stepLogicalXEnd(signal, i) * hscale;
    parts.push(svgStepGap(x1, x2, yHigh, yLow, gapStroke, gapFill));
  }

  const content = parts.join('\n').replaceAll(
    'stroke-width="2"',
    `stroke-width="${strokeWidth}"`,
  );
  const dash = signalStrokeDasharray(signal);
  return dash.length > 0
    ? `<g stroke-dasharray="${dash.join(' ')}">${content}</g>`
    : content;
}

function svgVectorSignal(
  signal: Signal,
  rowY: number,
  rowH: number,
  hscale: number,
  axisOffset: number,
): string {
  const d = BUS_DIAGONAL * hscale;
  const yMid = axisOffset + rowY + rowH / 2;
  const yHigh = axisOffset + rowY + TRACE_PADDING;
  const yLow = axisOffset + rowY + rowH - TRACE_PADDING;
  const parts: string[] = [];
  const strokeWidth = signalStrokeWidth(signal);
  const dash = signalStrokeDasharray(signal);
  const dashAttr = dash.length > 0
    ? ` stroke-dasharray="${dash.join(' ')}"`
    : '';

  for (const seg of signal.segments) {
    const x1 = stepLogicalX(signal, seg.startStep) * hscale;
    const x2 = stepLogicalXEnd(signal, seg.endStep - 1) * hscale;
    const span = x2 - x1;
    const stroke = esc(segmentBusStroke(seg, signal));
    const fill = esc(segmentBusFill(seg, signal));

    if (span < d * 3) {
      parts.push(
        `<path d="M${x1},${yHigh} L${x2},${yLow} M${x1},${yLow} L${x2},${yHigh}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}/>`,
      );
      continue;
    }

    const path = `M${x1},${yMid} L${x1 + d},${yHigh} L${x2 - d},${yHigh} L${x2},${yMid} L${x2 - d},${yLow} L${x1 + d},${yLow} Z`;
    parts.push(
      `<path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"${dashAttr}/>`,
    );
    const maxW = span - d * 2 - 8;
    if (maxW > 4) {
      const fs = signal.style?.fontSize ?? Math.max(10, rowH * 0.35);
      parts.push(
        `<text x="${(x1 + x2) / 2}" y="${yMid}" fill="${esc(segmentBusTextColor(seg))}" font-size="${fs}" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">${esc(seg.value)}</text>`,
      );
    }
  }

  const gapStroke = esc(themeColor('--text-primary', '#e8e8e8'));
  const gapFill = esc(themeColor('--bg-canvas', '#121212'));
  const gaps = signal.stepGaps ?? [];
  for (let i = 0; i < gaps.length; i++) {
    if (!gaps[i]) continue;
    const x1 = stepLogicalX(signal, i) * hscale;
    const x2 = stepLogicalXEnd(signal, i) * hscale;
    parts.push(svgStepGap(x1, x2, yHigh, yLow, gapStroke, gapFill));
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

function svgHeadFoot(
  diagram: DiagramState,
  contentHeight: number,
  waveformWidth: number,
  textColor: string,
  secondaryTextColor: string,
): string {
  const { headHeight, footHeight } = measureHeadFoot(diagram.config);
  if (headHeight === 0 && footHeight === 0) return '';

  const parts: string[] = [];
  const cellWidth = CELL_WIDTH * diagram.config.hscale;
  let y = TIME_AXIS_HEIGHT + HEAD_FOOT_BAND_PAD;

  if (diagram.config.head?.text) {
    parts.push(
      `<text x="${waveformWidth / 2}" y="${y + HEAD_TEXT_BAND / 2}" `
        + `fill="${esc(textColor)}" font-size="12" font-family="sans-serif" `
        + `text-anchor="middle" dominant-baseline="middle">${esc(diagram.config.head.text)}</text>`,
    );
    y += HEAD_TEXT_BAND + HEAD_FOOT_BAND_PAD;
  }
  if (
    diagram.config.head?.tick !== undefined
    || diagram.config.head?.every !== undefined
  ) {
    const labels = buildStepLabels(
      diagram.config.head.tick,
      diagram.config.head.every,
      diagram.config.totalSteps,
    );
    labels.forEach((label, index) => {
      if (!label) return;
      parts.push(
        `<text x="${index * cellWidth + cellWidth / 2}" y="${y + HEAD_TICK_BAND / 2}" `
          + `fill="${esc(secondaryTextColor)}" font-size="10" font-family="sans-serif" `
          + `text-anchor="middle" dominant-baseline="middle">${esc(label)}</text>`,
      );
    });
  }

  let footY = TIME_AXIS_HEIGHT + headHeight + contentHeight
    + HEAD_FOOT_BAND_PAD;
  if (diagram.config.foot?.text) {
    parts.push(
      `<text x="${waveformWidth / 2}" y="${footY + FOOT_TEXT_BAND / 2}" `
        + `fill="${esc(textColor)}" font-size="12" font-family="sans-serif" `
        + `text-anchor="middle" dominant-baseline="middle">${esc(diagram.config.foot.text)}</text>`,
    );
    footY += FOOT_TEXT_BAND + HEAD_FOOT_BAND_PAD;
  }
  if (
    diagram.config.foot?.tock !== undefined
    || diagram.config.foot?.every !== undefined
  ) {
    const labels = buildStepLabels(
      diagram.config.foot.tock,
      diagram.config.foot.every,
      diagram.config.totalSteps,
    );
    labels.forEach((label, index) => {
      if (!label) return;
      parts.push(
        `<text x="${(index + 1) * cellWidth}" y="${footY + FOOT_TOCK_BAND / 2}" `
          + `fill="${esc(secondaryTextColor)}" font-size="10" font-family="sans-serif" `
          + `text-anchor="middle" dominant-baseline="middle">${esc(label)}</text>`,
      );
    });
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
    const y = axisOffset + entry.y + entry.height * entry.centerRatio;
    const weight = entry.isGroup ? ' font-weight="600" font-size="11"' : ' font-size="12"';
    parts.push(
      `<text x="${x}" y="${y}" fill="${esc(textColor)}" font-family="sans-serif" dominant-baseline="middle"${weight}>${esc(entry.name)}</text>`,
    );
  }
  return parts.join('\n');
}

function svgAnnotations(
  diagram: DiagramState,
  rows: ReturnType<typeof buildRowLayout>,
  axisOffset: number,
  textColor: string,
  panelBg: string,
): string {
  const arrows = layoutArrowAnnotations(diagram, rows).map(({ annotation, from, to }, index) => {
    const x1 = from.x * diagram.config.hscale;
    const x2 = to.x * diagram.config.hscale;
    const y1 = axisOffset + from.y;
    const y2 = axisOffset + to.y;
    const stroke = esc(annotation.style?.stroke ?? textColor);
    const width = annotation.style?.strokeWidth ?? 1.5;
    const dash = annotation.style?.strokeDasharray?.join(' ');
    const markerId = `undulate-arrow-${index}`;
    const path = annotation.shape.includes('~')
      ? `M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`
      : `M ${x1} ${y1} L ${x2} ${y2}`;
    const end = annotation.shape.includes('>') ? ` marker-end="url(#${markerId})"` : '';
    const start = annotation.shape.includes('<') ? ` marker-start="url(#${markerId})"` : '';
    const endpoints = splitEdgeConnector(annotation.shape);
    const endpointShape = (
      decoration: 'none' | 'arrow' | 'square' | 'circle',
      x: number,
      y: number,
    ) => decoration === 'square'
      ? `<rect x="${x - 4}" y="${y - 4}" width="8" height="8" fill="${stroke}"/>`
      : decoration === 'circle'
        ? `<circle cx="${x}" cy="${y}" r="4" fill="${stroke}"/>`
        : '';
    const labelFontSize = annotation.style?.fontSize ?? 12;
    const labelX = (x1 + x2) / 2 + (annotation.dx ?? 0);
    const labelY = (y1 + y2) / 2 + (annotation.dy ?? 0);
    const labelBackground = annotation.text && annotation.style?.textBackground !== false
      ? `<rect x="${labelX - annotation.text.length * labelFontSize * 0.3 - 4}" `
        + `y="${labelY - labelFontSize * 0.675}" `
        + `width="${annotation.text.length * labelFontSize * 0.6 + 8}" `
        + `height="${labelFontSize * 1.35}" fill="${esc(panelBg)}"/>`
      : '';
    const label = annotation.text
      ? `${labelBackground}<text x="${labelX}" y="${labelY}" `
        + `fill="${esc(annotation.style?.fill ?? textColor)}" text-anchor="middle" `
        + `dominant-baseline="middle" font-family="sans-serif" `
        + `font-size="${labelFontSize}">${esc(annotation.text)}</text>`
      : '';
    return `<defs><marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8" fill="none" stroke="${stroke}"/></marker></defs>`
      + `<path d="${path}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}${start}${end}/>`
      + endpointShape(endpoints.start, x1, y1)
      + endpointShape(endpoints.end, x2, y2)
      + label;
  }).join('\n');
  const text = layoutTextAnnotations(diagram, rows)
    .map(({ annotation, x, y }) => {
      const style = annotation.style;
      const fontSize = style?.fontSize ?? 12;
      const canvasX = x * diagram.config.hscale;
      const canvasY = axisOffset + y;
      const background = style?.textBackground !== false
        ? `<rect x="${canvasX - annotation.text.length * fontSize * 0.3 - 4}" `
          + `y="${canvasY - fontSize * 0.675}" `
          + `width="${annotation.text.length * fontSize * 0.6 + 8}" `
          + `height="${fontSize * 1.35}" fill="${esc(panelBg)}"/>`
        : '';
      const stroke = style?.stroke ?? 'none';
      const strokeWidth = style?.stroke ? (style.strokeWidth ?? 1) : 0;
      const dash = style?.strokeDasharray
        ? ` stroke-dasharray="${style.strokeDasharray.join(' ')}"`
        : '';
      return `${background}<text x="${canvasX}" y="${canvasY}" `
        + `fill="${esc(style?.fill ?? textColor)}" stroke="${esc(stroke)}" `
        + `stroke-width="${strokeWidth}"${dash} `
        + `paint-order="stroke" stroke-linejoin="round" text-anchor="middle" `
        + `dominant-baseline="middle" font-family="sans-serif" font-size="${fontSize}">`
        + `${esc(annotation.text)}</text>`;
    })
    .join('\n');
  const lines = layoutLineAnnotations(diagram, rows).map((layout) => {
    const style = layout.annotation.style;
    const stroke = esc(style?.stroke ?? textColor);
    const width = style?.strokeWidth ?? 1.5;
    const dash = style?.strokeDasharray?.join(' ')
      ?? (layout.orientation === 'compression' ? '' : '5 4');
    const dashAttribute = dash ? ` stroke-dasharray="${dash}"` : '';
    if (layout.orientation === 'vertical' || layout.orientation === 'compression') {
      const x = layout.position * diagram.config.hscale;
      const line = (lineX: number) => `<line x1="${lineX}" y1="${axisOffset + layout.rangeStart}" x2="${lineX}" `
        + `y2="${axisOffset + layout.rangeEnd}" stroke="${stroke}" `
        + `stroke-width="${width}"${dashAttribute}/>`;
      return layout.orientation === 'compression'
        ? `<rect x="${x - 6}" y="${axisOffset + layout.rangeStart}" width="12" `
          + `height="${layout.rangeEnd - layout.rangeStart}" fill="${esc(panelBg)}"/>\n`
          + `${line(x - 3)}\n${line(x + 3)}`
        : line(x);
    }
    const y = axisOffset + layout.position;
    return `<line x1="${layout.rangeStart * diagram.config.hscale}" y1="${y}" `
      + `x2="${layout.rangeEnd * diagram.config.hscale}" y2="${y}" `
      + `stroke="${stroke}" stroke-width="${width}"${dashAttribute}/>`;
  }).join('\n');
  return [lines, arrows, text].filter(Boolean).join('\n');
}

function svgAnalogueSignal(
  signal: Signal,
  rowY: number,
  rowHeight: number,
  hscale: number,
  axisOffset: number,
): string {
  const points = analoguePathPoints(signal);
  if (points.length === 0) return '';
  const usableHeight = Math.max(1, rowHeight - TRACE_PADDING * 2);
  const path = points.map((point, index) => {
    const x = point.step * CELL_WIDTH * hscale;
    const y =
      axisOffset
      + rowY
      + TRACE_PADDING
      + (1 - analogueValueRatio(signal, point.value)) * usableHeight;
    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');
  const dash = signalStrokeDasharray(signal);
  const dashAttribute = dash.length > 0
    ? ` stroke-dasharray="${dash.join(' ')}"`
    : '';
  return `<path d="${path}" fill="none" stroke="${esc(signalStroke(signal))}" `
    + `stroke-width="${signalStrokeWidth(signal)}"${dashAttribute} `
    + 'stroke-linejoin="round" stroke-linecap="round"/>';
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
    } else if (item.type === 'analogue') {
      if (diagram.compatibility?.extensionsEnabled === true) {
        parts.push(
          svgAnalogueSignal(
            item,
            row.y,
            row.height,
            hscale,
            axisOffset,
          ),
        );
      }
      rowIndex.i++;
    } else {
      rowIndex.i++;
    }
  }
  return parts.join('\n');
}

export function buildSVGString(diagram: DiagramState, view: ViewState): string {
  const dims = computeExportDimensions(diagram, view);
  const rows = buildRowLayout(diagram.signals);
  const contentH = totalContentHeight(rows);
  const bg = themeColor('--bg-canvas', '#111111');
  const labelBg = themeColor('--bg-panel', '#242424');
  const textColor = themeColor('--text-primary', '#e8e8e8');
  const gridColor = themeColor('--grid-line', '#333333');
  const panelBg = themeColor('--bg-panel', '#242424');
  const secondaryTextColor = themeColor('--text-secondary', '#999999');

  const waveformParts: string[] = [];
  waveformParts.push(
    svgTimeAxis(
      diagram.config.totalSteps,
      diagram.config.hscale,
      dims.waveformWidth,
      panelBg,
      secondaryTextColor,
    ),
  );
  const headFootSvg = svgHeadFoot(
    diagram,
    contentH,
    dims.waveformWidth,
    textColor,
    secondaryTextColor,
  );
  if (headFootSvg) waveformParts.push(headFootSvg);
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
  const annotationSvg = svgAnnotations(
    diagram,
    rows,
    dims.axisOffset,
    textColor,
    bg,
  );
  if (annotationSvg) waveformParts.push(annotationSvg);
  const edgeSvg = svgEdges(diagram, view, 0);
  if (edgeSvg) waveformParts.push(edgeSvg);

  return `<?xml version="1.0" encoding="UTF-8"?>
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
}

export function exportSVG(diagram: DiagramState, view: ViewState): void {
  const svg = buildSVGString(diagram, view);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  saveAs(blob, `${exportBaseName(view)}.svg`);
}
