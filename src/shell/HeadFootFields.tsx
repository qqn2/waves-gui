import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { useStore } from '../shared/store';
import type { DiagramConfig } from '../shared/types';
import { DiagramStepsControl } from './DiagramStepsControl';
import { DiagramSubStepsControl } from './DiagramSubStepsControl';
import styles from './shell.module.css';

function parseOptionalNumber(raw: string): number | undefined | null {
  const t = raw.trim();
  if (t === '') return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function formatOptionalNumber(n: number | undefined): string {
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

function hasLabelFields(head: DiagramConfig['head'], foot: DiagramConfig['foot']): boolean {
  return Boolean(head?.text?.trim() || foot?.text?.trim());
}

function CommitInput({
  value,
  onCommit,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (value: string) => boolean | void;
}) {
  const [draft, setDraft] = useState(value);
  const cancelBlurRef = useRef(false);

  useEffect(() => setDraft(value), [value]);

  const commit = () => {
    if (cancelBlurRef.current) {
      cancelBlurRef.current = false;
      return;
    }
    if (onCommit(draft) === false) setDraft(value);
  };

  return (
    <input
      {...props}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          cancelBlurRef.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
        props.onKeyDown?.(event);
      }}
    />
  );
}

/** Steps plus collapsible title/caption and column scale (WaveDrom head/foot). */
export function HeadFootFields() {
  const head = useStore((s) => s.diagram.config.head);
  const foot = useStore((s) => s.diagram.config.foot);
  const updateDiagramHead = useStore((s) => s.updateDiagramHead);
  const updateDiagramFoot = useStore((s) => s.updateDiagramFoot);
  const extensionsEnabled = useStore(
    (s) => s.diagram.compatibility?.extensionsEnabled === true,
  );
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [scaleOpen, setScaleOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) {
        setLabelsOpen(false);
        setScaleOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLabelsOpen(false);
        setScaleOpen(false);
      }
    };
    document.addEventListener('click', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div
      ref={controlsRef}
      className={styles.headFootToolbarControls}
      title="Diagram steps; Labels: head.text / foot.text; Scale: column number ticks"
    >
      <DiagramStepsControl />
      {extensionsEnabled ? <DiagramSubStepsControl /> : null}
      <div className={styles.headFootMenuWrap}>
        <button
          type="button"
          className={styles.headFootAdvancedBtn}
          data-has-value={hasLabelFields(head, foot) || undefined}
          aria-expanded={labelsOpen}
          onClick={() => {
            setLabelsOpen((open) => !open);
            setScaleOpen(false);
          }}
          title="WaveDrom title and caption (head.text / foot.text)"
        >
          Labels <span aria-hidden>{labelsOpen ? '▾' : '▸'}</span>
        </button>
        {labelsOpen ? (
          <div className={styles.headFootPopover} role="group" aria-label="Diagram labels">
            <label className={styles.headFootField}>
              <span className={styles.headFootLabel}>Title</span>
              <CommitInput
                type="text"
                className={styles.headFootInput}
                value={head?.text ?? ''}
                onCommit={(text) => updateDiagramHead({ text: text || undefined })}
                placeholder="head.text"
                spellCheck={false}
              />
            </label>
            <label className={styles.headFootField}>
              <span className={styles.headFootLabel}>Caption</span>
              <CommitInput
                type="text"
                className={styles.headFootInput}
                value={foot?.text ?? ''}
                onCommit={(text) => updateDiagramFoot({ text: text || undefined })}
                placeholder="foot.text"
                spellCheck={false}
              />
            </label>
          </div>
        ) : null}
      </div>
      <div className={styles.headFootMenuWrap}>
        <button
          type="button"
          className={styles.headFootAdvancedBtn}
          data-has-value={hasScaleFields(head, foot) || undefined}
          aria-expanded={scaleOpen}
          onClick={() => {
            setScaleOpen((open) => !open);
            setLabelsOpen(false);
          }}
          title="WaveDrom column numbers: head.tick / head.every, foot.tock / foot.every"
        >
          Scale <span aria-hidden>{scaleOpen ? '▾' : '▸'}</span>
        </button>
        {scaleOpen ? (
          <div
            className={`${styles.headFootPopover} ${styles.headFootScalePopover}`}
            role="group"
            aria-label="Diagram scale"
          >
          <label className={styles.headFootField} title="head.tick — first number on top time scale">
            <span className={styles.headFootLabel}>tick</span>
            <CommitInput
              type="text"
              className={styles.headFootNum}
              value={formatOptionalNumber(head?.tick)}
              onCommit={(raw) => {
                const tick = parseOptionalNumber(raw);
                if (tick === null) return false;
                updateDiagramHead({ tick });
              }}
              placeholder="0"
              inputMode="numeric"
            />
          </label>
          <label
            className={styles.headFootField}
            title="head.every — show a label only every N columns on top"
          >
            <span className={styles.headFootLabel}>every↑</span>
            <CommitInput
              type="text"
              className={styles.headFootNum}
              value={formatOptionalNumber(head?.every)}
              onCommit={(raw) => {
                const every = parseOptionalNumber(raw);
                if (every === null) return false;
                updateDiagramHead({ every });
              }}
              placeholder="—"
              inputMode="numeric"
            />
          </label>
          <label className={styles.headFootField} title="foot.tock — first number on bottom scale">
            <span className={styles.headFootLabel}>tock</span>
            <CommitInput
              type="text"
              className={styles.headFootNum}
              value={formatOptionalNumber(foot?.tock)}
              onCommit={(raw) => {
                const tock = parseOptionalNumber(raw);
                if (tock === null) return false;
                updateDiagramFoot({ tock });
              }}
              placeholder="0"
              inputMode="numeric"
            />
          </label>
          <label
            className={styles.headFootField}
            title="foot.every — show a label only every N columns on bottom"
          >
            <span className={styles.headFootLabel}>every↓</span>
            <CommitInput
              type="text"
              className={styles.headFootNum}
              value={formatOptionalNumber(foot?.every)}
              onCommit={(raw) => {
                const every = parseOptionalNumber(raw);
                if (every === null) return false;
                updateDiagramFoot({ every });
              }}
              placeholder="—"
              inputMode="numeric"
            />
          </label>
          </div>
        ) : null}
      </div>
    </div>
  );
}
