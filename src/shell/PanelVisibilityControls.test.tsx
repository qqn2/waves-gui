/** @vitest-environment happy-dom */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStore } from '../shared/store';
import { defaultDiagram, defaultView } from '../shared/store/helpers';
import { useDiagramCode } from '../codePanel/useDiagramCode';
import { redoDocument, undoDocument } from '../codePanel/documentHistory';
import { AppLayout } from './AppLayout';
import { CodePanelLayoutProvider } from './codePanelLayout';
import { PanelVisibilityControls } from './PanelVisibilityControls';

// Exercise the real workspace and source provider without a CodeMirror DOM.
vi.mock('../codePanel/CodePanel', () => ({
  CodePanel: function SourceEditorProbe() {
    const { code, onCodeChange } = useDiagramCode();
    return (
      <>
        <output aria-label="Source text">{code}</output>
        <button onClick={() => onCodeChange('{ signal: [')}>Write unfinished source</button>
      </>
    );
  },
}));

vi.mock('../codePanel/RenderPanel', () => ({
  RenderPanel: () => <div>Preview content</div>,
}));

function Workspace() {
  const showCodePanel = useStore((s) => s.view.showCodePanel);
  const showRenderPanel = useStore((s) => s.view.showRenderPanel);
  return (
    <CodePanelLayoutProvider>
      <PanelVisibilityControls />
      <AppLayout
        signalPanel={<div>Signals</div>}
        canvas={<div>Waveform</div>}
        showCodePanel={showCodePanel}
        showRenderPanel={showRenderPanel}
      />
    </CodePanelLayoutProvider>
  );
}

function button(name: string): HTMLButtonElement {
  const match = Array.from(document.querySelectorAll('button')).find((candidate) =>
    candidate.getAttribute('aria-label') === name
    || candidate.getAttribute('title') === name
    || candidate.textContent?.trim() === name,
  );
  expect(match, `button ${name}`).toBeDefined();
  return match!;
}

describe('workspace panel visibility', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    const diagram = defaultDiagram();
    useStore.setState({ diagram, savedDiagram: diagram, view: defaultView(), history: [], future: [] });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    localStorage.clear();
  });

  it('starts with canvas space and toggles panels independently without document edits', async () => {
    await act(async () => root.render(<Workspace />));
    const diagram = useStore.getState().diagram;
    expect(button('Canvas only').getAttribute('aria-pressed')).toBe('true');
    expect(button('Source').getAttribute('aria-pressed')).toBe('false');
    expect(button('Preview').getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('[aria-label="Source text"]')).toBeNull();
    expect(host.textContent).not.toContain('Preview content');

    await act(async () => button('Source').click());
    expect(button('Source').getAttribute('aria-pressed')).toBe('true');
    expect(button('Preview').getAttribute('aria-pressed')).toBe('false');
    await act(async () => button('Preview').click());
    expect(button('Source').getAttribute('aria-pressed')).toBe('true');
    expect(button('Preview').getAttribute('aria-pressed')).toBe('true');
    await act(async () => button('Close Source panel').click());
    expect(button('Preview').getAttribute('aria-pressed')).toBe('true');
    await act(async () => button('Canvas only').click());
    expect(button('Canvas only').getAttribute('aria-pressed')).toBe('true');
    expect(host.textContent).not.toContain('Preview content');
    expect(useStore.getState().diagram).toBe(diagram);
    expect(useStore.getState().history).toHaveLength(0);
  });

  it('keeps unfinished source and its undo history while the editor is closed', async () => {
    await act(async () => root.render(<Workspace />));
    await act(async () => button('Source').click());
    const accepted = host.querySelector('[aria-label="Source text"]')!.textContent;
    await act(async () => button('Write unfinished source').click());
    await act(async () => button('Close Source panel').click());
    expect(useStore.getState().view.sourceDraft).toBe('{ signal: [');
    expect(useStore.getState().view.sourceDraftDirty).toBe(true);

    await act(async () => undoDocument());
    expect(useStore.getState().view.sourceDraftDirty).toBe(false);
    await act(async () => button('Source').click());
    expect(host.querySelector('[aria-label="Source text"]')!.textContent).toBe(accepted);
    await act(async () => redoDocument());
    expect(host.querySelector('[aria-label="Source text"]')!.textContent).toBe('{ signal: [');
    await act(async () => button('Canvas only').click());
    await act(async () => button('Source').click());
    expect(host.querySelector('[aria-label="Source text"]')!.textContent).toBe('{ signal: [');
  });

  it.each(['Source', 'Preview'])('reopens the %s panel in its saved floating position', async (panel) => {
    await act(async () => root.render(<Workspace />));
    await act(async () => button(panel).click());
    await act(async () => button('Floating window').click());
    const dialog = document.querySelector<HTMLElement>(`[role="dialog"][aria-label="${panel} panel"]`);
    expect(dialog).not.toBeNull();
    const position = dialog!.getAttribute('style');
    await act(async () => button(`Close ${panel} panel`).click());
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(button(panel).getAttribute('aria-pressed')).toBe('false');
    await act(async () => button(panel).click());
    expect(document.querySelector(`[role="dialog"][aria-label="${panel} panel"]`)?.getAttribute('style'))
      .toBe(position);
  });
});
