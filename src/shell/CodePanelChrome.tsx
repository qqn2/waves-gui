import type { PointerEvent as ReactPointerEvent } from 'react';
import { PanelBottom, PanelRight, PictureInPicture2 } from 'lucide-react';
import type { CodePanelLayoutState, CodePanelPlacement } from './codePanelLayout';
import styles from './shell.module.css';

export interface CodePanelChromeProps {
  layout: CodePanelLayoutState;
  onPlacementChange: (placement: CodePanelPlacement) => void;
  /** When floating, drag the window from the header. */
  onFloatDragStart?: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

const PLACEMENTS: {
  id: CodePanelPlacement;
  title: string;
  Icon: typeof PanelBottom;
}[] = [
  { id: 'bottom', title: 'Dock below canvas', Icon: PanelBottom },
  { id: 'right', title: 'Dock beside canvas (side by side)', Icon: PanelRight },
  { id: 'float', title: 'Floating window', Icon: PictureInPicture2 },
];

export function CodePanelChrome({
  layout,
  onPlacementChange,
  onFloatDragStart,
}: CodePanelChromeProps) {
  return (
    <div
      className={styles.codePanelChrome}
      onPointerDown={layout.placement === 'float' ? onFloatDragStart : undefined}
    >
      <span className={styles.codePanelChromeTitle}>WaveDrom JSON</span>
      <div className={styles.codePanelChromeActions}>
        {PLACEMENTS.map(({ id, title, Icon }) => (
          <button
            key={id}
            type="button"
            className={
              layout.placement === id
                ? `${styles.codePanelLayoutBtn} ${styles.codePanelLayoutBtnActive}`
                : styles.codePanelLayoutBtn
            }
            title={title}
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
