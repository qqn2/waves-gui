import { useCallback, useState } from 'react';
import {
  canRescaleDiagramTiming,
  MAX_TICKS_PER_STEP,
} from '../shared/fineTiming';
import { useStore } from '../shared/store';
import styles from './shell.module.css';

const TITLE =
  'Integer timing resolution for Undulate periods, duty cycles, and phase. ' +
  'Changes preserve exact timing; resolutions that would require rounding are rejected.';

function parseResolution(raw: string): number | null {
  const value = Number(raw.trim());
  return Number.isInteger(value) ? value : null;
}

export function DiagramSubStepsControl() {
  const diagram = useStore((s) => s.diagram);
  const setTicksPerStep = useStore((s) => s.setTicksPerStep);
  const ticksPerStep = diagram.config.ticksPerStep ?? 1;
  const [rejected, setRejected] = useState(false);

  const apply = useCallback((next: number) => {
    const accepted = setTicksPerStep(next);
    setRejected(!accepted);
  }, [setTicksPerStep]);

  const bump = useCallback((direction: -1 | 1) => {
    for (
      let next = ticksPerStep + direction;
      next >= 1 && next <= MAX_TICKS_PER_STEP;
      next += direction
    ) {
      if (canRescaleDiagramTiming(diagram, next)) {
        apply(next);
        return;
      }
    }
  }, [apply, diagram, ticksPerStep]);

  return (
    <div className={styles.stepsInline} title={TITLE}>
      <span className={styles.stepsLabel}>Sub-Steps</span>
      <button
        type="button"
        className={styles.stepsBtn}
        onClick={() => bump(-1)}
        disabled={ticksPerStep <= 1}
        aria-label="Lower sub-step resolution"
      >
        −
      </button>
      <input
        type="text"
        className={`${styles.stepsNum} ${rejected ? styles.stepsNumRejected : ''}`}
        value={String(ticksPerStep)}
        onChange={(event) => {
          const next = parseResolution(event.target.value);
          if (next !== null) apply(next);
          else setRejected(true);
        }}
        onFocus={() => setRejected(false)}
        inputMode="numeric"
        spellCheck={false}
        aria-label="Diagram sub-step resolution"
        aria-invalid={rejected}
      />
      <button
        type="button"
        className={styles.stepsBtn}
        onClick={() => bump(1)}
        disabled={ticksPerStep >= MAX_TICKS_PER_STEP}
        aria-label="Raise sub-step resolution"
      >
        +
      </button>
      {rejected ? (
        <span className={styles.subStepsError} role="status">
          Would round timing
        </span>
      ) : null}
    </div>
  );
}
