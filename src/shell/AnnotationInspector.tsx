import { MessageSquareText, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  formatAnnotationRangePosition,
  formatAnnotationAnchor,
  isSafeAnnotationColor,
  isSafeAnnotationDasharray,
  parseAnnotationRangeInput,
  parseAnnotationAnchorInput,
} from '../shared/annotations';
import { ROW_HEIGHT } from '../shared/constants';
import {
  splitEdgeConnector,
  withEdgeEndpointDecoration,
  type EdgeEndpointDecoration,
} from '../shared/edgeSyntax';
import { useStore } from '../shared/store';
import type {
  AnnotationStyle,
  ArrowAnnotation,
  DiagramAnnotation,
  SignalOrGroup,
} from '../shared/types';
import { annotationXCells, annotationYLogical } from '../renderer/annotationLayout';
import { buildRowLayout } from '../renderer/rowLayout';
import styles from './shell.module.css';

function AnnotationTypographyFields({
  style,
  onChange,
}: {
  style: AnnotationStyle | undefined;
  onChange: (style: AnnotationStyle) => void;
}) {
  return (
    <>
      <label className={styles.inspectorField}>
        <span>Font family</span>
        <select
          value={style?.fontFamily ?? 'sans-serif'}
          onChange={(event) => onChange({
            ...style,
            fontFamily: event.target.value as NonNullable<
              AnnotationStyle['fontFamily']
            >,
          })}
          aria-label="Annotation font family"
        >
          <option value="sans-serif">Sans serif</option>
          <option value="serif">Serif</option>
          <option value="monospace">Monospace</option>
        </select>
      </label>
      <label className={styles.inspectorField}>
        <span>Font weight</span>
        <select
          value={style?.fontWeight ?? 400}
          onChange={(event) => onChange({
            ...style,
            fontWeight: Number(event.target.value),
          })}
          aria-label="Annotation font weight"
        >
          {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((weight) => (
            <option key={weight} value={weight}>
              {weight}{weight === 400 ? ' Regular' : weight === 700 ? ' Bold' : ''}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}

function ArrowAnnotationInspector({
  annotation,
  onClose,
}: {
  annotation: ArrowAnnotation;
  onClose: () => void;
}) {
  const updateArrowAnnotation = useStore((state) => state.updateArrowAnnotation);
  const removeAnnotation = useStore((state) => state.removeAnnotation);
  const setActiveAnnotationId = useStore((state) => state.setActiveAnnotationId);
  const [shape, setShape] = useState(annotation.shape);
  const [text, setText] = useState(annotation.text ?? '');
  const [from, setFrom] = useState(formatAnnotationAnchor(annotation.from));
  const [to, setTo] = useState(formatAnnotationAnchor(annotation.to));
  const [stroke, setStroke] = useState(annotation.style?.stroke ?? '');

  useEffect(() => {
    setShape(annotation.shape);
    setText(annotation.text ?? '');
    setFrom(formatAnnotationAnchor(annotation.from));
    setTo(formatAnnotationAnchor(annotation.to));
    setStroke(annotation.style?.stroke ?? '');
  }, [annotation]);

  const close = () => {
    setActiveAnnotationId(null);
    onClose();
  };
  const commitAnchor = (field: 'from' | 'to', draft: string) => {
    const parsed = parseAnnotationAnchorInput(draft);
    if (!parsed) {
      const original = formatAnnotationAnchor(annotation[field]);
      if (field === 'from') setFrom(original);
      else setTo(original);
      return;
    }
    updateArrowAnnotation(annotation.id, { [field]: parsed });
  };
  const endpoint = splitEdgeConnector(annotation.shape);
  const updateEndpoint = (
    side: 'start' | 'end',
    decoration: EdgeEndpointDecoration,
  ) => {
    updateArrowAnnotation(annotation.id, {
      shape: withEdgeEndpointDecoration(annotation.shape, side, decoration),
    });
  };

  return (
    <aside className={styles.inspector} aria-label="Annotation inspector">
      <div className={styles.inspectorHeader}>
        <div>
          <span className={styles.inspectorEyebrow}>Undulate extension</span>
          <strong>Structured arrow</strong>
        </div>
        <button type="button" className={styles.inspectorClose} onClick={close} aria-label="Close annotation inspector">
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className={styles.inspectorBody}>
        <section className={styles.inspectorSection}>
          <h2>Arrow</h2>
          <label className={styles.inspectorField}>
            <span>Shape</span>
            <input
              value={shape}
              onChange={(event) => setShape(event.target.value)}
              onBlur={() => {
                const next = shape.trim();
                if (next) updateArrowAnnotation(annotation.id, { shape: next });
                else setShape(annotation.shape);
              }}
              aria-label="Arrow shape"
            />
          </label>
          <label className={styles.inspectorField}>
            <span>Start endpoint</span>
            <select
              value={endpoint.start}
              onChange={(event) => updateEndpoint(
                'start',
                event.target.value as EdgeEndpointDecoration,
              )}
              aria-label="Arrow start endpoint"
            >
              <option value="none">None</option>
              <option value="arrow">Arrow</option>
              <option value="square">Square</option>
              <option value="circle">Circle</option>
            </select>
          </label>
          <label className={styles.inspectorField}>
            <span>End endpoint</span>
            <select
              value={endpoint.end}
              onChange={(event) => updateEndpoint(
                'end',
                event.target.value as EdgeEndpointDecoration,
              )}
              aria-label="Arrow end endpoint"
            >
              <option value="none">None</option>
              <option value="arrow">Arrow</option>
              <option value="square">Square</option>
              <option value="circle">Circle</option>
            </select>
          </label>
          <label className={styles.inspectorField}>
            <span>Text</span>
            <input
              value={text}
              onChange={(event) => setText(event.target.value)}
              onBlur={() => updateArrowAnnotation(annotation.id, {
                text: text.trim() || undefined,
              })}
              aria-label="Arrow text"
            />
          </label>
          <label className={styles.inspectorField}>
            <span>From</span>
            <input
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              onBlur={() => commitAnchor('from', from)}
              placeholder="a(2, -1) or 10%, 50%"
              aria-label="Arrow from anchor"
            />
          </label>
          <label className={styles.inspectorField}>
            <span>To</span>
            <input
              value={to}
              onChange={(event) => setTo(event.target.value)}
              onBlur={() => commitAnchor('to', to)}
              placeholder="b or 80%, 50%"
              aria-label="Arrow to anchor"
            />
          </label>
          <p className={styles.inspectorFieldHint}>
            Use a node, node(dx, dy), x/y cells, or x%/y% coordinates.
          </p>
          <label className={styles.inspectorField}>
            <span>Label X offset</span>
            <input
              type="number"
              step="any"
              value={annotation.dx ?? 0}
              onChange={(event) => updateArrowAnnotation(annotation.id, {
                dx: Number(event.target.value),
              })}
              aria-label="Arrow label X offset"
            />
          </label>
          <label className={styles.inspectorField}>
            <span>Label Y offset</span>
            <input
              type="number"
              step="any"
              value={annotation.dy ?? 0}
              onChange={(event) => updateArrowAnnotation(annotation.id, {
                dy: Number(event.target.value),
              })}
              aria-label="Arrow label Y offset"
            />
          </label>
        </section>
        <section className={styles.inspectorSection}>
          <h2>Style</h2>
          <label className={styles.inspectorField}>
            <span>Stroke</span>
            <input
              value={stroke}
              placeholder="#4a9eff"
              onChange={(event) => setStroke(event.target.value)}
              onBlur={() => {
                const next = stroke.trim();
                if (next && !isSafeAnnotationColor(next)) {
                  setStroke(annotation.style?.stroke ?? '');
                  return;
                }
                updateArrowAnnotation(annotation.id, {
                  style: { ...annotation.style, stroke: next || undefined },
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
              onChange={(event) => updateArrowAnnotation(annotation.id, {
                style: {
                  ...annotation.style,
                  strokeWidth: event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                },
              })}
              aria-label="Annotation stroke width"
            />
          </label>
          <label className={styles.inspectorField}>
            <span>Label font size</span>
            <input
              type="number"
              min={6}
              max={96}
              step={1}
              value={annotation.style?.fontSize ?? ''}
              onChange={(event) => updateArrowAnnotation(annotation.id, {
                style: {
                  ...annotation.style,
                  fontSize: event.target.value === ''
                    ? undefined
                    : Number(event.target.value),
                },
              })}
              aria-label="Annotation font size"
            />
          </label>
          <AnnotationTypographyFields
            style={annotation.style}
            onChange={(style) => updateArrowAnnotation(annotation.id, { style })}
          />
          <label className={styles.inspectorField}>
            <span>Text background</span>
            <input
              type="checkbox"
              checked={annotation.style?.textBackground !== false}
              onChange={(event) => updateArrowAnnotation(annotation.id, {
                style: {
                  ...annotation.style,
                  textBackground: event.target.checked ? undefined : false,
                },
              })}
              aria-label="Annotation text background"
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
    </aside>
  );
}

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
  const collapsedGroupIds = useStore((state) => state.view.collapsedGroupIds);
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
  const rows = useMemo(
    () => buildRowLayout(diagram.signals, collapsedGroupIds),
    [diagram.signals, collapsedGroupIds],
  );
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

  if (selected?.type === 'arrow') {
    return <ArrowAnnotationInspector annotation={selected} onClose={onClose} />;
  }

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
                <AnnotationTypographyFields
                  style={annotation.style}
                  onChange={updateStyle}
                />
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
            {textAnnotation ? (
              <>
                <label className={styles.inspectorField}>
                  <span>Font size</span>
                  <input
                    type="number"
                    min={6}
                    max={96}
                    step={1}
                    value={annotation.style?.fontSize ?? ''}
                    onChange={(event) => updateStyle({
                      ...annotation.style,
                      fontSize: event.target.value === ''
                        ? undefined
                        : Number(event.target.value),
                    })}
                    aria-label="Annotation font size"
                  />
                </label>
                <label className={styles.inspectorField}>
                  <span>Text background</span>
                  <input
                    type="checkbox"
                    checked={annotation.style?.textBackground !== false}
                    onChange={(event) => updateStyle({
                      ...annotation.style,
                      textBackground: event.target.checked ? undefined : false,
                    })}
                    aria-label="Annotation text background"
                  />
                </label>
              </>
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
