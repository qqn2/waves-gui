import type { WdRoot } from '../wavedromBridge';

export interface UndulateAnnotationStyle {
  fill?: string;
  stroke?: string;
  'stroke-width'?: number;
  'stroke-dasharray'?: number[];
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
  | Array<[number, number]>;

export interface UndulateRoot extends WdRoot {
  annotations?: UndulateAnnotation[];
}
