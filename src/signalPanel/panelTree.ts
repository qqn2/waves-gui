import type { SignalGroup, SignalOrGroup } from '../shared/types';

export interface VisibleRow {
  id: string;
  kind: 'signal' | 'group';
  parentId?: string;
}

export interface GroupRef {
  id: string;
  name: string;
  depth: number;
}

/** All section (group) headers for "move to section" menus. */
export function collectAllGroups(
  items: SignalOrGroup[],
  depth = 0,
): GroupRef[] {
  const out: GroupRef[] = [];
  for (const item of items) {
    if (item.type === 'group') {
      out.push({ id: item.id, name: item.name || 'Section', depth });
      out.push(...collectAllGroups(item.children, depth + 1));
    }
  }
  return out;
}

export function collectVisibleRows(
  items: SignalOrGroup[],
  parentId?: string,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  for (const item of items) {
    rows.push({
      id: item.id,
      kind: item.type === 'group' ? 'group' : 'signal',
      parentId,
    });
    if (item.type === 'group' && !item.collapsed) {
      rows.push(...collectVisibleRows(item.children, item.id));
    }
  }
  return rows;
}

export function getSiblingIds(
  signals: SignalOrGroup[],
  parentId?: string,
): string[] | null {
  if (parentId === undefined) {
    return signals.map((sg) => sg.id);
  }
  const group = findGroupById(signals, parentId);
  if (!group) return null;
  return group.children.map((sg) => sg.id);
}

export function findGroupById(
  signals: SignalOrGroup[],
  id: string,
): SignalGroup | null {
  for (const sg of signals) {
    if (sg.type === 'group') {
      if (sg.id === id) return sg;
      const nested = findGroupById(sg.children, id);
      if (nested) return nested;
    }
  }
  return null;
}

export function reorderSiblingIds(
  siblingIds: string[],
  draggedId: string,
  targetId: string,
): string[] | null {
  const from = siblingIds.indexOf(draggedId);
  const to = siblingIds.indexOf(targetId);
  if (from === -1 || to === -1 || from === to) return null;
  const next = [...siblingIds];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved!);
  return next;
}

/** Toggle group.collapsed in-place (no store action yet). */
export function toggleGroupCollapsedInStore(
  setState: (fn: (state: { diagram: { signals: SignalOrGroup[] }; view: { isDirty: boolean } }) => void) => void,
  groupId: string,
): void {
  setState((s) => {
    const walk = (items: SignalOrGroup[]): boolean => {
      for (const item of items) {
        if (item.type === 'group') {
          if (item.id === groupId) {
            item.collapsed = !item.collapsed;
            return true;
          }
          if (walk(item.children)) return true;
        }
      }
      return false;
    };
    if (walk(s.diagram.signals)) s.view.isDirty = true;
  });
}

export function renameGroupInStore(
  setState: (fn: (state: { diagram: { signals: SignalOrGroup[] }; view: { isDirty: boolean } }) => void) => void,
  groupId: string,
  name: string,
): void {
  setState((s) => {
    const walk = (items: SignalOrGroup[]): boolean => {
      for (const item of items) {
        if (item.type === 'group') {
          if (item.id === groupId) {
            item.name = name;
            return true;
          }
          if (walk(item.children)) return true;
        }
      }
      return false;
    };
    if (walk(s.diagram.signals)) s.view.isDirty = true;
  });
}
