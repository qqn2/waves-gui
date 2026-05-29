import { useCallback, useEffect, useState } from 'react';
import type { DiagramState, ViewState } from '../shared/types';
import { exportImage } from './exportImage';
import { exportSVG } from './exportSVG';
import { exportWavedromJSON } from './exportJSON';
import styles from './ExportDialog.module.css';

export type ExportFormat = 'png' | 'svg' | 'jpg' | 'json';

export interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  diagram: DiagramState;
  view: ViewState;
}

function defaultBackground(): string {
  if (typeof document === 'undefined') return '#111111';
  return (
    getComputedStyle(document.documentElement)
      .getPropertyValue('--bg-canvas')
      .trim() || '#111111'
  );
}

export function ExportDialog({
  open,
  onClose,
  diagram,
  view,
}: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [scale, setScale] = useState(1);
  const [background, setBackground] = useState(defaultBackground);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBackground(defaultBackground());
      setError(null);
    }
  }, [open]);

  const isImage = format === 'png' || format === 'jpg';

  const handleExport = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (format === 'svg') {
        exportSVG(diagram, view);
      } else if (format === 'json') {
        exportWavedromJSON(diagram, view);
      } else {
        await exportImage(diagram, view, {
          format,
          scale,
          background,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  }, [background, diagram, format, onClose, scale, view]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="export-dialog-title" className={styles.title}>
          Export diagram
        </h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="export-format">
            Format
          </label>
          <select
            id="export-format"
            className={styles.select}
            value={format}
            onChange={(e) => setFormat(e.target.value as ExportFormat)}
          >
            <option value="png">PNG</option>
            <option value="svg">SVG</option>
            <option value="jpg">JPG</option>
            <option value="json">WaveDrom JSON</option>
          </select>
        </div>

        {isImage && (
          <>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="export-scale">
                Scale
              </label>
              <select
                id="export-scale"
                className={styles.select}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={3}>3×</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="export-bg">
                Background
              </label>
              <input
                id="export-bg"
                type="color"
                className={styles.input}
                value={background}
                onChange={(e) => setBackground(e.target.value)}
              />
            </div>
          </>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={busy}
            onClick={() => void handleExport()}
          >
            {busy ? 'Exporting…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
