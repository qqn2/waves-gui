import { loadRecentFiles } from '../soloDesk/recentFiles';
import { loadSampleDiagram } from '../samples';
import { SampleLibraryMenu } from './SampleLibraryMenu';
import { newDiagramFile, openDiagramFile, saveDiagramFile } from '../FileOperations';
import type { DiagramState } from '../../shared/types';
import type { ViewState } from '../../shared/types';
import styles from '../shell.module.css';

export interface ToolbarFileMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  diagram: DiagramState;
  view: ViewState;
  onExport: () => void;
}

export function ToolbarFileMenu({
  open,
  onToggle,
  onClose,
  diagram,
  view,
  onExport,
}: ToolbarFileMenuProps) {
  const recentFiles = open ? loadRecentFiles() : [];

  return (
    <div className={styles.addWrap}>
      <button type="button" className={styles.toolBtn} onClick={onToggle}>
        File ▾
      </button>
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.dropdownScroll}>
            <button type="button" onClick={() => { newDiagramFile(); onClose(); }}>
              New
            </button>
            <button type="button" onClick={() => { void openDiagramFile(); onClose(); }}>
              Open…
            </button>
            <button
              type="button"
              onClick={() => {
                void saveDiagramFile(diagram, view.fileName);
                onClose();
              }}
            >
              Save
            </button>
            <button type="button" onClick={() => { onExport(); onClose(); }}>
              Export…
            </button>
            {recentFiles.length > 0 ? (
              <>
                <div className={styles.menuSubheading}>Recent</div>
                {recentFiles.map((e) => (
                  <button
                    key={e.name + e.openedAt}
                    type="button"
                    disabled
                    title="Re-open via Open… (browser cannot reopen path automatically)"
                  >
                    {e.name}
                  </button>
                ))}
              </>
            ) : null}
          </div>
          <SampleLibraryMenu
            onPick={(id) => {
              void loadSampleDiagram(id);
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
}
