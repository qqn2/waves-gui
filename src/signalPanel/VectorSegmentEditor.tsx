import { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore } from '../shared/store';
import type { Signal, SignalOrGroup, VectorSegment } from '../shared/types';
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
  onCommit: (segmentId: string, value: string) => void;
}

function SegmentValueRow({ segment, onCommit }: SegmentValueRowProps) {
  const [draft, setDraft] = useState(segment.value);

  useEffect(() => {
    setDraft(segment.value);
  }, [segment.value]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    const next = trimmed.length > 0 ? trimmed : segment.value;
    if (next !== segment.value) {
      onCommit(segment.id, next);
    }
    setDraft(next);
  }, [draft, onCommit, segment.id, segment.value]);

  return (
    <li className={styles.segmentRow}>
      <span className={styles.segmentRange} title="Step range (start inclusive, end exclusive)">
        [{segment.startStep}, {segment.endStep})
      </span>
      <input
        type="text"
        className={styles.segmentValue}
        value={draft}
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

  const ordered = useMemo(() => sortedSegments(segments), [segments]);

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

  const sig = findSignalInTree(signals, signalId);
  if (!sig || sig.type !== 'vector') return null;

  return (
    <section className={styles.segmentEditor} aria-label="Bus segment labels">
      <div className={styles.segmentEditorHeader}>
        <span className={styles.segmentEditorTitle}>Bus labels</span>
        <span className={styles.segmentEditorSignal} title={signalName}>
          {signalName || '(unnamed)'}
        </span>
      </div>
      {ordered.length === 0 ? (
        <p className={styles.segmentEditorEmpty}>No segments</p>
      ) : (
        <ul className={styles.segmentList}>
          {ordered.map((seg) => (
            <SegmentValueRow key={seg.id} segment={seg} onCommit={onCommit} />
          ))}
        </ul>
      )}
    </section>
  );
}
