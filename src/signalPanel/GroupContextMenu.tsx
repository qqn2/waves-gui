import { useEffect, useRef } from 'react';
import type { SignalGroup } from '../shared/types';
import type { MenuAnchor } from './SignalContextMenu';
import styles from './SignalPanel.module.css';

export interface GroupContextMenuProps {
  anchor: MenuAnchor | null;
  group: SignalGroup | null;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export function GroupContextMenu({
  anchor,
  group,
  onClose,
  onRename,
  onDelete,
}: GroupContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor || !group) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchor, group, onClose]);

  if (!anchor || !group) return null;

  return (
    <div
      ref={menuRef}
      className={styles.contextMenu}
      style={{ left: anchor.x, top: anchor.y }}
      role="menu"
      aria-label={`Section actions for ${group.name || 'Section'}`}
    >
      <button type="button" role="menuitem" onClick={onRename}>
        Rename section
      </button>
      <button type="button" role="menuitem" onClick={onDelete}>
        Delete section
      </button>
    </div>
  );
}
