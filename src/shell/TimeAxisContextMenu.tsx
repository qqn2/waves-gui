import { useEffect, useRef, useState } from 'react';
import { useStore } from '../shared/store';
import { MAX_TOTAL_STEPS, MIN_TOTAL_STEPS } from '../shared/constants';
import {
  canDeleteStepInSignal,
  canInsertStepInSignal,
  hasLegacyTimelineTiming,
  walkSignals,
} from '../shared/store/stepColumnHelpers';
import { runAfterSourceFlush } from '../codePanel/sourceMutationGuard';
import { confirmStructuralReferenceLoss } from '../tools/structuralEditGuard';
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

  const canInsert = () => {
    const { diagram } = useStore.getState();
    if (diagram.config.totalSteps >= MAX_TOTAL_STEPS) return false;
    if (hasLegacyTimelineTiming(diagram.signals)) return false;
    const at = Math.max(0, Math.min(step, diagram.config.totalSteps));
    let allowed = true;
    walkSignals(diagram.signals, (signal) => {
      if (!canInsertStepInSignal(signal, at, diagram.config.totalSteps)) allowed = false;
    });
    return allowed;
  };

  const canDelete = () => {
    const { diagram } = useStore.getState();
    if (diagram.config.totalSteps <= MIN_TOTAL_STEPS) return false;
    if (hasLegacyTimelineTiming(diagram.signals)) return false;
    const at = Math.max(0, Math.min(step, diagram.config.totalSteps - 1));
    let allowed = true;
    walkSignals(diagram.signals, (signal) => {
      if (!canDeleteStepInSignal(signal, at, MIN_TOTAL_STEPS)) allowed = false;
      if (signal.type === 'vector' && !signal.vectorTiming) {
        for (const segment of signal.segments) {
          if (
            segment.startStep <= at
            && segment.endStep > at
            && segment.endStep - segment.startStep <= 1
          ) allowed = false;
        }
      }
    });
    return allowed;
  };

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
          const ran = runAfterSourceFlush(() => {
            if (!canInsert()) return;
            if (!confirmStructuralReferenceLoss('Inserting a column')) return;
            insertStepAt(step);
            onClose();
          });
          if (!ran) onClose();
        }}
      >
        Insert column at step {step}
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={totalSteps <= 1}
        onClick={() => {
          const ran = runAfterSourceFlush(() => {
            if (!canDelete()) return;
            if (!confirmStructuralReferenceLoss('Deleting a column')) return;
            deleteStepAt(step);
            onClose();
          });
          if (!ran) onClose();
        }}
      >
        Delete column at step {step}
      </button>
    </div>
  );
}

// This file intentionally co-locates the menu component with its state hook.
// eslint-disable-next-line react-refresh/only-export-components
export function useTimeAxisContextMenu() {
  const [menu, setMenu] = useState<{ step: number; x: number; y: number } | null>(null);
  return {
    menu,
    openMenu: (step: number, x: number, y: number) => setMenu({ step, x, y }),
    closeMenu: () => setMenu(null),
  };
}
