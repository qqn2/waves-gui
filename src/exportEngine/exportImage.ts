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
import { drawEdgesOnCanvas } from './exportEdges';

export interface ImageExportOptions {
  format: 'png' | 'jpg';
  scale: number;
  background: string;
}

export interface RenderedImage {
  blob: Blob;
  width: number;
  height: number;
}

function themeColor(varName: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return v || fallback;
}

function labelPanelBg(): string {
  return themeColor('--bg-panel', '#242424');
}

export async function renderDiagramImage(
  diagram: DiagramState,
  view: ViewState,
  options: ImageExportOptions,
): Promise<RenderedImage> {
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

    const labelBg = labelPanelBg();
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
    drawEdgesOnCanvas(ctx, diagram, exportView, 0);
    ctx.restore();

    const mime =
      options.format === 'jpg' ? 'image/jpeg' : 'image/png';
    const quality = options.format === 'jpg' ? 0.92 : undefined;
    const blob = await exportCanvasToBlob(canvas, mime, quality);
    return { blob, width: pixelW, height: pixelH };
  } finally {
    disposeExportCanvas(canvas);
  }
}

export async function exportImage(
  diagram: DiagramState,
  view: ViewState,
  options: ImageExportOptions,
): Promise<void> {
  const rendered = await renderDiagramImage(diagram, view, options);
  const ext = options.format === 'jpg' ? 'jpg' : 'png';
  saveAs(rendered.blob, `${exportBaseName(view)}.${ext}`);
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
