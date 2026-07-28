import { MessageSquareText, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  formatAnnotationRangePosition,
  isSafeAnnotationColor,
  isSafeAnnotationDasharray,
  parseAnnotationRangeInput,
} from '../shared/annotations';
import { ROW_HEIGHT } from '../shared/constants';
import { useStore } from '../shared/store';
import type {
  AnnotationStyle,
  DiagramAnnotation,
  SignalOrGroup,
} from '../shared/types';
import { annotationXCells, annotationYLogical } from '../renderer/annotationLayout';
import { buildRowLayout } from '../renderer/rowLayout';
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
  const selected = diagram.annotations?.find((item) => item.id === activeId) ?? null;
  const annotation = selected?.type === 'arrow' ? null : selected;
  const textAnnotation = annotation?.type === 'text' ? annotation : null;
  const options = useMemo(() => signalOptions(diagram.signals), [diagram.signals]);
  const rows = useMemo(() => buildRowLayout(diagram.signals), [diagram.signals]);
  const [textDraft, setTextDraft] = useState('');
  const [fillDraft, setFillDraft] = useState('');
  const [strokeDraft, setStrokeDraft] = useState('');
  const [dashDraft, setDashDraft] = useState('');
  const [rangeFromDraft, setRangeFromDraft] = useState('');
  const [rangeToDraft, setRangeToDraft] = useState('');

  useEffect(() => {
    setTextDraft(textAnnotation?.text ?? '');
  }, [textAnnotation?.id, textAnnotation?.text]);

  useEffect(() => {
    setFillDraft(annotation?.style?.fill ?? '');
    setStrokeDraft(annotation?.style?.stroke ?? '');
    setDashDraft(annotation?.style?.strokeDasharray?.join(', ') ?? '');
  }, [annotation?.id, annotation?.style]);

  useEffect(() => {
    if (!annotation || annotation.type === 'text') {
      setRangeFromDraft('');
      setRangeToDraft('');
      return;
    }
    setRangeFromDraft(formatAnnotationRangePosition(annotation.rangeFrom));
    setRangeToDraft(formatAnnotationRangePosition(annotation.rangeTo));
  }, [annotation]);

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

  const updatePosition = (patch: Partial<DiagramAnnotation>) => {
    if (!annotation) return;
    if (annotation.type === 'text') {
      updateTextAnnotation(annotation.id, patch);
    } else if (annotation.type === 'vertical-line') {
      updateVerticalLineAnnotation(annotation.id, patch);
    } else if (annotation.type === 'horizontal-line') {
      updateHorizontalLineAnnotation(annotation.id, patch);
    } else {
      updateGlobalCompressionAnnotation(annotation.id, patch);
    }
  };

  const close = () => {
    setActiveAnnotationId(null);
    onClose();
  };

  const commitRange = (
    field: 'rangeFrom' | 'rangeTo',
    draft: string,
    reset: (value: string) => void,
  ) => {
    if (!annotation || annotation.type === 'text') return;
    const parsed = parseAnnotationRangeInput(draft);
    if (parsed === null) {
      reset(formatAnnotationRangePosition(annotation[field]));
      return;
    }
    updatePosition({ [field]: parsed } as Partial<DiagramAnnotation>);
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
            <h2>Position</h2>
            {annotation.type !== 'horizontal-line' ? (
              <label className={styles.inspectorField}>
                <span>X</span>
                <input
                  type="number"
                  min={0}
                  max={diagram.config.totalSteps}
                  step={0.01}
                  value={annotationXCells(annotation)}
                  onChange={(event) => updatePosition({
                    x: Number(event.target.value),
                  })}
                  aria-label="Annotation X coordinate"
                />
              </label>
            ) : null}
            {annotation.type !== 'horizontal-line' ? (
              <label className={styles.inspectorField}>
                <span>Snap to steps</span>
                <input
                  type="checkbox"
                  checked={annotation.snapToGrid !== false}
                  onChange={(event) => updatePosition({
                    snapToGrid: event.target.checked,
                  })}
                  aria-label="Snap annotation X to steps"
                />
              </label>
            ) : null}
            {annotation.type === 'text' || annotation.type === 'horizontal-line' ? (
              <label className={styles.inspectorField}>
                <span>Y mode</span>
                <select
                  value={
                    annotation.coordinateMode
                    ?? (annotation.signalId ? 'signal' : 'diagram')
                  }
                  onChange={(event) => {
                    const coordinateMode = event.target.value as 'diagram' | 'signal';
                    if (coordinateMode === 'diagram') {
                      const logicalY = annotationYLogical(annotation, rows) ?? 0;
                      updatePosition({
                        coordinateMode,
                        y: logicalY / ROW_HEIGHT,
                      });
                    } else {
                      updatePosition({
                        coordinateMode,
                        signalId: annotation.signalId ?? options[0]?.id,
                      });
                    }
                  }}
                  aria-label="Annotation Y coordinate mode"
                >
                  <option value="diagram">Diagram coordinate</option>
                  <option value="signal">Signal anchor</option>
                </select>
              </label>
            ) : null}
            {(annotation.type === 'text' || annotation.type === 'horizontal-line')
              && (annotation.coordinateMode ?? (annotation.signalId ? 'signal' : 'diagram'))
                === 'diagram' ? (
              <label className={styles.inspectorField}>
                <span>Y</span>
                <input
                  type="number"
                  step={0.01}
                  value={
                    annotation.y
                    ?? (annotationYLogical(annotation, rows) ?? 0) / ROW_HEIGHT
                  }
                  onChange={(event) => updatePosition({
                    y: Number(event.target.value),
                    coordinateMode: 'diagram',
                  })}
                  aria-label="Annotation Y coordinate"
                />
              </label>
            ) : null}
            {(annotation.type === 'text' || annotation.type === 'horizontal-line')
              && (annotation.coordinateMode ?? (annotation.signalId ? 'signal' : 'diagram'))
                === 'signal' ? (
              <>
                <label className={styles.inspectorField}>
                  <span>Signal</span>
                  <select
                    value={annotation.signalId ?? ''}
                    onChange={(event) => updatePosition({
                      signalId: event.target.value || undefined,
                      coordinateMode: 'signal',
                    })}
                    aria-label="Annotation signal anchor"
                  >
                    {options.map((option) => (
                      <option key={option.id} value={option.id}>{option.name}</option>
                    ))}
                  </select>
                </label>
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
              </>
            ) : null}
            {annotation.type !== 'text' ? (
              <>
                <label className={styles.inspectorField}>
                  <span>From</span>
                  <input
                    type="text"
                    value={rangeFromDraft}
                    placeholder="start or 25%"
                    onChange={(event) => setRangeFromDraft(event.target.value)}
                    onBlur={() => commitRange(
                      'rangeFrom',
                      rangeFromDraft,
                      setRangeFromDraft,
                    )}
                    aria-label="Annotation range start"
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>To</span>
                  <input
                    type="text"
                    value={rangeToDraft}
                    placeholder="end or 75%"
                    onChange={(event) => setRangeToDraft(event.target.value)}
                    onBlur={() => commitRange(
                      'rangeTo',
                      rangeToDraft,
                      setRangeToDraft,
                    )}
                    aria-label="Annotation range end"
                  />
                </label>
                <p className={styles.inspectorFieldHint}>
                  {annotation.type === 'horizontal-line'
                    ? 'Cell indices or percentages of waveform width.'
                    : 'Signal-row indices or percentages of waveform height.'}
                </p>
              </>
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
