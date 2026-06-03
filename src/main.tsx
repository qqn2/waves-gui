import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './shared/theme.css';
import App from './App.tsx';
import { AppErrorBoundary } from './shell/AppErrorBoundary';
import { useStore } from './shared/store';
import { normalizeDiagram } from './shared/normalizeDiagram';
import { applyThemeSettings, themeSettingsFromView } from './shared/theme';

try {
  useStore.setState((s) => {
    s.diagram = normalizeDiagram(s.diagram);
  });
  applyThemeSettings(themeSettingsFromView(useStore.getState().view));
} catch (err) {
  console.error('[WaveDrom GUI] diagram bootstrap failed', err);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
