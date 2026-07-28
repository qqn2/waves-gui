export interface WdSignal {
  name?: string;
  wave?: string;
  data?: string | Array<string | string[]>;
  node?: string;
  period?: number;
  phase?: number;
  repeat?: number;
  periods?: number[];
  duty_cycle?: number;
  duty_cycles?: number[];
  slewing?: number;
  skin?: string;
  [key: string]: unknown;
}

export type WdSignalEntry = WdSignal | WdGroup | Record<string, never>;

export type WdGroup = [string, ...WdSignalEntry[]];

export interface WdRoot {
  signal: WdSignalEntry[];
  config?: {
    hscale?: number;
    skin?: string;
    head?: { text?: string; tick?: number; every?: number };
    foot?: { text?: string; tock?: number; every?: number };
  };
  head?: { text?: string; tick?: number; every?: number };
  foot?: { text?: string; tock?: number; every?: number };
  edge?: string[];
}
