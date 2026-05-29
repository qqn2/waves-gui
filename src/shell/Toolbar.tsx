import { useState } from 'react';
import { Eraser, Paintbrush, Plus, Square, ZoomIn, ZoomOut } from 'lucide-react';
import { useStore } from '../shared/store';
import type { BitState } from '../shared/types';
import { PatternsMenu } from '../patterns/PatternsMenu';
import { loadSampleDiagram, SAMPLE_DIAGRAMS } from './samples';
import { newDiagramFile, openDiagramFile, saveDiagramFile } from './FileOperations';
import { loadRecentFiles } from './soloDesk/recentFiles';
import { BUS_SEGMENT_EDIT_HINT } from '../tools/vectorPaintTool';
import styles from './shell.module.css';

const BIT_STATES: BitState[] = ['1', '0', 'z', 'x'];

export interface ToolbarProps {
  onExport: () => void;
}

export function Toolbar({ onExport }: ToolbarProps) {
  const tool = useStore((s) => s.view.selectedTool);
  const paintMode = useStore((s) => s.view.paintMode);
  const activeBit = useStore((s) => s.view.activeBitState);
  const zoom = useStore((s) => s.view.zoom);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const setTool = useStore((s) => s.setTool);
  const setActiveBitState = useStore((s) => s.setActiveBitState);
  const setPaintMode = useStore((s) => s.setPaintMode);
  const setZoom = useStore((s) => s.setZoom);
  const toggleCodePanel = useStore((s) => s.toggleCodePanel);
  const toggleTimeAxis = useStore((s) => s.toggleTimeAxis);
  const setTheme = useStore((s) => s.setTheme);
  const addSignal = useStore((s) => s.addSignal);
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
            {SAMPLE_DIAGRAMS.map((s) => (
              <button
                key={s.id}
                type="button"
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
        title="Paint"
        className={`${styles.toolBtn} ${tool === 'paint' ? styles.toolActive : ''}`}
        onClick={() => setTool('paint')}
      >
        <Paintbrush size={15} />
      </button>
      <button
        type="button"
        title="Erase"
        className={`${styles.toolBtn} ${tool === 'erase' ? styles.toolActive : ''}`}
        onClick={() => setTool('erase')}
      >
        <Eraser size={15} />
      </button>
      <button
        type="button"
        title="Select"
        className={`${styles.toolBtn} ${tool === 'select' ? styles.toolActive : ''}`}
        onClick={() => setTool('select')}
      >
        <Square size={15} />
      </button>
      <span className={styles.divider} />

      <button
        type="button"
        title="Toggle (NOT) — click flips 0/1"
        className={`${styles.toolBtn} ${paintMode === 'toggle' ? styles.toolActive : ''}`}
        onClick={() => setPaintMode('toggle')}
      >
        ¬
      </button>
      {BIT_STATES.map((st) => (
        <button
          key={st}
          type="button"
          className={`${styles.toolBtn} ${activeBit === st ? styles.toolActive : ''}`}
          onClick={() => setActiveBitState(st)}
        >
          {st.toUpperCase()}
        </button>
      ))}
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
              title={BUS_SEGMENT_EDIT_HINT}
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
      <button type="button" className={styles.toolBtn} onClick={() => setTheme('light')}>
        Light
      </button>
      <button type="button" className={styles.toolBtn} onClick={() => setTheme('dark')}>
        Dark
      </button>
    </div>
  );
}
