import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { SignalGroup } from '../shared/types';
import { GROUP_HEADER_HEIGHT } from '../shared/constants';
import { useStore } from '../shared/store';
import { OverflowText } from '../shared/OverflowText';
import { DragHandle } from './DragHandle';
import { InlineEditor } from './InlineEditor';
import styles from './SignalPanel.module.css';
import { runAfterSourceFlush } from '../codePanel/sourceMutationGuard';

export interface GroupRowProps {
  group: SignalGroup;
  collapsed: boolean;
  zoom: number;
  depth: number;
  dropHighlight: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onOpenMenu: (group: SignalGroup, anchor: { x: number; y: number }) => void;
  forceEdit?: boolean;
  onEditEnd?: () => void;
}

export function GroupRow({
  group,
  collapsed,
  zoom,
  depth,
  dropHighlight,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  onOpenMenu,
  forceEdit = false,
  onEditEnd,
}: GroupRowProps) {
  const renameGroup = useStore((s) => s.renameGroup);
  const toggleGroupCollapsed = useStore((s) => s.toggleGroupCollapsed);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (forceEdit) setEditing(true);
  }, [forceEdit]);

  const h = GROUP_HEADER_HEIGHT * zoom;
  const rowClass = [styles.groupRow, dropHighlight ? styles.rowDropTarget : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={rowClass}
      data-group-row="true"
      style={{ height: h, paddingLeft: 8 + depth * 12 }}
      onDragOver={(e) => onDragOver(e, group.id)}
      onDrop={(e) => onDrop(e, group.id)}
      onContextMenu={(e) => {
        e.preventDefault();
        onOpenMenu(group, { x: e.clientX, y: e.clientY });
      }}
    >
      <DragHandle
        onDragStart={(e) => onDragStart(e, group.id)}
        onDragEnd={onDragEnd}
      />
      <button
        type="button"
        className={styles.collapseBtn}
        aria-label={collapsed ? 'Expand group' : 'Collapse group'}
        onClick={() => toggleGroupCollapsed(group.id)}
      >
        {collapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>
      {editing ? (
        <InlineEditor
          value={group.name}
          onCommit={(name) => {
            runAfterSourceFlush(() => renameGroup(group.id, name));
            setEditing(false);
            onEditEnd?.();
          }}
          onCancel={() => {
            setEditing(false);
            onEditEnd?.();
          }}
        />
      ) : (
        <OverflowText
          className={styles.name}
          text={group.name}
          emptyText="(group)"
          onDoubleClick={() => setEditing(true)}
        />
      )}
      <button
        type="button"
        className={styles.menuBtn}
        aria-label="Section actions"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          onOpenMenu(group, { x: rect.left, y: rect.bottom });
        }}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>
  );
}
