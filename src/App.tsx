import { useMemo, useRef } from 'react';
import { AppLayout, createScrollSync } from './shell';
import { SignalPanel } from './signalPanel';
import { WaveformCanvas } from './renderer';
import { useToolHandler } from './tools';
import { useStore } from './shared/store';
import './App.css';

function App() {
  const panelScrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const setScroll = useStore((s) => s.setScroll);
  const showCodePanel = useStore((s) => s.view.showCodePanel);
  const theme = useStore((s) => s.view.theme);

  const scrollSync = useMemo(
    () =>
      createScrollSync(
        (y) => setScroll(useStore.getState().view.scrollX, y),
        () => {},
      ),
    [setScroll],
  );

  const { onPointerDown, onPointerMove, onPointerUp } = useToolHandler(canvasRef);

  return (
    <div className="appRoot" data-theme={theme}>
      <AppLayout
        showCodePanel={showCodePanel}
        signalPanel={
          <SignalPanel scrollSync={scrollSync} panelScrollRef={panelScrollRef} />
        }
        canvas={
          <WaveformCanvas
            scrollSync={scrollSync}
            onPointerEvent={(phase, e, hit) => {
              if (phase === 'down') onPointerDown(e, hit);
              else if (phase === 'move') onPointerMove(e, hit);
              else onPointerUp(e, hit);
            }}
          />
        }
        codePanel={<div className="codePlaceholder">Code panel (Track E)</div>}
      />
    </div>
  );
}

export default App;
