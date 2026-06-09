import { useCallback, useEffect, useMemo, useState } from 'react';

import {

  colorIndexFromFillHex,

  fillHexForColorIndex,

  WAVEDROM_COLOR_INDEXES,

} from '../wavedromBridge/wavedromColors';

import { MAX_HSCALE } from '../shared/constants';

import { useStore } from '../shared/store';

import type { Signal, SignalOrGroup, VectorSegment } from '../shared/types';

import { segmentLabelFit, segmentLabelOverflows } from '../shared/vectorLabelFit';
import { VECTOR_UNKNOWN_LABEL } from '../shared/vectorSegments';

import styles from './SignalPanel.module.css';



export interface VectorSegmentEditorProps {

  signalId: string;

}



function findSignalInTree(

  items: SignalOrGroup[],

  id: string,

): Signal | undefined {

  for (const item of items) {

    if (item.type === 'group') {

      const found = findSignalInTree(item.children, id);

      if (found) return found;

    } else if (item.id === id) {

      return item;

    }

  }

  return undefined;

}



function sortedSegments(segments: VectorSegment[]): VectorSegment[] {

  return [...segments].sort((a, b) => a.startStep - b.startStep);

}



interface SegmentValueRowProps {

  segment: VectorSegment;

  signal: Signal;

  hscale: number;

  onCommit: (segmentId: string, value: string) => void;

  onColor: (segmentId: string, fillHex: string) => void;

  onIncreaseHscale: (targetHscale: number) => void;

}



function SegmentValueRow({

  segment,

  signal,

  hscale,

  onCommit,

  onColor,

  onIncreaseHscale,

}: SegmentValueRowProps) {

  const [draft, setDraft] = useState(segment.value);



  useEffect(() => {

    setDraft(segment.value);

  }, [segment.value]);



  const fit = useMemo(

    () => segmentLabelFit(segment, signal, hscale, signal.rowHeight, draft),

    [draft, hscale, segment, signal],

  );



  const commit = useCallback(() => {

    const trimmed = draft.trim();

    const next = trimmed.length > 0 ? trimmed : segment.value;

    if (next !== segment.value) {

      onCommit(segment.id, next);

    }

    setDraft(next);

  }, [draft, onCommit, segment.id, segment.value]);



  const activeColorIndex =
    segment.value === VECTOR_UNKNOWN_LABEL
      ? null
      : colorIndexFromFillHex(segment.color);

  const canRaiseHscale = fit.minHscale > hscale && hscale < MAX_HSCALE;



  return (

    <li className={styles.segmentRow}>

      <div className={styles.segmentRowMain}>

        <span className={styles.segmentRange} title="Step range (start inclusive, end exclusive)">

          [{segment.startStep}, {segment.endStep})

        </span>

        <span className={styles.segmentColorGroup} title="WaveDrom bus fill">

          {WAVEDROM_COLOR_INDEXES.map((idx) => (

            <button

              key={idx}

              type="button"

              className={`${styles.segmentColorSwatch} ${

                activeColorIndex === idx ? styles.segmentColorSwatchActive : ''

              }`}

              style={{ background: fillHexForColorIndex(idx) }}

              aria-label={`Segment color ${idx}`}

              onClick={(e) => {

                e.stopPropagation();

                onColor(segment.id, fillHexForColorIndex(idx));

              }}

            />

          ))}

        </span>

        <input

          type="text"

          className={`${styles.segmentValue} ${!fit.fits ? styles.segmentValueOverflow : ''}`}

          value={draft}

          aria-invalid={!fit.fits}

          aria-describedby={!fit.fits ? `${segment.id}-overflow` : undefined}

          aria-label={`Label for steps ${segment.startStep} to ${segment.endStep}`}

          onChange={(e) => setDraft(e.target.value)}

          onBlur={commit}

          onKeyDown={(e) => {

            if (e.key === 'Enter') {

              e.preventDefault();

              (e.target as HTMLInputElement).blur();

            } else if (e.key === 'Escape') {

              e.preventDefault();

              setDraft(segment.value);

              (e.target as HTMLInputElement).blur();

            }

          }}

          onClick={(e) => e.stopPropagation()}

        />

      </div>

      {!fit.fits ? (

        <div className={styles.segmentRowFit} id={`${segment.id}-overflow`}>

          <span

            className={styles.segmentOverflow}

            title={`Label needs hscale ≥ ${fit.minHscale} (currently ${hscale})`}

          >

            {fit.tooNarrowForShape ? 'Span too narrow' : 'Label clipped on canvas'}

            {' · '}

            hscale ≥ {fit.minHscale}

          </span>

          <button

            type="button"

            className={styles.segmentHscaleBtn}

            disabled={!canRaiseHscale}

            title={

              canRaiseHscale

                ? `Set hscale to ${fit.minHscale}`

                : hscale >= MAX_HSCALE

                  ? 'Already at maximum hscale'

                  : `Current hscale ${hscale} is sufficient — commit label change if editing`

            }

            onClick={(e) => {

              e.stopPropagation();

              commit();

              onIncreaseHscale(fit.minHscale);

            }}

          >

            Increase hscale

          </button>

        </div>

      ) : null}

    </li>

  );

}



export function VectorSegmentEditor({ signalId }: VectorSegmentEditorProps) {

  const signals = useStore((s) => s.diagram.signals);

  const signalName = useStore((s) => {

    const sig = findSignalInTree(s.diagram.signals, signalId);

    return sig?.type === 'vector' ? sig.name : '';

  });

  const segments = useStore((s) => {

    const sig = findSignalInTree(s.diagram.signals, signalId);

    return sig?.type === 'vector' ? sig.segments : [];

  });



  const updateVectorSegmentValue = useStore((s) => s.updateVectorSegmentValue);

  const updateVectorSegmentColor = useStore((s) => s.updateVectorSegmentColor);

  const setHscale = useStore((s) => s.setHscale);

  const hscale = useStore((s) => s.diagram.config.hscale);



  const sig = findSignalInTree(signals, signalId);

  const ordered = useMemo(() => sortedSegments(segments), [segments]);



  const overflowCount = useMemo(() => {

    if (!sig || sig.type !== 'vector') return 0;

    return ordered.filter((seg) =>

      segmentLabelOverflows(seg, sig, hscale, sig.rowHeight),

    ).length;

  }, [ordered, sig, hscale]);



  const onCommit = useCallback(

    (segmentId: string, value: string) => {

      if (typeof updateVectorSegmentValue === 'function') {

        updateVectorSegmentValue(signalId, segmentId, value);

        return;

      }

      useStore.setState((s) => {

        const sig = findSignalInTree(s.diagram.signals, signalId);

        if (sig?.type !== 'vector') return;

        const seg = sig.segments.find((x) => x.id === segmentId);

        if (seg) seg.value = value;

        s.view.isDirty = true;

      });

    },

    [signalId, updateVectorSegmentValue],

  );



  const onColor = useCallback(

    (segmentId: string, fillHex: string) => {

      updateVectorSegmentColor(signalId, segmentId, fillHex);

    },

    [signalId, updateVectorSegmentColor],

  );



  const onIncreaseHscale = useCallback(

    (targetHscale: number) => {

      setHscale(targetHscale);

    },

    [setHscale],

  );



  if (!sig || sig.type !== 'vector') return null;



  return (

    <section className={styles.segmentEditor} aria-label="Bus segment labels">

      <div className={styles.segmentEditorHeader}>

        <span className={styles.segmentEditorTitle}>Bus labels</span>

        {overflowCount > 0 ? (

          <span

            className={styles.segmentEditorOverflowBadge}

            title={`${overflowCount} label${overflowCount === 1 ? '' : 's'} clipped on canvas — raise hscale to fit`}

          >

            {overflowCount} clipped

          </span>

        ) : null}

        <span className={styles.segmentEditorHint} title="Paint tool + Bus field sets spans on canvas">

          paint to edit spans

        </span>

        <span className={styles.segmentEditorSignal} title={signalName}>

          {signalName || '(unnamed)'}

        </span>

      </div>

      {ordered.length === 0 ? (

        <p className={styles.segmentEditorEmpty}>No segments</p>

      ) : (

        <ul className={styles.segmentList}>

          {ordered.map((seg) => (

            <SegmentValueRow

              key={seg.id}

              segment={seg}

              signal={sig}

              hscale={hscale}

              onCommit={onCommit}

              onColor={onColor}

              onIncreaseHscale={onIncreaseHscale}

            />

          ))}

        </ul>

      )}

    </section>

  );

}
