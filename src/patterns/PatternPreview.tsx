import type { BitState, VectorSegment } from '../shared/types';
import styles from './PatternsMenu.module.css';

export function BitPreview({ states }: { states: BitState[] }) {
  const n = states.length;
  const cellW = Math.max(2, Math.min(8, 200 / Math.max(n, 1)));
  const h = 40;
  const mid = h / 2;

  return (
    <svg className={styles.previewSvg} viewBox={`0 0 ${n * cellW} ${h}`} preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        points={states
          .map((s, i) => {
            const y = s === '1' ? 6 : h - 6;
            const x = i * cellW + cellW / 2;
            return `${x},${y}`;
          })
          .join(' ')}
      />
      <line x1={0} y1={mid} x2={n * cellW} y2={mid} stroke="var(--border)" strokeWidth="0.5" />
    </svg>
  );
}

export function VectorPreview({ segments }: { segments: VectorSegment[] }) {
  const end = segments.length ? segments[segments.length - 1]!.endStep : 1;
  const n = Math.max(1, end);
  const cellW = Math.max(2, Math.min(8, 200 / n));
  const h = 40;

  return (
    <svg className={styles.previewSvg} viewBox={`0 0 ${n * cellW} ${h}`} preserveAspectRatio="none">
      {segments.map((seg) => (
        <g key={seg.id}>
          <rect
            x={seg.startStep * cellW + 1}
            y={8}
            width={(seg.endStep - seg.startStep) * cellW - 2}
            height={h - 16}
            fill="color-mix(in srgb, var(--accent) 25%, transparent)"
            stroke="var(--accent)"
            strokeWidth="0.5"
          />
          <text
            x={((seg.startStep + seg.endStep) / 2) * cellW}
            y={h / 2 + 4}
            textAnchor="middle"
            fontSize="8"
            fill="var(--text)"
          >
            {seg.value.length > 6 ? `${seg.value.slice(0, 5)}…` : seg.value}
          </text>
        </g>
      ))}
    </svg>
  );
}
