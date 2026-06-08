import { useEffect, useRef } from 'react';
import type { Signal } from '../shared/types';
import type { GroupRef } from './panelTree';
import styles from './SignalPanel.module.css';

export interface MenuAnchor {
  x: number;
  y: number;
}

export interface SignalContextMenuProps {
  anchor: MenuAnchor | null;
  signal: Signal | null;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onAddAbove: (type: Signal['type']) => void;
  onAddBelow: (type: Signal['type']) => void;
  onSetAll: (state: '0' | '1') => void;
  parentGroupId?: string;
  groups: GroupRef[];
  onMoveToGroup: (groupId: string) => void;
  onRemoveFromGroup: () => void;
}

export function SignalContextMenu({
  anchor,
  signal,
  onClose,
  onRename,
  onDelete,
  onDuplicate,
  onAddAbove,
  onAddBelow,
  onSetAll,
  parentGroupId,
  groups,
  onMoveToGroup,
  onRemoveFromGroup,
}: SignalContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const onPointerDown = (e: MouseEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, onClose]);

  if (!anchor || !signal) return null;

  const isBit = signal.type === 'bit';
  const isSpacer = signal.type === 'spacer';
  const inSection = parentGroupId !== undefined;
  const moveTargets = groups.filter((g) => g.id !== parentGroupId);

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: anchor.x, top: anchor.y }}
      role="menu"
    >
      <button type="button" role="menuitem" onClick={onRename}>
        Rename
      </button>
      <button type="button" role="menuitem" onClick={onDelete}>
        Delete
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={onDuplicate}
      >
        Duplicate
      </button>
      <div className={styles.menuSep} />
      <button type="button" role="menuitem" onClick={() => onAddAbove('bit')}>
        Add bit above
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAddAbove('vector')}
      >
        Add bus above
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAddBelow('bit')}
      >
        Add bit below
      </button>
      <button
        type="button"
        role="menuitem"
        onClick={() => onAddBelow('vector')}
      >
        Add bus below
      </button>
      <div className={styles.menuSep} />
      {moveTargets.length > 0 ? (
        <>
          <div className={styles.menuSubheading}>Move to section</div>
          {moveTargets.map((g) => (
            <button
              key={g.id}
              type="button"
              role="menuitem"
              className={styles.menuIndent}
              style={{ paddingLeft: 12 + g.depth * 10 }}
              onClick={() => onMoveToGroup(g.id)}
            >
              {g.name}
            </button>
          ))}
        </>
      ) : (
        <p className={styles.menuHint}>Add a section from + Add signal</p>
      )}
      {inSection ? (
        <button type="button" role="menuitem" onClick={onRemoveFromGroup}>
          Remove from section
        </button>
      ) : null}
      {isBit && (
        <>
          <div className={styles.menuSep} />
          <button type="button" role="menuitem" onClick={() => onSetAll('0')}>
            Set all to 0
          </button>
          <button type="button" role="menuitem" onClick={() => onSetAll('1')}>
            Set all to 1
          </button>
        </>
      )}
      {isSpacer && (
        <p className={styles.menuHint}>Blank row — no waveform data</p>
      )}
    </div>
  );
}
