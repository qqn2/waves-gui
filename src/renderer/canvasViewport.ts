import type { DiagramState, ViewState } from '../shared/types';
import { diagramLogicalWidth } from './laneTiming';
import { getWaveformTopInsetPx, measureHeadFoot } from './renderHeadFoot';
import { buildRowLayout, totalContentHeight } from './rowLayout';

export interface CanvasViewport {
  width: number;
  height: number;
  contentWidth: number;
  contentHeight: number;
  waveformTop: number;
  visibleRowsHeight: number;
  maxX: number;
  maxY: number;
}

/** Extents are CSS pixels, matching the renderer and the native scroll rails. */
export function measureCanvasViewport(
  diagram: DiagramState,
  view: Pick<ViewState, 'zoom' | 'collapsedGroupIds'>,
  width: number,
  height: number,
  signalViewportHeight?: number,
): CanvasViewport {
  const rows = buildRowLayout(diagram.signals, view.collapsedGroupIds);
  const waveformTop = getWaveformTopInsetPx(diagram.config);
  const { footHeight } = measureHeadFoot(diagram.config);
  const contentWidth = Math.ceil(diagramLogicalWidth(diagram) * diagram.config.hscale * view.zoom);
  // Titles and scales use fixed CSS-pixel bands; only the signal rows zoom.
  const rowsHeight = totalContentHeight(rows) * view.zoom;
  // The signal list has an Add footer; leave enough bottom room to show its last
  // label fully too, even when the diagram has no footer of its own.
  const contentHeight = Math.ceil(Math.max(
    waveformTop + rowsHeight + footHeight,
    signalViewportHeight === undefined ? 0 : rowsHeight + height - signalViewportHeight,
  ));
  return {
    width,
    height,
    contentWidth,
    contentHeight,
    waveformTop,
    visibleRowsHeight: Math.max(0, Math.min(height - waveformTop, signalViewportHeight ?? Infinity)),
    maxX: Math.max(0, contentWidth - width),
    maxY: Math.max(0, contentHeight - height),
  };
}

export function clampCanvasScroll(x: number, y: number, viewport: CanvasViewport) {
  return {
    x: Math.max(0, Math.min(viewport.maxX, x)),
    y: Math.max(0, Math.min(viewport.maxY, y)),
  };
}

/** Reveal a focused cell without jumping when it already fits in the viewport. */
export function revealCanvasCell(
  rect: { left: number; right: number; top: number; bottom: number },
  scroll: { x: number; y: number },
  viewport: CanvasViewport,
) {
  const reveal = (start: number, end: number, offset: number, size: number) => {
    if (start < offset || end - start > size) return start;
    if (end > offset + size) return end - size;
    return offset;
  };
  return clampCanvasScroll(
    reveal(rect.left, rect.right, scroll.x, viewport.width),
    reveal(rect.top, rect.bottom, scroll.y, viewport.visibleRowsHeight),
    viewport,
  );
}

/** Wheel deltaMode may be CSS pixels, text lines, or whole viewport pages. */
export function canvasWheelDelta(
  event: Pick<WheelEvent, 'deltaX' | 'deltaY' | 'deltaMode' | 'shiftKey'>,
  viewport: Pick<CanvasViewport, 'width' | 'height'>,
) {
  const xUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.width : 1;
  const yUnit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.height : 1;
  // Browsers may already translate Shift+wheel into deltaX; do not apply it twice.
  return event.shiftKey
    ? { x: (event.deltaX || event.deltaY) * xUnit, y: 0 }
    : { x: event.deltaX * xUnit, y: event.deltaY * yUnit };
}
