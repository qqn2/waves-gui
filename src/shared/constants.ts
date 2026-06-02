/** Base cell width in logical pixels at zoom 1.0. Multiply by hscale and zoom for canvas px. */
export const CELL_WIDTH = 40;

/** Base row height in logical pixels at zoom 1.0. Multiply by zoom for canvas px. */
export const ROW_HEIGHT = 40;

/** Height of group header rows */
export const GROUP_HEADER_HEIGHT = 28;

/** Width of the signal label panel in px (DOM, not zoomed) */
export const LABEL_WIDTH = 160;

/** Height of the time axis bar in px (DOM, not zoomed) */
export const TIME_AXIS_HEIGHT = 24;

/** Vertical padding inside a row between the trace extremes and the row edges */
export const TRACE_PADDING = 8;

/** Width of a state transition diagonal, in logical px */
export const TRANSITION_WIDTH = 6;

/** Diagonal width for vector/bus segment ends, in logical px */
export const BUS_DIAGONAL = 8;

/** Max undo history depth */
export const MAX_HISTORY = 100;

export const DEFAULT_SIGNAL_COLOR = '#4A9EFF';
export const DEFAULT_STEPS = 20;
export const MIN_TOTAL_STEPS = 1;
export const MAX_TOTAL_STEPS = 512;
export const DEFAULT_HSCALE = 1;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 4.0;
