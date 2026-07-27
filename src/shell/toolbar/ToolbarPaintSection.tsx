import {
  fillHexForColorIndex,
  WAVEDROM_COLOR_INDEXES,
  type WavedromColorIndex,
} from '../../wavedromBridge/wavedromColors';
import type { BitState, PaintMode, PaintStyle } from '../../shared/types';
import { ArrowLeftRight, Columns2, Zap } from 'lucide-react';
import { BitStateButton } from './BitStateButton';
import {
  EDGE_CONNECTOR_GROUPS,
  MORE_BIT_STATES,
  PRIMARY_BIT_STATES,
  UNDULATE_BIT_STATES,
} from './bitStateConstants';
import styles from '../shell.module.css';

export interface ToolbarPaintSectionProps {
  paintMode: PaintMode;
  paintStyle: PaintStyle;
  activeBit: BitState;
  extensionsEnabled: boolean;
  moreBitsOpen: boolean;
  onSetPaintMode: (mode: PaintMode) => void;
  onSetPaintStyle: (style: PaintStyle) => void;
  onSelectBit: (st: BitState) => void;
  onToggleMoreBits: () => void;
}

export function ToolbarPaintSection({
  paintMode,
  paintStyle,
  activeBit,
  extensionsEnabled,
  moreBitsOpen,
  onSetPaintMode,
  onSetPaintStyle,
  onSelectBit,
  onToggleMoreBits,
}: ToolbarPaintSectionProps) {
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
        type="button"
        title="Glitch — add a spurious transition (G)"
        className={`${styles.toolBtn} ${paintMode === 'glitch' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintMode('glitch')}
        aria-pressed={paintMode === 'glitch'}
      >
        <Zap size={14} aria-hidden /> Glitch
      </button>
      <button
        type="button"
        title="Gap — insert a timeline break before the next column (|)"
        className={`${styles.toolBtn} ${paintMode === 'gap' ? styles.toolActive : ''}`}
        onClick={() => onSetPaintMode('gap')}
        aria-pressed={paintMode === 'gap'}
      >
        <Columns2 size={14} aria-hidden /> Gap
      </button>
      <button
        type="button"
        title="Invert — toggle 0↔1 and clock phase p↔n or P↔N (T); x/z unchanged"
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
          {moreBitStates.map((st) => (
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
  activeBusColorIndex: WavedromColorIndex;
  onBusColorIndex: (index: WavedromColorIndex) => void;
}

export function ToolbarBusSection({
  activeBusColorIndex,
  onBusColorIndex,
}: ToolbarBusSectionProps) {
  return (
    <>
      <span className={styles.toolGroupLabel}>Bus</span>
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
