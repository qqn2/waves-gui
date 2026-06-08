import { useCallback, useEffect, useState } from 'react';
import type { DiagramState, ViewState } from '../shared/types';
import { exportImage } from './exportImage';
import { exportSVG, buildSVGString } from './exportSVG';
import { exportWavedromJSON } from './exportJSON';
import { computeExportDimensions } from './exportDimensions';
import { drawSignalLabels } from './labelEntries';
import { CanvasRenderer } from '../renderer/CanvasRenderer';
import {
  createExportCanvas,
  disposeExportCanvas,
  exportCanvasToBlob,
} from './exportCanvas';
import { drawEdgesOnCanvas } from './exportEdges';
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

function themeColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v || fallback;
}

/** True only when running on a secure origin (HTTPS or localhost). */
const clipboardAvailable =
  typeof navigator !== 'undefined' &&
  typeof navigator.clipboard?.write === 'function';

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
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setBackground(defaultBackground());
      setError(null);
      setCopied(null);
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

  const handleCopyPNG = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const dims = computeExportDimensions(diagram, view);
      const pixelW = Math.ceil(dims.totalWidth);
      const pixelH = Math.ceil(dims.totalHeight);
      const created = createExportCanvas(pixelW, pixelH);
      if (!created) throw new Error('Could not create canvas');
      const { canvas, ctx } = created;
      try {
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, dims.totalWidth, dims.totalHeight);
        const labelBg = themeColor('--bg-panel', '#242424');
        const textColor = themeColor('--text-primary', '#e8e8e8');
        drawSignalLabels(
          ctx,
          diagram,
          dims.labelWidth,
          dims.axisOffset,
          dims.totalHeight,
          labelBg,
          textColor,
        );
        ctx.save();
        ctx.translate(dims.labelWidth, 0);
        const exportView: ViewState = { ...view, zoom: 1, scrollX: 0, scrollY: 0 };
        const renderer = new CanvasRenderer(ctx);
        renderer.draw(diagram, exportView, dims.waveformWidth, dims.totalHeight);
        drawEdgesOnCanvas(ctx, diagram, exportView, 0);
        ctx.restore();
        const blob = await exportCanvasToBlob(canvas, 'image/png');
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopied('PNG');
        setTimeout(() => setCopied(null), 2000);
      } finally {
        disposeExportCanvas(canvas);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copy failed');
    } finally {
      setBusy(false);
    }
  }, [background, diagram, view]);

  const handleCopySVG = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const svgString = buildSVGString(diagram, view);
      await navigator.clipboard.writeText(svgString);
      setCopied('SVG');
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Copy failed');
    } finally {
      setBusy(false);
    }
  }, [diagram, view]);

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
        {copied && <p className={styles.copied}>✓ Copied as {copied}!</p>}

        <div className={styles.actions}>
          {clipboardAvailable && (
            <>
              <button
                type="button"
                id="copy-png-btn"
                className={styles.btn}
                disabled={busy}
                onClick={() => void handleCopyPNG()}
                title="Copy diagram as PNG image to clipboard"
              >
                Copy PNG
              </button>
              <button
                type="button"
                id="copy-svg-btn"
                className={styles.btn}
                disabled={busy}
                onClick={() => void handleCopySVG()}
                title="Copy diagram as SVG markup to clipboard"
              >
                Copy SVG
              </button>
            </>
          )}
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
