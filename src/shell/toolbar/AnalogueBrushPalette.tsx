import {
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { AnalogueTransition } from '../../shared/types';
import styles from '../shell.module.css';
import {
  ANALOGUE_BRUSH_OPTIONS,
  analogueBrushPreviewPath,
  type AnalogueBrushOption,
} from './analogueBrushOptions';

function AnalogueBrushTile({
  option,
  active,
  onSelect,
}: {
  option: AnalogueBrushOption;
  active: boolean;
  onSelect: (kind: AnalogueTransition) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.valuePaletteTile} ${
        active ? styles.valuePaletteTileActive : ''
      }`}
      onClick={() => onSelect(option.kind)}
      aria-pressed={active}
      aria-label={`${option.label} (${option.symbol})`}
    >
      <svg className={styles.valuePalettePreview} viewBox="0 0 64 22" aria-hidden>
        <path d={analogueBrushPreviewPath(option.kind)} />
        {option.kind === 'samples' ? (
          <>
            <circle cx="2" cy="17" r="2" />
            <circle cx="20" cy="11" r="2" />
            <circle cx="36" cy="14" r="2" />
            <circle cx="50" cy="6" r="2" />
            <circle cx="62" cy="5" r="2" />
          </>
        ) : null}
      </svg>
      <span className={styles.valuePaletteTileText}>
        <strong>{option.label}</strong>
        <small>{option.description}</small>
      </span>
      <code>{option.symbol}</code>
    </button>
  );
}

export function AnalogueBrushPalette({
  anchorRef,
  activeKind,
  onSelect,
  onClose,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  activeKind: AnalogueTransition;
  onSelect: (kind: AnalogueTransition) => void;
  onClose: () => void;
}) {
  const [position, setPosition] = useState({ left: 8, top: 80 });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(560, window.innerWidth - 16);
      setPosition({
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - 235)),
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [anchorRef]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      const palette = document.querySelector('[data-analogue-brush-palette="true"]');
      if (!palette?.contains(target)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        anchorRef.current?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [anchorRef, onClose]);

  const select = (kind: AnalogueTransition) => {
    onSelect(kind);
    onClose();
    anchorRef.current?.focus();
  };

  return createPortal(
    <section
      className={styles.valuePalette}
      style={position}
      data-analogue-brush-palette="true"
      role="dialog"
      aria-label="Analogue cell shape palette"
    >
      <header className={styles.valuePaletteHeader}>
        <div>
          <strong>Analogue cell shapes</strong>
          <span>
            Choose the waveform behavior; the Undulate wave character is shown at right.
          </span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close analogue shape palette">
          ×
        </button>
      </header>
      <div className={styles.valuePaletteSection}>
        <h3>Transition from the previous cell</h3>
        <div className={styles.valuePaletteGrid}>
          {ANALOGUE_BRUSH_OPTIONS.map((option) => (
            <AnalogueBrushTile
              key={option.kind}
              option={option}
              active={activeKind === option.kind}
              onSelect={select}
            />
          ))}
        </div>
      </div>
    </section>,
    document.body,
  );
}
