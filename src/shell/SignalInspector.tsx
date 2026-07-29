import { Activity, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { findSignal, useStore } from '../shared/store';
import type { Signal } from '../shared/types';
import { DEFAULT_ANALOGUE_CONTEXT } from '../shared/analogueExpressions';
import {
  isSafeAnnotationColor,
  isSafeAnnotationDasharray,
} from '../shared/annotations';
import {
  MAX_ANALOGUE_OVERLAY_MEMBERS,
  nextAnalogueOverlayCandidate,
  overlayGroupForSignal,
} from '../shared/analogueOverlayGroups';
import { VectorSegmentEditor } from '../signalPanel/VectorSegmentEditor';
import styles from './shell.module.css';
import overlayStyles from './AnalogueOverlayGroup.module.css';

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
  const diagram = useStore((s) => s.diagram);
  const signals = diagram.signals;
  const activeIds = useStore((s) => s.view.activeSignalIds);
  const renameSignal = useStore((s) => s.renameSignal);
  const activeBusLabel = useStore((s) => s.view.activeBusLabel);
  const setActiveBusLabel = useStore((s) => s.setActiveBusLabel);
  const setSignalPhase = useStore((s) => s.setSignalPhase);
  const setSignalPeriod = useStore((s) => s.setSignalPeriod);
  const updateSignalStyle = useStore((s) => s.updateSignalStyle);
  const updateAnalogueCell = useStore((s) => s.updateAnalogueCell);
  const updateAnalogueSignal = useStore((s) => s.updateAnalogueSignal);
  const updateAnalogueContext = useStore((s) => s.updateAnalogueContext);
  const refreshAnalogueRandomSeed = useStore(
    (s) => s.refreshAnalogueRandomSeed,
  );
  const extendAnalogueOverlayGroup = useStore(
    (s) => s.extendAnalogueOverlayGroup,
  );
  const dissolveAnalogueOverlayGroup = useStore(
    (s) => s.dissolveAnalogueOverlayGroup,
  );
  const analogueContext = useStore(
    (s) => s.diagram.config.analogueContext ?? DEFAULT_ANALOGUE_CONTEXT,
  );
  const updateDigitalTimingCell = useStore((s) => s.updateDigitalTimingCell);
  const updateDigitalTimingSignal = useStore((s) => s.updateDigitalTimingSignal);
  const extensionsEnabled = useStore(
    (s) => s.diagram.compatibility?.extensionsEnabled === true,
  );
  const signal = useMemo(() => selectedSignal(signals, activeIds), [signals, activeIds]);
  const [nameDraft, setNameDraft] = useState('');
  const [analogueCellIndex, setAnalogueCellIndex] = useState(0);
  const [timingCellIndex, setTimingCellIndex] = useState(0);
  const [strokeDraft, setStrokeDraft] = useState('');
  const [fillDraft, setFillDraft] = useState('');
  const [dashDraft, setDashDraft] = useState('');

  useEffect(() => {
    setNameDraft(signal?.name ?? '');
  }, [signal?.id, signal?.name]);

  useEffect(() => {
    setStrokeDraft(signal?.style?.stroke ?? '');
    setFillDraft(signal?.style?.fill ?? '');
    setDashDraft(signal?.style?.strokeDasharray?.join(', ') ?? '');
  }, [
    signal?.id,
    signal?.style?.stroke,
    signal?.style?.fill,
    signal?.style?.strokeDasharray,
  ]);

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
  const overlayGroup = isAnalogue
    ? overlayGroupForSignal(diagram, signal.id)
    : undefined;
  const overlayCandidate = isAnalogue
    ? nextAnalogueOverlayCandidate(diagram, signal.id)
    : undefined;
  const overlayMemberNames = overlayGroup?.signalIds.map((id) => {
    let name = id;
    findSignal(signals, id, (member) => { name = member.name; });
    return name;
  }) ?? [];
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

          {extensionsEnabled ? <section className={styles.inspectorSection}>
            <h2>Undulate style</h2>
            <label className={styles.inspectorField}>
              <span>Stroke</span>
              <input
                type="text"
                value={strokeDraft}
                placeholder="Default"
                aria-label="Signal stroke color"
                onChange={(event) => setStrokeDraft(event.target.value)}
                onBlur={() => {
                  const next = strokeDraft.trim();
                  if (next === '' || isSafeAnnotationColor(next)) {
                    updateSignalStyle(signal.id, {
                      stroke: next === '' ? undefined : next,
                    });
                  } else {
                    setStrokeDraft(signal.style?.stroke ?? '');
                  }
                }}
                spellCheck={false}
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Fill</span>
              <input
                type="text"
                value={fillDraft}
                placeholder="Default"
                aria-label="Signal fill color"
                onChange={(event) => setFillDraft(event.target.value)}
                onBlur={() => {
                  const next = fillDraft.trim();
                  if (next === '' || isSafeAnnotationColor(next)) {
                    updateSignalStyle(signal.id, {
                      fill: next === '' ? undefined : next,
                    });
                  } else {
                    setFillDraft(signal.style?.fill ?? '');
                  }
                }}
                spellCheck={false}
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Stroke width</span>
              <input
                type="number"
                min={0}
                max={32}
                step="any"
                value={signal.style?.strokeWidth ?? ''}
                placeholder="2"
                aria-label="Signal stroke width"
                onChange={(event) => {
                  const value = event.target.value;
                  const parsed = value === '' ? undefined : Number(value);
                  if (
                    parsed === undefined
                    || (Number.isFinite(parsed) && parsed >= 0 && parsed <= 32)
                  ) {
                    updateSignalStyle(signal.id, { strokeWidth: parsed });
                  }
                }}
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Dash pattern</span>
              <input
                type="text"
                value={dashDraft}
                placeholder="4, 2"
                aria-label="Signal stroke dash pattern"
                onChange={(event) => setDashDraft(event.target.value)}
                onBlur={() => {
                  const text = dashDraft.trim();
                  const values = text === ''
                    ? undefined
                    : text.split(',').map((part) => Number(part.trim()));
                  if (values === undefined || isSafeAnnotationDasharray(values)) {
                    updateSignalStyle(signal.id, { strokeDasharray: values });
                  } else {
                    setDashDraft(signal.style?.strokeDasharray?.join(', ') ?? '');
                  }
                }}
                spellCheck={false}
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Font size</span>
              <input
                type="number"
                min={6}
                max={96}
                step="any"
                value={signal.style?.fontSize ?? ''}
                placeholder="Auto"
                aria-label="Signal font size"
                onChange={(event) => {
                  const value = event.target.value;
                  const parsed = value === '' ? undefined : Number(value);
                  if (
                    parsed === undefined
                    || (Number.isFinite(parsed) && parsed >= 6 && parsed <= 96)
                  ) {
                    updateSignalStyle(signal.id, { fontSize: parsed });
                  }
                }}
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Font family</span>
              <select
                value={signal.style?.fontFamily ?? ''}
                aria-label="Signal value font family"
                onChange={(event) => updateSignalStyle(signal.id, {
                  fontFamily: event.target.value === ''
                    ? undefined
                    : event.target.value as NonNullable<
                      NonNullable<Signal['style']>['fontFamily']
                    >,
                })}
              >
                <option value="">Default</option>
                <option value="sans-serif">Sans serif</option>
                <option value="serif">Serif</option>
                <option value="monospace">Monospace</option>
              </select>
            </label>
            <label className={styles.inspectorField}>
              <span>Font weight</span>
              <select
                value={signal.style?.fontWeight ?? ''}
                aria-label="Signal value font weight"
                onChange={(event) => updateSignalStyle(signal.id, {
                  fontWeight: event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                })}
              >
                <option value="">Default</option>
                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map(
                  (weight) => (
                    <option key={weight} value={weight}>{weight}</option>
                  ),
                )}
              </select>
            </label>
            <p className={styles.inspectorFieldHint}>
              Safe declarative styling only. Fill applies to bus lanes; font
              settings apply to the signal label and bus values.
            </p>
          </section> : null}

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
                          NonNullable<typeof analogueCell>['kind'],
                      },
                    )}
                  >
                    <option value="hold">Hold</option>
                    <option value="step">Step</option>
                    <option value="capacitive">Capacitive</option>
                    <option value="samples">Samples</option>
                    <option value="metastable-low">Metastable to low (m)</option>
                    <option value="metastable-high">Metastable to high (M)</option>
                    <option value="impulse-low">Downward impulse (i)</option>
                    <option value="impulse-high">Upward impulse (I)</option>
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
                <h2>Static context</h2>
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
                <div className={styles.inspectorField}>
                  <span>Random seed</span>
                  <div className={styles.inspectorSeedControl}>
                    <output>
                      {diagram.config.analogueRandomSeed ?? 'Stable default'}
                    </output>
                    <button type="button" onClick={refreshAnalogueRandomSeed}>
                      Refresh
                    </button>
                  </div>
                </div>
                <p className={styles.inspectorFieldHint}>
                  rnd() remains stable while editing. Refresh changes its
                  document seed once and reevaluates random expressions.
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
                <div className={styles.inspectorField}>
                  <span>Overlay group</span>
                  <output className={overlayStyles.readout}>
                    {overlayGroup?.name ?? 'None'}
                  </output>
                </div>
                {overlayGroup ? (
                  <p className={styles.inspectorFieldHint}>
                    {overlayMemberNames.join(' + ')} ({overlayGroup.signalIds.length}/
                    {MAX_ANALOGUE_OVERLAY_MEMBERS})
                  </p>
                ) : (
                  <p className={styles.inspectorFieldHint}>
                    Groups share one plotted row and export as consecutive
                    Undulate overlay lanes.
                  </p>
                )}
                <div className={overlayStyles.actionRow}>
                  <button
                    type="button"
                    className={overlayStyles.action}
                    disabled={!overlayCandidate}
                    onClick={() => extendAnalogueOverlayGroup(signal.id)}
                    title={overlayCandidate
                      ? `Add ${overlayCandidate.name} to the shared plot`
                      : 'Place another ungrouped analogue lane immediately after this group'}
                  >
                    {overlayGroup ? 'Add next lane' : 'Group with next lane'}
                  </button>
                  {overlayGroup ? (
                    <button
                      type="button"
                      className={overlayStyles.action}
                      onClick={() => dissolveAnalogueOverlayGroup(overlayGroup.id)}
                    >
                      Dissolve group
                    </button>
                  ) : null}
                </div>
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
