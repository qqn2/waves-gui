import type { WdRoot } from '../wavedromBridge';

export interface UndulateAnnotationStyle {
  fill?: string;
  stroke?: string;
  'stroke-width'?: number;
  'stroke-dasharray'?: number[];
  'font-size'?: number | string;
  font?: 'sans-serif' | 'serif' | 'monospace';
  'font-weight'?: number | string;
  text_background?: boolean;
}

export type UndulateAnnotationRange = number | string;

export interface UndulateTextAnnotation extends UndulateAnnotationStyle {
  text: string;
  x: number;
  y: number;
}

export interface UndulateVerticalLineAnnotation extends UndulateAnnotationStyle {
  shape: '|';
  x: number;
  from?: UndulateAnnotationRange;
  to?: UndulateAnnotationRange;
}

export interface UndulateHorizontalLineAnnotation extends UndulateAnnotationStyle {
  shape: '-';
  y: number;
  from?: UndulateAnnotationRange;
  to?: UndulateAnnotationRange;
}

export interface UndulateGlobalCompressionAnnotation extends UndulateAnnotationStyle {
  shape: '||';
  x: number;
  from?: UndulateAnnotationRange;
  to?: UndulateAnnotationRange;
}

export type UndulateAnnotationAnchor = string | [number | string, number | string];

export interface UndulateArrowAnnotation extends UndulateAnnotationStyle {
  shape: string;
  from: UndulateAnnotationAnchor;
  to: UndulateAnnotationAnchor;
  text?: string;
  dx?: number;
  dy?: number;
}

export type UndulateAnnotation =
  | UndulateTextAnnotation
  | UndulateVerticalLineAnnotation
  | UndulateHorizontalLineAnnotation
  | UndulateGlobalCompressionAnnotation
  | UndulateArrowAnnotation;

export type UndulateAnalogueValue =
  | number
  | string
  | Array<[number, number]>;

export interface WavesGuiUndulateMetadata {
  analogueContext?: { vssa: number; vdda: number };
  randomSeed?: number;
  edgeCurveControls?: Record<string, { c1x: number; c2x: number }>;
  importMode?: 'event-compressed-vcd';
}

export interface UndulateRoot extends WdRoot {
  annotations?: UndulateAnnotation[];
  /** Undulate's canonical dependency-edge field (plural). */
  edges?: string[];
  /** Namespaced editor context omitted by strict upstream export. */
  'x-waves-gui'?: WavesGuiUndulateMetadata;
}
