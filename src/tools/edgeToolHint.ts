import type { EdgeAnchorPending, Tool } from '../shared/types';

export function edgeToolHint(
  tool: Tool,
  pending: EdgeAnchorPending | null,
  timespanLabel?: string,
): string | null {
  if (tool === 'arrow') {
    return pending?.kind === 'arrow'
      ? `Anchor ${pending.char} at T${pending.step} — click end step (Esc cancel · Shift+click removes anchor)`
      : 'Arrow: click start step, then end step — preview follows pointer';
  }
  if (tool === 'timespan') {
    const labelNote = timespanLabel?.trim()
      ? ` · label “${timespanLabel.trim()}”`
      : '';
    return pending?.kind === 'timespan'
      ? `Anchor ${pending.fromChar} at T${pending.startStep} — drag to end on same row${labelNote}`
      : `Timespan: press start, release end on same row — set label in toolbar${labelNote}`;
  }
  return null;
}
