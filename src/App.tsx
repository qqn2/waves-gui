import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AppLayout,
  EditToolbar,
  AnnotationInspector,
  SignalInspector,
  StatusBar,
  Toolbar,
  saveCurrentDiagramFile,
  type AppLayoutPaneContext,
} from './shell';
import { TimeAxisContextMenu } from './shell/TimeAxisContextMenu';
import { SignalPanel } from './signalPanel';
import {
  WaveformCanvas,
  PointerMarker,
  EdgeOverlay,
  EdgeToolOverlay,
} from './renderer';
import type { HitTestResult } from './renderer';
import { useToolHandler } from './tools';
import { useStore } from './shared/store';
import { applyThemeSettings, themeSettingsFromView } from './shared/theme';
import { useSoloDeskPersistence } from './shell/soloDesk';
import { CodePanelLayoutProvider } from './shell/codePanelLayout';
import { flushPendingCodeToDiagram } from './codePanel/flushRegistry';
import { loadSampleDiagram } from './shell/samples';
import { SampleBrowser } from './sampleLibrary/SampleBrowser';
import './App.css';

const ExportDialog = lazy(() =>
  import('./exportEngine/ExportDialog').then((module) => ({
    default: module.ExportDialog,
  })),
);

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
    timeAxisMenu,
    closeTimeAxisMenu,
  } = useToolHandler(canvasRef);

  const onPointerEvent = useCallback(
    (phase: 'down' | 'move' | 'up', e: PointerEvent, hit: HitTestResult) => {
      if (phase === 'move') {
        onHoverHit(hit.signalId ? { ...hit, canvasX: e.offsetX } : null);
      }
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
        onKeyboardFocusHit={onHoverHit}
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
      {timeAxisMenu ? (
        <TimeAxisContextMenu
          step={timeAxisMenu.step}
          x={timeAxisMenu.x}
          y={timeAxisMenu.y}
          onClose={closeTimeAxisMenu}
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

  useEffect(() => {
    const onSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      void saveCurrentDiagramFile();
    };
    window.addEventListener('keydown', onSaveShortcut, { capture: true });
    return () => window.removeEventListener('keydown', onSaveShortcut, { capture: true });
  }, []);

  const showCodePanel = useStore((s) => s.view.showCodePanel);
  const showRenderPanel = useStore((s) => s.view.showRenderPanel);
  const theme = useStore((s) => s.view.theme);
  const accentColor = useStore((s) => s.view.accentColor);
  const canvasColor = useStore((s) => s.view.canvasColor);
  const uiFontScale = useStore((s) => s.view.uiFontScale);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const [exportOpen, setExportOpen] = useState(false);
  const [sampleBrowserOpen, setSampleBrowserOpen] = useState(false);
  const inspectorVisible = useStore((s) => s.view.showInspector);
  const toggleInspector = useStore((s) => s.toggleInspector);
  const [hoverHit, setHoverHit] = useState<HitTestResult | null>(null);

  const activeAnnotationId = view.activeAnnotationId ?? null;
  const selectedAnnotation = useMemo(
    () => diagram.annotations?.find((annotation) => annotation.id === activeAnnotationId) ?? null,
    [activeAnnotationId, diagram.annotations],
  );

  const openExport = useCallback(() => {
    if (!flushPendingCodeToDiagram().ok) return;
    setExportOpen(true);
  }, []);

  const closeSampleBrowser = useCallback(() => {
    setSampleBrowserOpen(false);
  }, []);

  const openSampleBrowser = useCallback(() => {
    setSampleBrowserOpen(true);
  }, []);

  const pickSample = useCallback((sampleId: string) => {
    void loadSampleDiagram(sampleId).then((loaded) => {
      if (loaded) setSampleBrowserOpen(false);
    });
  }, []);

  useLayoutEffect(() => {
    applyThemeSettings(
      themeSettingsFromView({ theme, accentColor, canvasColor, uiFontScale }),
    );
  }, [theme, accentColor, canvasColor, uiFontScale]);

  return (
    <CodePanelLayoutProvider>
      <div className="appRoot" data-theme={theme}>
        <header className="shellHeader">
          <Toolbar
            onExport={openExport}
            onBrowseSamples={openSampleBrowser}
          />
        </header>
        <div className="mainArea">
          <div className="editorShell">
            <EditToolbar />
            <div className="editorWorkspace">
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
            {inspectorVisible && selectedAnnotation ? (
              <AnnotationInspector onClose={toggleInspector} />
            ) : inspectorVisible ? (
              <SignalInspector onClose={toggleInspector} />
            ) : null}
          </div>
        </div>
        <StatusBar pointerHit={hoverHit} />
        {exportOpen ? (
          <Suspense fallback={null}>
            <ExportDialog
              open
              onClose={() => setExportOpen(false)}
              diagram={diagram}
              view={view}
            />
          </Suspense>
        ) : null}
        <SampleBrowser
          open={sampleBrowserOpen}
          onClose={closeSampleBrowser}
          onPick={pickSample}
        />
      </div>
    </CodePanelLayoutProvider>
  );
}

export default App;
