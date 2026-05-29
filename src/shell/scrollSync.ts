/** Imperative bridge between virtual canvas scroll and native panel scrollTop. */
export interface ScrollSyncHandles {
  /** The signal panel's overflow-y scroll container (native scrollTop). */
  signalPanelEl: HTMLDivElement | null;
  /** Canvas → panel: write panel.scrollTop = y. Call inside rAF. */
  applyCanvasScrollY(y: number): void;
  /** Panel → canvas: update store scrollY + trigger redraw. Call inside rAF. */
  applyPanelScrollY(y: number): void;
}

export function createScrollSync(
  setScrollY: (y: number) => void,
  onCanvasRedraw: () => void,
): ScrollSyncHandles {
  const handles: ScrollSyncHandles = {
    signalPanelEl: null,
    applyCanvasScrollY(y: number) {
      if (handles.signalPanelEl) {
        handles.signalPanelEl.scrollTop = y;
      }
    },
    applyPanelScrollY(y: number) {
      setScrollY(y);
      onCanvasRedraw();
    },
  };
  return handles;
}
