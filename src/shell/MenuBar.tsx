import { useStore } from '../shared/store';
import { newDiagramFile, openDiagramFile, saveDiagramFile } from './FileOperations';
import { loadSampleDiagram, samplesByCategory } from './samples';
import { THEME_OPTIONS } from '../shared/theme';
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
          <div className={styles.menuSubheading}>Samples</div>
          {samplesByCategory('general').map((sample) => (
            <button
              key={sample.id}
              type="button"
              title={sample.description}
              onClick={() => void loadSampleDiagram(sample.id)}
            >
              {sample.title}
            </button>
          ))}
          <div className={styles.menuSubheading}>AMBA templates</div>
          {samplesByCategory('amba').map((sample) => (
            <button
              key={sample.id}
              type="button"
              title={sample.description}
              onClick={() => void loadSampleDiagram(sample.id)}
            >
              {sample.title}
            </button>
          ))}
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
          <div className={styles.menuSubheading}>Appearance</div>
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              title={opt.description}
              onClick={() => setTheme(opt.id)}
            >
              {opt.label}
            </button>
          ))}
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
