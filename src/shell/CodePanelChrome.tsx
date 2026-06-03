import type { PointerEvent as ReactPointerEvent } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  PanelBottom,
  PanelRight,
  PictureInPicture2,
} from 'lucide-react';
import type { DockPanelLayout, CodePanelPlacement } from './codePanelLayout';
import styles from './shell.module.css';

export interface CodePanelChromeProps {
  title: string;
  layout: DockPanelLayout;
  onPlacementChange: (placement: CodePanelPlacement) => void;
  onFloatDragStart?: (e: ReactPointerEvent<HTMLDivElement>) => void;
  /** When two panels share an edge, axis of the shared stack. */
  stackAxis?: 'x' | 'y';
  canMoveTowardCanvas?: boolean;
  canMoveAwayFromCanvas?: boolean;
  onMoveTowardCanvas?: () => void;
  onMoveAwayFromCanvas?: () => void;
}

const PLACEMENTS: {
  id: CodePanelPlacement;
  title: string;
  Icon: typeof PanelBottom;
}[] = [
  { id: 'bottom', title: 'Dock below canvas', Icon: PanelBottom },
  { id: 'right', title: 'Dock beside canvas', Icon: PanelRight },
  { id: 'float', title: 'Floating window', Icon: PictureInPicture2 },
];

export function CodePanelChrome({
  title,
  layout,
  onPlacementChange,
  onFloatDragStart,
  stackAxis,
  canMoveTowardCanvas,
  canMoveAwayFromCanvas,
  onMoveTowardCanvas,
  onMoveAwayFromCanvas,
}: CodePanelChromeProps) {
  const TowardIcon = stackAxis === 'x' ? ChevronLeft : ChevronUp;
  const AwayIcon = stackAxis === 'x' ? ChevronRight : ChevronDown;
  const showOrder =
    stackAxis &&
    (canMoveTowardCanvas || canMoveAwayFromCanvas);

  return (
    <div
      className={styles.codePanelChrome}
      onPointerDown={layout.placement === 'float' ? onFloatDragStart : undefined}
    >
      <span className={styles.codePanelChromeTitle}>{title}</span>
      {showOrder ? (
        <div className={styles.codePanelOrderGroup}>
          <button
            type="button"
            className={styles.codePanelLayoutBtn}
            title="Move toward canvas"
            disabled={!canMoveTowardCanvas}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onMoveTowardCanvas?.()}
          >
            <TowardIcon size={14} aria-hidden />
          </button>
          <button
            type="button"
            className={styles.codePanelLayoutBtn}
            title="Move away from canvas"
            disabled={!canMoveAwayFromCanvas}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onMoveAwayFromCanvas?.()}
          >
            <AwayIcon size={14} aria-hidden />
          </button>
        </div>
      ) : null}
      <div className={styles.codePanelChromeActions}>
        {PLACEMENTS.map(({ id, title: placementTitle, Icon }) => (
          <button
            key={id}
            type="button"
            className={
              layout.placement === id
                ? `${styles.codePanelLayoutBtn} ${styles.codePanelLayoutBtnActive}`
                : styles.codePanelLayoutBtn
            }
            title={placementTitle}
            aria-pressed={layout.placement === id}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onPlacementChange(id)}
          >
            <Icon size={14} aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
