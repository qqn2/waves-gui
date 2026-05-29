import { useCallback } from 'react';
import { useStore } from '../shared/store';
import type { DiagramConfig } from '../shared/types';
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

/** Compact head/foot editors; mount from Toolbar or App shell. */
export function HeadFootFields() {
  const head = useStore((s) => s.diagram.config.head);
  const foot = useStore((s) => s.diagram.config.foot);

  const onHeadText = useCallback((text: string) => {
    patchHead({ text: text || undefined });
  }, []);

  const onFootText = useCallback((text: string) => {
    patchFoot({ text: text || undefined });
  }, []);

  return (
    <div className={styles.headFootRow} title="WaveDrom config.head / config.foot">
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
      <label className={styles.headFootField}>
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
      <label className={styles.headFootField}>
        <span className={styles.headFootLabel}>every</span>
        <input
          type="text"
          className={styles.headFootNum}
          value={formatOptionalInt(head?.every)}
          onChange={(e) => patchHead({ every: parseOptionalInt(e.target.value) })}
          placeholder="—"
          inputMode="numeric"
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
      <label className={styles.headFootField}>
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
      <label className={styles.headFootField}>
        <span className={styles.headFootLabel}>every</span>
        <input
          type="text"
          className={styles.headFootNum}
          value={formatOptionalInt(foot?.every)}
          onChange={(e) => patchFoot({ every: parseOptionalInt(e.target.value) })}
          placeholder="—"
          inputMode="numeric"
        />
      </label>
    </div>
  );
}
