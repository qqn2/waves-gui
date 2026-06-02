import {
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { useStore } from '../shared/store';
import { clampLabelColumnWidth } from './labelColumnLayout';
import { createScrollSync, type ScrollSyncHandles } from './scrollSync';
import {
  CODE_PANEL_DOCK_MIN,
  CODE_PANEL_DOCK_MAX_RATIO,
  useCodePanelLayout,
} from './codePanelLayout';
import { PanelResizeHandle } from './PanelResizeHandle';
import { CodePanelChrome } from './CodePanelChrome';
import { FloatingCodePanel } from './FloatingCodePanel';
import type { CodePanelPlacement } from './codePanelLayout';
import styles from './shell.module.css';

export interface AppLayoutPaneContext {
  scrollSync: ScrollSyncHandles;
  panelScrollRef: RefObject<HTMLDivElement | null>;
}

export type AppLayoutPane = ReactNode | ((ctx: AppLayoutPaneContext) => ReactNode);

export interface AppLayoutProps {
  signalPanel: AppLayoutPane;
  canvas: AppLayoutPane;
  codePanel?: ReactNode;
  showCodePanel?: boolean;
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

export function AppLayout({
  signalPanel,
  canvas,
  codePanel,
  showCodePanel = true,
}: AppLayoutProps) {
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const [codeLayout, updateCodeLayout] = useCodePanelLayout();
  const dockResizeBase = useRef(codeLayout.dockSize);
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

  const onPlacementChange = (placement: CodePanelPlacement) => {
    updateCodeLayout({ placement });
  };

  const dockedCode =
    showCodePanel && codePanel ? (
      <div className={styles.codePanelStack}>
        <CodePanelChrome layout={codeLayout} onPlacementChange={onPlacementChange} />
        <div className={styles.codePanelBody}>{codePanel}</div>
      </div>
    ) : null;

  const mainRow = (
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
      {showCodePanel &&
      codePanel &&
      codeLayout.placement === 'right' ? (
        <>
          <PanelResizeHandle
            axis="x"
            onResizeStart={() => {
              dockResizeBase.current = codeLayout.dockSize;
            }}
            onResizeDelta={(delta) => {
              updateCodeLayout({
                dockSize: clampDockSize(dockResizeBase.current + delta, 'x'),
              });
            }}
          />
          <div
            className={styles.codePane}
            style={{
              flex: `0 0 ${codeLayout.dockSize}px`,
              width: codeLayout.dockSize,
              maxWidth: '72vw',
            }}
          >
            {dockedCode}
          </div>
        </>
      ) : null}
    </div>
  );

  if (showCodePanel && codePanel && codeLayout.placement === 'float') {
    return (
      <>
        <div className={styles.columnLayout}>{mainRow}</div>
        <FloatingCodePanel layout={codeLayout} onLayoutChange={updateCodeLayout}>
          {codePanel}
        </FloatingCodePanel>
      </>
    );
  }

  if (showCodePanel && codePanel && codeLayout.placement === 'right') {
    return <div className={styles.columnLayout}>{mainRow}</div>;
  }

  if (showCodePanel && codePanel && codeLayout.placement === 'bottom') {
    return (
      <div className={styles.columnLayout}>
        {mainRow}
        <PanelResizeHandle
          axis="y"
          onResizeStart={() => {
            dockResizeBase.current = codeLayout.dockSize;
          }}
          onResizeDelta={(delta) => {
            updateCodeLayout({
              dockSize: clampDockSize(dockResizeBase.current - delta, 'y'),
            });
          }}
        />
        <div
          className={styles.codeDock}
          style={{
            flex: `0 0 ${codeLayout.dockSize}px`,
            height: codeLayout.dockSize,
            maxHeight: '72vh',
          }}
        >
          {dockedCode}
        </div>
      </div>
    );
  }

  return <div className={styles.columnLayout}>{mainRow}</div>;
}
