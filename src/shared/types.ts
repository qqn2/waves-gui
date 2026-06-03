/**
 * Domain model — internal representation of a WaveDrom timing diagram.
 *
 * WaveDrom JSON mapping (encode/decode lives in src/wavedromBridge/):
 *
 *   Signal.states[]     ↔  signal[i].wave     one char per time step (0,1,x,z,u,d,p,n,P,N,=,|,…)
 *   Signal.segments[]   ↔  signal[i].data[]   bus label per '=' span in wave
 *   Signal.node         ↔  signal[i].node     anchor letters for edge[] arrows
 *   Signal.stepGaps[]   ↔  '|' in wave        vertical gap before next column
 *   Signal.stepGlitches ↔  repeated char      spurious transition (e.g. "00" = glitch between steps)
 *   Signal.period/phase ↔  .period / .phase   lane stretch and horizontal shift
 *   DiagramState.edges  ↔  top-level edge[]   dependency paths (e.g. "a~>b  label")
 *
 * ViewState (zoom, tools, scroll) is NOT part of DiagramState — see store.ts.
 */

// ─── Signal states ────────────────────────────────────────────────────────────

/** All possible states for a single bit signal at one time step */
export type BitState = '0' | '1' | 'x' | 'z' | 'u' | 'd' | 'p' | 'n' | 'P' | 'N';

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
  'P': 'P',
  'N': 'N',
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
  phase?: number; // horizontal shift in steps (WaveDrom phase)
  /** Cycles per column for this lane (WaveDrom period, integer >= 1) */
  period?: number;
  /** WaveDrom node string — one character per step; anchors for edge[] */
  node?: string;
  /** Gap before step i+1 when stepGaps[i] is true (WaveDrom `|` in wave) */
  stepGaps?: boolean[];
  /** Spurious transition between step i and i+1 (WaveDrom explicit repeat, e.g. `00`) */
  stepGlitches?: boolean[];
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
  hscale: number; // 1–4 (fractional OK), multiplier applied to CELL_WIDTH
  head?: { text?: string; tick?: number; every?: number };
  foot?: { text?: string; tock?: number; every?: number };
}

// ─── Diagram state (the saved document) ──────────────────────────────────────

export interface DiagramState {
  version: 1;
  signals: SignalOrGroup[];
  config: DiagramConfig;
  /** WaveDrom edge[] dependency arrow strings */
  edges: string[];
}

// ─── View/UI state ────────────────────────────────────────────────────────────

export type Tool =
  | 'paint'
  | 'erase'
  | 'select'
  | 'arrow'
  | 'timespan'
  | 'cursor';

import type { WavedromColorIndex } from '../wavedromBridge/wavedromColors';
import type { Theme } from './theme';
export type { Theme } from './theme';

/** Paint tool: set value, toggle (NOT), or insert explicit glitch between steps */
export type PaintMode = 'toggle' | 'set' | 'glitch';

export interface ViewState {
  zoom: number; // 0.25–4.0, default 1.0
  scrollX: number; // canvas horizontal scroll in logical px
  scrollY: number; // canvas vertical scroll in logical px
  selectedTool: Tool;
  paintMode: PaintMode;
  activeBitState: BitState; // used when paintMode is 'set' (or Shift override)
  /** Label written on bus lanes when painting with the paint tool (= span) */
  activeBusLabel: string;
  /** Label for new timespan edges (WaveDrom edge[] text after path) */
  activeTimespanLabel: string;
  /** WaveDrom bus fill palette index (2–9) for new vector spans */
  activeBusColorIndex: WavedromColorIndex;
  activeSignalIds: string[]; // selected for operations
  showCodePanel: boolean;
  /** Signal name column width in px (DOM, not zoomed). */
  labelWidth: number;
  showTimeAxis: boolean;
  theme: Theme;
  isDirty: boolean; // unsaved changes
  fileName: string | null;
  /** Ephemeral paint/erase preview during pointer drag — never pushed to undo history */
  paintDraft: PaintDraft | null;
  /** In-progress WaveDrom edge[] anchor placement (arrow / timespan tools) */
  edgeAnchorPending: EdgeAnchorPending | null;
  /** Hover step while arrow / timespan tool is active (live preview) */
  edgeToolHover: { signalId: string; step: number } | null;
  /** Middle shape for new arrow edges (WaveDrom path between node letters, before `>`) */
  activeEdgeShape: string;
  /** Show A–Z anchor letters on canvas (WaveDrom invisible nodes) */
  showAnchorLetters: boolean;
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
  lane: 'bit' | 'vector';
  bitState: BitState; // paint+set: target state; paint+toggle: unused
  apply: 'toggle' | 'set' | 'glitch'; // paint only; erase ignores
  busLabel?: string; // vector paint: WaveDrom data[] label
  busColorFill?: string; // vector paint: WaveDrom bus fill hex
  mode: 'paint' | 'erase';
  /** Erase tool: WaveDrom edge[] index to remove on pointer up */
  edgeIndex?: number;
}

// ─── Full app store shape ─────────────────────────────────────────────────────

export interface AppState {
  diagram: DiagramState;
  view: ViewState;
  history: DiagramState[]; // undo stack (most recent last)
  future: DiagramState[]; // redo stack
}
