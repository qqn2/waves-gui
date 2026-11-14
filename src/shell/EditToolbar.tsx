import {
  ArrowRight,
  Activity,
  Eraser,
  Group,
  MousePointer2,
  MoveHorizontal,
  MoveVertical,
  Minus,
  Paintbrush,
  TextCursorInput,
  Plus,
  Rows3,
  ChevronsLeftRight,
} from 'lucide-react';
import { useStore } from '../shared/store';
import type { Tool } from '../shared/types';
import { EDITING_SHORTCUTS, type EditingShortcutId } from '../shared/shortcuts';
import styles from './shell.module.css';
import { runAfterSourceFlush } from '../codePanel/sourceMutationGuard';

type ToolMode = {
  id: Tool & EditingShortcutId;
  label: string;
  Icon: typeof MousePointer2;
};

const CORE_MODES: ToolMode[] = [
  { id: 'cursor', label: 'Select', Icon: MousePointer2 },
  { id: 'paint', label: 'Draw', Icon: Paintbrush },
  { id: 'erase', label: 'Erase', Icon: Eraser },
  { id: 'arrow', label: 'Edge', Icon: ArrowRight },
  { id: 'timespan', label: 'Span', Icon: MoveHorizontal },
];

const UNDULATE_MODES: ToolMode[] = [
  { id: 'analogue-paint', label: 'Analog paint', Icon: Paintbrush },
  { id: 'annotation', label: 'Text', Icon: TextCursorInput },
  { id: 'structured-arrow', label: 'Arrow', Icon: ArrowRight },
  { id: 'vertical-line', label: 'V line', Icon: MoveVertical },
  { id: 'horizontal-line', label: 'H line', Icon: Minus },
  { id: 'global-compression', label: 'Compress', Icon: ChevronsLeftRight },
];

export function EditToolbar() {
  const tool = useStore((s) => s.view.selectedTool);
  const setTool = useStore((s) => s.setTool);
  const addSignal = useStore((s) => s.addSignal);
  const setActiveSignalIds = useStore((s) => s.setActiveSignalIds);
  const addGroup = useStore((s) => s.addGroup);
  const extensionsEnabled = useStore(
    (s) => s.diagram.compatibility?.extensionsEnabled === true,
  );
  const addAnalogueSignal = () => {
    if (!runAfterSourceFlush(() => addSignal('analogue'))) return;
    const added = useStore.getState().diagram.signals.at(-1);
    if (added && added.type !== 'group') setActiveSignalIds([added.id]);
  };

  return (
    <nav className={styles.editRail} aria-label="Waveform editing tools">
      <div className={styles.editRailGroup} role="group" aria-label="Tools">
        <span className={styles.editRailLabel}>Tools</span>
        {CORE_MODES.map(({ id, label, Icon }) => {
          const active = id === 'cursor'
            ? tool === 'cursor' || tool === 'select'
            : tool === id;
          return (
            <button
              key={id}
              type="button"
              className={`${styles.railBtn} ${active ? styles.railBtnActive : ''}`}
              aria-pressed={active}
              title={`${label} (${EDITING_SHORTCUTS[id].label})`}
              onClick={() => setTool(id)}
            >
              <Icon size={21} strokeWidth={1.8} aria-hidden />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.editRailGroup} role="group" aria-label="Insert">
        <span className={styles.editRailLabel}>Insert</span>
        <button type="button" className={styles.railBtn} onClick={() => runAfterSourceFlush(() => addSignal('bit'))}>
          <Plus size={21} strokeWidth={1.8} aria-hidden />
          <span>Signal</span>
        </button>
        <button type="button" className={styles.railBtn} onClick={() => runAfterSourceFlush(() => addSignal('vector'))}>
          <Rows3 size={21} strokeWidth={1.8} aria-hidden />
          <span>Bus</span>
        </button>
        <button type="button" className={styles.railBtn} onClick={() => runAfterSourceFlush(() => addGroup())}>
          <Group size={21} strokeWidth={1.8} aria-hidden />
          <span>Group</span>
        </button>
      </div>

      {extensionsEnabled && (
        <div className={styles.editRailGroup} role="group" aria-label="Undulate">
          <span className={styles.editRailLabel}>Undulate</span>
          <button
            type="button"
            className={styles.railBtn}
            title="Add an analogue signal and open it in the Inspector"
            onClick={addAnalogueSignal}
          >
            <Activity size={21} strokeWidth={1.8} aria-hidden />
            <span>Add analog</span>
          </button>
          {UNDULATE_MODES.map(({ id, label, Icon }) => {
            const active = tool === id;
            return (
              <button
                key={id}
                type="button"
                className={`${styles.railBtn} ${active ? styles.railBtnActive : ''}`}
                aria-pressed={active}
                title={`${label} (${EDITING_SHORTCUTS[id].label})`}
                onClick={() => setTool(id)}
              >
                <Icon size={21} strokeWidth={1.8} aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
