import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { useStore } from '../shared/store';
import { LABEL_WIDTH } from '../shared/constants';
import type { Signal, SignalOrGroup } from '../shared/types';
import type { ScrollSyncHandles } from './scrollSyncTypes';
import { SignalRow } from './SignalRow';
import { GroupRow } from './GroupRow';
import { SignalContextMenu } from './SignalContextMenu';
import {
  collectVisibleRows,
  getSiblingIds,
  reorderSiblingIds,
} from './panelTree';
import styles from './SignalPanel.module.css';

const VECTOR_ADD_DISABLED_TITLE =
  'Vector editing coming later — use JSON/code panel for buses';

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
  dropTargetId: string | null,
  dragHandlers: {
    onDragStart: (e: React.DragEvent, id: string) => void;
    onDragEnd: () => void;
    onDragOver: (e: React.DragEvent, id: string) => void;
    onDrop: (e: React.DragEvent, id: string) => void;
    onOpenMenu: (signal: Signal, anchor: { x: number; y: number }) => void;
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
          zoom={zoom}
          depth={depth}
          dropHighlight={dropTargetId === item.id}
          {...dragHandlers}
        />,
      );
      if (!item.collapsed) {
        nodes.push(
          ...renderTree(
            item.children,
            zoom,
            depth + 1,
            activeIds,
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
  const totalSteps = useStore((s) => s.diagram.config.totalSteps);
  const activeIds = useStore((s) => s.view.activeSignalIds);
  const addSignal = useStore((s) => s.addSignal);
  const removeSignal = useStore((s) => s.removeSignal);
  const reorderSignals = useStore((s) => s.reorderSignals);
  const setSignalStateRange = useStore((s) => s.setSignalStateRange);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [menuSignal, setMenuSignal] = useState<Signal | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [addOpen, setAddOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const addMenuRef = useRef<HTMLDivElement>(null);

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
    (id: string): string | undefined => {
      const rows = collectVisibleRows(signals);
      return rows.find((r) => r.id === id)?.parentId;
    },
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
    if (parentForId(targetId) !== drag.parentId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetId);
  };

  const onDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!drag) return;
    const parentId = drag.parentId;
    if (parentForId(targetId) !== parentId) return;
    const siblings = getSiblingIds(signals, parentId);
    if (!siblings) return;
    const ordered = reorderSiblingIds(siblings, drag.id, targetId);
    if (ordered) reorderSignals(ordered, parentId);
    onDragEnd();
  };

  const closeMenu = () => {
    setMenuSignal(null);
    setMenuAnchor(null);
  };

  const menuSignalId = menuSignal?.id;

  return (
    <div className={styles.panel} style={{ width: LABEL_WIDTH }}>
      <div
        ref={scrollRef}
        className={styles.scroll}
        onScroll={onScroll}
      >
        {renderTree(
          signals,
          zoom,
          0,
          activeIds,
          dropTargetId,
          {
            onDragStart,
            onDragEnd,
            onDragOver,
            onDrop,
            onOpenMenu: (signal, anchor) => {
              setMenuSignal(signal);
              setMenuAnchor(anchor);
            },
          },
          renameId,
          () => setRenameId(null),
        )}
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
                disabled
                title={VECTOR_ADD_DISABLED_TITLE}
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
          closeMenu();
        }}
        onAddAbove={(type) => {
          if (menuSignalId) {
            const parentId = parentForId(menuSignalId);
            const siblings = getSiblingIds(signals, parentId);
            const idx = siblings?.indexOf(menuSignalId) ?? -1;
            if (idx <= 0) addSignal(type);
            else addSignal(type, siblings![idx - 1]!);
          }
          closeMenu();
        }}
        onAddBelow={(type) => {
          if (menuSignalId) addSignal(type, menuSignalId);
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
      />
    </div>
  );
}
