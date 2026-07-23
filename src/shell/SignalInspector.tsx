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
  return (
    result?.type === 'bit'
    || result?.type === 'vector'
    || result?.type === 'analogue'
  ) ? result : null;
}

export function SignalInspector({ onClose }: { onClose: () => void }) {
  const signals = useStore((s) => s.diagram.signals);
  const activeIds = useStore((s) => s.view.activeSignalIds);
  const renameSignal = useStore((s) => s.renameSignal);
  const activeBusLabel = useStore((s) => s.view.activeBusLabel);
  const setActiveBusLabel = useStore((s) => s.setActiveBusLabel);
  const setSignalPhase = useStore((s) => s.setSignalPhase);
  const setSignalPeriod = useStore((s) => s.setSignalPeriod);
  const updateAnalogueCell = useStore((s) => s.updateAnalogueCell);
  const updateAnalogueSignal = useStore((s) => s.updateAnalogueSignal);
  const signal = useMemo(() => selectedSignal(signals, activeIds), [signals, activeIds]);
  const [nameDraft, setNameDraft] = useState('');
  const [analogueCellIndex, setAnalogueCellIndex] = useState(0);

  useEffect(() => {
    setNameDraft(signal?.name ?? '');
    setAnalogueCellIndex(0);
  }, [signal?.id, signal?.name]);

  const isBus = signal?.type === 'vector';
  const isAnalogue = signal?.type === 'analogue';
  const analogueCell =
    isAnalogue ? signal.analogueCells?.[analogueCellIndex] : undefined;

  return (
    <aside className={styles.inspector} aria-label="Properties inspector">
      <div className={styles.inspectorHeader}>
        <div>
          <span className={styles.inspectorEyebrow}>
            {isBus ? 'Bus inspector' : isAnalogue ? 'Analog inspector' : 'Signal inspector'}
          </span>
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
              <input
                type="text"
                value={isBus ? 'Bus' : isAnalogue ? 'Analog' : 'Bit'}
                readOnly
              />
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

          {isAnalogue ? (
            <>
              <section className={styles.inspectorSection}>
                <h2>Analog range</h2>
                <label className={styles.inspectorField}>
                  <span>Minimum</span>
                  <input
                    type="number"
                    step="any"
                    value={signal.analogueMin ?? 0}
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueSignal(signal.id, {
                          analogueMin: Number(event.target.value),
                        });
                      }
                    }}
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Maximum</span>
                  <input
                    type="number"
                    step="any"
                    value={signal.analogueMax ?? 1.8}
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueSignal(signal.id, {
                          analogueMax: Number(event.target.value),
                        });
                      }
                    }}
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Vertical scale</span>
                  <input
                    type="number"
                    min={0.25}
                    max={16}
                    step={0.25}
                    value={signal.vscale ?? 1}
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueSignal(signal.id, {
                          vscale: Number(event.target.value),
                        });
                      }
                    }}
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Slewing</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={signal.slewing ?? 0}
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueSignal(signal.id, {
                          slewing: Number(event.target.value),
                        });
                      }
                    }}
                  />
                </label>
              </section>

              <section className={styles.inspectorSection}>
                <h2>Cell</h2>
                <label className={styles.inspectorField}>
                  <span>Step</span>
                  <input
                    type="number"
                    min={1}
                    max={signal.analogueCells?.length ?? 1}
                    value={analogueCellIndex + 1}
                    onChange={(event) => {
                      const next = Number(event.target.value) - 1;
                      setAnalogueCellIndex(Math.max(
                        0,
                        Math.min((signal.analogueCells?.length ?? 1) - 1, next),
                      ));
                    }}
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Transition</span>
                  <select
                    value={analogueCell?.kind ?? 'hold'}
                    onChange={(event) => updateAnalogueCell(
                      signal.id,
                      analogueCellIndex,
                      {
                        kind: event.target.value as
                          | 'hold'
                          | 'step'
                          | 'capacitive'
                          | 'samples',
                      },
                    )}
                  >
                    <option value="hold">Hold</option>
                    <option value="step">Step</option>
                    <option value="capacitive">Capacitive</option>
                    <option value="samples">Samples</option>
                  </select>
                </label>
                <label className={styles.inspectorField}>
                  <span>Value</span>
                  <input
                    type="number"
                    step="any"
                    value={analogueCell?.value ?? 0}
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueCell(signal.id, analogueCellIndex, {
                          value: Number(event.target.value),
                        });
                      }
                    }}
                  />
                </label>
              </section>
            </>
          ) : null}

          {!isAnalogue ? <section className={styles.inspectorSection}>
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
          </section> : null}
        </div>
      ) : (
        <div className={styles.inspectorEmpty}>
          <strong>The selected signal is no longer available.</strong>
        </div>
      )}
    </aside>
  );
}
