import { useCallback, useEffect, useRef, useState } from 'react';
import {
  canRescaleDiagramTiming,
  MAX_TICKS_PER_STEP,
} from '../shared/fineTiming';
import { useStore } from '../shared/store';
import styles from './shell.module.css';

const TITLE =
  'Timing grid divisions per WaveDrom step for Undulate periods, duty cycles, and phase. ' +
  'Changes preserve exact timing; resolutions that would require rounding are rejected.';

function parseResolution(raw: string): number | null {
  const value = Number(raw.trim());
  return Number.isInteger(value) ? value : null;
}

export function DiagramSubStepsControl() {
  const diagram = useStore((s) => s.diagram);
  const setTicksPerStep = useStore((s) => s.setTicksPerStep);
  const extensionsEnabled = useStore(
    (s) => s.diagram.compatibility?.extensionsEnabled === true,
  );
  const ticksPerStep = diagram.config.ticksPerStep ?? 1;
  const [draft, setDraft] = useState(String(ticksPerStep));
  const [rejected, setRejected] = useState(false);
  const cancelBlurRef = useRef(false);

  useEffect(() => setDraft(String(ticksPerStep)), [ticksPerStep]);

  const apply = useCallback((next: number) => {
    const accepted = setTicksPerStep(next);
    setRejected(!accepted);
  }, [setTicksPerStep]);

  const commitDraft = useCallback(() => {
    if (cancelBlurRef.current) {
      cancelBlurRef.current = false;
      return;
    }
    const next = parseResolution(draft);
    if (next === null || draft.trim() === '') {
      setDraft(String(ticksPerStep));
      setRejected(false);
      return;
    }
    apply(next);
  }, [apply, draft, ticksPerStep]);

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
    <div
      className={styles.stepsInline}
      title={extensionsEnabled ? TITLE : 'Enable Undulate extensions to edit substeps.'}
    >
      <span className={styles.stepsLabel}>Substeps</span>
      <button
        type="button"
        className={styles.stepsBtn}
        onClick={() => bump(-1)}
        disabled={!extensionsEnabled || ticksPerStep <= 1}
        aria-label="Coarsen timing grid"
      >
        −
      </button>
      <input
        type="text"
        className={`${styles.stepsNum} ${rejected ? styles.stepsNumRejected : ''}`}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setRejected(false);
        }}
        onFocus={() => setRejected(false)}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            commitDraft();
            event.currentTarget.blur();
          } else if (event.key === 'Escape') {
            cancelBlurRef.current = true;
            setDraft(String(ticksPerStep));
            setRejected(false);
            event.currentTarget.blur();
          }
        }}
        inputMode="numeric"
        spellCheck={false}
        aria-label="Diagram substep count"
        aria-invalid={rejected}
        disabled={!extensionsEnabled}
      />
      <button
        type="button"
        className={styles.stepsBtn}
        onClick={() => bump(1)}
        disabled={!extensionsEnabled || ticksPerStep >= MAX_TICKS_PER_STEP}
        aria-label="Refine timing grid"
      >
        +
      </button>
      {rejected ? (
        <span className={styles.subStepsError} role="status">
          Would round existing timing
        </span>
      ) : null}
    </div>
  );
}
