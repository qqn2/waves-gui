/** Contract with Track H `src/shell/scrollSync.ts` — duplicated here so Track B stays self-contained. */
export interface ScrollSyncHandles {
  signalPanelEl: HTMLDivElement | null;
  applyCanvasScrollY: (y: number) => void;
  applyPanelScrollY: (y: number) => void;
}
