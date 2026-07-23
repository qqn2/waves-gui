import { MessageSquareText, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '../shared/store';
import type { SignalOrGroup } from '../shared/types';
import styles from './shell.module.css';

function signalOptions(signals: SignalOrGroup[]): Array<{ id: string; name: string }> {
  const options: Array<{ id: string; name: string }> = [];
  const walk = (items: SignalOrGroup[]) => {
    for (const item of items) {
      if (item.type === 'group') walk(item.children);
      else if (item.type !== 'spacer') options.push({ id: item.id, name: item.name });
    }
  };
  walk(signals);
  return options;
}

export function AnnotationInspector({ onClose }: { onClose: () => void }) {
  const diagram = useStore((state) => state.diagram);
  const activeId = useStore((state) => state.view.activeAnnotationId);
  const updateTextAnnotation = useStore((state) => state.updateTextAnnotation);
  const removeAnnotation = useStore((state) => state.removeAnnotation);
  const setActiveAnnotationId = useStore((state) => state.setActiveAnnotationId);
  const annotation = diagram.annotations?.find((item) => item.id === activeId) ?? null;
  const options = useMemo(() => signalOptions(diagram.signals), [diagram.signals]);
  const [textDraft, setTextDraft] = useState('');

  useEffect(() => {
    setTextDraft(annotation?.text ?? '');
  }, [annotation?.id, annotation?.text]);

  const close = () => {
    setActiveAnnotationId(null);
    onClose();
  };

  return (
    <aside className={styles.inspector} aria-label="Annotation inspector">
      <div className={styles.inspectorHeader}>
        <div>
          <span className={styles.inspectorEyebrow}>Undulate extension</span>
          <strong>Text annotation</strong>
        </div>
        <button type="button" className={styles.inspectorClose} onClick={close} aria-label="Close annotation inspector">
          <X size={14} aria-hidden />
        </button>
      </div>

      {annotation ? (
        <div className={styles.inspectorBody}>
          <section className={styles.inspectorSection}>
            <h2>Content</h2>
            <label className={styles.inspectorField}>
              <span>Text</span>
              <textarea
                value={textDraft}
                rows={3}
                onChange={(event) => setTextDraft(event.target.value)}
                onBlur={() => {
                  if (textDraft !== annotation.text) {
                    updateTextAnnotation(annotation.id, { text: textDraft });
                  }
                }}
                aria-label="Annotation text"
              />
            </label>
          </section>

          <section className={styles.inspectorSection}>
            <h2>Anchor</h2>
            <label className={styles.inspectorField}>
              <span>Signal</span>
              <select
                value={annotation.signalId ?? ''}
                onChange={(event) => updateTextAnnotation(annotation.id, {
                  signalId: event.target.value || undefined,
                })}
                aria-label="Annotation signal anchor"
              >
                <option value="">Diagram</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
            </label>
            <label className={styles.inspectorField}>
              <span>Step</span>
              <input
                type="number"
                min={1}
                max={diagram.config.totalSteps}
                value={annotation.tick + 1}
                onChange={(event) => updateTextAnnotation(annotation.id, {
                  tick: Number(event.target.value) - 1,
                })}
                aria-label="Annotation step"
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Y offset</span>
              <input
                type="number"
                value={annotation.yOffset ?? 0}
                onChange={(event) => updateTextAnnotation(annotation.id, {
                  yOffset: Number(event.target.value),
                })}
                aria-label="Annotation vertical offset"
              />
            </label>
          </section>

          <section className={styles.inspectorSection}>
            <button
              type="button"
              className={styles.inspectorDanger}
              onClick={() => {
                removeAnnotation(annotation.id);
                close();
              }}
            >
              <Trash2 size={14} aria-hidden /> Delete annotation
            </button>
          </section>
        </div>
      ) : (
        <div className={styles.inspectorEmpty}>
          <MessageSquareText size={22} aria-hidden />
          <strong>The annotation is no longer available.</strong>
        </div>
      )}
    </aside>
  );
}
