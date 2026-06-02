import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../shared/store';
import type { DiagramConfig } from '../shared/types';
import { DiagramStepsControl } from './DiagramStepsControl';
import styles from './shell.module.css';

type HeadSlice = NonNullable<DiagramConfig['head']>;
type FootSlice = NonNullable<DiagramConfig['foot']>;

function parseOptionalInt(raw: string): number | undefined {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function formatOptionalInt(n: number | undefined): string {
  return n === undefined ? '' : String(n);
}

function hasScaleFields(
  head: DiagramConfig['head'],
  foot: DiagramConfig['foot'],
): boolean {
  return (
    head?.tick !== undefined ||
    head?.every !== undefined ||
    foot?.tock !== undefined ||
    foot?.every !== undefined
  );
}

function patchHead(patch: Partial<HeadSlice>): void {
  useStore.setState((s) => {
    const prev = s.diagram.config.head ?? {};
    const next: HeadSlice = { ...prev, ...patch };
    if (!next.text && next.tick === undefined && next.every === undefined) {
      delete s.diagram.config.head;
    } else {
      s.diagram.config.head = next;
    }
    s.view.isDirty = true;
  });
}

function patchFoot(patch: Partial<FootSlice>): void {
  useStore.setState((s) => {
    const prev = s.diagram.config.foot ?? {};
    const next: FootSlice = { ...prev, ...patch };
    if (!next.text && next.tock === undefined && next.every === undefined) {
      delete s.diagram.config.foot;
    } else {
      s.diagram.config.foot = next;
    }
    s.view.isDirty = true;
  });
}

/** Title, caption, steps, and optional tick/tock scale (WaveDrom head/foot). */
export function HeadFootFields() {
  const head = useStore((s) => s.diagram.config.head);
  const foot = useStore((s) => s.diagram.config.foot);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (hasScaleFields(head, foot)) {
      setAdvancedOpen(true);
    }
  }, [head?.tick, head?.every, foot?.tock, foot?.every]);

  const onHeadText = useCallback((text: string) => {
    patchHead({ text: text || undefined });
  }, []);

  const onFootText = useCallback((text: string) => {
    patchFoot({ text: text || undefined });
  }, []);

  return (
    <div
      className={styles.headFootRow}
      title="Steps, title/caption (head.text / foot.text); Advanced: column number scales"
    >
      <DiagramStepsControl />
      <span className={styles.headFootSep} aria-hidden />
      <label className={styles.headFootField}>
        <span className={styles.headFootLabel}>Title</span>
        <input
          type="text"
          className={styles.headFootInput}
          value={head?.text ?? ''}
          onChange={(e) => onHeadText(e.target.value)}
          placeholder="head.text"
          spellCheck={false}
        />
      </label>
      <span className={styles.headFootSep} />
      <label className={styles.headFootField}>
        <span className={styles.headFootLabel}>Caption</span>
        <input
          type="text"
          className={styles.headFootInput}
          value={foot?.text ?? ''}
          onChange={(e) => onFootText(e.target.value)}
          placeholder="foot.text"
          spellCheck={false}
        />
      </label>
      <button
        type="button"
        className={styles.headFootAdvancedBtn}
        aria-expanded={advancedOpen}
        onClick={() => setAdvancedOpen((o) => !o)}
        title="WaveDrom column numbers: head.tick / head.every, foot.tock / foot.every"
      >
        Advanced {advancedOpen ? '▾' : '▸'}
      </button>
      {advancedOpen ? (
        <>
          <span className={styles.headFootSep} aria-hidden />
          <label className={styles.headFootField} title="head.tick — first number on top time scale">
            <span className={styles.headFootLabel}>tick</span>
            <input
              type="text"
              className={styles.headFootNum}
              value={formatOptionalInt(head?.tick)}
              onChange={(e) => patchHead({ tick: parseOptionalInt(e.target.value) })}
              placeholder="0"
              inputMode="numeric"
            />
          </label>
          <label
            className={styles.headFootField}
            title="head.every — show a label only every N columns on top"
          >
            <span className={styles.headFootLabel}>every↑</span>
            <input
              type="text"
              className={styles.headFootNum}
              value={formatOptionalInt(head?.every)}
              onChange={(e) => patchHead({ every: parseOptionalInt(e.target.value) })}
              placeholder="—"
              inputMode="numeric"
            />
          </label>
          <label className={styles.headFootField} title="foot.tock — first number on bottom scale">
            <span className={styles.headFootLabel}>tock</span>
            <input
              type="text"
              className={styles.headFootNum}
              value={formatOptionalInt(foot?.tock)}
              onChange={(e) => patchFoot({ tock: parseOptionalInt(e.target.value) })}
              placeholder="0"
              inputMode="numeric"
            />
          </label>
          <label
            className={styles.headFootField}
            title="foot.every — show a label only every N columns on bottom"
          >
            <span className={styles.headFootLabel}>every↓</span>
            <input
              type="text"
              className={styles.headFootNum}
              value={formatOptionalInt(foot?.every)}
              onChange={(e) => patchFoot({ every: parseOptionalInt(e.target.value) })}
              placeholder="—"
              inputMode="numeric"
            />
          </label>
        </>
      ) : null}
    </div>
  );
}
