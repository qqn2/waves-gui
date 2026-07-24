import type { WdRoot } from '../wavedromBridge';

export interface UndulateTextAnnotation {
  text: string;
  x: number;
  y: number;
}

export interface UndulateVerticalLineAnnotation {
  shape: '|';
  x: number;
}

export interface UndulateHorizontalLineAnnotation {
  shape: '-';
  y: number;
}

export type UndulateAnnotation =
  | UndulateTextAnnotation
  | UndulateVerticalLineAnnotation
  | UndulateHorizontalLineAnnotation;

export type UndulateAnalogueValue =
  | number
  | Array<[number, number]>;

export interface UndulateRoot extends WdRoot {
  annotations?: UndulateAnnotation[];
}
