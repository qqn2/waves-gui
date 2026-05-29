import { useCallback, useMemo } from 'react';
import { useStore, findSignal } from '../shared/store';
import type { Signal } from '../shared/types';
import styles from './shell.module.css';

function parseOptionalNumber(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function formatOptionalNumber(n: number | undefined): string {
  return n === undefined ? '' : String(n);
}

function applyPhase(signalId: string, phase: number | undefined): void {
  const { setSignalPhase } = useStore.getState();
  if (typeof setSignalPhase === 'function') {
    setSignalPhase(signalId, phase);
    return;
  }
  useStore.setState((s) => {
    findSignal(s.diagram.signals, signalId, (sig) => {
      if (phase === undefined) delete sig.phase;
      else sig.phase = phase;
    });
    s.view.isDirty = true;
  });
}

function applyPeriod(signalId: string, period: number | undefined): void {
  const { setSignalPeriod } = useStore.getState();
  if (typeof setSignalPeriod === 'function') {
    setSignalPeriod(signalId, period);
    return;
  }
  useStore.setState((s) => {
    findSignal(s.diagram.signals, signalId, (sig) => {
      if (period === undefined || period < 1) delete sig.period;
      else sig.period = Math.floor(period);
    });
    s.view.isDirty = true;
  });
}

/** WaveDrom phase / period for one selected bit or vector lane. Mount from App shell. */
export function SignalTimingBar() {
  const activeIds = useStore((s) => s.view.activeSignalIds);
  const signals = useStore((s) => s.diagram.signals);

  const target = useMemo(() => {
    if (activeIds.length !== 1) return null;
    const id = activeIds[0]!;
    let found: Signal | undefined;
    findSignal(signals, id, (s) => {
      found = s;
    });
    if (!found || (found.type !== 'bit' && found.type !== 'vector')) return null;
    return { id, signal: found };
  }, [activeIds, signals]);

  const onPhaseChange = useCallback(
    (raw: string) => {
      if (!target) return;
      applyPhase(target.id, parseOptionalNumber(raw));
    },
    [target],
  );

  const onPeriodChange = useCallback(
    (raw: string) => {
      if (!target) return;
      const n = parseOptionalNumber(raw);
      if (n === undefined) {
        applyPeriod(target.id, undefined);
        return;
      }
      const period = Math.max(1, Math.floor(n));
      applyPeriod(target.id, period);
    },
    [target],
  );

  const clearPhase = useCallback(() => {
    if (!target) return;
    applyPhase(target.id, undefined);
  }, [target]);

  const clearPeriod = useCallback(() => {
    if (!target) return;
    applyPeriod(target.id, undefined);
  }, [target]);

  if (!target) return null;

  const { signal, id } = target;

  return (
    <div
      className={styles.timingBarRow}
      title="WaveDrom signal phase and period"
      data-signal-id={id}
    >
      <span className={styles.timingBarSignal} title={signal.name}>
        {signal.name}
      </span>
      <label className={styles.timingBarField}>
        <span className={styles.timingBarLabel}>phase</span>
        <input
          type="text"
          className={styles.timingBarNum}
          value={formatOptionalNumber(signal.phase)}
          onChange={(e) => onPhaseChange(e.target.value)}
          placeholder="0"
          inputMode="decimal"
          spellCheck={false}
        />
        <button
          type="button"
          className={styles.timingBarClear}
          onClick={clearPhase}
          title="Clear phase"
          disabled={signal.phase === undefined}
        >
          ×
        </button>
      </label>
      <label className={styles.timingBarField}>
        <span className={styles.timingBarLabel}>period</span>
        <input
          type="text"
          className={styles.timingBarNum}
          value={formatOptionalNumber(signal.period)}
          onChange={(e) => onPeriodChange(e.target.value)}
          placeholder="—"
          inputMode="numeric"
          spellCheck={false}
        />
        <button
          type="button"
          className={styles.timingBarClear}
          onClick={clearPeriod}
          title="Clear period"
          disabled={signal.period === undefined}
        >
          ×
        </button>
      </label>
    </div>
  );
}
