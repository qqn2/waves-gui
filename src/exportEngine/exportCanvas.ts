export type ExportCanvas = OffscreenCanvas | HTMLCanvasElement;

/** Keep raster exports below browser memory/dimension limits. */
export const MAX_EXPORT_PIXELS = 40_000_000;
export const MAX_EXPORT_DIMENSION = 32_767;

export function createExportCanvas(
  width: number,
  height: number,
): { canvas: ExportCanvas; ctx: CanvasRenderingContext2D } | null {
  if (
    !Number.isFinite(width)
    || !Number.isFinite(height)
    || width < 1
    || height < 1
    || width > MAX_EXPORT_DIMENSION
    || height > MAX_EXPORT_DIMENSION
    || width * height > MAX_EXPORT_PIXELS
  ) {
    return null;
  }
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d') as unknown as CanvasRenderingContext2D | null;
    if (ctx) return { canvas, ctx };
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.visibility = 'hidden';
  canvas.style.position = 'fixed';
  canvas.style.left = '-9999px';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    canvas.remove();
    return null;
  }
  return { canvas, ctx };
}

export function disposeExportCanvas(canvas: ExportCanvas): void {
  if (canvas instanceof HTMLCanvasElement && canvas.parentNode) {
    canvas.parentNode.removeChild(canvas);
  }
}

export async function exportCanvasToBlob(
  canvas: ExportCanvas,
  mimeType: string,
  quality?: number,
): Promise<Blob> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to encode canvas'));
      },
      mimeType,
      quality,
    );
  });
}
