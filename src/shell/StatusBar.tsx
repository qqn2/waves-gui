import { useStore, findSignal } from '../shared/store';
import type { HitTestResult } from '../renderer/hitTest';
import type { Tool } from '../shared/types';
import type { BitState } from '../shared/types';
import { toggleBinaryBitState } from '../shared/bitToggle';
import { countSignals } from './statusUtils';
import styles from './shell.module.css';

export interface StatusBarProps {
  pointerHit?: HitTestResult | null;
}

function toolHelp(tool: Tool): string {
  switch (tool) {
    case 'cursor':
    case 'select':
      return 'Pointer: click row · drag area · Del clears selection';
    case 'paint':
      return 'Draw: drag on a bit row · Set or ¬ toggle mode';
    case 'erase':
      return 'Erase: drag on a bit/bus row';
    default:
      return '';
  }
}

export function StatusBar({ pointerHit }: StatusBarProps) {
  const tool = useStore((s) => s.view.selectedTool);
  const activeBit = useStore((s) => s.view.activeBitState);
  const paintMode = useStore((s) => s.view.paintMode);
  const zoom = useStore((s) => s.view.zoom);
  const signals = useStore((s) => s.diagram.signals);
  const totalSteps = useStore((s) => s.diagram.config.totalSteps);
  const isDirty = useStore((s) => s.view.isDirty);
  const diagram = useStore((s) => s.diagram);

  const signalCount = countSignals(signals);

  let pointerLabel = '—';
  if (pointerHit?.signalId && pointerHit.step !== null) {
    let name = pointerHit.signalId;
    findSignal(diagram.signals, pointerHit.signalId, (s) => {
      name = s.name;
    });
    pointerLabel = `T${pointerHit.step} · ${name}`;
    if (tool === 'paint') {
      let cur: BitState | null = null;
      findSignal(diagram.signals, pointerHit.signalId, (s) => {
        if (s.type === 'bit') cur = s.states[pointerHit.step!] ?? null;
      });
      if (paintMode === 'toggle' && cur !== null) {
        pointerLabel += ` · ¬ ${cur}→${toggleBinaryBitState(cur)}`;
      } else {
        pointerLabel += ` · set ${activeBit}`;
      }
    }
  }

  const displayTool =
    tool === 'cursor' || tool === 'select' ? 'pointer' : tool;

  return (
    <footer className={styles.statusBar}>
      <span className={styles.statusPointer} title={toolHelp(tool)}>
        {pointerLabel}
      </span>
      <span className={styles.statusSep}>|</span>
      <span>{displayTool}</span>
      <span>{Math.round(zoom * 100)}%</span>
      <span>
        {signalCount} sig · {totalSteps} steps
      </span>
      {isDirty ? <span className={styles.dirty}>unsaved</span> : null}
    </footer>
  );
}
