import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { Search, X } from 'lucide-react';
import { useStore } from '../shared/store';
import { getSignalRowsTopInsetPx } from '../renderer/renderHeadFoot';
import { countSignals } from '../shell/statusUtils';
import type { Signal, SignalOrGroup } from '../shared/types';
import type { ScrollSyncHandles } from './scrollSyncTypes';
import { SignalRow } from './SignalRow';
import { GroupRow } from './GroupRow';
import { GroupContextMenu } from './GroupContextMenu';
import { SignalContextMenu } from './SignalContextMenu';
import {
  collectAllGroups,
  collectVisibleRows,
  findParentGroupId,
  filterSignalTree,
  getSiblingIds,
  reorderSiblingIds,
} from './panelTree';
import styles from './SignalPanel.module.css';


export type { ScrollSyncHandles } from './scrollSyncTypes';

export interface SignalPanelProps {
  scrollSync: ScrollSyncHandles;
  panelScrollRef: RefObject<HTMLDivElement | null>;
}

interface DragState {
  id: string;
  parentId?: string;
}

function renderTree(
  items: SignalOrGroup[],
  zoom: number,
  depth: number,
  activeIds: string[],
  collapsedGroupIds: readonly string[],
  dropTargetId: string | null,
  dragHandlers: {
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent, id: string) => void;
    onDrop: (e: React.DragEvent, id: string) => void;
    onOpenMenu: (signal: Signal, anchor: { x: number; y: number }) => void;
    onOpenGroupMenu: (
      group: Extract<SignalOrGroup, { type: 'group' }>,
      anchor: { x: number; y: number },
    ) => void;
    onSelect: (id: string) => void;
  },
  renameId: string | null,
  onEditEnd: () => void,
): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  for (const item of items) {
    if (item.type === 'group') {
      nodes.push(
        <GroupRow
          key={item.id}
          group={item}
          collapsed={collapsedGroupIds.includes(item.id)}
          zoom={zoom}
          depth={depth}
          dropHighlight={dropTargetId === item.id}
          {...dragHandlers}
          onOpenMenu={dragHandlers.onOpenGroupMenu}
          forceEdit={renameId === item.id}
          onEditEnd={onEditEnd}
        />,
      );
      if (!collapsedGroupIds.includes(item.id)) {
        nodes.push(
          ...renderTree(
            item.children,
            zoom,
            depth + 1,
            activeIds,
            collapsedGroupIds,
            dropTargetId,
            dragHandlers,
            renameId,
            onEditEnd,
          ),
        );
      }
    } else {
      nodes.push(
        <SignalRow
          key={item.id}
          signal={item}
          zoom={zoom}
          depth={depth}
          selected={activeIds.includes(item.id)}
          dropHighlight={dropTargetId === item.id}
          forceEdit={renameId === item.id}
          onEditEnd={onEditEnd}
          {...dragHandlers}
        />,
      );
    }
  }
  return nodes;
}

export function SignalPanel({ scrollSync, panelScrollRef }: SignalPanelProps) {
  const signals = useStore((s) => s.diagram.signals);
  const zoom = useStore((s) => s.view.zoom);
  const scrollY = useStore((s) => s.view.scrollY);
  const config = useStore((s) => s.diagram.config);
  const totalSteps = config.totalSteps;
  const signalRowsTopInset = getSignalRowsTopInsetPx(config);
  const activeIds = useStore((s) => s.view.activeSignalIds);
  const collapsedGroupIds = useStore((s) => s.view.collapsedGroupIds);
  const addSignal = useStore((s) => s.addSignal);
  const duplicateSignal = useStore((s) => s.duplicateSignal);
  const addGroup = useStore((s) => s.addGroup);
  const removeSignal = useStore((s) => s.removeSignal);
  const reorderSignals = useStore((s) => s.reorderSignals);
  const moveSignalToParent = useStore((s) => s.moveSignalToParent);
  const labelWidth = useStore((s) => s.view.labelWidth);
  const setSignalStateRange = useStore((s) => s.setSignalStateRange);
  const setActiveSignalIds = useStore((s) => s.setActiveSignalIds);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [menuSignal, setMenuSignal] = useState<Signal | null>(null);
  const [menuGroup, setMenuGroup] = useState<
    Extract<SignalOrGroup, { type: 'group' }> | null
  >(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const addMenuRef = useRef<HTMLDivElement>(null);
  const filterInputRef = useRef<HTMLInputElement>(null);

  const filteredSignals = useMemo(() =>
    filterText.trim() ? filterSignalTree(signals, filterText) : signals,
  [signals, filterText]);
  const visibleRows = useMemo(
    () => collectVisibleRows(
      filteredSignals,
      filterText.trim() ? [] : collapsedGroupIds,
    ),
    [collapsedGroupIds, filterText, filteredSignals],
  );

  const scrollRef = panelScrollRef;

  useEffect(() => {
    scrollSync.signalPanelEl = scrollRef.current;
    return () => {
      scrollSync.signalPanelEl = null;
    };
  }, [scrollSync, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (Math.abs(el.scrollTop - scrollY) > 1) {
      el.scrollTop = scrollY;
    }
  }, [scrollY, scrollRef]);

  useEffect(() => {
    if (!addOpen) return;
    const close = (e: MouseEvent) => {
      if (addMenuRef.current?.contains(e.target as Node)) return;
      setAddOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [addOpen]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (el) scrollSync.applyPanelScrollY(el.scrollTop);
  };

  const parentForId = useCallback(
    (id: string): string | undefined => findParentGroupId(signals, id),
    [signals],
  );

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDrag({ id, parentId: parentForId(id) });
    setDropTargetId(null);
  };

  const onDragEnd = () => {
    setDrag(null);
    setDropTargetId(null);
  };

  const onDragOver = (e: React.DragEvent, targetId: string) => {
    if (!drag || drag.id === targetId) return;
    const dragRow = visibleRows.find((r) => r.id === drag.id);
    const targetRow = visibleRows.find((r) => r.id === targetId);
    if (!dragRow || !targetRow) return;
    if (dragRow.kind === 'group' && parentForId(targetId) !== drag.parentId) {
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetId);
  };

  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!drag) return;
    const dragRow = visibleRows.find((r) => r.id === drag.id);
    const targetRow = visibleRows.find((r) => r.id === targetId);
    if (!dragRow || !targetRow) return;

    if (dragRow.kind === 'signal') {
      if (targetRow.kind === 'group') {
        moveSignalToParent(drag.id, targetId);
        onDragEnd();
        return;
      }
      const targetParent = targetRow.parentId;
      if (drag.parentId !== targetParent) {
        moveSignalToParent(drag.id, targetParent, targetId);
        onDragEnd();
        return;
      }
    }

    const parentId = drag.parentId;
    if (parentForId(targetId) !== parentId) {
      onDragEnd();
      return;
    }
    const siblings = getSiblingIds(signals, parentId);
    if (!siblings) return;
    const ordered = reorderSiblingIds(siblings, drag.id, targetId);
    if (ordered) reorderSignals(ordered, parentId);
    onDragEnd();
  };

  const closeMenu = () => {
    setMenuSignal(null);
    setMenuGroup(null);
    setMenuAnchor(null);
  };

  const menuSignalId = menuSignal?.id;
  const sectionOptions = useMemo(() => collectAllGroups(signals), [signals]);
  const menuParentId = menuSignalId
    ? findParentGroupId(signals, menuSignalId)
    : undefined;
  return (
    <div
      className={styles.panel}
      style={{ width: labelWidth, minWidth: labelWidth }}
      aria-label="Signals panel"
    >
      <div className={styles.panelHeader}>
        <strong>Signals</strong>
        <span>{countSignals(signals)} signals</span>
      </div>
      <div className={styles.filterBar}>
        <Search className={styles.filterIcon} size={12} aria-hidden />
        <input
          ref={filterInputRef}
          type="text"
          className={styles.filterInput}
          placeholder="Filter signals…"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          aria-label="Filter signals and sections by name"
          spellCheck={false}
        />
        {filterText && (
          <button
            type="button"
            className={styles.filterClear}
            onClick={() => { setFilterText(''); filterInputRef.current?.focus(); }}
            aria-label="Clear filter"
          >
            <X size={12} aria-hidden />
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className={styles.scroll}
        onScroll={onScroll}
      >
        <div
          className={styles.scrollInner}
          style={{ paddingTop: signalRowsTopInset }}
        >
        {renderTree(
          filteredSignals,
          zoom,
          0,
          activeIds,
          filterText.trim() ? [] : collapsedGroupIds,
          dropTargetId,
          {
            onDragStart,
            onDragEnd,
            onDragOver,
            onDrop,
            onOpenMenu: (signal, anchor) => {
              setMenuSignal(signal);
              setMenuGroup(null);
              setMenuAnchor(anchor);
            },
            onOpenGroupMenu: (group, anchor) => {
              setMenuGroup(group);
              setMenuSignal(null);
              setMenuAnchor(anchor);
            },
            onSelect: (id) => setActiveSignalIds([id]),
          },
          renameId,
          () => setRenameId(null),
        )}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.addWrap} ref={addMenuRef}>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setAddOpen((o) => !o)}
            aria-expanded={addOpen}
          >
            + Add signal
          </button>
          {addOpen && (
            <div className={styles.addDropdown} role="menu">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  addSignal('bit');
                  setAddOpen(false);
                }}
              >
                Bit signal
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  addSignal('vector');
                  setAddOpen(false);
                }}
              >
                Vector signal
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  addSignal('spacer');
                  setAddOpen(false);
                }}
              >
                Blank row
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  addGroup();
                  setAddOpen(false);
                }}
              >
                Section (group)
              </button>
            </div>
          )}
        </div>
      </div>

      <SignalContextMenu
        anchor={menuAnchor}
        signal={menuSignal}
        onClose={closeMenu}
        onRename={() => {
          if (menuSignalId) setRenameId(menuSignalId);
          closeMenu();
        }}
        onDelete={() => {
          if (menuSignalId) removeSignal(menuSignalId);
          closeMenu();
        }}
        onDuplicate={() => {
          if (menuSignalId) duplicateSignal(menuSignalId);
          closeMenu();
        }}
        onAddAbove={(type) => {
          if (menuSignalId) {
            const parentId = parentForId(menuSignalId);
            addSignal(type, { parentId, beforeId: menuSignalId });
          }
          closeMenu();
        }}
        onAddBelow={(type) => {
          if (menuSignalId) {
            addSignal(type, {
              parentId: parentForId(menuSignalId),
              afterId: menuSignalId,
            });
          }
          closeMenu();
        }}
        onSetAll={(state) => {
          if (menuSignalId && menuSignal?.type === 'bit') {
            setSignalStateRange(
              menuSignalId,
              0,
              totalSteps - 1,
              state,
            );
          }
          closeMenu();
        }}
        parentGroupId={menuParentId}
        groups={sectionOptions}
        onMoveToGroup={(groupId) => {
          if (menuSignalId) moveSignalToParent(menuSignalId, groupId);
          closeMenu();
        }}
        onRemoveFromGroup={() => {
          if (menuSignalId) moveSignalToParent(menuSignalId, undefined);
          closeMenu();
        }}
      />
      <GroupContextMenu
        anchor={menuAnchor}
        group={menuGroup}
        onClose={closeMenu}
        onRename={() => {
          if (menuGroup) setRenameId(menuGroup.id);
          closeMenu();
        }}
        onDelete={() => {
          if (menuGroup) removeSignal(menuGroup.id);
          closeMenu();
        }}
      />
    </div>
  );
}
