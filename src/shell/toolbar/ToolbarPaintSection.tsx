import {
  fillHexForColorIndex,
  colorIndexFromFillHex,
  WAVEDROM_COLOR_INDEXES,
  type WavedromColorIndex,
} from '../../wavedromBridge/wavedromColors';
import type {
  AnalogueTransition,
  BitState,
  PaintMode,
  PaintStyle,
} from '../../shared/types';
import { ArrowLeftRight, Columns2, Zap } from 'lucide-react';
import { EDITING_SHORTCUTS } from '../../shared/shortcuts';
import { useStore } from '../../shared/store';
import { selectedBusSegment } from '../../tools/busLabelPick';
import { runAfterSourceFlush } from '../../codePanel/sourceMutationGuard';
import { useEffect, useRef, useState } from 'react';
import { registerBusLabelDraftCommit } from '../busLabelDraft';
import { BitStateButton } from './BitStateButton';
import {
  BIT_STATE_LABELS,
  EDGE_CONNECTOR_GROUPS,
  MORE_BIT_STATES,
  PRIMARY_BIT_STATES,
  UNDULATE_BIT_STATES,
} from './bitStateConstants';
import { BitValuePalette } from './BitValuePalette';
import {
  AnalogueBrushPalette,
} from './AnalogueBrushPalette';
import {
  ANALOGUE_BRUSH_OPTIONS,
  analogueBrushPreviewPath,
} from './analogueBrushOptions';
import styles from '../shell.module.css';

export interface ToolbarPaintSectionProps {
  paintMode: PaintMode;
  paintStyle: PaintStyle;
  activeBit: BitState;
  extensionsEnabled: boolean;
  moreBitsOpen: boolean;
  recentBits: BitState[];
  onSetPaintMode: (mode: PaintMode) => void;
  onSetPaintStyle: (style: PaintStyle) => void;
  onSelectBit: (st: BitState) => void;
  onToggleMoreBits: () => void;
  onCloseMoreBits: () => void;
  onRememberBit: (state: BitState) => void;
}

export function ToolbarPaintSection({
  paintMode,
  paintStyle,
  activeBit,
  extensionsEnabled,
  moreBitsOpen,
  recentBits,
  onSetPaintMode,
  onSetPaintStyle,
  onSelectBit,
  onToggleMoreBits,
  onCloseMoreBits,
  onRememberBit,
}: ToolbarPaintSectionProps) {
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const moreBitStates = extensionsEnabled
    ? [...MORE_BIT_STATES, ...UNDULATE_BIT_STATES]
    : MORE_BIT_STATES;
  const moreBitsActive = moreBitStates.includes(activeBit);

  return (
    <>
      <span className={styles.toolGroupLabel}>Draw</span>
      <button
        type="button"
        title="Replace — overwrite cells (1→0, |→0); gap paint toggles | on column"
        className={`${styles.toolBtn} ${paintStyle === 'replace' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintStyle('replace')}
        aria-pressed={paintStyle === 'replace'}
      >
        Replace
      </button>
      <button
        type="button"
        title="Additive — insert columns (|→|value); paint on | adds value after gap"
        className={`${styles.toolBtn} ${paintStyle === 'additive' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintStyle('additive')}
        aria-pressed={paintStyle === 'additive'}
      >
        Add
      </button>
      <span className={styles.toolGroupLabel}>Value</span>
      <button
        ref={moreButtonRef}
        type="button"
        title={`Glitch — add a spurious transition (${EDITING_SHORTCUTS.glitch.label})`}
        className={`${styles.toolBtn} ${paintMode === 'glitch' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintMode('glitch')}
        aria-pressed={paintMode === 'glitch'}
      >
        <Zap size={14} aria-hidden /> Glitch
      </button>
      <button
        type="button"
        title={`Gap — insert a timeline break before the next column (${EDITING_SHORTCUTS.gap.label})`}
        className={`${styles.toolBtn} ${paintMode === 'gap' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintMode('gap')}
        aria-pressed={paintMode === 'gap'}
      >
        <Columns2 size={14} aria-hidden /> Gap
      </button>
      <button
        type="button"
        title={`Invert — toggle 0↔1 and clock phase p↔n or P↔N (${EDITING_SHORTCUTS.invert.label}); x/z unchanged`}
        className={`${styles.toolBtn} ${paintMode === 'toggle' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintMode('toggle')}
        aria-pressed={paintMode === 'toggle'}
      >
        <ArrowLeftRight size={14} aria-hidden /> Invert
      </button>
      {PRIMARY_BIT_STATES.map((st) => (
        <BitStateButton
          key={st}
          st={st}
          active={paintMode === 'set' && activeBit === st}
          onSelect={onSelectBit}
        />
      ))}
      <button
        type="button"
        title={
          extensionsEnabled
            ? 'More values — clocks, weak pull-up/down, impulse, metastability, held edges'
            : 'More values — p, n, weak pull-up/down (u, d), Set mode'
        }
        className={`${styles.toolBtn} ${
          moreBitsOpen || moreBitsActive ? styles.toolActive : ''
        }`}
        onClick={onToggleMoreBits}
        aria-pressed={moreBitsOpen}
        aria-expanded={moreBitsOpen}
      >
        {moreBitsActive
          ? `${BIT_STATE_LABELS[activeBit] ?? 'More'} (${activeBit})`
          : 'More'} ▾
      </button>
      {moreBitsOpen ? (
        <BitValuePalette
          anchorRef={moreButtonRef}
          activeBit={activeBit}
          extensionsEnabled={extensionsEnabled}
          recentBits={recentBits}
          onSelect={(state) => {
            onSelectBit(state);
            onRememberBit(state);
          }}
          onClose={onCloseMoreBits}
        />
      ) : null}
    </>
  );
}

export interface ToolbarBusSectionProps {
  mode: 'edit' | 'paint';
  activeBusLabel: string;
  activeBusColorIndex: WavedromColorIndex;
  onBusLabel: (label: string) => void;
  onBusColorIndex: (index: WavedromColorIndex) => void;
}

export interface ToolbarAnaloguePaintSectionProps {
  kind: AnalogueTransition;
  value: number;
  onKindChange: (kind: AnalogueTransition) => void;
  onValueChange: (value: number) => void;
}

export function ToolbarAnaloguePaintSection({
  kind,
  value,
  onKindChange,
  onValueChange,
}: ToolbarAnaloguePaintSectionProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteButtonRef = useRef<HTMLButtonElement>(null);
  const activeOption =
    ANALOGUE_BRUSH_OPTIONS.find((option) => option.kind === kind)
    ?? ANALOGUE_BRUSH_OPTIONS[0]!;
  const usesTarget =
    kind === 'step' || kind === 'capacitive' || kind === 'samples';

  return (
    <>
      <span className={styles.toolGroupLabel}>Shape</span>
      <button
        ref={paletteButtonRef}
        type="button"
        title="Choose an analogue cell shape with waveform previews"
        className={`${styles.toolBtn} ${styles.toolActive}`}
        aria-expanded={paletteOpen}
        onClick={() => setPaletteOpen((open) => !open)}
      >
        <svg
          className={styles.analogueBrushButtonPreview}
          viewBox="0 0 64 22"
          aria-hidden
        >
          <path d={analogueBrushPreviewPath(kind)} />
        </svg>
        {activeOption.label} ▾
      </button>
      {paletteOpen ? (
        <AnalogueBrushPalette
          anchorRef={paletteButtonRef}
          activeKind={kind}
          onSelect={onKindChange}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}
      <label
        className={styles.hscaleWrap}
        title={
          usesTarget
            ? 'Target analogue value painted into cells'
            : 'This analogue state derives its level from the voltage rails'
        }
      >
        <span className={styles.hscaleLabel}>Target</span>
        <input
          type="number"
          step="any"
          className={styles.hscaleInput}
          value={value}
          disabled={!usesTarget}
          aria-label="Analogue brush value"
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onValueChange(next);
          }}
        />
      </label>
      <span className={styles.contextHint}>
        {kind === 'hold'
          ? 'Paint . to continue the previous voltage'
          : usesTarget
            ? `Paint ${activeOption.symbol} toward ${value}`
            : `Paint ${activeOption.symbol}: ${activeOption.description}`}
        {' · '}Inspector edits exact cells and points
      </span>
    </>
  );
}

export function ToolbarBusSection({
  mode,
  activeBusLabel,
  activeBusColorIndex,
  onBusLabel,
  onBusColorIndex,
}: ToolbarBusSectionProps) {
  const diagram = useStore((state) => state.diagram);
  const view = useStore((state) => state.view);
  const selected = mode === 'edit' ? selectedBusSegment(diagram, view) : null;
  const disabled = mode === 'edit' && !selected;
  const colorIndex = selected ? colorIndexFromFillHex(selected.segment.color) : activeBusColorIndex;

  const editSelected = (edit: (signalId: string, segmentId: string) => void): boolean => {
    if (!selected) return false;
    let applied = false;
    runAfterSourceFlush(() => {
      const current = useStore.getState();
      const target = selectedBusSegment(current.diagram, current.view);
      if (target?.signalId !== selected.signalId || target.segment.id !== selected.segment.id) return;
      edit(target.signalId, target.segment.id);
      applied = true;
    });
    return applied;
  };

  return (
    <>
      <span className={styles.toolGroupLabel}>Bus</span>
      <label
        className={styles.busLabelWrap}
        title={mode === 'paint' ? 'Label applied to new bus spans'
          : selected ? 'Edit selected bus span; Enter or leaving this field applies the label'
            : 'Select a bus span on the waveform to edit its label'}
      >
        <span className={styles.busLabelTag}>Label</span>
        <BusLabelInput
          key={`${mode}:${view.diagramRevision}:${selected?.signalId ?? ''}:${selected?.segment.id ?? ''}`}
          value={mode === 'paint' ? activeBusLabel : selected?.segment.value ?? ''}
          disabled={disabled}
          onChange={mode === 'paint' ? onBusLabel : undefined}
          onCommit={mode === 'edit' ? (value) => editSelected((signalId, segmentId) => {
            useStore.getState().updateVectorSegmentValue(signalId, segmentId, value);
          }) : undefined}
        />
      </label>
      <span className={styles.busColorGroup} title="WaveDrom bus fill (wave digits 2–9)">
        {WAVEDROM_COLOR_INDEXES.map((idx) => (
          <button
            key={idx}
            type="button"
            className={`${styles.busColorSwatch} ${
              !disabled && colorIndex === idx ? styles.busColorSwatchActive : ''
            }`}
            style={{ background: fillHexForColorIndex(idx) }}
            title={`Bus color ${idx}`}
            aria-label={`Bus color ${idx}`}
            aria-pressed={!disabled && colorIndex === idx}
            disabled={disabled}
            onClick={() => {
              if (mode === 'paint') onBusColorIndex(idx as WavedromColorIndex);
              else editSelected((signalId, segmentId) => {
                useStore.getState().updateVectorSegmentColor(signalId, segmentId, fillHexForColorIndex(idx));
              });
            }}
          />
        ))}
      </span>
    </>
  );
}

function BusLabelInput({ value, disabled, onChange, onCommit }: {
  value: string;
  disabled: boolean;
  onChange?: (value: string) => void;
  onCommit?: (value: string) => boolean;
}) {
  const [draft, setDraft] = useState<{ source: string; value: string } | null>(null);
  const cancelBlur = useRef(false);
  const displayed = draft?.source === value ? draft.value : value;
  const commit = (): boolean => {
    if (displayed !== value && onCommit && !onCommit(displayed)) return false;
    setDraft(null);
    return true;
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => registerBusLabelDraftCommit(() => commitRef.current()), []);
  return <input type="text" className={styles.busLabelInput}
    value={displayed} disabled={disabled} placeholder={disabled ? 'Select bus span' : 'data'}
    aria-label="Bus label" spellCheck={false}
    onChange={(event) => {
      if (onChange) onChange(event.target.value);
      else setDraft({ source: value, value: event.target.value });
    }}
    onBlur={() => {
      if (cancelBlur.current) cancelBlur.current = false;
      else commit();
    }}
    onKeyDown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        cancelBlur.current = true;
        setDraft(null);
        event.currentTarget.blur();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        commit();
        event.currentTarget.blur();
      }
    }} />;
}

export interface ToolbarEdgeSectionProps {
  tool: string;
  activeEdgeConnector: string;
  activeEdgeLabel: string;
  showAnchorLetters: boolean;
  activeTimespanLabel: string;
  onEdgeConnectorChange: (connector: string) => void;
  onEdgeLabelChange: (label: string) => void;
  onToggleAnchorLetters: () => void;
  onTimespanLabelChange: (label: string) => void;
}

export function ToolbarEdgeSection({
  tool,
  activeEdgeConnector,
  activeEdgeLabel,
  showAnchorLetters,
  activeTimespanLabel,
  onEdgeConnectorChange,
  onEdgeLabelChange,
  onToggleAnchorLetters,
  onTimespanLabelChange,
}: ToolbarEdgeSectionProps) {
  if (tool === 'arrow') {
    return (
      <>
        <label className={styles.hscaleWrap} title="WaveDrom connector emitted between node anchors">
          <span className={styles.hscaleLabel}>connector</span>
          <select
            className={styles.hscaleSelect}
            value={activeEdgeConnector}
            onChange={(e) => onEdgeConnectorChange(e.target.value)}
            aria-label="WaveDrom edge connector"
          >
            {EDGE_CONNECTOR_GROUPS.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.options.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <label className={styles.busLabelWrap} title="Optional text appended to the WaveDrom edge">
          <span className={styles.busLabelTag}>Label</span>
          <input
            type="text"
            className={styles.busLabelInput}
            value={activeEdgeLabel}
            onChange={(e) => onEdgeLabelChange(e.target.value)}
            placeholder="time 3"
            aria-label="Edge label"
          />
        </label>
        <button
          type="button"
          title="Show A–Z anchor letters on canvas while placing edges"
          className={`${styles.toolBtn} ${showAnchorLetters ? styles.toolActive : ''}`}
          onClick={onToggleAnchorLetters}
          aria-pressed={showAnchorLetters}
        >
          ABC
        </button>
      </>
    );
  }

  if (tool === 'timespan') {
    return (
      <label
        className={styles.busLabelWrap}
        title="Label on new timespan edges (WaveDrom edge[] text)"
      >
        <span className={styles.busLabelTag}>Span</span>
        <input
          type="text"
          className={styles.busLabelInput}
          value={activeTimespanLabel}
          onChange={(e) => onTimespanLabelChange(e.target.value)}
          placeholder="5 ms"
          aria-label="Timespan label"
        />
      </label>
    );
  }

  return null;
}
