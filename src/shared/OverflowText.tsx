import { useCallback, useEffect, useRef, useState } from 'react';

export interface OverflowTextProps {
  text: string;
  className?: string;
  emptyText?: string;
  onDoubleClick?: () => void;
}

/** Adds a tooltip only when the rendered text is actually clipped. */
export function OverflowText({
  text,
  className,
  emptyText = '',
  onDoubleClick,
}: OverflowTextProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const displayText = text || emptyText;

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const next =
      element.scrollWidth > element.clientWidth + 1 ||
      element.scrollHeight > element.clientHeight + 1;
    setOverflowing((current) => (current === next ? current : next));
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
  }, [displayText, measure]);

  return (
    <span
      ref={ref}
      className={className}
      data-overflow={overflowing ? 'true' : 'false'}
      title={overflowing ? displayText : undefined}
      aria-label={overflowing ? displayText : undefined}
      onDoubleClick={onDoubleClick}
    >
      {displayText}
    </span>
  );
}
