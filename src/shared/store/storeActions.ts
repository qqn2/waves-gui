import type {
  BitState,
  DiagramState,
  EdgeAnchorPending,
  PaintDraft,
  PaintMode,
  PaintStyle,
  Signal,
  Theme,
  Tool,
  ViewState,
} from '../types';
import type { WavedromColorIndex } from '../../wavedromBridge/wavedromColors';

/** Public store API — grouped by domain for navigation. */
export interface StoreActions {
  // ── Signals ──
  addSignal(type: Signal['type'], afterId?: string): void;
  duplicateSignal(id: string): void;
  addGroup(afterId?: string, name?: string): void;
  removeSignal(id: string): void;
  renameSignal(id: string, name: string): void;
  setSignalState(signalId: string, step: number, bitState: BitState): void;
  setSignalStateRange(
    signalId: string,
    startStep: number,
    endStep: number,
    bitState: BitState,
  ): void;
  paintBitStateRange(
    signalId: string,
    startStep: number,
    endStep: number,
    bitState: BitState,
    paintStyle: PaintStyle,
  ): void;
  toggleSignalStateRange(signalId: string, startStep: number, endStep: number): void;
  paintToggleRange(
    signalId: string,
    startStep: number,
    endStep: number,
    paintStyle: PaintStyle,
  ): void;
  toggleStepGlitchRange(signalId: string, startStep: number, endStep: number): void;
  paintGapRange(
    signalId: string,
    startStep: number,
    endStep: number,
    paintStyle: PaintStyle,
  ): void;
  /** Insert `count` gap columns at `column` on one lane (all lanes gain a column). */
  insertGapColumnsRange(
    signalId: string,
    column: number,
    count: number,
  ): void;
  /** Remove gap columns on one lane within `[startStep, endStep]`. */
  removeGapColumnsRange(
    signalId: string,
    startStep: number,
    endStep: number,
  ): void;
  /** Clear `|` gap flags on one lane without deleting timeline columns. */
  clearGapFlagsRange(
    signalId: string,
    startStep: number,
    endStep: number,
  ): void;
  eraseSignalState(signalId: string, step: number): void;
  eraseSignalStateRange(signalId: string, startStep: number, endStep: number): void;
  reorderSignals(orderedIds: string[], parentId?: string): void;
  moveSignalToParent(signalId: string, parentId?: string, beforeId?: string): void;
  updateVectorSegmentValue(signalId: string, segmentId: string, value: string): void;
  setVectorSpanRange(
    signalId: string,
    startStep: number,
    endStepInclusive: number,
    value: string | null,
    busColorFill?: string,
    options?: { preserveExistingLabels?: boolean },
  ): void;
  updateVectorSegmentColor(
    signalId: string,
    segmentId: string,
    color: string | undefined,
  ): void;
  setSignalNodeAt(signalId: string, step: number, char: string | null): void;
  setSignalPhase(signalId: string, phase: number | undefined): void;
  setSignalPeriod(signalId: string, period: number | undefined): void;
  setActiveSignalIds(ids: string[]): void;
  setTotalSteps(steps: number): void;
  setHscale(hscale: number): void;
  insertStepAt(index: number): void;
  deleteStepAt(index: number): void;
  /** Toggle WaveDrom `|` gap before column `boundary + 1` on every lane (bulk helper). */
  toggleStepGapAt(boundary: number): void;
  setDiagramSkin(skin: string | undefined): void;

  // ── WaveDrom edges ──
  addDiagramEdge(edge: string): void;
  updateDiagramEdge(index: number, edge: string): void;
  removeDiagramEdge(index: number): void;
  setEdgeCurveControl(
    index: number,
    control: { c1x: number; c2x: number } | undefined,
    options?: { recordHistory?: boolean },
  ): void;
  setActiveEdgeShape(shape: string): void;
  setShowAnchorLetters(show: boolean): void;
  setEdgeAnchorPending(pending: EdgeAnchorPending | null): void;

  // ── Document ──
  loadDiagram(diagram: DiagramState): void;
  clearAll(): void;
  markClean(fileName: string): void;
  undo(): void;
  redo(): void;
  setPaintDraft(draft: PaintDraft): void;
  clearPaintDraft(): void;

  // ── View (not saved to file) ──
  setZoom(zoom: number): void;
  setScroll(x: number, y: number): void;
  setTool(tool: Tool): void;
  setActiveBitState(state: BitState): void;
  setActiveBusLabel(label: string): void;
  setActiveTimespanLabel(label: string): void;
  setActiveBusColorIndex(index: WavedromColorIndex): void;
  setEdgeToolHover(hover: ViewState['edgeToolHover']): void;
  setPaintMode(mode: PaintMode): void;
  setPaintStyle(style: PaintStyle): void;
  toggleCodePanel(): void;
  toggleRenderPanel(): void;
  setLabelWidth(width: number): void;
  toggleTimeAxis(): void;
  setTheme(theme: Theme): void;
  setAccentColor(color: string | null): void;
  setCanvasColor(color: string | null): void;
  setUiFontScale(scale: number): void;
}

/** @deprecated Use StoreActions */
export type Actions = StoreActions;

export type ImmerSet = (fn: (state: import('../types').AppState & StoreActions) => void) => void;
