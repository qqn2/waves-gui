import {
  fillHexForColorIndex,
  WAVEDROM_COLOR_INDEXES,
  type WavedromColorIndex,
} from '../../wavedromBridge/wavedromColors';
import type { BitState, PaintMode } from '../../shared/types';
import { BitStateButton } from './BitStateButton';
import {
  EDGE_SHAPES,
  MORE_BIT_STATES,
  PRIMARY_BIT_STATES,
} from './bitStateConstants';
import styles from '../shell.module.css';

export interface ToolbarPaintSectionProps {
  paintMode: PaintMode;
  activeBit: BitState;
  moreBitsOpen: boolean;
  onSetPaintMode: (mode: PaintMode) => void;
  onSelectBit: (st: BitState) => void;
  onToggleMoreBits: () => void;
}

export function ToolbarPaintSection({
  paintMode,
  activeBit,
  moreBitsOpen,
  onSetPaintMode,
  onSelectBit,
  onToggleMoreBits,
}: ToolbarPaintSectionProps) {
  const moreBitsActive = MORE_BIT_STATES.includes(activeBit);

  return (
    <>
      <span className={styles.toolGroupLabel}>Value</span>
      <button
        type="button"
        title="Glitch — spurious same-level transition (WaveDrom 00 / 0.0)"
        className={`${styles.toolBtn} ${paintMode === 'glitch' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintMode('glitch')}
        aria-pressed={paintMode === 'glitch'}
      >
        ⌢
      </button>
      <button
        type="button"
        title="Toggle (NOT) — 0↔1; clock rise↔fall (p/P→n, n/N→p); x/z unchanged"
        className={`${styles.toolBtn} ${paintMode === 'toggle' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintMode('toggle')}
        aria-pressed={paintMode === 'toggle'}
      >
        ¬
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
        title="More values — p, n, weak pull-up/down (u, d), Set mode"
        className={`${styles.toolBtn} ${
          moreBitsOpen || moreBitsActive ? styles.toolActive : ''
        }`}
        onClick={onToggleMoreBits}
        aria-pressed={moreBitsOpen}
        aria-expanded={moreBitsOpen}
      >
        More{moreBitsActive && !moreBitsOpen ? ` (${activeBit})` : ''} ▾
      </button>
      {moreBitsOpen ? (
        <span className={styles.paintMoreGroup}>
          {MORE_BIT_STATES.map((st) => (
            <BitStateButton
              key={st}
              st={st}
              active={paintMode === 'set' && activeBit === st}
              onSelect={onSelectBit}
            />
          ))}
          <button
            type="button"
            title="Set — apply the selected value"
            className={`${styles.toolBtn} ${paintMode === 'set' ? styles.toolActive : ''}`}
            onClick={() => onSetPaintMode('set')}
            aria-pressed={paintMode === 'set'}
          >
            Set
          </button>
        </span>
      ) : null}
    </>
  );
}

export interface ToolbarBusSectionProps {
  activeBusLabel: string;
  activeBusColorIndex: WavedromColorIndex;
  onBusLabelChange: (label: string) => void;
  onBusColorIndex: (index: WavedromColorIndex) => void;
  /** Pointer mode: click canvas bus to copy label here */
  pickFromCanvas?: boolean;
}

export function ToolbarBusSection({
  activeBusLabel,
  activeBusColorIndex,
  onBusLabelChange,
  onBusColorIndex,
  pickFromCanvas = false,
}: ToolbarBusSectionProps) {
  const labelTitle = pickFromCanvas
    ? 'Click a bus segment on canvas to copy its label here'
    : 'Label written on bus spans when you drag with Draw';

  return (
    <>
      <span className={styles.toolGroupLabel}>Bus</span>
      <label className={styles.busLabelWrap} title={labelTitle}>
        <span className={styles.busLabelTag}>label</span>
        <input
          type="text"
          className={styles.busLabelInput}
          value={activeBusLabel}
          onChange={(e) => onBusLabelChange(e.target.value)}
          placeholder="data"
          aria-label="Bus label"
        />
      </label>
      <span className={styles.busColorGroup} title="WaveDrom bus fill (wave digits 2–9)">
        {WAVEDROM_COLOR_INDEXES.map((idx) => (
          <button
            key={idx}
            type="button"
            className={`${styles.busColorSwatch} ${
              activeBusColorIndex === idx ? styles.busColorSwatchActive : ''
            }`}
            style={{ background: fillHexForColorIndex(idx) }}
            title={`Bus color ${idx}`}
            aria-label={`Bus color ${idx}`}
            aria-pressed={activeBusColorIndex === idx}
            onClick={() => onBusColorIndex(idx as WavedromColorIndex)}
          />
        ))}
      </span>
    </>
  );
}

export interface ToolbarEdgeSectionProps {
  tool: string;
  activeEdgeShape: string;
  showAnchorLetters: boolean;
  activeTimespanLabel: string;
  onEdgeShapeChange: (shape: string) => void;
  onToggleAnchorLetters: () => void;
  onTimespanLabelChange: (label: string) => void;
}

export function ToolbarEdgeSection({
  tool,
  activeEdgeShape,
  showAnchorLetters,
  activeTimespanLabel,
  onEdgeShapeChange,
  onToggleAnchorLetters,
  onTimespanLabelChange,
}: ToolbarEdgeSectionProps) {
  if (tool === 'arrow') {
    return (
      <>
        <label className={styles.hscaleWrap} title="Path shape between anchors (before >)">
          <span className={styles.hscaleLabel}>shape</span>
          <select
            className={styles.hscaleSelect}
            value={activeEdgeShape}
            onChange={(e) => onEdgeShapeChange(e.target.value)}
            aria-label="Arrow edge shape"
          >
            {EDGE_SHAPES.map((sh) => (
              <option key={sh || 'default'} value={sh}>
                {sh === '' ? '→' : sh}
              </option>
            ))}
          </select>
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
