/**
 * Domain model — internal representation of a WaveDrom timing diagram.
 *
 * WaveDrom JSON mapping (encode/decode lives in src/wavedromBridge/):
 *
 *   Signal.states[]     ↔  signal[i].wave     one char per time step; p/n/P/N are full clock cycles
 *   Signal.wave         ↔  signal[i].wave     canonical when laneMode is 'wave' (clocks, sub-cycles)
 *   Signal.laneMode     ↔  (internal)         'states' = per-step cache is truth; 'wave' = wave string is truth
 *   Signal.segments[]   ↔  signal[i].data[]   bus label per '=' span in wave
 *   Signal.node         ↔  signal[i].node     anchor letters for edge[] arrows
 *   Signal.stepGaps[]   ↔  '|' in wave        column i is a gap column (one `|` each)
 *   Signal.stepGlitches ↔  repeated char      spurious transition (e.g. "00" = glitch between steps)
 *   Signal.period/phase ↔  .period / .phase   lane stretch and horizontal shift
 *   DiagramState.edges  ↔  top-level edge[]   dependency paths (e.g. "a~>b  label")
 *
 * ViewState (zoom, tools, scroll) is NOT part of DiagramState — see store.ts.
 */

// ─── Signal states ────────────────────────────────────────────────────────────

/** All supported states for a scalar or mixed Undulate digital lane cell. */
export type BitState =
  | '0' | '1' | 'x' | 'X' | 'z' | 'u' | 'd'
  | 'p' | 'n' | 'P' | 'N'
  | 'h' | 'H' | 'l' | 'L'
  | '=' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | 'i' | 'I' | 'm' | 'M'
  | '.';

/** Map to WaveDrom wave characters (`.` is paint-only — resolved before storing in states[]) */
export const BIT_STATE_CHARS: Record<BitState, string> = {
  '0': '0',
  '1': '1',
  'x': 'x',
  'X': 'X',
  'z': 'z',
  'u': 'u',
  'd': 'd',
  'p': 'p',
  'n': 'n',
  'P': 'P',
  'N': 'N',
  'h': 'h',
  'H': 'H',
  'l': 'l',
  'L': 'L',
  '=': '=',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  'i': 'i',
  'I': 'I',
  'm': 'm',
  'M': 'M',
  '.': '.',
};

// ─── Signal types ─────────────────────────────────────────────────────────────

export interface VectorSegment {
  id: string;
  startStep: number; // inclusive
  endStep: number; // exclusive
  value: string; // displayed label (hex / decimal / binary / custom text)
  color?: string; // optional per-segment fill override
}

export interface AnaloguePoint {
  /** Position within the cell, normalized to the inclusive 0..1 range. */
  offset: number;
  value: number;
}

export type AnalogueTransition =
  | 'hold'
  | 'step'
  | 'capacitive'
  | 'samples'
  | 'metastable-low'
  | 'metastable-high'
  | 'impulse-low'
  | 'impulse-high';

export interface AnalogueCell {
  id: string;
  kind: AnalogueTransition;
  /** Settled value at the end of this cell. */
  value: number;
  /** Explicit points used by arbitrary sampled cells. */
  samples?: AnaloguePoint[];
  /** Original finite sample-time domain mapped affinely onto offsets 0..1. */
  sampleTimebase?: { start: number; end: number };
  /** Original safe Ludwig expression, retained for reevaluation and round-trip. */
  expression?: string;
}

export interface TimedCell {
  /** Positive duration in document ticks. */
  durationTicks: number;
  /** Optional high/low boundary preserved for native timing round-trips. */
  dutyTicks?: number;
}

export interface DigitalTimingCell extends TimedCell {
  state: BitState;
}

export interface SignalTiming {
  ticksPerStep: number;
  /** Horizontal shift in document ticks. */
  phaseTicks: number;
  cells: TimedCell[];
  /** Signal transition width in document steps. */
  slewing?: number;
  /** Preserve explicitly authored default-valued native timing fields. */
  sourceFields?: {
    period?: boolean;
    phase?: boolean;
    dutyCycle?: boolean;
  };
}

export interface DigitalTiming extends Omit<SignalTiming, 'cells'> {
  cells: DigitalTimingCell[];
}

/**
 * Per-cell native timing for bus/vector lanes. Timing is deliberately shared
 * with digital lanes, while values remain represented by vector segments.
 */
export type VectorTiming = SignalTiming;

export interface SignalStyle {
  /** Safe normalized waveform stroke color. */
  stroke?: string;
  /** Safe normalized fill color, currently used by vector lanes. */
  fill?: string;
  strokeWidth?: number;
  strokeDasharray?: number[];
  /** Safe normalized pixel size, currently used by vector value labels. */
  fontSize?: number;
  /** Safe local generic family; no remote font loading. */
  fontFamily?: 'sans-serif' | 'serif' | 'monospace';
  /** Numeric font weight, restricted to 100-step values. */
  fontWeight?: number;
}

export interface Signal {
  id: string;
  name: string;
  type: 'bit' | 'vector' | 'analogue' | 'spacer';
  /** Bit signals: one entry per time step. Clock entries represent a complete WaveDrom cycle. */
  states: BitState[];
  /** Vector signals: non-overlapping segments covering all steps */
  segments: VectorSegment[];
  /** Analogue lanes: one finite, normalized cell per document step. */
  analogueCells?: AnalogueCell[];
  /** Integer-tick timing for Undulate bit lanes. */
  digitalTiming?: DigitalTiming;
  /** Integer-tick timing for Undulate vector lanes. */
  vectorTiming?: VectorTiming;
  /** Internal: timing-cell states have replaced the imported compact wave spelling. */
  digitalTimingStatesEdited?: boolean;
  /** Original compact Undulate repeat spelling, retained while cell states stay unchanged. */
  undulateRepeat?: {
    repeat: number;
    wave: string;
    states: BitState[];
  };
  /** Original compact analogue repeat spelling, retained until a cell changes. */
  undulateAnalogueRepeat?: {
    repeat: number;
    wave: string;
    analogue: unknown[];
    fingerprint: string;
  };
  /** Display range. Defaults to Undulate's VSSA/VDDA context (0..1.8). */
  analogueMin?: number;
  analogueMax?: number;
  /** Undulate-compatible transition slew coefficient. */
  slewing?: number;
  /** Undulate-compatible vertical scale. */
  vscale?: number;
  /** Undulate overlay hint; layout support is introduced separately. */
  overlay?: boolean;
  /** Label order within an Undulate overlay. */
  order?: number;
  /** Safe declarative Undulate styling; arbitrary CSS is intentionally excluded. */
  style?: SignalStyle;
  color: string; // stroke color, default '#4A9EFF'
  fillColor?: string; // vector fill, default semi-transparent stroke
  rowHeight: number; // px at zoom=1, default 40
  phase?: number; // horizontal shift in steps (WaveDrom phase)
  /** Cycles per column for this lane (WaveDrom period, integer >= 1) */
  period?: number;
  /** WaveDrom node string — one character per step; anchors for edge[] */
  node?: string;
  /** Undulate expanded node identifiers keyed by their waveform step. */
  nodeNames?: Record<number, string>;
  /** Column i is a WaveDrom `|` gap column (holds previous level; consecutive `||` = multiple columns) */
  stepGaps?: boolean[];
  /** Spurious transition between step i and i+1 (WaveDrom explicit repeat, e.g. `00`) */
  stepGlitches?: boolean[];
  /**
   * When `'wave'`, `wave` is the source of truth (clock `P...`, sub-cycle `<|>`, etc.).
   * `states[]` is a decoded render cache kept in sync via laneWaveOps.
   */
  laneMode?: 'states' | 'wave';
  /** Canonical WaveDrom wave for laneMode `'wave'` lanes. */
  wave?: string;
  /** @deprecated Use laneMode `'wave'` and `wave`. Kept for loaded diagrams. */
  waveOverride?: string;
}

export interface SignalGroup {
  id: string;
  name: string;
  type: 'group';
  children: Array<Signal | SignalGroup>;
  color?: string; // bracket color
}

export type SignalOrGroup = Signal | SignalGroup;

export interface AnalogueOverlayGroup {
  id: string;
  name: string;
  /** Two to four consecutive analogue siblings, in visual order. */
  signalIds: string[];
}

// ─── Diagram config ───────────────────────────────────────────────────────────

export interface DiagramConfig {
  totalSteps: number; // number of time step columns
  hscale: number; // 1–4 (fractional OK), multiplier applied to CELL_WIDTH
  /** Integer timing resolution. Existing documents default to one tick per step. */
  ticksPerStep?: number;
  /** Document-wide Ludwig analogue evaluation rails. */
  analogueContext?: { vssa: number; vdda: number };
  /** App-owned deterministic seed mixed into every supported rnd() expression. */
  analogueRandomSeed?: number;
  /** WaveDrom config.skin (default, narrow, dark, …) */
  skin?: string;
  head?: { text?: string; tick?: number; every?: number };
  foot?: { text?: string; tock?: number; every?: number };
}

// ─── Diagram state (the saved document) ──────────────────────────────────────

export type DiagramSourceFormat =
  | 'wavedrom-json'
  | 'undulate-json'
  | 'undulate-yaml'
  | 'undulate-toml';

export interface OpaqueUndulateData {
  /** Safe, unknown top-level properties keyed by their original property name. */
  root?: Record<string, unknown>;
  /** Safe unknown config fields, including nested head/foot fields. */
  config?: Record<string, unknown>;
  /** Safe unknown fields on top-level head/foot objects. */
  head?: Record<string, unknown>;
  foot?: Record<string, unknown>;
  /** Safe, unknown properties keyed by the stable internal signal id. */
  signals?: Record<string, Record<string, unknown>>;
  /** Safe, unknown properties keyed by the stable internal annotation id. */
  annotations?: Record<string, Record<string, unknown>>;
}

export interface DiagramCompatibility {
  extensionsEnabled: boolean;
  sourceFormat?: DiagramSourceFormat;
  sourceRevision?: string;
  /**
   * Original source text. JSON5 uses it for CST-preserving edits; YAML and
   * TOML keep it only as metadata and are rewritten canonically after edits.
   */
  sourceText?: string;
  /** Safe declarative data retained verbatim until a future bridge models it. */
  opaqueUndulate?: OpaqueUndulateData;
}

export interface AnnotationStyle {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: number[];
  /** Safe normalized pixel size for annotation labels. */
  fontSize?: number;
  /** Safe local generic family; no remote font loading. */
  fontFamily?: 'sans-serif' | 'serif' | 'monospace';
  /** CSS-compatible numeric weight, restricted to 100-step values. */
  fontWeight?: number;
  /** Undulate defaults textual annotations to an opaque background. */
  textBackground?: boolean;
}

export interface AnnotationRangePosition {
  unit: 'index' | 'percent';
  value: number;
}

export interface TextAnnotation {
  id: string;
  type: 'text';
  text: string;
  /** Integer document tick. Version 2 currently uses one tick per major step. */
  tick: number;
  /** Exact Undulate X coordinate in waveform-cell units. */
  x?: number;
  /** Exact diagram Y coordinate in row-height units. */
  y?: number;
  coordinateMode?: 'diagram' | 'signal';
  snapToGrid?: boolean;
  /** Optional semantic row anchor. */
  signalId?: string;
  /** Logical pixel offset from the anchored row center. */
  yOffset?: number;
  style?: AnnotationStyle;
}

export interface VerticalLineAnnotation {
  id: string;
  type: 'vertical-line';
  /** Integer document tick. The line is centered on this step. */
  tick: number;
  /** Exact Undulate X coordinate in waveform-cell units. */
  x?: number;
  snapToGrid?: boolean;
  /** Optional vertical span, expressed as a signal-row index or percentage. */
  rangeFrom?: AnnotationRangePosition;
  rangeTo?: AnnotationRangePosition;
  style?: AnnotationStyle;
}

export interface HorizontalLineAnnotation {
  id: string;
  type: 'horizontal-line';
  /** Exact diagram Y coordinate in row-height units. */
  y?: number;
  coordinateMode?: 'diagram' | 'signal';
  /** Optional semantic row anchor. */
  signalId?: string;
  /** Logical pixel offset from the anchored row center. */
  yOffset?: number;
  /** Optional horizontal span, expressed as a cell index or percentage. */
  rangeFrom?: AnnotationRangePosition;
  rangeTo?: AnnotationRangePosition;
  style?: AnnotationStyle;
}

export interface GlobalCompressionAnnotation {
  id: string;
  type: 'global-compression';
  /** Integer document tick. The compression marker is centered on this step. */
  tick: number;
  /** Exact Undulate X coordinate in waveform-cell units. */
  x?: number;
  snapToGrid?: boolean;
  /** Optional vertical span, expressed as a signal-row index or percentage. */
  rangeFrom?: AnnotationRangePosition;
  rangeTo?: AnnotationRangePosition;
  style?: AnnotationStyle;
}

export type AnnotationAnchor =
  | { kind: 'point'; x: number; y: number; percent?: boolean }
  | { kind: 'node'; node: string; dx?: number; dy?: number };

export interface ArrowAnnotation {
  id: string;
  type: 'arrow';
  shape: string;
  from: AnnotationAnchor;
  to: AnnotationAnchor;
  text?: string;
  dx?: number;
  dy?: number;
  style?: AnnotationStyle;
}

export type DiagramAnnotation =
  | TextAnnotation
  | VerticalLineAnnotation
  | HorizontalLineAnnotation
  | GlobalCompressionAnnotation
  | ArrowAnnotation;

export interface DiagramState {
  /** Version 1 is accepted as legacy input; normalization always migrates it to version 2. */
  version: 1 | 2;
  compatibility?: DiagramCompatibility;
  signals: SignalOrGroup[];
  /** Explicit analogue overlay membership; Undulate overlay flags are derived. */
  analogueOverlayGroups?: AnalogueOverlayGroup[];
  config: DiagramConfig;
  annotations?: DiagramAnnotation[];
  /** WaveDrom edge[] dependency arrow strings */
  edges: string[];
  /** Per-edge cubic control bias for ~ curves, persisted in x-waves-gui metadata. */
  edgeCurveControls?: Record<number, { c1x: number; c2x: number }>;
}

// ─── View/UI state ────────────────────────────────────────────────────────────

export type Tool =
  | 'paint'
  | 'analogue-paint'
  | 'erase'
  | 'select'
  | 'annotation'
  | 'vertical-line'
  | 'horizontal-line'
  | 'global-compression'
  | 'structured-arrow'
  | 'arrow'
  | 'timespan'
  | 'cursor';

import type { WavedromColorIndex } from '../wavedromBridge/wavedromColors';
import type { Theme } from './theme';
export type { Theme } from './theme';

/** Paint tool: set value, toggle (NOT), glitch, or timeline gap (|) between steps */
export type PaintMode = 'toggle' | 'set' | 'glitch' | 'gap';

/**
 * Replace — overwrite cells: paint 0 on 1 → 0, paint 0 on | → 0, paint | toggles gap on column.
 * Additive — insert: paint | → |value (new column), paint 0 on | → |0 (value after gap).
 */
export type PaintStyle = 'replace' | 'additive';

export interface ViewState {
  zoom: number; // 0.25–4.0, default 1.0
  scrollX: number; // canvas horizontal scroll in logical px
  scrollY: number; // canvas vertical scroll in logical px
  selectedTool: Tool;
  paintMode: PaintMode;
  /** Replace vs additive when painting values and gaps (Draw tool). */
  paintStyle: PaintStyle;
  activeBitState: BitState; // used when paintMode is 'set' (or Shift override)
  /** Brush used by the dedicated Undulate analogue cell-painting tool. */
  activeAnalogueKind: AnalogueTransition;
  activeAnalogueValue: number;
  /** Label written on bus lanes when painting with the paint tool (= span) */
  activeBusLabel: string;
  /** Label for new timespan edges (WaveDrom edge[] text after path) */
  activeTimespanLabel: string;
  /** Optional label appended to new WaveDrom dependency edges. */
  activeEdgeLabel: string;
  /** WaveDrom bus fill palette index (2–9) for new vector spans */
  activeBusColorIndex: WavedromColorIndex;
  activeSignalIds: string[]; // selected for operations
  /** Fine-timing cell targeted from the canvas or signal inspector. */
  activeTimingCellIndex?: number | null;
  /** Selected extended object, mutually exclusive with activeSignalIds. */
  activeAnnotationId?: string | null;
  /** Group ids collapsed in the current editor session; never serialized. */
  collapsedGroupIds: string[];
  /** User-controlled properties inspector visibility; never serialized. */
  showInspector: boolean;
  showCodePanel: boolean;
  showRenderPanel: boolean;
  /** Signal name column width in px (DOM, not zoomed). */
  labelWidth: number;
  theme: Theme;
  /** User accent override; null = preset default for active theme. */
  accentColor: string | null;
  /** User canvas background override; null = preset default. */
  canvasColor: string | null;
  /** Body font scale (0.9–1.15). */
  uiFontScale: number;
  /** Derived cache: true when diagram differs from AppState.savedDiagram. */
  isDirty: boolean;
  /** Source editor contains text that has not been successfully applied. */
  sourceDraftDirty?: boolean;
  sourceDraft?: string | null;
  /** Last source parse/apply error, if the draft is invalid. */
  sourceDraftError?: string | null;
  fileName: string | null;
  /** Ephemeral paint/erase preview during pointer drag — never pushed to undo history */
  paintDraft: PaintDraft | null;
  /** In-progress WaveDrom edge[] anchor placement (arrow / timespan tools) */
  edgeAnchorPending: EdgeAnchorPending | null;
  /** First coordinate selected while placing a structured Undulate arrow. */
  structuredArrowPending: { x: number; y: number } | null;
  /** Default X snapping for newly created annotations. */
  annotationSnapToGrid?: boolean;
  /** Pointer position + optional lane snap while arrow / timespan tool is active */
  edgeToolHover: {
    signalId: string | null;
    step: number | null;
    canvasX: number;
    canvasY: number;
  } | null;
  /** WaveDrom connector placed between generated node letters, such as `~`, `-~>`, or `<->`. */
  activeEdgeConnector: string;
  /** Show A–Z anchor letters on canvas (WaveDrom invisible nodes) */
  showAnchorLetters: boolean;
  /** Monotonic counter bumped on loadDiagram — drives JSON panel resync. */
  diagramRevision: number;
}

export type EdgeAnchorPending =
  | { kind: 'arrow'; char: string; signalId: string; step: number }
  | {
      kind: 'timespan';
      fromChar: string;
      signalId: string;
      startStep: number;
    };

/** In-progress stroke from the paint or erase tool; cleared on pointer up */
export interface PaintDraft {
  signalId: string;
  startStep: number;
  endStep: number; // inclusive; grows during drag
  /** Absolute document-tick range for precision digital painting. */
  startTick?: number;
  endTick?: number;
  lane: 'bit' | 'vector' | 'analogue';
  bitState: BitState; // paint+set: target state; paint+toggle: unused
  apply: 'toggle' | 'set' | 'glitch' | 'gap'; // paint only; erase ignores
  busLabel?: string; // vector paint: WaveDrom data[] label
  busColorFill?: string; // vector paint: WaveDrom bus fill hex
  analogueKind?: AnalogueTransition;
  analogueValue?: number;
  mode: 'paint' | 'erase';
  /** Erase tool: WaveDrom edge[] index to remove on pointer up */
  edgeIndex?: number;
}

// ─── Full app store shape ─────────────────────────────────────────────────────

export interface AppState {
  diagram: DiagramState;
  /** Last confirmed save/load state; document dirtiness is derived from this snapshot. */
  savedDiagram: DiagramState;
  view: ViewState;
  history: DiagramState[]; // undo stack (most recent last)
  future: DiagramState[]; // redo stack
}
