import {
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { useStore } from '../shared/store';
import { DiagramCodeProvider } from '../codePanel/useDiagramCode';
import { clampLabelColumnWidth } from './labelColumnLayout';
import { createScrollSync, type ScrollSyncHandles } from './scrollSync';
import {
  CODE_PANEL_DOCK_MIN,
  CODE_PANEL_DOCK_MAX_RATIO,
  dockSlotsForPlacement,
  useSharedSidePanelsLayout,
  type DockPanelLayout,
  type SidePanelId,
} from './codePanelLayout';
import { PanelResizeHandle } from './PanelResizeHandle';
import { FloatingCodePanel } from './FloatingCodePanel';
import { DockPanel } from './DockPanel';
import styles from './shell.module.css';

export interface AppLayoutPaneContext {
  scrollSync: ScrollSyncHandles;
  panelScrollRef: RefObject<HTMLDivElement | null>;
}

export type AppLayoutPane = ReactNode | ((ctx: AppLayoutPaneContext) => ReactNode);

export interface AppLayoutProps {
  signalPanel: AppLayoutPane;
  canvas: AppLayoutPane;
  showCodePanel?: boolean;
  showRenderPanel?: boolean;
}

function renderPane(slot: AppLayoutPane, ctx: AppLayoutPaneContext): ReactNode {
  return typeof slot === 'function' ? slot(ctx) : slot;
}

function clampDockSize(size: number, axis: 'x' | 'y'): number {
  const max = Math.floor(
    (axis === 'y' ? window.innerHeight : window.innerWidth) *
      CODE_PANEL_DOCK_MAX_RATIO,
  );
  return Math.max(CODE_PANEL_DOCK_MIN, Math.min(max, size));
}

function stackMoveProps(
  index: number,
  stackSize: number,
  panelId: SidePanelId,
  movePanelInOrder: (panelId: SidePanelId, direction: -1 | 1) => void,
) {
  if (stackSize < 2) {
    return {
      canMoveTowardCanvas: false,
      canMoveAwayFromCanvas: false,
    };
  }
  return {
    canMoveTowardCanvas: index > 0,
    canMoveAwayFromCanvas: index < stackSize - 1,
    onMoveTowardCanvas: () => movePanelInOrder(panelId, -1),
    onMoveAwayFromCanvas: () => movePanelInOrder(panelId, 1),
  };
}

export function AppLayout({
  signalPanel,
  canvas,
  showCodePanel = true,
  showRenderPanel = true,
}: AppLayoutProps) {
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const [panelsLayout, updatePanelLayout, movePanelInOrder] =
    useSharedSidePanelsLayout();
  const dockResizeBase = useRef(0);
  const labelWidth = useStore((s) => s.view.labelWidth);
  const setLabelWidth = useStore((s) => s.setLabelWidth);
  const labelResizeBase = useRef(labelWidth);

  const scrollSync = useMemo(
    () =>
      createScrollSync(
        (y) => {
          const { view, setScroll } = useStore.getState();
          setScroll(view.scrollX, y);
        },
        () => {
          /* WaveformCanvas redraws when view.scrollY changes via store subscription */
        },
      ),
    [],
  );

  const paneCtx = useMemo<AppLayoutPaneContext>(
    () => ({ scrollSync, panelScrollRef }),
    [scrollSync],
  );

  const panelVisible = useMemo(
    () => ({ json: showCodePanel, render: showRenderPanel }),
    [showCodePanel, showRenderPanel],
  );

  const rightSlots = useMemo(
    () =>
      dockSlotsForPlacement(
        panelsLayout.panelOrder,
        'right',
        panelsLayout,
        panelVisible,
      ),
    [panelsLayout, panelVisible],
  );

  const bottomSlots = useMemo(
    () =>
      dockSlotsForPlacement(
        panelsLayout.panelOrder,
        'bottom',
        panelsLayout,
        panelVisible,
      ),
    [panelsLayout, panelVisible],
  );

  const isMixedDock = rightSlots.length > 0 && bottomSlots.length > 0;

  const floatJson =
    showCodePanel && panelsLayout.json.placement === 'float';
  const floatRender =
    showRenderPanel && panelsLayout.render.placement === 'float';

  const canvasRow = (
    <div className={styles.mainRow}>
      <div
        className={styles.signalPane}
        style={{ flexBasis: labelWidth, minWidth: labelWidth, width: labelWidth }}
      >
        {renderPane(signalPanel, paneCtx)}
      </div>
      <PanelResizeHandle
        axis="x"
        onResizeStart={() => {
          labelResizeBase.current = labelWidth;
        }}
        onResizeDelta={(delta) => {
          setLabelWidth(clampLabelColumnWidth(labelResizeBase.current + delta));
        }}
        title="Resize signal name column"
      />
      <div className={styles.canvasPane}>{renderPane(canvas, paneCtx)}</div>
      {!isMixedDock
        ? rightSlots.map(({ panelId, layout }, index) => (
            <RightDockColumn
              key={panelId}
              panelId={panelId}
              layout={layout}
              onLayoutChange={(patch) => updatePanelLayout(panelId, patch)}
              stackAxis="x"
              {...stackMoveProps(
                index,
                rightSlots.length,
                panelId,
                movePanelInOrder,
              )}
            />
          ))
        : null}
    </div>
  );

  const bottomRows = bottomSlots.map(({ panelId, layout }, index) => (
    <BottomDockRow
      key={panelId}
      panelId={panelId}
      layout={layout}
      onResizeStart={() => {
        dockResizeBase.current = layout.dockSize;
      }}
      onResizeDelta={(delta) => {
        updatePanelLayout(panelId, {
          dockSize: clampDockSize(dockResizeBase.current - delta, 'y'),
        });
      }}
      onLayoutChange={(patch) => updatePanelLayout(panelId, patch)}
      stackAxis="y"
      {...stackMoveProps(
        index,
        bottomSlots.length,
        panelId,
        movePanelInOrder,
      )}
    />
  ));

  const rightColumns = rightSlots.map(({ panelId, layout }, index) => (
    <RightDockColumn
      key={panelId}
      panelId={panelId}
      layout={layout}
      fullHeight={isMixedDock}
      onLayoutChange={(patch) => updatePanelLayout(panelId, patch)}
      stackAxis="x"
      {...stackMoveProps(
        index,
        rightSlots.length,
        panelId,
        movePanelInOrder,
      )}
    />
  ));

  const dockedBody = isMixedDock ? (
    <div className={styles.workspaceRow}>
      <div className={styles.workspaceCore}>
        {canvasRow}
        {bottomRows}
      </div>
      {rightColumns}
    </div>
  ) : (
    <>
      {canvasRow}
      {bottomRows}
    </>
  );

  return (
    <DiagramCodeProvider>
      <div className={styles.columnLayout}>{dockedBody}</div>
      {floatJson ? (
        <FloatingCodePanel
          layout={panelsLayout.json}
          ariaLabel="JSON panel"
          onLayoutChange={(patch) => updatePanelLayout('json', patch)}
        >
          <DockPanel
            panelId="json"
            layout={panelsLayout.json}
            onLayoutChange={(patch) => updatePanelLayout('json', patch)}
          />
        </FloatingCodePanel>
      ) : null}
      {floatRender ? (
        <FloatingCodePanel
          layout={panelsLayout.render}
          ariaLabel="Render panel"
          onLayoutChange={(patch) => updatePanelLayout('render', patch)}
        >
          <DockPanel
            panelId="render"
            layout={panelsLayout.render}
            onLayoutChange={(patch) => updatePanelLayout('render', patch)}
          />
        </FloatingCodePanel>
      ) : null}
    </DiagramCodeProvider>
  );
}

function RightDockColumn({
  panelId,
  layout,
  fullHeight = false,
  onLayoutChange,
  stackAxis,
  canMoveTowardCanvas,
  canMoveAwayFromCanvas,
  onMoveTowardCanvas,
  onMoveAwayFromCanvas,
}: {
  panelId: SidePanelId;
  layout: DockPanelLayout;
  fullHeight?: boolean;
  onLayoutChange: (patch: Partial<DockPanelLayout>) => void;
  stackAxis?: 'x' | 'y';
  canMoveTowardCanvas?: boolean;
  canMoveAwayFromCanvas?: boolean;
  onMoveTowardCanvas?: () => void;
  onMoveAwayFromCanvas?: () => void;
}) {
  const dockResizeBase = useRef(layout.dockSize);

  return (
    <>
      <PanelResizeHandle
        axis="x"
        onResizeStart={() => {
          dockResizeBase.current = layout.dockSize;
        }}
        onResizeDelta={(delta) => {
          onLayoutChange({
            dockSize: clampDockSize(dockResizeBase.current - delta, 'x'),
          });
        }}
      />
      <div
        className={
          fullHeight
            ? `${styles.codePane} ${styles.codePaneFullHeight}`
            : styles.codePane
        }
        style={{
          flex: `0 0 ${layout.dockSize}px`,
          width: layout.dockSize,
          minWidth: 280,
          maxWidth: '72vw',
        }}
      >
        <DockPanel
          panelId={panelId}
          layout={layout}
          onLayoutChange={onLayoutChange}
          stackAxis={stackAxis}
          canMoveTowardCanvas={canMoveTowardCanvas}
          canMoveAwayFromCanvas={canMoveAwayFromCanvas}
          onMoveTowardCanvas={onMoveTowardCanvas}
          onMoveAwayFromCanvas={onMoveAwayFromCanvas}
        />
      </div>
    </>
  );
}

function BottomDockRow({
  panelId,
  layout,
  onResizeStart,
  onResizeDelta,
  onLayoutChange,
  stackAxis,
  canMoveTowardCanvas,
  canMoveAwayFromCanvas,
  onMoveTowardCanvas,
  onMoveAwayFromCanvas,
}: {
  panelId: SidePanelId;
  layout: DockPanelLayout;
  onResizeStart: () => void;
  onResizeDelta: (delta: number) => void;
  onLayoutChange: (patch: Partial<DockPanelLayout>) => void;
  stackAxis?: 'x' | 'y';
  canMoveTowardCanvas?: boolean;
  canMoveAwayFromCanvas?: boolean;
  onMoveTowardCanvas?: () => void;
  onMoveAwayFromCanvas?: () => void;
}) {
  return (
    <>
      <PanelResizeHandle
        axis="y"
        onResizeStart={onResizeStart}
        onResizeDelta={onResizeDelta}
      />
      <div
        className={styles.codeDock}
        style={{
          flex: `0 0 ${layout.dockSize}px`,
          height: layout.dockSize,
          maxHeight: '72vh',
        }}
      >
        <DockPanel
          panelId={panelId}
          layout={layout}
          onLayoutChange={onLayoutChange}
          stackAxis={stackAxis}
          canMoveTowardCanvas={canMoveTowardCanvas}
          canMoveAwayFromCanvas={canMoveAwayFromCanvas}
          onMoveTowardCanvas={onMoveTowardCanvas}
          onMoveAwayFromCanvas={onMoveAwayFromCanvas}
        />
      </div>
    </>
  );
}
