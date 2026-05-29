import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppLayout,
  StatusBar,
  Toolbar,
  type AppLayoutPaneContext,
} from './shell';
import { SignalPanel } from './signalPanel';
import { WaveformCanvas, PointerMarker } from './renderer';
import type { HitTestResult } from './renderer';
import { useToolHandler } from './tools';
import { CodePanel } from './codePanel';
import { ExportDialog } from './exportEngine';
import { useStore } from './shared/store';
import { useSoloDeskPersistence } from './shell/soloDesk';
import { HeadFootFields } from './shell/HeadFootFields';
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

  return (
    <div className="canvasWrapOuter">
      <IntegratedCanvas scrollSync={scrollSync} onHoverHit={handleHover} />
      <PointerMarker hit={displayHit} diagram={diagram} view={view} />
    </div>
  );
}

function App() {
  useSoloDeskPersistence();

  const showCodePanel = useStore((s) => s.view.showCodePanel);
  const theme = useStore((s) => s.view.theme);
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const [exportOpen, setExportOpen] = useState(false);
  const [hoverHit, setHoverHit] = useState<HitTestResult | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return (
    <div className="appRoot" data-theme={theme}>
      <header className="shellHeader">
        <Toolbar onExport={() => setExportOpen(true)} />
        <HeadFootFields />
      </header>
      <div className="mainArea">
        <AppLayout
          showCodePanel={showCodePanel}
          signalPanel={(ctx) => (
            <SignalPanel
              scrollSync={ctx.scrollSync}
              panelScrollRef={ctx.panelScrollRef}
            />
          )}
          canvas={(ctx) => (
            <CanvasWithMarker scrollSync={ctx.scrollSync} onHoverHit={setHoverHit} />
          )}
          codePanel={<CodePanel />}
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
  );
}

export default App;
