import {
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { LABEL_WIDTH } from '../shared/constants';
import { useStore } from '../shared/store';
import { createScrollSync, type ScrollSyncHandles } from './scrollSync';
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

export function AppLayout({
  signalPanel,
  canvas,
  codePanel,
  showCodePanel = true,
}: AppLayoutProps) {
  const panelScrollRef = useRef<HTMLDivElement | null>(null);

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

  return (
    <div className={styles.columnLayout}>
      <div className={styles.mainRow}>
        <div
          className={styles.signalPane}
          style={{ flexBasis: LABEL_WIDTH, minWidth: LABEL_WIDTH }}
        >
          {renderPane(signalPanel, paneCtx)}
        </div>
        <div className={styles.canvasPane}>{renderPane(canvas, paneCtx)}</div>
      </div>
      {showCodePanel && codePanel ? (
        <div className={styles.codeDock}>{codePanel}</div>
      ) : null}
    </div>
  );
}
