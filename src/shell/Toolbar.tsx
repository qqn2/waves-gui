import { useState, useEffect } from 'react';
import { ShortcutHelp } from './ShortcutHelp';
import {
  Braces,
  CircleHelp,
  Eye,
  ZoomIn,
  ZoomOut,
  Maximize,
  PanelRight,
  Redo2,
  Undo2,
} from 'lucide-react';
import { useStore } from '../shared/store';
import type { BitState } from '../shared/types';
import {
  HSCALE_STEP,
  MAX_HSCALE,
  MIN_HSCALE,
  TIME_AXIS_HEIGHT,
  MIN_ZOOM,
  MAX_ZOOM,
} from '../shared/constants';
import { buildRowLayout, totalContentHeight } from '../renderer/rowLayout';
import { measureHeadFoot } from '../renderer/renderHeadFoot';
import { diagramLogicalWidth } from '../renderer/laneTiming';
import { ThemeMenu } from './ThemeMenu';
import { ToolbarFileMenu } from './toolbar/ToolbarFileMenu';
import {
  ToolbarBusSection,
  ToolbarEdgeSection,
  ToolbarPaintSection,
} from './toolbar/ToolbarPaintSection';
import styles from './shell.module.css';

export interface ToolbarProps {
  onExport: () => void;
  inspectorVisible: boolean;
  inspectorAvailable: boolean;
  onToggleInspector: () => void;
}

export function Toolbar({
  onExport,
  inspectorVisible,
  inspectorAvailable,
  onToggleInspector,
}: ToolbarProps) {
  const tool = useStore((s) => s.view.selectedTool);
  const paintMode = useStore((s) => s.view.paintMode);
  const paintStyle = useStore((s) => s.view.paintStyle);
  const activeBit = useStore((s) => s.view.activeBitState);
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
  const setActiveBitState = useStore((s) => s.setActiveBitState);
  const setPaintMode = useStore((s) => s.setPaintMode);
  const setPaintStyle = useStore((s) => s.setPaintStyle);
  const setZoom = useStore((s) => s.setZoom);
  const setScroll = useStore((s) => s.setScroll);
  const toggleCodePanel = useStore((s) => s.toggleCodePanel);
  const toggleRenderPanel = useStore((s) => s.toggleRenderPanel);
  const setDiagramSkin = useStore((s) => s.setDiagramSkin);
  const diagramSkin = useStore((s) => s.diagram.config.skin);
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

    const contentW = diagramLogicalWidth(diagram) * diagram.config.hscale;

    const rows = buildRowLayout(diagram.signals);
    const contentH = totalContentHeight(rows);

    const axisOffset = TIME_AXIS_HEIGHT;
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

  const updateHscale = (raw: string) => {
    setLocalHscale(raw);
    if (raw.trim() === '') return;
    const val = Number(raw);
    if (Number.isFinite(val)) setHscale(val);
  };

  const handleHscaleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitHscale();
      (e.target as HTMLInputElement).blur();
    }
  };

  const toolLabel =
    tool === 'cursor' || tool === 'select'
      ? 'Select'
      : tool === 'paint'
        ? 'Draw'
        : tool === 'erase'
          ? 'Erase'
          : tool === 'arrow'
            ? 'Edge'
            : 'Span';


  return (
    <div className={styles.toolbarShell}>
      <div className={`${styles.toolbar} ${styles.toolbarPrimary}`} data-toolbar="primary">
        <div className={styles.appIdentity} aria-label="Waves GUI waveform editor">
          <span className={styles.appMark}>W</span>
          <span className={styles.appName}>Waves GUI</span>
        </div>
        <span className={styles.divider} />
        <ToolbarFileMenu
          open={fileOpen}
          onToggle={() => setFileOpen((o) => !o)}
          onClose={() => setFileOpen(false)}
          onExport={onExport}
        />
        <button type="button" className={styles.toolBtn} onClick={() => undo()} title="Undo (Ctrl+Z)">
          <Undo2 size={16} aria-hidden /><span>Undo</span>
        </button>
        <button type="button" className={styles.toolBtn} onClick={() => redo()} title="Redo (Ctrl+Shift+Z)">
          <Redo2 size={16} aria-hidden /><span>Redo</span>
        </button>

        <span className={styles.toolbarSpacer} />

        <div className={styles.zoomControls} aria-label="Canvas scale controls">
          <button type="button" className={styles.toolBtn} onClick={() => setZoom(zoom / 1.25)} title="Zoom out">
            <ZoomOut size={15} aria-hidden />
          </button>
          <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
          <button type="button" className={styles.toolBtn} onClick={() => setZoom(zoom * 1.25)} title="Zoom in">
            <ZoomIn size={15} aria-hidden />
          </button>
          <button
            type="button"
            id="fit-zoom-btn"
            className={styles.toolBtn}
            onClick={fitToWindow}
            title="Fit diagram to canvas window"
          >
            <Maximize size={15} aria-hidden />
          </button>
          <label className={styles.hscaleWrap} title="WaveDrom config.hscale (≥ 1, fractional OK e.g. 1.5)">
            <span className={styles.hscaleLabel}>hscale</span>
            <input
              type="number"
              className={styles.hscaleInput}
              min={MIN_HSCALE}
              max={MAX_HSCALE}
              step={HSCALE_STEP}
              value={localHscale}
              onChange={(e) => updateHscale(e.target.value)}
              onBlur={commitHscale}
              onKeyDown={handleHscaleKeyDown}
              aria-label="WaveDrom horizontal scale"
            />
          </label>
        </div>

        <div className={styles.viewControls}>
        <button
          type="button"
          className={`${styles.toolBtn} ${view.showCodePanel ? styles.toolActive : ''}`}
          onClick={() => toggleCodePanel()}
          title="Show or hide WaveDrom JSON editor"
        >
          <Braces size={16} aria-hidden /> JSON
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${view.showRenderPanel ? styles.toolActive : ''}`}
          onClick={() => toggleRenderPanel()}
          title="Show or hide WaveDrom render preview"
          aria-pressed={view.showRenderPanel}
        >
          <Eye size={16} aria-hidden /> Render
        </button>
        <button
          type="button"
          className={`${styles.toolBtn} ${inspectorVisible ? styles.toolActive : ''}`}
          onClick={onToggleInspector}
          disabled={!inspectorAvailable}
          title={inspectorAvailable ? 'Show or hide bus properties inspector' : 'Select a bus to inspect its properties'}
          aria-pressed={inspectorVisible}
        >
          <PanelRight size={16} aria-hidden /> Inspector
        </button>
        <label className={styles.hscaleField} title="WaveDrom config.skin">
          <span className={styles.hscaleLabel}>Skin</span>
          <select
            className={`${styles.hscaleInput} ${styles.skinSelect}`}
            aria-label="WaveDrom skin"
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
        <ThemeMenu />
        <button
          type="button"
          className={styles.toolBtn}
          title="Help and keyboard shortcuts"
          onClick={() => setShortcutOpen(true)}
        >
          <CircleHelp size={17} aria-hidden />
        </button>
        </div>
      </div>

      <div
        className={styles.contextToolbar}
        data-toolbar="context"
        aria-label={`${toolLabel} tool options`}
      >
        <span className={styles.contextToolName}>{toolLabel}</span>
        <span className={styles.divider} />
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
            paintStyle={paintStyle}
            activeBit={activeBit}
            moreBitsOpen={moreBitsOpen}
            onSetPaintMode={setPaintMode}
            onSetPaintStyle={setPaintStyle}
            onSelectBit={selectBitValue}
            onToggleMoreBits={() => setMoreBitsOpen((o) => !o)}
          />
        ) : null}
        {(tool === 'cursor' || tool === 'select' || tool === 'paint') && (
          <ToolbarBusSection
            activeBusColorIndex={activeBusColorIndex}
            onBusColorIndex={setActiveBusColorIndex}
          />
        )}
        {tool === 'erase' ? <span className={styles.contextHint}>Drag across waveform cells to clear them</span> : null}
      </div>
      <ShortcutHelp open={shortcutOpen} onClose={() => setShortcutOpen(false)} />
    </div>
  );
}
