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
  const updateVerticalLineAnnotation = useStore(
    (state) => state.updateVerticalLineAnnotation,
  );
  const updateHorizontalLineAnnotation = useStore(
    (state) => state.updateHorizontalLineAnnotation,
  );
  const removeAnnotation = useStore((state) => state.removeAnnotation);
  const setActiveAnnotationId = useStore((state) => state.setActiveAnnotationId);
  const annotation = diagram.annotations?.find((item) => item.id === activeId) ?? null;
  const textAnnotation = annotation?.type === 'text' ? annotation : null;
  const options = useMemo(() => signalOptions(diagram.signals), [diagram.signals]);
  const [textDraft, setTextDraft] = useState('');

  useEffect(() => {
    setTextDraft(textAnnotation?.text ?? '');
  }, [textAnnotation?.id, textAnnotation?.text]);

  const close = () => {
    setActiveAnnotationId(null);
    onClose();
  };

  return (
    <aside className={styles.inspector} aria-label="Annotation inspector">
      <div className={styles.inspectorHeader}>
        <div>
          <span className={styles.inspectorEyebrow}>Undulate extension</span>
          <strong>
            {annotation?.type === 'vertical-line'
              ? 'Vertical line'
              : annotation?.type === 'horizontal-line'
                ? 'Horizontal line'
                : 'Text annotation'}
          </strong>
        </div>
        <button type="button" className={styles.inspectorClose} onClick={close} aria-label="Close annotation inspector">
          <X size={14} aria-hidden />
        </button>
      </div>

      {annotation ? (
        <div className={styles.inspectorBody}>
          {textAnnotation ? (
            <section className={styles.inspectorSection}>
              <h2>Content</h2>
              <label className={styles.inspectorField}>
                <span>Text</span>
                <textarea
                  value={textDraft}
                  rows={3}
                  onChange={(event) => setTextDraft(event.target.value)}
                  onBlur={() => {
                    if (textDraft !== textAnnotation.text) {
                      updateTextAnnotation(textAnnotation.id, { text: textDraft });
                    }
                  }}
                  aria-label="Annotation text"
                />
              </label>
            </section>
          ) : null}

          <section className={styles.inspectorSection}>
            <h2>Anchor</h2>
            {annotation.type !== 'vertical-line' ? (
              <label className={styles.inspectorField}>
              <span>Signal</span>
              <select
                value={annotation.signalId ?? ''}
                onChange={(event) => {
                  const patch = { signalId: event.target.value || undefined };
                  if (annotation.type === 'text') {
                    updateTextAnnotation(annotation.id, patch);
                  } else {
                    updateHorizontalLineAnnotation(annotation.id, patch);
                  }
                }}
                aria-label="Annotation signal anchor"
              >
                <option value="">Diagram</option>
                {options.map((option) => (
                  <option key={option.id} value={option.id}>{option.name}</option>
                ))}
              </select>
              </label>
            ) : null}
            {annotation.type !== 'horizontal-line' ? (
              <label className={styles.inspectorField}>
              <span>Step</span>
              <input
                type="number"
                min={1}
                max={diagram.config.totalSteps}
                value={annotation.tick + 1}
                onChange={(event) => {
                  const patch = { tick: Number(event.target.value) - 1 };
                  if (annotation.type === 'text') {
                    updateTextAnnotation(annotation.id, patch);
                  } else {
                    updateVerticalLineAnnotation(annotation.id, patch);
                  }
                }}
                aria-label="Annotation step"
              />
              </label>
            ) : null}
            {annotation.type !== 'vertical-line' ? (
              <label className={styles.inspectorField}>
              <span>Y offset</span>
              <input
                type="number"
                value={annotation.yOffset ?? 0}
                onChange={(event) => {
                  const patch = { yOffset: Number(event.target.value) };
                  if (annotation.type === 'text') {
                    updateTextAnnotation(annotation.id, patch);
                  } else {
                    updateHorizontalLineAnnotation(annotation.id, patch);
                  }
                }}
                aria-label="Annotation vertical offset"
              />
              </label>
            ) : null}
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
