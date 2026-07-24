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
import styles from './shell.module.css';

type ToolMode = {
  id: Tool;
  label: string;
  shortcut: string;
  Icon: typeof MousePointer2;
};

const CORE_MODES: ToolMode[] = [
  { id: 'cursor', label: 'Select', shortcut: 'V', Icon: MousePointer2 },
  { id: 'paint', label: 'Draw', shortcut: 'D', Icon: Paintbrush },
  { id: 'erase', label: 'Erase', shortcut: 'E', Icon: Eraser },
  { id: 'arrow', label: 'Edge', shortcut: 'A', Icon: ArrowRight },
  { id: 'timespan', label: 'Span', shortcut: 'T', Icon: MoveHorizontal },
];

const UNDULATE_MODES: ToolMode[] = [
  { id: 'annotation', label: 'Text', shortcut: 'I', Icon: TextCursorInput },
  { id: 'vertical-line', label: 'V line', shortcut: 'L', Icon: MoveVertical },
  { id: 'horizontal-line', label: 'H line', shortcut: 'Shift+L', Icon: Minus },
  { id: 'global-compression', label: 'Compress', shortcut: 'Shift+C', Icon: ChevronsLeftRight },
];

export function EditToolbar() {
  const tool = useStore((s) => s.view.selectedTool);
  const setTool = useStore((s) => s.setTool);
  const addSignal = useStore((s) => s.addSignal);
  const addGroup = useStore((s) => s.addGroup);
  const extensionsEnabled = useStore(
    (s) => s.diagram.compatibility?.extensionsEnabled === true,
  );

  return (
    <nav className={styles.editRail} aria-label="Waveform editing tools">
      <div className={styles.editRailGroup} role="group" aria-label="Tools">
        <span className={styles.editRailLabel}>Tools</span>
        {CORE_MODES.map(({ id, label, shortcut, Icon }) => {
          const active = id === 'cursor'
            ? tool === 'cursor' || tool === 'select'
            : tool === id;
          return (
            <button
              key={id}
              type="button"
              className={`${styles.railBtn} ${active ? styles.railBtnActive : ''}`}
              aria-pressed={active}
              title={`${label} (${shortcut})`}
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
        <button type="button" className={styles.railBtn} onClick={() => addSignal('bit')}>
          <Plus size={21} strokeWidth={1.8} aria-hidden />
          <span>Signal</span>
        </button>
        <button type="button" className={styles.railBtn} onClick={() => addSignal('vector')}>
          <Rows3 size={21} strokeWidth={1.8} aria-hidden />
          <span>Bus</span>
        </button>
        <button type="button" className={styles.railBtn} onClick={() => addGroup()}>
          <Group size={21} strokeWidth={1.8} aria-hidden />
          <span>Group</span>
        </button>
      </div>

      {extensionsEnabled && (
        <div className={styles.editRailGroup} role="group" aria-label="Undulate">
          <span className={styles.editRailLabel}>Undulate</span>
          {UNDULATE_MODES.map(({ id, label, shortcut, Icon }) => {
            const active = tool === id;
            return (
              <button
                key={id}
                type="button"
                className={`${styles.railBtn} ${active ? styles.railBtnActive : ''}`}
                aria-pressed={active}
                title={`${label} (${shortcut})`}
                onClick={() => setTool(id)}
              >
                <Icon size={21} strokeWidth={1.8} aria-hidden />
                <span>{label}</span>
              </button>
            );
          })}
          <button
            type="button"
            className={styles.railBtn}
            onClick={() => addSignal('analogue')}
          >
            <Activity size={21} strokeWidth={1.8} aria-hidden />
            <span>Analog</span>
          </button>
        </div>
      )}
    </nav>
  );
}
