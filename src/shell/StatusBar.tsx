import { useStore, findSignal } from '../shared/store';
import type { HitTestResult } from '../renderer/hitTest';
import { toggleBinaryBitState } from '../shared/bitToggle';
import type { BitState } from '../shared/types';
import { countSignals } from './statusUtils';
import styles from './shell.module.css';

export interface StatusBarProps {
  pointerHit?: HitTestResult | null;
}

export function StatusBar({ pointerHit }: StatusBarProps) {
  const tool = useStore((s) => s.view.selectedTool);
  const paintMode = useStore((s) => s.view.paintMode);
  const activeBit = useStore((s) => s.view.activeBitState);
  const zoom = useStore((s) => s.view.zoom);
  const signals = useStore((s) => s.diagram.signals);
  const totalSteps = useStore((s) => s.diagram.config.totalSteps);
  const isDirty = useStore((s) => s.view.isDirty);
  const diagram = useStore((s) => s.diagram);

  const signalCount = countSignals(signals);

  let pointerLabel = 'Move pointer over waveform';
  if (pointerHit?.signalId && pointerHit.step !== null) {
    let name = pointerHit.signalId;
    findSignal(diagram.signals, pointerHit.signalId, (s) => {
      name = s.name;
    });
    let cur: BitState | null = null;
    findSignal(diagram.signals, pointerHit.signalId, (s) => {
      if (s.type === 'bit') cur = s.states[pointerHit.step!];
    });
    const paintHint =
      tool === 'paint' && cur !== null
        ? paintMode === 'set'
          ? ` · paint ${activeBit}`
          : ` · ${cur}→${toggleBinaryBitState(cur)}`
        : '';
    pointerLabel = `Step ${pointerHit.step} · ${name}${paintHint}`;
  }

  return (
    <footer className={styles.statusBar}>
      <span className={styles.statusPointer}>{pointerLabel}</span>
      <span className={styles.statusSep}>|</span>
      <span>{tool}</span>
      <span>paint: {paintMode === 'toggle' ? 'toggle' : activeBit}</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span>
        {signalCount} sig · {totalSteps} steps
      </span>
      {isDirty ? <span className={styles.dirty}>unsaved</span> : null}
    </footer>
  );
}
