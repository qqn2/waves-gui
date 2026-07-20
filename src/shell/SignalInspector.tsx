import { Activity, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { findSignal, useStore } from '../shared/store';
import type { Signal } from '../shared/types';
import { VectorSegmentEditor } from '../signalPanel/VectorSegmentEditor';
import styles from './shell.module.css';

function selectedSignal(signals: ReturnType<typeof useStore.getState>['diagram']['signals'], ids: string[]) {
  if (ids.length !== 1) return null;
  let result: Signal | null = null;
  findSignal(signals, ids[0]!, (signal) => { result = signal; });
  return result?.type === 'bit' || result?.type === 'vector' ? result : null;
}

export function SignalInspector({ onClose }: { onClose: () => void }) {
  const signals = useStore((s) => s.diagram.signals);
  const activeIds = useStore((s) => s.view.activeSignalIds);
  const renameSignal = useStore((s) => s.renameSignal);
  const activeBusLabel = useStore((s) => s.view.activeBusLabel);
  const setActiveBusLabel = useStore((s) => s.setActiveBusLabel);
  const setSignalPhase = useStore((s) => s.setSignalPhase);
  const setSignalPeriod = useStore((s) => s.setSignalPeriod);
  const signal = useMemo(() => selectedSignal(signals, activeIds), [signals, activeIds]);
  const [nameDraft, setNameDraft] = useState('');

  useEffect(() => {
    setNameDraft(signal?.name ?? '');
  }, [signal?.id, signal?.name]);

  const isBus = signal?.type === 'vector';

  return (
    <aside className={styles.inspector} aria-label="Properties inspector">
      <div className={styles.inspectorHeader}>
        <div>
          <span className={styles.inspectorEyebrow}>{isBus ? 'Bus inspector' : 'Signal inspector'}</span>
          <strong>{signal?.name ?? 'Signal properties'}</strong>
        </div>
        <button type="button" className={styles.inspectorClose} onClick={onClose} aria-label="Close signal inspector">
          <X size={14} aria-hidden />
        </button>
      </div>

      {signal ? (
        <div className={styles.inspectorBody} aria-label="Signal inspector details">
          <section className={styles.inspectorSection}>
            <h2>Identity</h2>
            <label className={styles.inspectorField}>
              <span>Name</span>
              <input
                type="text"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  if (nameDraft !== signal.name) renameSignal(signal.id, nameDraft);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    setNameDraft(signal.name);
                    event.currentTarget.blur();
                  }
                }}
                spellCheck={false}
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Type</span>
              <input type="text" value={isBus ? 'Bus' : 'Bit'} readOnly />
            </label>
            <label className={styles.inspectorField}>
              <span>Color</span>
              <span className={styles.colorReadout}>
                <i style={{ background: signal.color }} />
                <code>{signal.color}</code>
              </span>
            </label>
          </section>

          {isBus ? (
            <>
              <section className={styles.inspectorSection}>
                <h2>Drawing</h2>
                <label className={styles.inspectorField}>
                  <span>Bus label</span>
                  <input
                    type="text"
                    value={activeBusLabel}
                    onChange={(event) => setActiveBusLabel(event.target.value)}
                    placeholder="data"
                    aria-label="Bus label"
                    spellCheck={false}
                  />
                </label>
                <p className={styles.inspectorFieldHint}>
                  Applied to new bus spans when drawing. Clicking an existing bus segment copies its value here.
                </p>
              </section>

              <VectorSegmentEditor signalId={signal.id} />
            </>
          ) : null}

          <section className={styles.inspectorSection}>
            <h2>Timing</h2>
            <label className={styles.inspectorField}>
              <span>Period</span>
              <input
                type="number"
                min={1}
                placeholder="1"
                aria-label="Signal period"
                value={signal.period ?? ''}
                onChange={(event) => setSignalPeriod(signal.id, event.target.value ? Number(event.target.value) : undefined)}
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Phase</span>
              <input
                type="number"
                step="any"
                placeholder="0"
                aria-label="Signal phase"
                value={signal.phase ?? ''}
                onChange={(event) => setSignalPhase(signal.id, event.target.value ? Number(event.target.value) : undefined)}
              />
            </label>
            {isBus ? (
              <div className={styles.inspectorMetric}>
                <Activity size={15} aria-hidden />
                <span>{signal.segments.length} bus segments</span>
              </div>
            ) : null}
          </section>
        </div>
      ) : (
        <div className={styles.inspectorEmpty}>
          <strong>The selected signal is no longer available.</strong>
        </div>
      )}
    </aside>
  );
}
