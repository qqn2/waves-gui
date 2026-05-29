import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppLayout,
  MenuBar,
  StatusBar,
  Toolbar,
  type AppLayoutPaneContext,
} from './shell';
import { SignalPanel } from './signalPanel';
import { WaveformCanvas } from './renderer';
import type { HitTestResult } from './renderer';
import { useToolHandler } from './tools';
import { AnnotationLayer, useAnnotationTools } from './annotations';
import { CodePanel } from './codePanel';
import { ExportDialog } from './exportEngine';
import { useStore } from './shared/store';
import type { Tool } from './shared/types';
import './App.css';

const ANNOTATION_TOOLS: Tool[] = ['arrow', 'timespan', 'marker', 'text'];

function IntegratedCanvas({
  scrollSync,
}: {
  scrollSync: AppLayoutPaneContext['scrollSync'];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const tool = useStore((s) => s.view.selectedTool);
  const useAnnTool = ANNOTATION_TOOLS.includes(tool);

  const {
    onPointerDown: drawDown,
    onPointerMove: drawMove,
    onPointerUp: drawUp,
    onContextMenu,
    selectionOverlay,
  } = useToolHandler(canvasRef);

  const {
    creationDraft,
    onPointerDown: annDown,
    onPointerMove: annMove,
    onPointerUp: annUp,
  } = useAnnotationTools(canvasRef);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewport({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setViewport({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const onPointerEvent = useCallback(
    (phase: 'down' | 'move' | 'up', e: PointerEvent, hit: HitTestResult) => {
      if (useAnnTool) {
        if (phase === 'down') annDown(e, hit);
        else if (phase === 'move') annMove(e, hit);
        else annUp(e, hit);
      } else {
        if (phase === 'down') drawDown(e, hit);
        else if (phase === 'move') drawMove(e, hit);
        else drawUp(e, hit);
      }
    },
    [useAnnTool, annDown, annMove, annUp, drawDown, drawMove, drawUp],
  );

  return (
    <div ref={wrapRef} className="canvasWrap">
      <WaveformCanvas
        canvasRef={canvasRef}
        scrollSync={scrollSync}
        onPointerEvent={onPointerEvent}
        onContextMenu={onContextMenu}
      />
      {viewport.width > 0 && viewport.height > 0 ? (
        <AnnotationLayer
          width={viewport.width}
          height={viewport.height}
          creationDraft={creationDraft}
        />
      ) : null}
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

function App() {
  const showCodePanel = useStore((s) => s.view.showCodePanel);
  const theme = useStore((s) => s.view.theme);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="appRoot" data-theme={theme}>
      <MenuBar onExport={() => setExportOpen(true)} />
      <Toolbar onExport={() => setExportOpen(true)} />
      <AppLayout
        showCodePanel={showCodePanel}
        signalPanel={(ctx) => (
          <SignalPanel
            scrollSync={ctx.scrollSync}
            panelScrollRef={ctx.panelScrollRef}
          />
        )}
        canvas={(ctx) => <IntegratedCanvas scrollSync={ctx.scrollSync} />}
        codePanel={<CodePanel />}
      />
      <StatusBar />
      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        diagram={diagram}
        view={view}
      />
    </div>
  );
}

export default App;
