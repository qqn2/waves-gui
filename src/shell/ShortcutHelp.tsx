import { useEffect } from 'react';
import { BUILD_LABEL } from '../shared/buildInfo';
import { Bug, ExternalLink, FileText, GitBranch, ShieldCheck, X } from 'lucide-react';
import styles from './shell.module.css';

export interface ShortcutHelpProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUTS: Array<{ keys: string; action: string }> = [
  { keys: 'V / D / E', action: 'Pointer / draw / erase tool' },
  { keys: 'Shift+D', action: 'Undulate analogue cell painter' },
  { keys: 'G / | / T', action: 'Glitch / timeline gap / invert mode' },
  { keys: '1 / 0 / P / N / Z / X', action: 'Primary paint values' },
  { keys: 'Ctrl+Z / Ctrl+Y', action: 'Undo / redo' },
  { keys: 'Ctrl+S', action: 'Save to the opened file, or Save As' },
  { keys: 'Ctrl+A', action: 'Select all signals' },
  { keys: 'Del / Backspace', action: 'Clear steps or remove selected rows' },
  { keys: 'Esc', action: 'Cancel drag or close this panel' },
  { keys: 'Ctrl + + / − / 0', action: 'Zoom in / out / reset' },
];

const GITHUB_URL = 'https://github.com/qqn2/waves-gui';
const BUG_REPORT_URL = `${GITHUB_URL}/issues/new?template=bug_report.yml`;

export function ShortcutHelp({ open, onClose }: ShortcutHelpProps) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.shortcutBackdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="help-about-title"
      onClick={onClose}
    >
      <div className={styles.shortcutDialog} onClick={(event) => event.stopPropagation()}>
        <header className={styles.shortcutHero}>
          <div>
            <span className={styles.shortcutEyebrow}>waves-gui workspace</span>
            <h2 id="help-about-title" className={styles.shortcutTitle}>Help &amp; About</h2>
            <p className={styles.shortcutLead}>
              Paint WaveDrom and Undulate timing diagrams, inspect source, and export locally.
            </p>
            <p className={styles.shortcutText}>{BUILD_LABEL}</p>
          </div>
          <button type="button" aria-label="Close help" className={styles.shortcutClose} onClick={onClose}>
            <X size={17} aria-hidden />
          </button>
        </header>

        <div className={styles.shortcutGrid}>
          <section className={styles.shortcutCard}>
            <div className={styles.shortcutCardHeader}>
              <FileText size={16} aria-hidden />
              <h3>Keyboard shortcuts</h3>
            </div>
            <table className={styles.shortcutTable}>
              <tbody>
                {SHORTCUTS.map((row) => (
                  <tr key={row.keys}>
                    <td className={styles.shortcutKeys}><kbd>{row.keys}</kbd></td>
                    <td>{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <div className={styles.shortcutSide}>
            <section className={styles.shortcutCard}>
              <div className={styles.shortcutCardHeader}>
                <ShieldCheck size={16} aria-hidden />
                <h3>Browser-local privacy</h3>
              </div>
              <p className={styles.shortcutText}>
                Editing and rendering stay in this browser. The full recovery draft and recent filenames are stored in localStorage, do not synchronize, and disappear when site data is cleared. Choosing <strong>Open in WaveDrom Editor</strong> is the exception: after a warning, it sends the complete diagram to wavedrom.com in the URL.
              </p>
            </section>

            <section className={`${styles.shortcutCard} ${styles.shortcutReportCard}`}>
              <div className={styles.shortcutCardHeader}>
                <Bug size={16} aria-hidden />
                <h3>Found a bug?</h3>
              </div>
              <p className={styles.shortcutText}>
                Use synthetic names and remove confidential diagrams, internal URLs, and proprietary screenshots.
              </p>
              <a className={styles.shortcutReportLink} href={BUG_REPORT_URL} target="_blank" rel="noreferrer">
                Report a bug <ExternalLink size={13} aria-hidden />
              </a>
            </section>
          </div>
        </div>

        <footer className={styles.shortcutFooter}>
          <p>This independent community project is not affiliated with or endorsed by WaveDrom, Undulate, or their maintainers.</p>
          <nav className={styles.shortcutLinks} aria-label="Project links">
            <a href={GITHUB_URL} target="_blank" rel="noreferrer"><GitBranch size={13} aria-hidden /> GitHub</a>
            <a href="/licenses/THIRD_PARTY_NOTICES.txt" target="_blank" rel="noreferrer"><FileText size={13} aria-hidden /> Licenses</a>
          </nav>
        </footer>
      </div>
    </div>
  );
}
