import { loadRecentFiles } from '../soloDesk/recentFiles';
import {
  newDiagramFile,
  openDiagramFile,
  openVCDFile,
  saveCurrentDiagramFile,
} from '../FileOperations';
import styles from '../shell.module.css';

export interface ToolbarFileMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onExport: () => void;
  onBrowseSamples: () => void;
}

export function ToolbarFileMenu({
  open,
  onToggle,
  onClose,
  onExport,
  onBrowseSamples,
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
              Open document…
            </button>
            <button type="button" onClick={() => { void openVCDFile(); onClose(); }}>
              Open VCD…
            </button>
            <button
              type="button"
              onClick={() => {
                void saveCurrentDiagramFile();
                onClose();
              }}
            >
              Save
            </button>
            <button type="button" onClick={() => { onExport(); onClose(); }}>
              Export…
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onBrowseSamples();
              }}
            >
              Browse samples
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
        </div>
      )}
    </div>
  );
}
