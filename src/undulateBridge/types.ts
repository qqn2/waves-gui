import type { WdRoot } from '../wavedromBridge';

export interface UndulateAnnotationStyle {
  fill?: string;
  stroke?: string;
  'stroke-width'?: number;
  'stroke-dasharray'?: number[];
}

export interface UndulateTextAnnotation extends UndulateAnnotationStyle {
  text: string;
  x: number;
  y: number;
}

export interface UndulateVerticalLineAnnotation extends UndulateAnnotationStyle {
  shape: '|';
  x: number;
}

export interface UndulateHorizontalLineAnnotation extends UndulateAnnotationStyle {
  shape: '-';
  y: number;
}

export interface UndulateGlobalCompressionAnnotation extends UndulateAnnotationStyle {
  shape: '||';
  x: number;
}

export type UndulateAnnotation =
  | UndulateTextAnnotation
  | UndulateVerticalLineAnnotation
  | UndulateHorizontalLineAnnotation
  | UndulateGlobalCompressionAnnotation;

export type UndulateAnalogueValue =
  | number
  | Array<[number, number]>;

export interface UndulateRoot extends WdRoot {
  annotations?: UndulateAnnotation[];
}
