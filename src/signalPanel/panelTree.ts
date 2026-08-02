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

export function filterSignalTree(
  items: SignalOrGroup[],
  query: string,
): SignalOrGroup[] {
  const lower = query.toLowerCase();
  const result: SignalOrGroup[] = [];
  for (const item of items) {
    if (item.type === 'group') {
      if (item.name.toLowerCase().includes(lower)) {
        result.push(item);
        continue;
      }
      const children = filterSignalTree(item.children, query);
      if (children.length > 0) result.push({ ...item, children });
    } else if (
      item.type !== 'spacer'
      && item.name.toLowerCase().includes(lower)
    ) {
      result.push(item);
    }
  }
  return result;
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
  collapsedGroupIds: readonly string[] = [],
  parentId?: string,
): VisibleRow[] {
  const rows: VisibleRow[] = [];
  for (const item of items) {
    rows.push({
      id: item.id,
      kind: item.type === 'group' ? 'group' : 'signal',
      parentId,
    });
    if (item.type === 'group' && !collapsedGroupIds.includes(item.id)) {
      rows.push(...collectVisibleRows(item.children, collapsedGroupIds, item.id));
    }
  }
  return rows;
}

/** Resolve hierarchy from the document tree, never from the currently visible rows. */
export function findParentGroupId(
  items: SignalOrGroup[],
  id: string,
  parentId?: string,
): string | undefined {
  for (const item of items) {
    if (item.id === id) return parentId;
    if (item.type === 'group') {
      const nested = findParentGroupId(item.children, id, item.id);
      if (nested !== undefined) return nested;
    }
  }
  return undefined;
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
