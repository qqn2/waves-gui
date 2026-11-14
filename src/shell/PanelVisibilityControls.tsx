import { Braces, Eye, Square } from 'lucide-react';
import { useStore } from '../shared/store';
import styles from './shell.module.css';
import panelStyles from './PanelVisibilityControls.module.css';

export function PanelVisibilityControls() {
  const showSource = useStore((s) => s.view.showCodePanel);
  const showPreview = useStore((s) => s.view.showRenderPanel);
  const toggleSource = useStore((s) => s.toggleCodePanel);
  const togglePreview = useStore((s) => s.toggleRenderPanel);

  const canvasOnly = () => {
    // Only visibility changes: docking preferences and source drafts stay intact.
    useStore.setState((state) => {
      state.view.showCodePanel = false;
      state.view.showRenderPanel = false;
    });
  };
  const buttonClass = (active: boolean) =>
    `${styles.toolBtn} ${active ? styles.toolActive : ''}`;

  return (
    <div className={panelStyles.panelControls} role="group" aria-label="Workspace panels">
      <button
        type="button"
        className={buttonClass(!showSource && !showPreview)}
        onClick={canvasOnly}
        title="Give the waveform the full workspace"
        aria-pressed={!showSource && !showPreview}
      >
        <Square size={14} aria-hidden /> Canvas only
      </button>
      <button
        type="button"
        className={buttonClass(showSource)}
        onClick={toggleSource}
        title="Show or hide source editor"
        aria-pressed={showSource}
      >
        <Braces size={16} aria-hidden /> Source
      </button>
      <button
        type="button"
        className={buttonClass(showPreview)}
        onClick={togglePreview}
        title="Show or hide local timing diagram preview"
        aria-pressed={showPreview}
      >
        <Eye size={16} aria-hidden /> Preview
      </button>
    </div>
  );
}
