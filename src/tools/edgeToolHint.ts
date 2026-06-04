import type { EdgeAnchorPending, Tool } from '../shared/types';

export function edgeToolHint(
  tool: Tool,
  pending: EdgeAnchorPending | null,
  timespanLabel?: string,
): string | null {
  if (tool === 'arrow') {
    return pending?.kind === 'arrow'
      ? `Anchor ${pending.char} at T${pending.step} — click end step (preview follows pointer · Esc cancel · Shift+click removes anchor)`
      : 'Arrow: click start anchor, move to preview, click end anchor — no drag';
  }
  if (tool === 'timespan') {
    const labelNote = timespanLabel?.trim()
      ? ` · label “${timespanLabel.trim()}”`
      : '';
    return pending?.kind === 'timespan'
      ? `Anchor ${pending.fromChar} at T${pending.startStep} — click end on same row (preview follows pointer · Esc cancel · Shift+click removes anchor)${labelNote}`
      : `Timespan: click start, move to preview, click end on same row — set label in toolbar${labelNote}`;
  }
  return null;
}
