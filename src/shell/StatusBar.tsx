import { useStore } from '../shared/store';
import { countSignals } from './statusUtils';
import styles from './shell.module.css';

export function StatusBar() {
  const tool = useStore((s) => s.view.selectedTool);
  const activeBit = useStore((s) => s.view.activeBitState);
  const zoom = useStore((s) => s.view.zoom);
  const signals = useStore((s) => s.diagram.signals);
  const totalSteps = useStore((s) => s.diagram.config.totalSteps);
  const isDirty = useStore((s) => s.view.isDirty);

  const signalCount = countSignals(signals);

  return (
    <footer className={styles.statusBar}>
      <span>{tool}</span>
      <span>State: {activeBit}</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span>
        {signalCount} signal{signalCount === 1 ? '' : 's'}
      </span>
      <span>{totalSteps} steps</span>
      {isDirty ? <span className={styles.dirty}>●</span> : null}
    </footer>
  );
}
