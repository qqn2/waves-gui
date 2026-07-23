import type { WdRoot } from '../wavedromBridge';

export interface UndulateTextAnnotation {
  text: string;
  x: number;
  y: number;
}

export interface UndulateRoot extends WdRoot {
  annotations?: UndulateTextAnnotation[];
}
