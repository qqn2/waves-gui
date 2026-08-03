import { useCallback, useEffect, useRef, useState } from 'react';
import { useStore } from '../shared/store';
import { MAX_TOTAL_STEPS, MIN_TOTAL_STEPS } from '../shared/constants';
import styles from './shell.module.css';

const STEPS_TITLE =
  'Diagram length: number of time columns on the timeline (WaveDrom wave length). ' +
  'Use +/− or type a value. Per-signal clock stretch uses period when a lane is selected.';

function parseSteps(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return Math.floor(n);
}

/** Always-visible control for diagram.config.totalSteps (timeline columns). */
export function DiagramStepsControl() {
  const totalSteps = useStore((s) => s.diagram.config.totalSteps);
  const setTotalSteps = useStore((s) => s.setTotalSteps);
  const [draft, setDraft] = useState(String(totalSteps));
  const [rejected, setRejected] = useState(false);
  const cancelBlurRef = useRef(false);

  useEffect(() => setDraft(String(totalSteps)), [totalSteps]);

  const commitDraft = useCallback(() => {
    if (cancelBlurRef.current) {
      cancelBlurRef.current = false;
      return;
    }
    const next = parseSteps(draft);
    if (next === null) {
      setDraft(String(totalSteps));
      setRejected(false);
      return;
    }
    setRejected(!setTotalSteps(next));
  }, [draft, setTotalSteps, totalSteps]);

  const bump = useCallback(
    (delta: number) => {
      setRejected(!setTotalSteps(totalSteps + delta));
    },
    [setTotalSteps, totalSteps],
  );

  return (
    <div className={styles.stepsInline} title={STEPS_TITLE}>
      <span className={styles.stepsLabel}>Steps</span>
      <button
        type="button"
        className={styles.stepsBtn}
        onClick={() => bump(-1)}
        disabled={totalSteps <= MIN_TOTAL_STEPS}
        title={`Remove one time column (${MIN_TOTAL_STEPS} min)`}
        aria-label="Fewer steps"
      >
        −
      </button>
      <input
        type="text"
        className={`${styles.stepsNum} ${rejected ? styles.stepsNumRejected : ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        aria-invalid={rejected}
        onFocus={() => setRejected(false)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commitDraft();
            e.currentTarget.blur();
          } else if (e.key === 'Escape') {
            cancelBlurRef.current = true;
            setDraft(String(totalSteps));
            setRejected(false);
            e.currentTarget.blur();
          }
        }}
        inputMode="numeric"
        spellCheck={false}
        aria-label="Diagram step count"
      />
      <button
        type="button"
        className={styles.stepsBtn}
        onClick={() => bump(1)}
        disabled={totalSteps >= MAX_TOTAL_STEPS}
        title={`Add one time column (${MAX_TOTAL_STEPS} max)`}
        aria-label="More steps"
      >
        +
      </button>
      {rejected ? (
        <span className={styles.subStepsError} role="status">
          Timing edit would split a native cell
        </span>
      ) : null}
    </div>
  );
}
