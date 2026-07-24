import { MessageSquareText, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  isSafeAnnotationColor,
  isSafeAnnotationDasharray,
} from '../shared/annotations';
import { useStore } from '../shared/store';
import type { AnnotationStyle, SignalOrGroup } from '../shared/types';
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
  const updateGlobalCompressionAnnotation = useStore(
    (state) => state.updateGlobalCompressionAnnotation,
  );
  const removeAnnotation = useStore((state) => state.removeAnnotation);
  const setActiveAnnotationId = useStore((state) => state.setActiveAnnotationId);
  const annotation = diagram.annotations?.find((item) => item.id === activeId) ?? null;
  const textAnnotation = annotation?.type === 'text' ? annotation : null;
  const options = useMemo(() => signalOptions(diagram.signals), [diagram.signals]);
  const [textDraft, setTextDraft] = useState('');
  const [fillDraft, setFillDraft] = useState('');
  const [strokeDraft, setStrokeDraft] = useState('');
  const [dashDraft, setDashDraft] = useState('');

  useEffect(() => {
    setTextDraft(textAnnotation?.text ?? '');
  }, [textAnnotation?.id, textAnnotation?.text]);

  useEffect(() => {
    setFillDraft(annotation?.style?.fill ?? '');
    setStrokeDraft(annotation?.style?.stroke ?? '');
    setDashDraft(annotation?.style?.strokeDasharray?.join(', ') ?? '');
  }, [annotation?.id, annotation?.style]);

  const updateStyle = (style: AnnotationStyle) => {
    if (!annotation) return;
    if (annotation.type === 'text') {
      updateTextAnnotation(annotation.id, { style });
    } else if (annotation.type === 'vertical-line') {
      updateVerticalLineAnnotation(annotation.id, { style });
    } else if (annotation.type === 'horizontal-line') {
      updateHorizontalLineAnnotation(annotation.id, { style });
    } else {
      updateGlobalCompressionAnnotation(annotation.id, { style });
    }
  };

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
              : annotation?.type === 'global-compression'
                ? 'Global compression'
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
            {annotation.type === 'text' || annotation.type === 'horizontal-line' ? (
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
                  } else if (annotation.type === 'global-compression') {
                    updateGlobalCompressionAnnotation(annotation.id, patch);
                  } else {
                    updateVerticalLineAnnotation(annotation.id, patch);
                  }
                }}
                aria-label="Annotation step"
              />
              </label>
            ) : null}
            {annotation.type === 'text' || annotation.type === 'horizontal-line' ? (
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
            <h2>Style</h2>
            <label className={styles.inspectorField}>
              <span>Fill</span>
              <input
                type="text"
                value={fillDraft}
                placeholder="#e8e8e8"
                onChange={(event) => setFillDraft(event.target.value)}
                onBlur={() => {
                  const fill = fillDraft.trim();
                  if (fill !== '' && !isSafeAnnotationColor(fill)) {
                    setFillDraft(annotation.style?.fill ?? '');
                    return;
                  }
                  updateStyle({
                    ...annotation.style,
                    fill: fill || undefined,
                  });
                }}
                aria-label="Annotation fill"
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Stroke</span>
              <input
                type="text"
                value={strokeDraft}
                placeholder="#4a9eff"
                onChange={(event) => setStrokeDraft(event.target.value)}
                onBlur={() => {
                  const stroke = strokeDraft.trim();
                  if (stroke !== '' && !isSafeAnnotationColor(stroke)) {
                    setStrokeDraft(annotation.style?.stroke ?? '');
                    return;
                  }
                  updateStyle({
                    ...annotation.style,
                    stroke: stroke || undefined,
                  });
                }}
                aria-label="Annotation stroke"
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Stroke width</span>
              <input
                type="number"
                min={0}
                max={32}
                step={0.5}
                value={annotation.style?.strokeWidth ?? ''}
                onChange={(event) => updateStyle({
                  ...annotation.style,
                  strokeWidth: event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                })}
                aria-label="Annotation stroke width"
              />
            </label>
            <label className={styles.inspectorField}>
              <span>Dash pattern</span>
              <input
                type="text"
                value={dashDraft}
                placeholder="5, 4"
                onChange={(event) => setDashDraft(event.target.value)}
                onBlur={() => {
                  const values = dashDraft.trim() === ''
                    ? undefined
                    : dashDraft.split(/[\s,]+/).map(Number);
                  if (values && !isSafeAnnotationDasharray(values)) {
                    setDashDraft(
                      annotation.style?.strokeDasharray?.join(', ') ?? '',
                    );
                    return;
                  }
                  updateStyle({
                    ...annotation.style,
                    strokeDasharray: values,
                  });
                }}
                aria-label="Annotation dash pattern"
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
