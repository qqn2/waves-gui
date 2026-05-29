import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { LABEL_WIDTH } from '../shared/constants';
import { useStore } from '../shared/store';
import { createScrollSync, type ScrollSyncHandles } from './scrollSync';
import styles from './shell.module.css';

const DEFAULT_CODE_PANEL_WIDTH = 400;
const MIN_CODE_PANEL_WIDTH = 280;

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
  showCodePanel = false,
}: AppLayoutProps) {
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const [codePanelWidth, setCodePanelWidth] = useState(DEFAULT_CODE_PANEL_WIDTH);

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

  const onResizePointerDown = useCallback((e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = codePanelWidth;

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const delta = startX - moveEvent.clientX;
      setCodePanelWidth(Math.max(MIN_CODE_PANEL_WIDTH, startWidth + delta));
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [codePanelWidth]);

  return (
    <div className={styles.appLayout}>
      <div className={styles.signalPane} style={{ flexBasis: LABEL_WIDTH, minWidth: LABEL_WIDTH }}>
        {renderPane(signalPanel, paneCtx)}
      </div>
      <div className={styles.canvasPane}>{renderPane(canvas, paneCtx)}</div>
      {showCodePanel && codePanel ? (
        <>
          <div
            className={styles.resizeHandle}
            role="separator"
            aria-orientation="vertical"
            onPointerDown={onResizePointerDown}
          />
          <div
            className={styles.codePane}
            style={{ flexBasis: codePanelWidth, minWidth: MIN_CODE_PANEL_WIDTH }}
          >
            {codePanel}
          </div>
        </>
      ) : null}
    </div>
  );
}
