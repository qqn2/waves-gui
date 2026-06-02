import { useState } from 'react';
import {
  ArrowRight,
  Eraser,
  MousePointer2,
  MoveHorizontal,
  Paintbrush,
  Plus,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useStore } from '../shared/store';
import type { BitState } from '../shared/types';
import {
  fillHexForColorIndex,
  WAVEDROM_COLOR_INDEXES,
  type WavedromColorIndex,
} from '../wavedromBridge/wavedromColors';
import { PatternsMenu } from '../patterns/PatternsMenu';
import { HSCALE_STEP, MAX_HSCALE, MIN_HSCALE } from '../shared/constants';
import { loadSampleDiagram, samplesByCategory } from './samples';
import { newDiagramFile, openDiagramFile, saveDiagramFile } from './FileOperations';
import { loadRecentFiles } from './soloDesk/recentFiles';
import { ThemeMenu } from './ThemeMenu';
import styles from './shell.module.css';

const BIT_STATES: BitState[] = ['1', '0', 'p', 'z', 'x'];

const BIT_STATE_TITLES: Partial<Record<BitState, string>> = {
  p: 'Clock rising edge (WaveDrom p); toggle flips to n',
};

export interface ToolbarProps {
  onExport: () => void;
}

export function Toolbar({ onExport }: ToolbarProps) {
  const tool = useStore((s) => s.view.selectedTool);
  const paintMode = useStore((s) => s.view.paintMode);
  const activeBit = useStore((s) => s.view.activeBitState);
  const activeBusLabel = useStore((s) => s.view.activeBusLabel);
  const setActiveBusLabel = useStore((s) => s.setActiveBusLabel);
  const activeTimespanLabel = useStore((s) => s.view.activeTimespanLabel);
  const setActiveTimespanLabel = useStore((s) => s.setActiveTimespanLabel);
  const activeBusColorIndex = useStore((s) => s.view.activeBusColorIndex);
  const setActiveBusColorIndex = useStore((s) => s.setActiveBusColorIndex);
  const setHscale = useStore((s) => s.setHscale);
  const zoom = useStore((s) => s.view.zoom);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const setTool = useStore((s) => s.setTool);
  const setActiveBitState = useStore((s) => s.setActiveBitState);
  const setPaintMode = useStore((s) => s.setPaintMode);
  const setZoom = useStore((s) => s.setZoom);
  const toggleCodePanel = useStore((s) => s.toggleCodePanel);
  const toggleTimeAxis = useStore((s) => s.toggleTimeAxis);
  const addSignal = useStore((s) => s.addSignal);
  const addGroup = useStore((s) => s.addGroup);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  const [fileOpen, setFileOpen] = useState(false);
  const recentFiles = fileOpen ? loadRecentFiles() : [];
  const [addOpen, setAddOpen] = useState(false);
  const [patternsOpen, setPatternsOpen] = useState(false);

  return (
    <div className={styles.toolbar}>
      <div className={styles.addWrap}>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => {
            setFileOpen((o) => !o);
            setAddOpen(false);
          }}
        >
          File ▾
        </button>
        {fileOpen && (
          <div className={styles.dropdown}>
            <button type="button" onClick={() => { newDiagramFile(); setFileOpen(false); }}>
              New
            </button>
            <button type="button" onClick={() => { void openDiagramFile(); setFileOpen(false); }}>
              Open…
            </button>
            <button
              type="button"
              onClick={() => {
                void saveDiagramFile(diagram, view.fileName);
                setFileOpen(false);
              }}
            >
              Save
            </button>
            <button type="button" onClick={() => { onExport(); setFileOpen(false); }}>
              Export…
            </button>
            {recentFiles.length > 0 ? (
              <>
                <div className={styles.menuSubheading}>Recent</div>
                {recentFiles.map((e) => (
                  <button
                    key={e.name + e.openedAt}
                    type="button"
                    disabled
                    title="Re-open via Open… (browser cannot reopen path automatically)"
                  >
                    {e.name}
                  </button>
                ))}
              </>
            ) : null}
            <div className={styles.menuSubheading}>Samples</div>
            {samplesByCategory('general').map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.description}
                onClick={() => {
                  void loadSampleDiagram(s.id);
                  setFileOpen(false);
                }}
              >
                {s.title}
              </button>
            ))}
            <div className={styles.menuSubheading}>AMBA templates</div>
            {samplesByCategory('amba').map((s) => (
              <button
                key={s.id}
                type="button"
                title={s.description}
                onClick={() => {
                  void loadSampleDiagram(s.id);
                  setFileOpen(false);
                }}
              >
                {s.title}
              </button>
            ))}
          </div>
        )}
      </div>

      <button type="button" className={styles.toolBtn} onClick={() => undo()} title="Undo">
        Undo
      </button>
      <button type="button" className={styles.toolBtn} onClick={() => redo()} title="Redo">
        Redo
      </button>
      <span className={styles.divider} />

      <button
        type="button"
        title="Draw (D) — drag along a row to fill time steps with the value below"
        className={`${styles.toolBtn} ${tool === 'paint' ? styles.toolActive : ''}`}
        onClick={() => setTool('paint')}
      >
        <Paintbrush size={15} aria-hidden />
      </button>
      <button
        type="button"
        title="Erase (E) — drag to clear cells (hold previous level)"
        className={`${styles.toolBtn} ${tool === 'erase' ? styles.toolActive : ''}`}
        onClick={() => setTool('erase')}
      >
        <Eraser size={15} aria-hidden />
      </button>
      <button
        type="button"
        title="Pointer (V) — click a row to select; drag for area select"
        className={`${styles.toolBtn} ${tool === 'cursor' || tool === 'select' ? styles.toolActive : ''}`}
        onClick={() => setTool('cursor')}
      >
        <MousePointer2 size={15} aria-hidden />
      </button>
      <button
        type="button"
        title="WaveDrom edge arrow — click start node, then end node"
        className={`${styles.toolBtn} ${tool === 'arrow' ? styles.toolActive : ''}`}
        onClick={() => setTool('arrow')}
      >
        <ArrowRight size={15} aria-hidden />
      </button>
      <button
        type="button"
        title="WaveDrom timespan edge — drag on one row between two steps"
        className={`${styles.toolBtn} ${tool === 'timespan' ? styles.toolActive : ''}`}
        onClick={() => setTool('timespan')}
      >
        <MoveHorizontal size={15} aria-hidden />
      </button>
      {tool === 'timespan' ? (
        <label
          className={styles.busLabelWrap}
          title="Label on new timespan edges (WaveDrom edge[] text)"
        >
          <span className={styles.busLabelTag}>Span</span>
          <input
            type="text"
            className={styles.busLabelInput}
            value={activeTimespanLabel}
            onChange={(e) => setActiveTimespanLabel(e.target.value)}
            placeholder="5 ms"
            aria-label="Timespan label"
          />
        </label>
      ) : null}
      {tool === 'paint' ? (
        <>
          <span className={styles.toolGroupLabel}>Value</span>
          <button
            type="button"
            title="Toggle (NOT) — 0↔1, clock p↔n; x/z unchanged"
            className={`${styles.toolBtn} ${paintMode === 'toggle' ? styles.toolActive : ''}`}
            onClick={() => setPaintMode('toggle')}
            aria-pressed={paintMode === 'toggle'}
          >
            ¬
          </button>
          <button
            type="button"
            title="Set — apply the selected value (0, 1, p, …)"
            className={`${styles.toolBtn} ${paintMode === 'set' ? styles.toolActive : ''}`}
            onClick={() => setPaintMode('set')}
            aria-pressed={paintMode === 'set'}
          >
            Set
          </button>
          {BIT_STATES.map((st) => (
            <button
              key={st}
              type="button"
              title={BIT_STATE_TITLES[st] ?? `Draw ${st}`}
              className={`${styles.toolBtn} ${activeBit === st ? styles.toolActive : ''}`}
              onClick={() => setActiveBitState(st)}
            >
              {st.toUpperCase()}
            </button>
          ))}
          <label
            className={styles.busLabelWrap}
            title="Label for bus rows (= span)"
          >
            <span className={styles.busLabelTag}>Bus</span>
            <input
              type="text"
              className={styles.busLabelInput}
              value={activeBusLabel}
              onChange={(e) => setActiveBusLabel(e.target.value)}
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
                onClick={() => setActiveBusColorIndex(idx as WavedromColorIndex)}
              />
            ))}
          </span>
        </>
      ) : null}
      <span className={styles.divider} />

      <div className={styles.addWrap}>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => {
            setAddOpen((o) => !o);
            setFileOpen(false);
          }}
        >
          <Plus size={15} /> Signal
        </button>
        {addOpen && (
          <div className={styles.dropdown}>
            <button type="button" onClick={() => { addSignal('bit'); setAddOpen(false); }}>
              Bit
            </button>
            <button
              type="button"
              title="Vector / bus lane — paint spans with the paint tool"
              onClick={() => {
                addSignal('vector');
                setAddOpen(false);
              }}
            >
              Bus
            </button>
            <button type="button" onClick={() => { addSignal('spacer'); setAddOpen(false); }}>
              Blank
            </button>
            <button
              type="button"
              onClick={() => {
                addGroup();
                setAddOpen(false);
              }}
            >
              Section
            </button>
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                setPatternsOpen(true);
              }}
            >
              Pattern…
            </button>
          </div>
        )}
        {patternsOpen && (
          <div className={styles.patternsPopover}>
            <PatternsMenu
              onClose={() => setPatternsOpen(false)}
              onInserted={() => setPatternsOpen(false)}
            />
          </div>
        )}
      </div>

      <span className={styles.divider} />
      <button type="button" className={styles.toolBtn} onClick={() => setZoom(zoom / 1.25)}>
        <ZoomOut size={15} />
      </button>
      <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
      <button type="button" className={styles.toolBtn} onClick={() => setZoom(zoom * 1.25)}>
        <ZoomIn size={15} />
      </button>
      <label
        className={styles.hscaleWrap}
        title="WaveDrom config.hscale (≥ 1, fractional OK e.g. 1.5)"
      >
        <span className={styles.hscaleLabel}>hscale</span>
        <input
          type="number"
          className={styles.hscaleInput}
          min={MIN_HSCALE}
          max={MAX_HSCALE}
          step={HSCALE_STEP}
          value={diagram.config.hscale}
          onChange={(e) => setHscale(Number(e.target.value))}
          aria-label="WaveDrom horizontal scale"
        />
      </label>

      <span className={styles.toolbarSpacer} />

      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => toggleCodePanel()}
        title="WaveDrom JSON"
      >
        {view.showCodePanel ? '✓ ' : ''}JSON
      </button>
      <button type="button" className={styles.toolBtn} onClick={() => toggleTimeAxis()}>
        {view.showTimeAxis ? '✓ ' : ''}Axis
      </button>
      <ThemeMenu />
    </div>
  );
}
