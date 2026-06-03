import type { BitState } from '../../shared/types';
import { BIT_STATE_TITLES } from './bitStateConstants';
import styles from '../shell.module.css';

export function BitStateButton({
  st,
  active,
  onSelect,
}: {
  st: BitState;
  active: boolean;
  onSelect: (st: BitState) => void;
}) {
  return (
    <button
      type="button"
      title={BIT_STATE_TITLES[st] ?? `Draw ${st}`}
      className={`${styles.toolBtn} ${active ? styles.toolActive : ''}`}
      onClick={() => onSelect(st)}
      aria-pressed={active}
    >
      {st}
    </button>
  );
}
