/**
 * Canvas segment paint for vector/bus rows is not wired yet (paintTool ignores
 * vector hits). Users add buses from the toolbar or signal panel; segment
 * labels and spans are edited via the JSON/code panel until a pointer handler
 * is added here.
 */

/** Shown on bus context-menu actions until segment paint lands. */
export const BUS_SEGMENT_EDIT_HINT =
  'Edit bus values in JSON panel until segment tool lands';
