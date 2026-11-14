import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { buildSVGString } from '../exportEngine/exportSVG';
import { computeExportDimensions } from '../exportEngine/exportDimensions';
import { defaultView } from '../shared/store/helpers';
import { useStore } from '../shared/store';
import type { SampleLibraryEntry } from './catalog';
import type { SampleLearningNotes } from './learningTypes';
import { lessonHighlight, lessonPreviewDiagram, stageCycleLabel } from './lessonPreview';
import { loadSamplePreview } from './previewLoader';
import styles from './SampleBrowser.module.css';

type PreviewState = { status: 'loading' } | { status: 'error'; message: string }
  | { status: 'ready'; url: string; signals: number; steps: number; width: number; height: number;
    highlight: ReturnType<typeof lessonHighlight> | null };

export function SamplePreview({ entry, lesson }: { entry: SampleLibraryEntry; lesson?: SampleLearningNotes }) {
  const theme = useStore((state) => state.view.theme);
  const accent = useStore((state) => state.view.accentColor);
  const canvas = useStore((state) => state.view.canvasColor);
  const [state, setState] = useState<PreviewState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [actualSize, setActualSize] = useState(true);
  const [stageIndex, setStageIndex] = useState(0);
  const [focusSignals, setFocusSignals] = useState(true);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageTabsRef = useRef<HTMLDivElement>(null);
  const stage = lesson?.stages[stageIndex];

  useEffect(() => {
    const tabs = stageTabsRef.current;
    const active = tabs?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!tabs || !active) return;
    tabs.scrollLeft = Math.max(0, active.offsetLeft - tabs.offsetLeft - 12);
  }, [stageIndex]);

  useEffect(() => {
    const controller = new AbortController();
    let url: string | undefined;
    setState({ status: 'loading' });
    void loadSamplePreview(entry, controller.signal).then((source) => {
      if (controller.signal.aborted) return;
      const diagram = stage ? lessonPreviewDiagram(source, stage, focusSignals) : source;
      const view = { ...defaultView(), labelWidth: 140, theme };
      const svg = buildSVGString(diagram, view);
      const dims = computeExportDimensions(diagram, view);
      url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      const countSignals = (signals: typeof diagram.signals): number => signals.reduce(
        (count, signal) => count + (signal.type === 'group'
          ? countSignals(signal.children) : signal.type === 'spacer' ? 0 : 1), 0,
      );
      setState({ status: 'ready', url, signals: countSignals(diagram.signals), steps: diagram.config.totalSteps,
        width: dims.totalWidth, height: dims.totalHeight, highlight: stage ? lessonHighlight(diagram, view, stage) : null });
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) setState({
        status: 'error', message: error instanceof Error ? error.message : 'Could not load this waveform.',
      });
    });
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [entry, theme, accent, canvas, attempt, stage, focusSignals]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || state.status !== 'ready') return;
    const highlight = state.highlight;
    const centerStage = () => {
      viewport.scrollLeft = actualSize && highlight
        ? Math.max(0, highlight.x + highlight.width / 2 - (viewport.clientWidth + 140) / 2) : 0;
    };
    centerStage();
    viewport.scrollTop = 0;
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(centerStage);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [state, actualSize]);

  return (
    <section className={styles.walkthrough} aria-label={lesson ? 'Step-by-step walkthrough' : 'Waveform preview'}>
      {lesson && stage && <>
        <div className={styles.walkthroughHeader}>
          <h4>Step by step</h4>
          <div className={styles.stageNavigation}>
            <button type="button" aria-label="Previous stage" disabled={stageIndex === 0} onClick={() => setStageIndex((index) => index - 1)}><ChevronLeft size={16} /></button>
            <span>{stageIndex + 1} / {lesson.stages.length}</span>
            <button type="button" aria-label="Next stage" disabled={stageIndex === lesson.stages.length - 1} onClick={() => setStageIndex((index) => index + 1)}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div ref={stageTabsRef} className={styles.stageTabs} role="group" aria-label="Lesson stages">
          {lesson.stages.map((item, index) => <button key={item.title} type="button"
            aria-pressed={stageIndex === index} onClick={() => setStageIndex(index)}>
            <span>{index + 1}</span>{item.title}
          </button>)}
        </div>
        <div className={styles.stageExplanation} aria-live="polite" aria-label="Current stage">
          <span className={styles.stageCycle}>{stageCycleLabel(stage)}</span>
          <h5>{stage.title}</h5>
          <p>{stage.description}</p>
          <span className={styles.watchSignals}>Watch: {stage.signals.join(', ')}</span>
        </div>
      </>}
      <section className={styles.waveform} aria-label="Waveform preview">
        <div className={styles.waveformToolbar}>
          {stage ? <div className={styles.scaleControls} aria-label="Visible signals">
            <button type="button" aria-pressed={focusSignals} onClick={() => setFocusSignals(true)}>Stage signals</button>
            <button type="button" aria-pressed={!focusSignals} onClick={() => setFocusSignals(false)}>All signals</button>
          </div> : <span>{state.status === 'ready' ? `${state.signals} signals · ${state.steps} steps` : 'Waveform'}</span>}
          <div className={styles.scaleControls} aria-label="Preview scale">
            <button type="button" aria-pressed={!actualSize} onClick={() => setActualSize(false)}>Fit</button>
            <button type="button" aria-pressed={actualSize} onClick={() => setActualSize(true)}>100%</button>
          </div>
        </div>
        <div ref={viewportRef} className={styles.waveformViewport} tabIndex={0} aria-label="Scrollable waveform">
          {state.status === 'ready' ? <div className={actualSize ? styles.actualSurface : styles.fitSurface}
            style={{ width: state.width }}>
            <img key={state.url} className={styles.waveformImage} src={state.url} width={state.width} height={state.height}
              alt={`${entry.title} waveform${stage ? ` — ${stage.title}, ${stageCycleLabel(stage).toLowerCase()}` : ''}`}
              onError={() => setState({ status: 'error', message: 'The waveform image could not be displayed.' })} />
            {state.highlight && <svg className={styles.cycleOverlay} viewBox={`0 0 ${state.width} ${state.height}`} aria-hidden="true"
              data-highlight-start={stage?.start} data-highlight-end={stage?.end}>
              <rect x={state.highlight.x} y={state.highlight.y} width={state.highlight.width} height={state.highlight.height} fill="currentColor" opacity="0.1" />
              <line x1={state.highlight.x + state.highlight.width} x2={state.highlight.x + state.highlight.width}
                y1={state.highlight.y} y2={state.highlight.y + state.highlight.height} stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" />
            </svg>}
            {actualSize && <div className={styles.pinnedLabels} aria-hidden="true"
              style={{ width: 140, height: state.height, marginTop: -state.height }}>
              <img className={styles.pinnedLabelImage} src={state.url} width={state.width} height={state.height} alt="" />
            </div>}
          </div> : state.status === 'error' ? <div className={styles.previewMessage}>
            <strong role="alert">Preview unavailable</strong><p>{state.message}</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry preview</button>
          </div> : <div className={styles.previewMessage} role="status">Loading waveform…</div>}
        </div>
        {state.status === 'ready' && <div className={styles.previewHint}>
          {stage ? <><strong>{stageCycleLabel(stage)} highlighted.</strong> Columns are clock cycles; signals are sampled at the rising edge on each column’s right boundary. The dashed line marks the highlighted interval’s last boundary.</>
            : actualSize ? 'Scroll to explore the waveform. Choose Fit for an overview.' : 'Choose 100% to read signal labels and inspect timing.'}
        </div>}
      </section>
    </section>
  );
}
