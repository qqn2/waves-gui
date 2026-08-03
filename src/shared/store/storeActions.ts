import type {
  BitState,
  AnalogueCell,
  AnalogueTransition,
  TextAnnotation,
  VerticalLineAnnotation,
  HorizontalLineAnnotation,
  GlobalCompressionAnnotation,
  ArrowAnnotation,
  DiagramConfig,
  DiagramState,
  EdgeAnchorPending,
  PaintDraft,
  PaintMode,
  PaintStyle,
  Signal,
  SignalStyle,
  Theme,
  Tool,
  ViewState,
} from '../types';
import type { WavedromColorIndex } from '../../wavedromBridge/wavedromColors';

/** Public store API — grouped by domain for navigation. */
export interface StoreActions {
  // ── Signals ──
  addSignal(
    type: Signal['type'],
    location?: { parentId?: string; beforeId?: string; afterId?: string },
  ): void;
  duplicateSignal(id: string): void;
  addGroup(afterId?: string, name?: string): void;
  removeSignal(id: string): void;
  renameSignal(id: string, name: string): void;
  renameGroup(id: string, name: string): void;
  updateSignalStyle(signalId: string, patch: Partial<SignalStyle>): void;
  updateAnalogueCell(
    signalId: string,
    index: number,
    patch: Partial<Omit<AnalogueCell, 'id'>>,
  ): void;
  updateAnalogueSignal(
    signalId: string,
    patch: {
      analogueMin?: number;
      analogueMax?: number;
      slewing?: number;
      vscale?: number;
      order?: number;
    },
  ): void;
  paintAnalogueCellRange(
    signalId: string,
    startStep: number,
    endStep: number,
    kind: AnalogueTransition,
    value: number,
  ): void;
  updateAnalogueContext(patch: { vssa?: number; vdda?: number }): void;
  refreshAnalogueRandomSeed(): void;
  /** Create an overlay with the next analogue sibling, or extend its group. */
  extendAnalogueOverlayGroup(signalId: string): boolean;
  dissolveAnalogueOverlayGroup(groupId: string): void;
  updateDigitalTimingCell(
    signalId: string,
    index: number,
    patch: { durationTicks?: number; dutyTicks?: number | null },
  ): void;
  /** Promote a bit/clock lane to editable per-cell Undulate timing. */
  enableDigitalTiming(signalId: string): boolean;
  updateDigitalTimingSignal(
    signalId: string,
    patch: { phaseTicks?: number; slewing?: number | null },
  ): void;
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
  paintDigitalTimingRange(
    signalId: string,
    startTick: number,
    endTick: number,
    bitState: BitState,
    mode: 'set' | 'toggle',
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
  eraseSignalStateRange(
    signalId: string,
    startStep: number,
    endStep: number,
    coordinate?: 'native' | 'document',
  ): boolean;
  eraseSignalStateRanges(
    signalIds: string[],
    startStep: number,
    endStep: number,
    coordinate?: 'native' | 'document',
  ): boolean;
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
  setActiveTimingCellIndex(index: number | null): void;
  setActiveAnnotationId(id: string | null): void;
  setTotalSteps(steps: number): boolean;
  setHscale(hscale: number): void;
  updateDiagramHead(patch: Partial<NonNullable<DiagramConfig['head']>>): void;
  updateDiagramFoot(patch: Partial<NonNullable<DiagramConfig['foot']>>): void;
  insertStepAt(index: number): void;
  deleteStepAt(index: number): void;
  /** Toggle WaveDrom `|` gap before column `boundary + 1` on every lane (bulk helper). */
  toggleStepGapAt(boundary: number): void;
  setDiagramSkin(skin: string | undefined): void;

  // ── WaveDrom edges ──
  addDiagramEdge(edge: string): void;
  addDiagramArrow(
    from: { signalId: string; step: number },
    to: { signalId: string; step: number },
    connector?: string,
    label?: string,
  ): void;
  updateDiagramEdge(index: number, edge: string): void;
  promoteDiagramEdgeToAnnotation(index: number): string | null;
  removeDiagramEdge(index: number): void;
  setEdgeCurveControl(
    index: number,
    control: { c1x: number; c2x: number } | undefined,
    options?: { recordHistory?: boolean },
  ): void;
  setActiveEdgeConnector(connector: string): void;
  setShowAnchorLetters(show: boolean): void;
  setEdgeAnchorPending(pending: EdgeAnchorPending | null): void;

  // ── Document ──
  loadDiagram(diagram: DiagramState): void;
  restoreDraft(diagram: DiagramState): void;
  applyDiagramEdit(diagram: DiagramState): void;
  clearAll(): void;
  setExtensionsEnabled(enabled: boolean): void;
  /** Change the integer timing timebase; returns false if rescaling would round. */
  setTicksPerStep(ticksPerStep: number): boolean;
  removeUndulateFeatures(): void;
  addTextAnnotation(
    annotation: Omit<TextAnnotation, 'id' | 'type'>,
  ): string | null;
  addVerticalLineAnnotation(
    annotation: Omit<VerticalLineAnnotation, 'id' | 'type'>,
  ): string | null;
  addHorizontalLineAnnotation(
    annotation: Omit<HorizontalLineAnnotation, 'id' | 'type'>,
  ): string | null;
  addGlobalCompressionAnnotation(
    annotation: Omit<GlobalCompressionAnnotation, 'id' | 'type'>,
  ): string | null;
  addArrowAnnotation(
    annotation: Omit<ArrowAnnotation, 'id' | 'type'>,
  ): string | null;
  updateVerticalLineAnnotation(
    id: string,
    patch: Partial<Omit<VerticalLineAnnotation, 'id' | 'type'>>,
    options?: { recordHistory?: boolean },
  ): void;
  updateHorizontalLineAnnotation(
    id: string,
    patch: Partial<Omit<HorizontalLineAnnotation, 'id' | 'type'>>,
    options?: { recordHistory?: boolean },
  ): void;
  updateGlobalCompressionAnnotation(
    id: string,
    patch: Partial<Omit<GlobalCompressionAnnotation, 'id' | 'type'>>,
    options?: { recordHistory?: boolean },
  ): void;
  updateTextAnnotation(
    id: string,
    patch: Partial<Omit<TextAnnotation, 'id' | 'type'>>,
    options?: { recordHistory?: boolean },
  ): void;
  updateArrowAnnotation(
    id: string,
    patch: Partial<Omit<ArrowAnnotation, 'id' | 'type'>>,
    options?: { recordHistory?: boolean },
  ): void;
  removeAnnotation(id: string): void;
  markClean(fileName: string): void;
  undo(): void;
  redo(): void;
  setPaintDraft(draft: PaintDraft): void;
  clearPaintDraft(): void;
  setSourceDraftStatus(dirty: boolean, error?: string | null, draft?: string | null): void;
  setOperationNotice(message: string | null): void;

  // ── View (not saved to file) ──
  setZoom(zoom: number): void;
  setScroll(x: number, y: number): void;
  setTool(tool: Tool): void;
  setActiveBitState(state: BitState): void;
  setActiveAnalogueKind(kind: AnalogueTransition): void;
  setActiveAnalogueValue(value: number): void;
  setActiveBusLabel(label: string): void;
  setActiveTimespanLabel(label: string): void;
  setActiveEdgeLabel(label: string): void;
  setActiveBusColorIndex(index: WavedromColorIndex): void;
  setAnnotationSnapToGrid(enabled: boolean): void;
  setEdgeToolHover(hover: ViewState['edgeToolHover']): void;
  setStructuredArrowPending(pending: ViewState['structuredArrowPending']): void;
  setPaintMode(mode: PaintMode): void;
  setPaintStyle(style: PaintStyle): void;
  toggleGroupCollapsed(groupId: string): void;
  toggleInspector(): void;
  toggleCodePanel(): void;
  toggleRenderPanel(): void;
  setLabelWidth(width: number): void;
  setTheme(theme: Theme): void;
  setAccentColor(color: string | null): void;
  setCanvasColor(color: string | null): void;
  setUiFontScale(scale: number): void;
}

/** @deprecated Use StoreActions */
export type Actions = StoreActions;

export type ImmerSet = (fn: (state: import('../types').AppState & StoreActions) => void) => void;
