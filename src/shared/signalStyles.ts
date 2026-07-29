import {
  isSafeAnnotationColor,
  isSafeAnnotationDasharray,
  isSafeAnnotationFontSize,
  isSafeAnnotationStrokeWidth,
  parseAnnotationFontFamily,
  parseAnnotationFontSize,
  parseAnnotationFontWeight,
} from './annotations';
import type { SignalStyle } from './types';

export function normalizeSignalStyle(
  value: SignalStyle | undefined,
): SignalStyle | undefined {
  if (!value) return undefined;
  const style: SignalStyle = {};
  if (isSafeAnnotationColor(value.fill)) style.fill = value.fill.trim();
  if (isSafeAnnotationColor(value.stroke)) style.stroke = value.stroke.trim();
  if (isSafeAnnotationStrokeWidth(value.strokeWidth)) {
    style.strokeWidth = value.strokeWidth;
  }
  if (isSafeAnnotationDasharray(value.strokeDasharray)) {
    style.strokeDasharray = [...value.strokeDasharray];
  }
  if (isSafeAnnotationFontSize(value.fontSize)) {
    style.fontSize = value.fontSize;
  }
  const fontFamily = parseAnnotationFontFamily(value.fontFamily);
  if (fontFamily) style.fontFamily = fontFamily;
  const fontWeight = parseAnnotationFontWeight(value.fontWeight);
  if (fontWeight) style.fontWeight = fontWeight;
  return Object.keys(style).length > 0 ? style : undefined;
}

export function signalStyleFromUndulate(
  value: Record<string, unknown>,
): SignalStyle | undefined {
  return normalizeSignalStyle({
    fill: typeof value.fill === 'string' ? value.fill : undefined,
    stroke: typeof value.stroke === 'string' ? value.stroke : undefined,
    strokeWidth: typeof value['stroke-width'] === 'number'
      ? value['stroke-width']
      : undefined,
    strokeDasharray: Array.isArray(value['stroke-dasharray'])
      ? value['stroke-dasharray'] as number[]
      : undefined,
    fontSize: parseAnnotationFontSize(value['font-size']),
    fontFamily: parseAnnotationFontFamily(value.font),
    fontWeight: parseAnnotationFontWeight(value['font-weight']),
  });
}

export function signalStyleToUndulate(
  style: SignalStyle | undefined,
): Record<string, unknown> {
  const normalized = normalizeSignalStyle(style);
  if (!normalized) return {};
  return {
    ...(normalized.fill !== undefined ? { fill: normalized.fill } : {}),
    ...(normalized.stroke !== undefined ? { stroke: normalized.stroke } : {}),
    ...(normalized.strokeWidth !== undefined
      ? { 'stroke-width': normalized.strokeWidth }
      : {}),
    ...(normalized.strokeDasharray !== undefined
      ? { 'stroke-dasharray': [...normalized.strokeDasharray] }
      : {}),
    ...(normalized.fontSize !== undefined
      ? { 'font-size': `${normalized.fontSize}px` }
      : {}),
    ...(normalized.fontFamily !== undefined
      ? { font: normalized.fontFamily }
      : {}),
    ...(normalized.fontWeight !== undefined
      ? { 'font-weight': normalized.fontWeight }
      : {}),
  };
}
