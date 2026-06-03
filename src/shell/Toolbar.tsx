import { useState } from 'react';
import { ShortcutHelp } from './ShortcutHelp';
import {
  ArrowRight,
  Eraser,
  MousePointer2,
  MoveHorizontal,
  Paintbrush,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useStore } from '../shared/store';
import type { BitState } from '../shared/types';
import { HSCALE_STEP, MAX_HSCALE, MIN_HSCALE } from '../shared/constants';
import { ThemeMenu } from './ThemeMenu';
import { ToolbarFileMenu } from './toolbar/ToolbarFileMenu';
import { ToolbarAddSignalMenu } from './toolbar/ToolbarAddSignalMenu';
import {
  ToolbarEdgeSection,
  ToolbarPaintSection,
} from './toolbar/ToolbarPaintSection';
import styles from './shell.module.css';

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
  const activeEdgeShape = useStore((s) => s.view.activeEdgeShape);
  const setActiveEdgeShape = useStore((s) => s.setActiveEdgeShape);
  const showAnchorLetters = useStore((s) => s.view.showAnchorLetters);
  const setShowAnchorLetters = useStore((s) => s.setShowAnchorLetters);
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
  const toggleRenderPanel = useStore((s) => s.toggleRenderPanel);
  const toggleTimeAxis = useStore((s) => s.toggleTimeAxis);
  const addSignal = useStore((s) => s.addSignal);
  const addGroup = useStore((s) => s.addGroup);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  const [fileOpen, setFileOpen] = useState(false);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [moreBitsOpen, setMoreBitsOpen] = useState(false);

  const selectBitValue = (st: BitState) => {
    setActiveBitState(st);
    setPaintMode('set');
  };

  return (
    <div className={styles.toolbar}>
      <ToolbarFileMenu
        open={fileOpen}
        onToggle={() => {
          setFileOpen((o) => !o);
        }}
        onClose={() => setFileOpen(false)}
        diagram={diagram}
        view={view}
        onExport={onExport}
      />

      <button type="button" className={styles.toolBtn} onClick={() => undo()} title="Undo">
        Undo
      </button>
      <button type="button" className={styles.toolBtn} onClick={() => redo()} title="Redo">
        Redo
      </button>
      <span className={styles.divider} />

      {/* Drawing tools */}
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

      <ToolbarEdgeSection
        tool={tool}
        activeEdgeShape={activeEdgeShape}
        showAnchorLetters={showAnchorLetters}
        activeTimespanLabel={activeTimespanLabel}
        onEdgeShapeChange={setActiveEdgeShape}
        onToggleAnchorLetters={() => setShowAnchorLetters(!showAnchorLetters)}
        onTimespanLabelChange={setActiveTimespanLabel}
      />

      {tool === 'paint' ? (
        <ToolbarPaintSection
          paintMode={paintMode}
          activeBit={activeBit}
          activeBusLabel={activeBusLabel}
          activeBusColorIndex={activeBusColorIndex}
          moreBitsOpen={moreBitsOpen}
          onSetPaintMode={setPaintMode}
          onSelectBit={selectBitValue}
          onToggleMoreBits={() => setMoreBitsOpen((o) => !o)}
          onBusLabelChange={setActiveBusLabel}
          onBusColorIndex={setActiveBusColorIndex}
        />
      ) : null}

      <span className={styles.divider} />

      <ToolbarAddSignalMenu
        onAddBit={() => addSignal('bit')}
        onAddBus={() => addSignal('vector')}
        onAddSpacer={() => addSignal('spacer')}
        onAddGroup={() => addGroup()}
        onCloseOtherMenus={() => setFileOpen(false)}
      />

      <span className={styles.divider} />

      {/* Zoom + hscale */}
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
        className={`${styles.toolBtn} ${view.showCodePanel ? styles.toolActive : ''}`}
        onClick={() => toggleCodePanel()}
        title="Show or hide WaveDrom JSON editor"
      >
        {view.showCodePanel ? '✓ ' : ''}JSON
      </button>
      <button
        type="button"
        className={`${styles.toolBtn} ${view.showRenderPanel ? styles.toolActive : ''}`}
        onClick={() => toggleRenderPanel()}
        title="Show or hide WaveDrom render preview"
      >
        {view.showRenderPanel ? '✓ ' : ''}Render
      </button>
      <button type="button" className={styles.toolBtn} onClick={() => toggleTimeAxis()}>
        {view.showTimeAxis ? '✓ ' : ''}Axis
      </button>
      <ThemeMenu />
      <button
        type="button"
        className={styles.toolBtn}
        title="Keyboard shortcuts"
        onClick={() => setShortcutOpen(true)}
      >
        ?
      </button>
      <ShortcutHelp open={shortcutOpen} onClose={() => setShortcutOpen(false)} />
    </div>
  );
}
