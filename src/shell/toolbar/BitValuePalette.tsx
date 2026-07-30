import {
  useEffect,
  useLayoutEffect,
  useState,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import type { BitState } from '../../shared/types';
import styles from '../shell.module.css';

interface PaletteOption {
  state: BitState;
  label: string;
  description: string;
}

const BASIC_OPTIONS: PaletteOption[] = [
  { state: '.', label: 'Hold previous', description: 'Continue the current value' },
  { state: 'p', label: 'Rising clock', description: 'Positive-edge clock cycle' },
  { state: 'n', label: 'Falling clock', description: 'Negative-edge clock cycle' },
  { state: 'u', label: 'Weak high', description: 'Weak pull-up level' },
  { state: 'd', label: 'Weak low', description: 'Weak pull-down level' },
];

const UNDULATE_GROUPS: Array<{ label: string; options: PaletteOption[] }> = [
  {
    label: 'Impulses',
    options: [
      { state: 'i', label: 'Low-going impulse', description: 'Pulse low from high' },
      { state: 'I', label: 'High-going impulse', description: 'Pulse high from low' },
    ],
  },
  {
    label: 'Metastability',
    options: [
      { state: 'm', label: 'Resolves low', description: 'Metastability settling to 0' },
      { state: 'M', label: 'Resolves high', description: 'Metastability settling to 1' },
    ],
  },
  {
    label: 'Held edges',
    options: [
      { state: 'h', label: 'Rise and hold', description: 'Transition high, then hold' },
      { state: 'H', label: 'Rise, arrow, hold', description: 'Marked transition high' },
      { state: 'l', label: 'Fall and hold', description: 'Transition low, then hold' },
      { state: 'L', label: 'Fall, arrow, hold', description: 'Marked transition low' },
    ],
  },
];

const OPTION_BY_STATE = new Map(
  [...BASIC_OPTIONS, ...UNDULATE_GROUPS.flatMap((group) => group.options)]
    .map((option) => [option.state, option]),
);

function previewPath(state: BitState): string {
  switch (state) {
    case 'p': return 'M2 18H13V4H30V18H47V4H62';
    case 'n': return 'M2 4H13V18H30V4H47V18H62';
    case 'u': return 'M2 7H62';
    case 'd': return 'M2 17H62';
    case 'i': return 'M2 5H30V18V5H62';
    case 'I': return 'M2 18H30V4V18H62';
    case 'm': return 'M2 11C7 1 12 21 17 11S27 2 32 11S42 18 47 14S55 17 62 18';
    case 'M': return 'M2 11C7 21 12 1 17 11S27 20 32 11S42 4 47 8S55 5 62 4';
    case 'h':
    case 'H': return 'M2 18H20L30 4H62';
    case 'l':
    case 'L': return 'M2 4H20L30 18H62';
    default: return 'M2 11H62';
  }
}

function ValueTile({
  option,
  active,
  onSelect,
}: {
  option: PaletteOption;
  active: boolean;
  onSelect: (state: BitState) => void;
}) {
  return (
    <button
      type="button"
      className={`${styles.valuePaletteTile} ${active ? styles.valuePaletteTileActive : ''}`}
      onClick={() => onSelect(option.state)}
      aria-pressed={active}
      aria-label={`${option.label} (${option.state})`}
    >
      <svg
        className={styles.valuePalettePreview}
        viewBox="0 0 64 22"
        aria-hidden
      >
        <path d={previewPath(option.state)} />
        {(option.state === 'H' || option.state === 'L') ? (
          <path d={option.state === 'H' ? 'M26 9L30 4L34 9' : 'M26 13L30 18L34 13'} />
        ) : null}
      </svg>
      <span className={styles.valuePaletteTileText}>
        <strong>{option.label}</strong>
        <small>{option.description}</small>
      </span>
      <code>{option.state}</code>
    </button>
  );
}

export function BitValuePalette({
  anchorRef,
  activeBit,
  extensionsEnabled,
  recentBits,
  onSelect,
  onClose,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  activeBit: BitState;
  extensionsEnabled: boolean;
  recentBits: BitState[];
  onSelect: (state: BitState) => void;
  onClose: () => void;
}) {
  const [position, setPosition] = useState({ left: 8, top: 80 });
  const availableStates = new Set([
    ...BASIC_OPTIONS.map((option) => option.state),
    ...(extensionsEnabled
      ? UNDULATE_GROUPS.flatMap((group) => group.options.map((option) => option.state))
      : []),
  ]);
  const recentOptions = recentBits
    .filter((state) => availableStates.has(state))
    .map((state) => OPTION_BY_STATE.get(state))
    .filter((option): option is PaletteOption => option !== undefined);

  useLayoutEffect(() => {
    const updatePosition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(560, window.innerWidth - 16);
      setPosition({
        left: Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8)),
        top: Math.max(8, Math.min(anchor.bottom + 6, window.innerHeight - 320)),
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
      const palette = document.querySelector('[data-bit-value-palette="true"]');
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

  const select = (state: BitState) => {
    onSelect(state);
    onClose();
    anchorRef.current?.focus();
  };

  return createPortal(
    <section
      className={styles.valuePalette}
      style={position}
      data-bit-value-palette="true"
      role="dialog"
      aria-label="Waveform value palette"
    >
      <header className={styles.valuePaletteHeader}>
        <div>
          <strong>Waveform values</strong>
          <span>Choose a semantic state; the JSON symbol is shown at right.</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close value palette">×</button>
      </header>

      {recentOptions.length > 0 ? (
        <div className={styles.valuePaletteSection}>
          <h3>Recent</h3>
          <div className={styles.valuePaletteGrid}>
            {recentOptions.map((option) => (
              <ValueTile
                key={`recent-${option.state}`}
                option={option}
                active={activeBit === option.state}
                onSelect={select}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.valuePaletteSection}>
        <h3>Logic and clocks</h3>
        <div className={styles.valuePaletteGrid}>
          {BASIC_OPTIONS.map((option) => (
            <ValueTile
              key={option.state}
              option={option}
              active={activeBit === option.state}
              onSelect={select}
            />
          ))}
        </div>
      </div>

      {extensionsEnabled ? UNDULATE_GROUPS.map((group) => (
        <div className={styles.valuePaletteSection} key={group.label}>
          <h3>{group.label}</h3>
          <div className={styles.valuePaletteGrid}>
            {group.options.map((option) => (
              <ValueTile
                key={option.state}
                option={option}
                active={activeBit === option.state}
                onSelect={select}
              />
            ))}
          </div>
        </div>
      )) : null}
    </section>,
    document.body,
  );
}
