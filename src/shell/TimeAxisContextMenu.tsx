import { useEffect, useRef, useState } from 'react';
import { useStore } from '../shared/store';
import styles from './TimeAxisContextMenu.module.css';

export interface TimeAxisContextMenuProps {
  step: number;
  x: number;
  y: number;
  onClose: () => void;
}

export function TimeAxisContextMenu({ step, x, y, onClose }: TimeAxisContextMenuProps) {
  const insertStepAt = useStore((s) => s.insertStepAt);
  const deleteStepAt = useStore((s) => s.deleteStepAt);
  const totalSteps = useStore((s) => s.diagram.config.totalSteps);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className={styles.menu}
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Time column actions"
    >
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          insertStepAt(step);
          onClose();
        }}
      >
        Insert column at step {step}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={totalSteps <= 1}
        onClick={() => {
          deleteStepAt(step);
          onClose();
        }}
      >
        Delete column at step {step}
      </button>
    </div>
  );
}

export function useTimeAxisContextMenu() {
  const [menu, setMenu] = useState<{ step: number; x: number; y: number } | null>(null);
  return {
    menu,
    openMenu: (step: number, x: number, y: number) => setMenu({ step, x, y }),
    closeMenu: () => setMenu(null),
  };
}
