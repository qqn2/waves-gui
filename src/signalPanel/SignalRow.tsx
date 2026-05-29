import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';
import type { Signal } from '../shared/types';
import { useStore } from '../shared/store';
import { DragHandle } from './DragHandle';
import { InlineEditor } from './InlineEditor';
import styles from './SignalPanel.module.css';

export interface SignalRowProps {
  signal: Signal;
  zoom: number;
  depth: number;
  selected: boolean;
  dropHighlight: boolean;
  forceEdit?: boolean;
  onEditEnd?: () => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onOpenMenu: (signal: Signal, anchor: { x: number; y: number }) => void;
}

function typeBadge(type: Signal['type']): string {
  if (type === 'vector') return 'BUS';
  if (type === 'spacer') return '—';
  return 'BIT';
}

export function SignalRow({
  signal,
  zoom,
  depth,
  selected,
  dropHighlight,
  forceEdit = false,
  onEditEnd,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onOpenMenu,
}: SignalRowProps) {
  const renameSignal = useStore((s) => s.renameSignal);
  const updateSignalColor = useStore((s) => s.updateSignalColor);
  const [editing, setEditing] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (forceEdit) setEditing(true);
  }, [forceEdit]);

  const h = signal.rowHeight * zoom;
  const rowClass = [
    styles.row,
    selected ? styles.rowSelected : '',
    dropHighlight ? styles.rowDropTarget : '',
  ]
    .filter(Boolean)
    .join(' ');

  const openMenuAt = (clientX: number, clientY: number) => {
    onOpenMenu(signal, { x: clientX, y: clientY });
  };

  return (
    <div
      className={rowClass}
      style={{ height: h, paddingLeft: 8 + depth * 12 }}
      onDragOver={(e) => onDragOver(e, signal.id)}
      onDrop={(e) => onDrop(e, signal.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        openMenuAt(e.clientX, e.clientY);
      }}
    >
      <DragHandle
        onDragStart={(e) => onDragStart(e, signal.id)}
        onDragEnd={onDragEnd}
      />
      <span className={styles.badge}>{typeBadge(signal.type)}</span>
      {editing ? (
        <InlineEditor
          value={signal.name}
          onCommit={(name) => {
            renameSignal(signal.id, name);
            setEditing(false);
            onEditEnd?.();
          }}
          onCancel={() => {
            setEditing(false);
            onEditEnd?.();
          }}
        />
      ) : (
        <span
          className={styles.name}
          title={signal.name}
          onDoubleClick={() => setEditing(true)}
        >
          {signal.name || '(unnamed)'}
        </span>
      )}
      {signal.type !== 'spacer' && (
        <>
          <button
            type="button"
            className={styles.swatchBtn}
            aria-label="Signal color"
            onClick={() => colorInputRef.current?.click()}
          >
            <span
              className={styles.swatch}
              style={{ background: signal.color }}
            />
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className={styles.colorInput}
            value={signal.color}
            onChange={(e) => updateSignalColor(signal.id, e.target.value)}
          />
        </>
      )}
      <button
        type="button"
        className={styles.menuBtn}
        aria-label="Signal actions"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          openMenuAt(rect.left, rect.bottom);
        }}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
