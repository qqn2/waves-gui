import { useState } from 'react';
import {
  ArrowRight,
  Clock,
  Eraser,
  Minus,
  MousePointer2,
  Paintbrush,
  Plus,
  Square,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useStore } from '../shared/store';
import type { BitState, Tool } from '../shared/types';
import { PatternsMenu } from '../patterns/PatternsMenu';
import styles from './shell.module.css';

const TOOLS: { id: Tool; icon: typeof Paintbrush; label: string }[] = [
  { id: 'paint', icon: Paintbrush, label: 'Paint' },
  { id: 'erase', icon: Eraser, label: 'Erase' },
  { id: 'select', icon: Square, label: 'Select' },
  { id: 'cursor', icon: MousePointer2, label: 'Cursor' },
  { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
  { id: 'timespan', icon: Minus, label: 'Time span' },
  { id: 'marker', icon: Clock, label: 'Marker' },
  { id: 'text', icon: Type, label: 'Text' },
];

const BIT_STATES: BitState[] = ['1', '0', 'z', 'x'];

export interface ToolbarProps {
  onExport: () => void;
}

export function Toolbar({ onExport }: ToolbarProps) {
  const tool = useStore((s) => s.view.selectedTool);
  const activeBit = useStore((s) => s.view.activeBitState);
  const zoom = useStore((s) => s.view.zoom);
  const setTool = useStore((s) => s.setTool);
  const setActiveBitState = useStore((s) => s.setActiveBitState);
  const setZoom = useStore((s) => s.setZoom);
  const addSignal = useStore((s) => s.addSignal);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);

  const [addOpen, setAddOpen] = useState(false);
  const [patternsOpen, setPatternsOpen] = useState(false);

  return (
    <div className={styles.toolbar}>
      <button type="button" className={styles.toolBtn} onClick={() => undo()} title="Undo">
        ↶
      </button>
      <button type="button" className={styles.toolBtn} onClick={() => redo()} title="Redo">
        ↷
      </button>
      <span className={styles.divider} />
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => setZoom(zoom / 1.25)}
        title="Zoom out"
      >
        <ZoomOut size={16} />
      </button>
      <span className={styles.zoomLabel}>{Math.round(zoom * 100)}%</span>
      <button
        type="button"
        className={styles.toolBtn}
        onClick={() => setZoom(zoom * 1.25)}
        title="Zoom in"
      >
        <ZoomIn size={16} />
      </button>
      <span className={styles.divider} />
      <div className={styles.addWrap}>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => {
            setAddOpen((o) => !o);
            setPatternsOpen(false);
          }}
        >
          <Plus size={16} /> Signal
        </button>
        {addOpen && (
          <div className={styles.dropdown}>
            <button type="button" onClick={() => { addSignal('bit'); setAddOpen(false); }}>
              Bit signal
            </button>
            <button type="button" onClick={() => { addSignal('vector'); setAddOpen(false); }}>
              Vector signal
            </button>
            <button type="button" onClick={() => { addSignal('spacer'); setAddOpen(false); }}>
              Blank row
            </button>
            <button
              type="button"
              onClick={() => {
                setAddOpen(false);
                setPatternsOpen(true);
              }}
            >
              Predefined patterns…
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
      {TOOLS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          type="button"
          title={label}
          className={`${styles.toolBtn} ${tool === id ? styles.toolActive : ''}`}
          onClick={() => setTool(id)}
        >
          <Icon size={16} />
        </button>
      ))}
      <span className={styles.divider} />
      <button type="button" className={styles.toolBtn} onClick={onExport}>
        Export
      </button>
    </div>
  );
}
