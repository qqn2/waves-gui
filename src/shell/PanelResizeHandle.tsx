import { useCallback, type PointerEvent as ReactPointerEvent } from 'react';
import styles from './shell.module.css';

export interface PanelResizeHandleProps {
  axis: 'x' | 'y';
  /** Called with pixel delta since pointer down (positive = larger panel). */
  onResizeDelta: (delta: number) => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  className?: string;
  title?: string;
}

export function PanelResizeHandle({
  axis,
  onResizeDelta,
  onResizeStart,
  onResizeEnd,
  className,
  title,
}: PanelResizeHandleProps) {
  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      e.preventDefault();
      onResizeStart?.();
      const el = e.currentTarget;
      el.setPointerCapture(e.pointerId);
      const start = axis === 'y' ? e.clientY : e.clientX;

      const onMove = (ev: PointerEvent) => {
        const current = axis === 'y' ? ev.clientY : ev.clientX;
        onResizeDelta(current - start);
      };

      const onUp = () => {
        el.releasePointerCapture(e.pointerId);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        onResizeEnd?.();
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
    },
    [axis, onResizeDelta, onResizeStart, onResizeEnd],
  );

  const axisClass = axis === 'y' ? styles.resizeHandleRow : styles.resizeHandleCol;

  return (
    <div
      role="separator"
      aria-orientation={axis === 'y' ? 'horizontal' : 'vertical'}
      className={[axisClass, className].filter(Boolean).join(' ')}
      title={title ?? (axis === 'y' ? 'Resize panel height' : 'Resize panel width')}
      onPointerDown={onPointerDown}
    />
  );
}
