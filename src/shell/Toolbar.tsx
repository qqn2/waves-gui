import { useState, useEffect } from 'react';
import { ShortcutHelp } from './ShortcutHelp';
import {
  ArrowRight,
  Eraser,
  MousePointer2,
  MoveHorizontal,
  Paintbrush,
  ZoomIn,
  ZoomOut,
  Maximize,
} from 'lucide-react';
import { useStore } from '../shared/store';
import type { BitState } from '../shared/types';
import {
  HSCALE_STEP,
  MAX_HSCALE,
  MIN_HSCALE,
  CELL_WIDTH,
  TIME_AXIS_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../shared/constants';
import { buildRowLayout, totalContentHeight } from '../renderer/rowLayout';
import { measureHeadFoot } from '../renderer/renderHeadFoot';
import { ThemeMenu } from './ThemeMenu';
import { ToolbarFileMenu } from './toolbar/ToolbarFileMenu';
import { ToolbarAddSignalMenu } from './toolbar/ToolbarAddSignalMenu';
import {
  ToolbarBusSection,
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
  const setScroll = useStore((s) => s.setScroll);
  const toggleCodePanel = useStore((s) => s.toggleCodePanel);
  const toggleRenderPanel = useStore((s) => s.toggleRenderPanel);
  const setDiagramSkin = useStore((s) => s.setDiagramSkin);
  const diagramSkin = useStore((s) => s.diagram.config.skin);
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

  const fitToWindow = () => {
    const canvas = document.querySelector('.canvasWrap canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const canvasWidth = canvas.clientWidth;
    const canvasHeight = canvas.clientHeight;
    if (canvasWidth <= 0 || canvasHeight <= 0) return;

    const { totalSteps, hscale } = diagram.config;
    const contentW = totalSteps * CELL_WIDTH * hscale;

    const rows = buildRowLayout(diagram.signals);
    const contentH = totalContentHeight(rows);

    const axisOffset = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
    const { headHeight, footHeight } = measureHeadFoot(diagram.config);

    const zoomX = canvasWidth / contentW;
    const remainingH = canvasHeight - (axisOffset + headHeight + footHeight);
    const zoomY = remainingH > 0 ? remainingH / contentH : zoomX;

    const fitZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(zoomX, zoomY)));
    setZoom(fitZoom);
    setScroll(0, 0);
  };

  const [localHscale, setLocalHscale] = useState('');

  useEffect(() => {
    setLocalHscale(String(diagram.config.hscale));
  }, [diagram.config.hscale]);

  const commitHscale = () => {
    const val = Number(localHscale);
    if (Number.isFinite(val)) {
      setHscale(val);
    } else {
      setLocalHscale(String(diagram.config.hscale));
    }
  };

  const handleHscaleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitHscale();
      (e.target as HTMLInputElement).blur();
    }
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
        title="Draw (D) — drag to fill steps; bit values below, bus label in Bus field"
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
        title="Pointer (V) — click a bus to copy its label; click a row to select"
        className={`${styles.toolBtn} ${tool === 'cursor' || tool === 'select' ? styles.toolActive : ''}`}
        onClick={() => setTool('cursor')}
      >
        <MousePointer2 size={15} aria-hidden />
      </button>
      <button
        type="button"
        title="WaveDrom edge arrow — click start, move to preview, click end"
        className={`${styles.toolBtn} ${tool === 'arrow' ? styles.toolActive : ''}`}
        onClick={() => setTool('arrow')}
      >
        <ArrowRight size={15} aria-hidden />
      </button>
      <button
        type="button"
        title="WaveDrom timespan — click start, move to preview, click end on same row"
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
          moreBitsOpen={moreBitsOpen}
          onSetPaintMode={setPaintMode}
          onSelectBit={selectBitValue}
          onToggleMoreBits={() => setMoreBitsOpen((o) => !o)}
        />
      ) : null}

      {(tool === 'cursor' || tool === 'select' || tool === 'paint') && (
        <ToolbarBusSection
          activeBusLabel={activeBusLabel}
          activeBusColorIndex={activeBusColorIndex}
          onBusLabelChange={setActiveBusLabel}
          onBusColorIndex={setActiveBusColorIndex}
          pickFromCanvas={tool === 'cursor' || tool === 'select'}
        />
      )}

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
      <button
        type="button"
        id="fit-zoom-btn"
        className={styles.toolBtn}
        onClick={fitToWindow}
        title="Fit diagram to canvas window"
      >
        <Maximize size={15} />
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
          value={localHscale}
          onChange={(e) => setLocalHscale(e.target.value)}
          onBlur={commitHscale}
          onKeyDown={handleHscaleKeyDown}
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
      <label className={styles.hscaleField} title="WaveDrom config.skin">
        <span className={styles.hscaleLabel}>Skin</span>
        <select
          className={styles.hscaleInput}
          value={diagramSkin ?? 'default'}
          onChange={(e) => {
            const v = e.target.value;
            setDiagramSkin(v === 'default' ? undefined : v);
          }}
        >
          <option value="default">default</option>
          <option value="narrow">narrow</option>
          <option value="dark">dark</option>
          <option value="lowkey">lowkey</option>
        </select>
      </label>
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
