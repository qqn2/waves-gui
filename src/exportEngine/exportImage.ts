import { saveAs } from 'file-saver';
import type { DiagramState, ViewState } from '../shared/types';
import { CanvasRenderer } from '../renderer/CanvasRenderer';
import { computeExportDimensions } from './exportDimensions';
import { drawSignalLabels } from './labelEntries';
import {
  createExportCanvas,
  disposeExportCanvas,
  exportCanvasToBlob,
} from './exportCanvas';
import { exportBaseName } from './fileName';

export interface ImageExportOptions {
  format: 'png' | 'jpg';
  scale: number;
  background: string;
}

function themeColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v || fallback;
}

function labelPanelBg(theme: ViewState['theme']): string {
  return theme === 'light' ? '#ffffff' : '#242424';
}

export async function exportImage(
  diagram: DiagramState,
  view: ViewState,
  options: ImageExportOptions,
): Promise<void> {
  const dims = computeExportDimensions(diagram, view);
  const pixelW = Math.ceil(dims.totalWidth * options.scale);
  const pixelH = Math.ceil(dims.totalHeight * options.scale);

  const created = createExportCanvas(pixelW, pixelH);
  if (!created) throw new Error('Could not create export canvas');
  const { canvas, ctx } = created;

  try {
    ctx.setTransform(options.scale, 0, 0, options.scale, 0, 0);
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, dims.totalWidth, dims.totalHeight);

    const labelBg = labelPanelBg(view.theme);
    const textColor = themeColor('--text-primary', '#e8e8e8');
    drawSignalLabels(
      ctx,
      diagram,
      dims.axisOffset,
      dims.totalHeight,
      labelBg,
      textColor,
    );

    ctx.save();
    ctx.translate(dims.labelWidth, 0);

    const exportView: ViewState = {
      ...view,
      zoom: 1,
      scrollX: 0,
      scrollY: 0,
    };
    const renderer = new CanvasRenderer(ctx);
    renderer.draw(
      diagram,
      exportView,
      dims.waveformWidth,
      dims.totalHeight,
    );
    ctx.restore();

    const mime =
      options.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const ext = options.format === 'jpg' ? 'jpg' : 'png';
    const quality = options.format === 'jpg' ? 0.92 : undefined;
    const blob = await exportCanvasToBlob(canvas, mime, quality);
    saveAs(blob, `${exportBaseName(view)}.${ext}`);
  } finally {
    disposeExportCanvas(canvas);
  }
}

export async function exportPNG(
  diagram: DiagramState,
  view: ViewState,
  opts?: Partial<Pick<ImageExportOptions, 'scale' | 'background'>>,
): Promise<void> {
  return exportImage(diagram, view, {
    format: 'png',
    scale: opts?.scale ?? 1,
    background:
      opts?.background ?? themeColor('--bg-canvas', '#111111'),
  });
}

export async function exportJPG(
  diagram: DiagramState,
  view: ViewState,
  opts?: Partial<Pick<ImageExportOptions, 'scale' | 'background'>>,
): Promise<void> {
  return exportImage(diagram, view, {
    format: 'jpg',
    scale: opts?.scale ?? 1,
    background:
      opts?.background ?? themeColor('--bg-canvas', '#111111'),
  });
}
