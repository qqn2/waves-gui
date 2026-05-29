import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { SignalGroup } from '../shared/types';
import { GROUP_HEADER_HEIGHT } from '../shared/constants';
import { useStore } from '../shared/store';
import { DragHandle } from './DragHandle';
import { InlineEditor } from './InlineEditor';
import { renameGroupInStore, toggleGroupCollapsedInStore } from './panelTree';
import styles from './SignalPanel.module.css';

export interface GroupRowProps {
  group: SignalGroup;
  zoom: number;
  depth: number;
  dropHighlight: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
}

export function GroupRow({
  group,
  zoom,
  depth,
  dropHighlight,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: GroupRowProps) {
  const setState = useStore.setState;
  const [editing, setEditing] = useState(false);

  const h = GROUP_HEADER_HEIGHT * zoom;
  const rowClass = [styles.groupRow, dropHighlight ? styles.rowDropTarget : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClass}
      style={{ height: h, paddingLeft: 8 + depth * 12 }}
      onDragOver={(e) => onDragOver(e, group.id)}
      onDrop={(e) => onDrop(e, group.id)}
    >
      <DragHandle
        onDragStart={(e) => onDragStart(e, group.id)}
        onDragEnd={onDragEnd}
      />
      <button
        type="button"
        className={styles.collapseBtn}
        aria-label={group.collapsed ? 'Expand group' : 'Collapse group'}
        onClick={() => toggleGroupCollapsedInStore(setState, group.id)}
      >
        {group.collapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>
      {editing ? (
        <InlineEditor
          value={group.name}
          onCommit={(name) => {
            renameGroupInStore(setState, group.id, name);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <span
          className={styles.name}
          title={group.name}
          onDoubleClick={() => setEditing(true)}
        >
          {group.name || '(group)'}
        </span>
      )}
    </div>
  );
}
