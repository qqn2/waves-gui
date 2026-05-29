import { GripVertical } from 'lucide-react';
import styles from './SignalPanel.module.css';

export interface DragHandleProps {
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function DragHandle({
  draggable = true,
  onDragStart,
  onDragEnd,
}: DragHandleProps) {
  return (
    <span
      className={styles.dragHandle}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-hidden
    >
      <GripVertical size={14} strokeWidth={2} />
    </span>
  );
}
