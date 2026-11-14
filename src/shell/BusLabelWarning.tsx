import { useEffect, useMemo, useRef } from 'react';
import { runAfterSourceFlush } from '../codePanel/sourceMutationGuard';
import { busLabelWarnings } from '../renderer/busLabelWarnings';
import { MAX_HSCALE } from '../shared/constants';
import { useStore } from '../shared/store';
import styles from './BusLabelWarning.module.css';

export function BusLabelWarning() {
  const signals = useStore((state) => state.diagram.signals);
  const hscale = useStore((state) => state.diagram.config.hscale);
  const warnings = useMemo(() => busLabelWarnings(signals, hscale), [signals, hscale]);
  const disclosureRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      const disclosure = disclosureRef.current;
      if (disclosure?.open && !disclosure.contains(event.target as Node)) disclosure.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const disclosure = disclosureRef.current;
      if (event.key === 'Escape' && disclosure?.open) {
        disclosure.open = false;
        disclosure.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);
  if (warnings.length === 0) return null;

  const target = Math.max(...warnings.map((warning) => warning.minHscale ?? MAX_HSCALE));
  const needsLabelEdit = warnings.some((warning) => warning.minHscale === null);
  const widen = () => runAfterSourceFlush(() => useStore.getState().setHscale(target));
  const edit = () => {
    const opened = runAfterSourceFlush(() => {
      const store = useStore.getState();
      store.setActiveAnnotationId(null);
      store.setActiveSignalIds([warnings[0]!.signalId]);
      if (!store.view.showInspector) store.toggleInspector();
    });
    if (opened && disclosureRef.current) disclosureRef.current.open = false;
  };

  return (
    <details ref={disclosureRef} className={styles.warning}>
      <summary className={styles.summary}>
        <span className={styles.icon} aria-hidden>!</span>
        {warnings.length === 1 ? 'Label needs more space' : `${warnings.length} labels need more space`}
      </summary>
      <div className={styles.explanation} role="group" aria-label="Bus label warning">
        <p>Yellow outlines mark bus labels that need more space.</p>
        <p>hscale widens time columns in the diagram and exports. Timing stays the same.</p>
        {needsLabelEdit ? <p>Some labels cannot fit at the maximum hscale. Shorten a label or widen its span.</p> : null}
        <div className={styles.actions}>
          <button type="button" onClick={widen} disabled={target <= hscale}>Increase hscale</button>
          <button type="button" onClick={edit}>Edit bus labels</button>
        </div>
      </div>
    </details>
  );
}
