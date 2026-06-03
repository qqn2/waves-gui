import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppLayout,
  StatusBar,
  Toolbar,
  type AppLayoutPaneContext,
} from './shell';
import { SignalPanel } from './signalPanel';
import {
  WaveformCanvas,
  PointerMarker,
  EdgeOverlay,
  EdgeToolOverlay,
} from './renderer';
import type { HitTestResult } from './renderer';
import { useToolHandler } from './tools';
import { ExportDialog } from './exportEngine';
import { useStore } from './shared/store';
import { applyThemeSettings, themeSettingsFromView } from './shared/theme';
import { useSoloDeskPersistence } from './shell/soloDesk';
import { CodePanelLayoutProvider } from './shell/codePanelLayout';
import { HeadFootFields } from './shell/HeadFootFields';
import { SignalTimingBar } from './shell/SignalTimingBar';
import './App.css';

function IntegratedCanvas({
  scrollSync,
  onHoverHit,
}: {
  scrollSync: AppLayoutPaneContext['scrollSync'];
  onHoverHit: (hit: HitTestResult | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
    selectionOverlay,
  } = useToolHandler(canvasRef);

  const onPointerEvent = useCallback(
    (phase: 'down' | 'move' | 'up', e: PointerEvent, hit: HitTestResult) => {
      if (phase === 'move') onHoverHit(hit.signalId ? hit : null);
      if (phase === 'down') onPointerDown(e, hit);
      else if (phase === 'move') onPointerMove(e, hit);
      else onPointerUp(e, hit);
    },
    [onHoverHit, onPointerDown, onPointerMove, onPointerUp],
  );

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const leave = () => onHoverHit(null);
    el.addEventListener('pointerleave', leave);
    return () => el.removeEventListener('pointerleave', leave);
  }, [onHoverHit]);

  return (
    <div ref={wrapRef} className="canvasWrap">
      <WaveformCanvas
        canvasRef={canvasRef}
        scrollSync={scrollSync}
        onPointerEvent={onPointerEvent}
        onContextMenu={onContextMenu}
      />
      {selectionOverlay ? (
        <div
          className="selectionOverlay"
          style={{
            left: selectionOverlay.left,
            top: selectionOverlay.top,
            width: selectionOverlay.width,
            height: selectionOverlay.height,
          }}
        />
      ) : null}
    </div>
  );
}

function CanvasWithMarker({
  scrollSync,
  onHoverHit,
}: {
  scrollSync: AppLayoutPaneContext['scrollSync'];
  onHoverHit: (hit: HitTestResult | null) => void;
}) {
  const [hoverHit, setHoverHit] = useState<HitTestResult | null>(null);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);

  const handleHover = useCallback(
    (hit: HitTestResult | null) => {
      setHoverHit(hit);
      onHoverHit(hit);
    },
    [onHoverHit],
  );

  const displayHit = view.paintDraft ? null : hoverHit;
  const edgeTool =
    view.selectedTool === 'arrow' || view.selectedTool === 'timespan'
      ? view.selectedTool
      : null;

  return (
    <div
      className="canvasWrapOuter"
      data-edge-tool={edgeTool ?? undefined}
    >
      <IntegratedCanvas scrollSync={scrollSync} onHoverHit={handleHover} />
      <PointerMarker
        hit={displayHit}
        diagram={diagram}
        view={view}
        tool={view.selectedTool}
        edgePending={view.edgeAnchorPending}
      />
      <EdgeToolOverlay />
      <EdgeOverlay />
    </div>
  );
}

function App() {
  useSoloDeskPersistence();

  const showCodePanel = useStore((s) => s.view.showCodePanel);
  const showRenderPanel = useStore((s) => s.view.showRenderPanel);
  const theme = useStore((s) => s.view.theme);
  const accentColor = useStore((s) => s.view.accentColor);
  const canvasColor = useStore((s) => s.view.canvasColor);
  const uiFontScale = useStore((s) => s.view.uiFontScale);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const [exportOpen, setExportOpen] = useState(false);
  const [hoverHit, setHoverHit] = useState<HitTestResult | null>(null);

  useEffect(() => {
    applyThemeSettings(
      themeSettingsFromView({ theme, accentColor, canvasColor, uiFontScale }),
    );
  }, [theme, accentColor, canvasColor, uiFontScale]);

  return (
    <CodePanelLayoutProvider>
      <div className="appRoot" data-theme={theme}>
        <header className="shellHeader">
          <Toolbar onExport={() => setExportOpen(true)} />
          <HeadFootFields />
          <SignalTimingBar />
        </header>
        <div className="mainArea">
          <AppLayout
            showCodePanel={showCodePanel}
            showRenderPanel={showRenderPanel}
            signalPanel={(ctx) => (
              <SignalPanel
                scrollSync={ctx.scrollSync}
                panelScrollRef={ctx.panelScrollRef}
              />
            )}
            canvas={(ctx) => (
              <CanvasWithMarker scrollSync={ctx.scrollSync} onHoverHit={setHoverHit} />
            )}
          />
        </div>
        <StatusBar pointerHit={hoverHit} />
        <ExportDialog
          open={exportOpen}
          onClose={() => setExportOpen(false)}
          diagram={diagram}
          view={view}
        />
      </div>
    </CodePanelLayoutProvider>
  );
}

export default App;
