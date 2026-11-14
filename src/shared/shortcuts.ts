import type { BitState, PaintMode, Tool } from './types';

interface EditingShortcut {
  key: string;
  shift?: boolean;
  label: string;
  description: string;
  tool: Tool;
  paintMode?: PaintMode;
  extensionsOnly?: boolean;
}

/** One definition for keyboard dispatch, tooltips, and the Help table. */
export const EDITING_SHORTCUTS = {
  cursor: { key: 'v', label: 'V', description: 'Select tool', tool: 'cursor' },
  paint: { key: 'd', shift: false, label: 'D', description: 'Draw tool', tool: 'paint' },
  erase: { key: 'e', label: 'E', description: 'Erase tool', tool: 'erase' },
  arrow: { key: 'a', shift: false, label: 'A', description: 'Edge tool', tool: 'arrow' },
  timespan: { key: 't', shift: false, label: 'T', description: 'Span tool', tool: 'timespan' },
  'analogue-paint': { key: 'd', shift: true, label: 'Shift+D', description: 'Undulate analogue painter', tool: 'analogue-paint', extensionsOnly: true },
  annotation: { key: 'i', label: 'I', description: 'Undulate text annotation', tool: 'annotation', extensionsOnly: true },
  'structured-arrow': { key: 'a', shift: true, label: 'Shift+A', description: 'Undulate annotation arrow', tool: 'structured-arrow', extensionsOnly: true },
  'vertical-line': { key: 'l', shift: false, label: 'L', description: 'Undulate vertical guide', tool: 'vertical-line', extensionsOnly: true },
  'horizontal-line': { key: 'l', shift: true, label: 'Shift+L', description: 'Undulate horizontal guide', tool: 'horizontal-line', extensionsOnly: true },
  'global-compression': { key: 'c', shift: true, label: 'Shift+C', description: 'Undulate time compression', tool: 'global-compression', extensionsOnly: true },
  glitch: { key: 'g', label: 'G', description: 'Draw a glitch', tool: 'paint', paintMode: 'glitch' },
  gap: { key: '|', label: '|', description: 'Draw a timeline gap', tool: 'paint', paintMode: 'gap' },
  invert: { key: 't', shift: true, label: 'Shift+T', description: 'Invert waveform values', tool: 'paint', paintMode: 'toggle' },
} as const satisfies Record<string, EditingShortcut>;

export type EditingShortcutId = keyof typeof EDITING_SHORTCUTS;

type ShortcutEvent = Pick<KeyboardEvent, 'key' | 'shiftKey' | 'ctrlKey' | 'metaKey' | 'altKey' | 'isComposing'>;

export const PAINT_VALUE_SHORTCUTS: ReadonlyArray<{
  keys: readonly string[];
  label: string;
  value: BitState;
}> = [
  { keys: ['1'], label: '1', value: '1' },
  { keys: ['0'], label: '0', value: '0' },
  { keys: ['p'], label: 'p', value: 'p' },
  { keys: ['P'], label: 'P', value: 'P' },
  { keys: ['n'], label: 'n', value: 'n' },
  { keys: ['N'], label: 'N', value: 'N' },
  { keys: ['z', 'Z'], label: 'Z', value: 'z' },
  { keys: ['x', 'X'], label: 'X', value: 'x' },
  { keys: ['u', 'U'], label: 'U', value: 'u' },
  { keys: ['.'], label: '.', value: '.' },
];

export function paintValueForEvent(event: ShortcutEvent): BitState | undefined {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  return PAINT_VALUE_SHORTCUTS.find(({ keys }) => keys.includes(event.key))?.value;
}

export function editingShortcutForEvent(
  event: ShortcutEvent,
  extensionsEnabled: boolean,
): EditingShortcut | undefined {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
  return (Object.values(EDITING_SHORTCUTS) as EditingShortcut[]).find((shortcut) => (
    event.key.toLowerCase() === shortcut.key
    && (shortcut.shift === undefined || event.shiftKey === shortcut.shift)
    && (!shortcut.extensionsOnly || extensionsEnabled)
  ));
}
