import { Activity, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { findSignal, useStore } from '../shared/store';
import type { Signal } from '../shared/types';
import { DEFAULT_ANALOGUE_CONTEXT } from '../shared/analogueExpressions';
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
  const updateAnalogueContext = useStore((s) => s.updateAnalogueContext);
  const analogueContext = useStore(
    (s) => s.diagram.config.analogueContext ?? DEFAULT_ANALOGUE_CONTEXT,
  );
  const updateDigitalTimingCell = useStore((s) => s.updateDigitalTimingCell);
  const updateDigitalTimingSignal = useStore((s) => s.updateDigitalTimingSignal);
  const signal = useMemo(() => selectedSignal(signals, activeIds), [signals, activeIds]);
  const [nameDraft, setNameDraft] = useState('');
  const [analogueCellIndex, setAnalogueCellIndex] = useState(0);
  const [timingCellIndex, setTimingCellIndex] = useState(0);

  useEffect(() => {
    setNameDraft(signal?.name ?? '');
  }, [signal?.id, signal?.name]);

  useEffect(() => {
    setAnalogueCellIndex((index) => Math.max(
      0,
      Math.min((signal?.analogueCells?.length ?? 1) - 1, index),
    ));
  }, [signal?.analogueCells?.length]);

  const isBus = signal?.type === 'vector';
  const isAnalogue = signal?.type === 'analogue';
  const analogueCell =
    isAnalogue ? signal.analogueCells?.[analogueCellIndex] : undefined;
  const timingCell = signal?.digitalTiming?.cells[timingCellIndex];

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
                <h2>Analog values</h2>
                <label className={styles.inspectorField}>
                  <span>Step</span>
                  <input
                    type="number"
                    min={1}
                    max={signal.analogueCells?.length ?? 1}
                    value={analogueCellIndex + 1}
                    aria-label="Analog value step"
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
                  <span>Value</span>
                  <input
                    type="number"
                    step="any"
                    value={analogueCell?.value ?? 0}
                    aria-label="Analog cell value"
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueCell(signal.id, analogueCellIndex, {
                          value: Number(event.target.value),
                        });
                      }
                    }}
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Transition</span>
                  <select
                    value={analogueCell?.kind ?? 'hold'}
                    aria-label="Analog cell transition"
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
                <p className={styles.inspectorFieldHint}>
                  Edit each waveform value directly; change Step to move through
                  the analog cells.
                </p>
                {analogueCell?.expression ? (
                  <p className={styles.inspectorFieldHint}>
                    Resolved from Ludwig expression: <code>{analogueCell.expression}</code>.
                    Editing this cell detaches it from the expression.
                  </p>
                ) : null}
                {analogueCell?.kind === 'samples' ? (
                  <>
                    <h2>Sample points</h2>
                    {(analogueCell.samples ?? []).map((point, pointIndex) => (
                      <div className={styles.inspectorMetric} key={pointIndex}>
                        <input
                          type="number"
                          min={0}
                          max={1}
                          step="any"
                          aria-label={`Sample ${pointIndex + 1} offset`}
                          value={point.offset}
                          onChange={(event) => {
                            const samples = (analogueCell.samples ?? []).map(
                              (candidate, index) => index === pointIndex
                                ? { ...candidate, offset: Number(event.target.value) }
                                : candidate,
                            );
                            updateAnalogueCell(signal.id, analogueCellIndex, { samples });
                          }}
                        />
                        <input
                          type="number"
                          step="any"
                          aria-label={`Sample ${pointIndex + 1} value`}
                          value={point.value}
                          onChange={(event) => {
                            const samples = (analogueCell.samples ?? []).map(
                              (candidate, index) => index === pointIndex
                                ? { ...candidate, value: Number(event.target.value) }
                                : candidate,
                            );
                            updateAnalogueCell(signal.id, analogueCellIndex, {
                              samples,
                              ...(pointIndex === samples.length - 1
                                ? { value: Number(event.target.value) }
                                : {}),
                            });
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => updateAnalogueCell(
                            signal.id,
                            analogueCellIndex,
                            {
                              samples: (analogueCell.samples ?? []).filter(
                                (_, index) => index !== pointIndex,
                              ),
                            },
                          )}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const samples = [...(analogueCell.samples ?? [])];
                        const last = samples.at(-1);
                        samples.push({
                          offset: last ? Math.min(1, last.offset + 0.1) : 0,
                          value: last?.value ?? analogueCell.value,
                        });
                        updateAnalogueCell(signal.id, analogueCellIndex, { samples });
                      }}
                    >
                      Add point
                    </button>
                  </>
                ) : null}
              </section>

              <section className={styles.inspectorSection}>
                <h2>Ludwig context</h2>
                <label className={styles.inspectorField}>
                  <span>VSSA</span>
                  <input
                    type="number"
                    step="any"
                    value={analogueContext.vssa}
                    aria-label="Analog context VSSA"
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueContext({
                          vssa: Number(event.target.value),
                        });
                      }
                    }}
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>VDDA</span>
                  <input
                    type="number"
                    step="any"
                    value={analogueContext.vdda}
                    aria-label="Analog context VDDA"
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueContext({
                          vdda: Number(event.target.value),
                        });
                      }
                    }}
                  />
                </label>
                <p className={styles.inspectorFieldHint}>
                  Document-wide rails for Ludwig expressions. Changing either
                  value reevaluates every expression-backed analog cell.
                </p>
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
                <label className={styles.inspectorField}>
                  <span>Overlay next lane</span>
                  <input
                    type="checkbox"
                    checked={signal.overlay === true}
                    onChange={(event) => updateAnalogueSignal(signal.id, {
                      overlay: event.target.checked,
                    })}
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Overlay label order</span>
                  <input
                    type="number"
                    min={0}
                    max={4}
                    step={1}
                    value={signal.order ?? 0}
                    onChange={(event) => {
                      if (event.target.value) {
                        updateAnalogueSignal(signal.id, {
                          order: Number(event.target.value),
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
            {signal.digitalTiming ? (
              <>
                <label className={styles.inspectorField}>
                  <span>Cell</span>
                  <input
                    type="number"
                    min={1}
                    max={signal.digitalTiming.cells.length}
                    value={timingCellIndex + 1}
                    onChange={(event) => setTimingCellIndex(Math.max(
                      0,
                      Math.min(
                        signal.digitalTiming!.cells.length - 1,
                        Number(event.target.value) - 1,
                      ),
                    ))}
                    aria-label="Timing cell"
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Period</span>
                  <input
                    type="number"
                    min={1 / signal.digitalTiming.ticksPerStep}
                    step={1 / signal.digitalTiming.ticksPerStep}
                    value={(timingCell?.durationTicks ?? signal.digitalTiming.ticksPerStep)
                      / signal.digitalTiming.ticksPerStep}
                    onChange={(event) => updateDigitalTimingCell(
                      signal.id,
                      timingCellIndex,
                      {
                        durationTicks: Number(event.target.value)
                          * signal.digitalTiming!.ticksPerStep,
                      },
                    )}
                    aria-label="Cell period"
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Duty cycle</span>
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={1 / signal.digitalTiming.ticksPerStep}
                    value={timingCell?.dutyTicks === undefined
                      ? ''
                      : timingCell.dutyTicks / timingCell.durationTicks}
                    placeholder="0.5"
                    onChange={(event) => updateDigitalTimingCell(
                      signal.id,
                      timingCellIndex,
                      {
                        dutyTicks: event.target.value === ''
                          ? null
                          : Number(event.target.value)
                            * (timingCell?.durationTicks ?? 1),
                      },
                    )}
                    aria-label="Cell duty cycle"
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Phase</span>
                  <input
                    type="number"
                    step={1 / signal.digitalTiming.ticksPerStep}
                    value={signal.digitalTiming.phaseTicks
                      / signal.digitalTiming.ticksPerStep}
                    onChange={(event) => updateDigitalTimingSignal(signal.id, {
                      phaseTicks: Number(event.target.value)
                        * signal.digitalTiming!.ticksPerStep,
                    })}
                    aria-label="Signal phase"
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Digital slew</span>
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={signal.digitalTiming.slewing ?? ''}
                    placeholder="0"
                    onChange={(event) => updateDigitalTimingSignal(signal.id, {
                      slewing: event.target.value === ''
                        ? null
                        : Number(event.target.value),
                    })}
                    aria-label="Digital slew"
                  />
                </label>
                <p className={styles.inspectorFieldHint}>
                  Resolution: {signal.digitalTiming.ticksPerStep} ticks per step.
                </p>
              </>
            ) : (
              <>
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
              </>
            )}
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
