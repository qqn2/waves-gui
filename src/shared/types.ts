// ─── Signal states ────────────────────────────────────────────────────────────

/** All possible states for a single bit signal at one time step */
export type BitState = '0' | '1' | 'x' | 'z' | 'u' | 'd' | 'p' | 'n';

/** Map to WaveDrom wave characters */
export const BIT_STATE_CHARS: Record<BitState, string> = {
  '0': '0',
  '1': '1',
  'x': 'x',
  'z': 'z',
  'u': 'u',
  'd': 'd',
  'p': 'p',
  'n': 'n',
};

// ─── Signal types ─────────────────────────────────────────────────────────────

export interface VectorSegment {
  id: string;
  startStep: number; // inclusive
  endStep: number; // exclusive
  value: string; // displayed label (hex / decimal / binary / custom text)
  color?: string; // optional per-segment fill override
}

export interface Signal {
  id: string;
  name: string;
  type: 'bit' | 'vector' | 'spacer';
  /** Bit signals: one entry per time step. Length always equals DiagramConfig.totalSteps */
  states: BitState[];
  /** Vector signals: non-overlapping segments covering all steps */
  segments: VectorSegment[];
  color: string; // stroke color, default '#4A9EFF'
  fillColor?: string; // vector fill, default semi-transparent stroke
  rowHeight: number; // px at zoom=1, default 40
  phase?: number; // clock phase offset (0 or 0.5), for 'p'/'n' type signals
}

export interface SignalGroup {
  id: string;
  name: string;
  type: 'group';
  children: Array<Signal | SignalGroup>;
  collapsed: boolean;
  color?: string; // bracket color
}

export type SignalOrGroup = Signal | SignalGroup;

// ─── Diagram config ───────────────────────────────────────────────────────────

export interface DiagramConfig {
  totalSteps: number; // number of time step columns
  hscale: number; // 1–4, multiplier applied to CELL_WIDTH
  head?: { text?: string; tick?: number; every?: number };
  foot?: { text?: string; tock?: number; every?: number };
}

// ─── Annotations ──────────────────────────────────────────────────────────────

export interface ArrowAnnotation {
  id: string;
  type: 'arrow';
  fromSignalId: string;
  fromStep: number;
  toSignalId: string;
  toStep: number;
  label?: string;
  color: string;
}

export interface TimeSpanAnnotation {
  id: string;
  type: 'timespan';
  startStep: number;
  endStep: number;
  label?: string;
  color: string;
  row?: 'top' | 'bottom'; // position above or below all signals
}

export interface TimeMarkerAnnotation {
  id: string;
  type: 'marker';
  step: number;
  label?: string;
  color: string;
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  signalId: string;
  step: number;
  text: string;
  color: string;
}

export type Annotation =
  | ArrowAnnotation
  | TimeSpanAnnotation
  | TimeMarkerAnnotation
  | TextAnnotation;

// ─── Diagram state (the saved document) ──────────────────────────────────────

export interface DiagramState {
  version: 1;
  signals: SignalOrGroup[];
  config: DiagramConfig;
  annotations: Annotation[];
}

// ─── View/UI state ────────────────────────────────────────────────────────────

export type Tool =
  | 'paint'
  | 'erase'
  | 'select'
  | 'arrow'
  | 'timespan'
  | 'marker'
  | 'text'
  | 'cursor';

export type Theme = 'dark' | 'light';

export interface ViewState {
  zoom: number; // 0.25–4.0, default 1.0
  scrollX: number; // canvas horizontal scroll in logical px
  scrollY: number; // canvas vertical scroll in logical px
  selectedTool: Tool;
  activeBitState: BitState; // the state the paint tool will apply
  activeSignalIds: string[]; // selected for operations
  showCodePanel: boolean;
  showTimeAxis: boolean;
  theme: Theme;
  isDirty: boolean; // unsaved changes
  fileName: string | null;
  /** Ephemeral paint/erase preview during pointer drag — never pushed to undo history */
  paintDraft: PaintDraft | null;
}

/** In-progress stroke from the paint or erase tool; cleared on pointer up */
export interface PaintDraft {
  signalId: string;
  startStep: number;
  endStep: number; // inclusive; grows during drag
  bitState: BitState; // paint: target state; erase: ignored (erase uses propagate-left logic in renderer)
  mode: 'paint' | 'erase';
}

// ─── Full app store shape ─────────────────────────────────────────────────────

export interface AppState {
  diagram: DiagramState;
  view: ViewState;
  history: DiagramState[]; // undo stack (most recent last)
  future: DiagramState[]; // redo stack
}
