import { useMemo, useState } from 'react';
import { useStore } from '../shared/store';
import type { BitState, VectorSegment } from '../shared/types';
import {
  applyBitPatternToSignal,
  applyVectorPatternToSignal,
  lastTopLevelSignalId,
} from './applyPattern';
import {
  buildPattern,
  fieldNum,
  initialPatternConfigs,
  PATTERN_DEFS,
  type PatternId,
} from './patternDefs';
import { BitPreview, VectorPreview } from './PatternPreview';
import styles from './PatternsMenu.module.css';

export type { PatternId } from './patternDefs';
export { PATTERN_DEFS } from './patternDefs';

export interface PatternsMenuProps {
  onInserted?: (patternId: PatternId, signalId: string) => void;
  onClose?: () => void;
}

export function PatternsMenu({ onInserted, onClose }: PatternsMenuProps) {
  const totalSteps = useStore((s) => s.diagram.config.totalSteps);
  const addSignal = useStore((s) => s.addSignal);
  const renameSignal = useStore((s) => s.renameSignal);
  const activeSignalIds = useStore((s) => s.view.activeSignalIds);
  const signals = useStore((s) => s.diagram.signals);

  const [selectedId, setSelectedId] = useState<PatternId>('clock');
  const [configs, setConfigs] = useState(initialPatternConfigs);

  const def = PATTERN_DEFS.find((d) => d.id === selectedId) ?? PATTERN_DEFS[0]!;
  const cfg = configs[selectedId];

  const preview = useMemo(
    () => buildPattern(selectedId, totalSteps, cfg),
    [selectedId, totalSteps, cfg],
  );

  const handleInsert = () => {
    addSignal(def.signalKind);
    const signalId = lastTopLevelSignalId(useStore.getState().diagram.signals);
    if (!signalId) return;

    renameSignal(signalId, def.defaultName);

    if (def.signalKind === 'bit') {
      applyBitPatternToSignal(signalId, preview as BitState[]);
    } else {
      applyVectorPatternToSignal(signalId, preview as VectorSegment[]);
    }

    onInserted?.(selectedId, signalId);
    onClose?.();
  };

  const selectedSignal = useMemo(() => {
    if (activeSignalIds.length !== 1) return null;
    const id = activeSignalIds[0]!;
    let found: import('../shared/types').Signal | undefined;
    const walk = (list: typeof signals) => {
      for (const sg of list) {
        if (sg.type === 'group') walk(sg.children);
        else if (sg.id === id) found = sg;
      }
    };
    walk(signals);
    return found ?? null;
  }, [activeSignalIds, signals]);

  const canApplyToSelected =
    selectedSignal !== null &&
    selectedSignal.type !== 'spacer' &&
    selectedSignal.type === def.signalKind;

  const handleApplyToSelected = () => {
    if (!selectedSignal || !canApplyToSelected) return;
    if (def.signalKind === 'bit') {
      applyBitPatternToSignal(selectedSignal.id, preview as BitState[]);
    } else {
      applyVectorPatternToSignal(selectedSignal.id, preview as VectorSegment[]);
    }
    onInserted?.(selectedId, selectedSignal.id);
    onClose?.();
  };

  const setField = (key: string, value: string | number) => {
    setConfigs((prev) => ({
      ...prev,
      [selectedId]: { ...prev[selectedId], [key]: value },
    }));
  };

  return (
    <div className={styles.menu} role="dialog" aria-label="Predefined signal patterns">
      <div className={styles.header}>Predefined signals</div>
      <div className={styles.body}>
        <div className={styles.list} role="listbox" aria-label="Pattern list">
          {PATTERN_DEFS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={p.id === selectedId}
                className={`${styles.listItem} ${p.id === selectedId ? styles.listItemActive : ''}`}
                onClick={() => setSelectedId(p.id)}
              >
                <Icon size={14} aria-hidden />
                {p.label}
              </button>
            );
          })}
        </div>
        <div className={styles.panel}>
          <p className={styles.desc}>{def.description}</p>
          <div className={styles.fields}>
            {def.fields.map((field) => (
              <label key={field.key} className={styles.field}>
                {field.label}
                {field.type === 'number' ? (
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step ?? 1}
                    value={fieldNum(cfg, field.key)}
                    onChange={(e) => setField(field.key, Number(e.target.value))}
                  />
                ) : field.type === 'select' ? (
                  <select
                    value={String(cfg[field.key])}
                    onChange={(e) => setField(field.key, e.target.value)}
                  >
                    {field.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={String(cfg[field.key] ?? '')}
                    onChange={(e) => setField(field.key, e.target.value)}
                  />
                )}
              </label>
            ))}
          </div>
          <div className={styles.preview} aria-label="Pattern preview">
            {def.signalKind === 'bit' ? (
              <BitPreview states={preview as BitState[]} />
            ) : (
              <VectorPreview segments={preview as VectorSegment[]} />
            )}
          </div>
        </div>
      </div>
      <div className={styles.footer}>
        {canApplyToSelected ? (
          <button
            type="button"
            className={styles.insertBtn}
            onClick={handleApplyToSelected}
          >
            Apply to selected signal
          </button>
        ) : null}
        <button type="button" className={styles.insertBtn} onClick={handleInsert}>
          Insert signal
        </button>
      </div>
    </div>
  );
}
