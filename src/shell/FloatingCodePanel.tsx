import { useCallback, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  CODE_PANEL_FLOAT_MIN_H,
  CODE_PANEL_FLOAT_MIN_W,
  type DockPanelLayout,
} from './codePanelLayout';
import styles from './shell.module.css';

export interface FloatingCodePanelProps {
  layout: DockPanelLayout;
  ariaLabel: string;
  onLayoutChange: (patch: Partial<DockPanelLayout>) => void;
  children: ReactNode;
}

function clampFloatRect(rect: DockPanelLayout['floatRect']): DockPanelLayout['floatRect'] {
  const w = Math.max(
    CODE_PANEL_FLOAT_MIN_W,
    Math.min(window.innerWidth - 24, rect.w),
  );
  const h = Math.max(
    CODE_PANEL_FLOAT_MIN_H,
    Math.min(window.innerHeight - 24, rect.h),
  );
  const x = Math.max(8, Math.min(window.innerWidth - w - 8, rect.x));
  const y = Math.max(8, Math.min(window.innerHeight - h - 8, rect.y));
  return { x, y, w, h };
}

export function FloatingCodePanel({
  layout,
  ariaLabel,
  onLayoutChange,
  children,
}: FloatingCodePanelProps) {
  const { floatRect: rect } = layout;

  const onFloatDragStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('button')) return;
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { ...rect };

      const onMove = (ev: PointerEvent) => {
        onLayoutChange({
          floatRect: clampFloatRect({
            ...origin,
            x: origin.x + (ev.clientX - startX),
            y: origin.y + (ev.clientY - startY),
          }),
        });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [onLayoutChange, rect],
  );

  const onResizeStart = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const origin = { ...rect };

      const onMove = (ev: PointerEvent) => {
        onLayoutChange({
          floatRect: clampFloatRect({
            ...origin,
            w: origin.w + (ev.clientX - startX),
            h: origin.h + (ev.clientY - startY),
          }),
        });
      };

      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [onLayoutChange, rect],
  );

  return createPortal(
    <div
      className={styles.floatPanel}
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
      }}
      role="dialog"
      aria-label={ariaLabel}
    >
      <div
        className={styles.floatDragStrip}
        onPointerDown={onFloatDragStart}
        title="Drag to move"
      />
      <div className={styles.floatPanelBody}>{children}</div>
      <div
        className={styles.floatResizeHandle}
        title="Resize window"
        onPointerDown={onResizeStart}
      />
    </div>,
    document.body,
  );
}
