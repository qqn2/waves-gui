import { useStore } from '../shared/store';
import { newDiagramFile, openDiagramFile, saveDiagramFile } from './FileOperations';
import styles from './shell.module.css';

export interface MenuBarProps {
  onExport: () => void;
}

export function MenuBar({ onExport }: MenuBarProps) {
  const diagram = useStore((s) => s.diagram);
  const view = useStore((s) => s.view);
  const toggleCodePanel = useStore((s) => s.toggleCodePanel);
  const toggleTimeAxis = useStore((s) => s.toggleTimeAxis);
  const setTheme = useStore((s) => s.setTheme);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const clearAll = useStore((s) => s.clearAll);

  return (
    <nav className={styles.menuBar}>
      <div className={styles.menuGroup}>
        <span className={styles.menuLabel}>File</span>
        <div className={styles.menuDropdown}>
          <button type="button" onClick={() => newDiagramFile()}>
            New
          </button>
          <button type="button" onClick={() => void openDiagramFile()}>
            Open…
          </button>
          <button
            type="button"
            onClick={() => void saveDiagramFile(diagram, view.fileName)}
          >
            Save
          </button>
          <button type="button" onClick={onExport}>
            Export…
          </button>
        </div>
      </div>
      <div className={styles.menuGroup}>
        <span className={styles.menuLabel}>Edit</span>
        <div className={styles.menuDropdown}>
          <button type="button" onClick={() => undo()}>
            Undo
          </button>
          <button type="button" onClick={() => redo()}>
            Redo
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Clear all signals?')) clearAll();
            }}
          >
            Clear all
          </button>
        </div>
      </div>
      <div className={styles.menuGroup}>
        <span className={styles.menuLabel}>View</span>
        <div className={styles.menuDropdown}>
          <button type="button" onClick={() => setTheme('dark')}>
            Dark theme
          </button>
          <button type="button" onClick={() => setTheme('light')}>
            Light theme
          </button>
          <button type="button" onClick={() => toggleTimeAxis()}>
            {view.showTimeAxis ? '✓ ' : ''}Time axis
          </button>
          <button type="button" onClick={() => toggleCodePanel()}>
            {view.showCodePanel ? '✓ ' : ''}Code panel
          </button>
        </div>
      </div>
    </nav>
  );
}
