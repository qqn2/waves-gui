export interface EdgeCurveControl {
  c1x: number;
  c2x: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isEdgeIndex(key: string): boolean {
  return /^(0|[1-9]\d*)$/.test(key) && Number.isSafeInteger(Number(key));
}

export function isEdgeCurveControl(value: unknown): value is EdgeCurveControl {
  return isRecord(value)
    && typeof value.c1x === 'number' && Number.isFinite(value.c1x)
    && typeof value.c2x === 'number' && Number.isFinite(value.c2x)
    && value.c1x >= 0 && value.c1x <= 1
    && value.c2x >= 0 && value.c2x <= 1;
}

/** Curve metadata is shared by WaveDrom and Undulate documents. */
export function validateEdgeCurveControls(value: unknown): string | null {
  if (value === undefined) return null;
  if (!isRecord(value)) return 'x-waves-gui.edgeCurveControls must be an object';
  for (const [index, control] of Object.entries(value)) {
    if (!isEdgeIndex(index) || !isEdgeCurveControl(control)) {
      return `x-waves-gui.edgeCurveControls.${index} is invalid`;
    }
  }
  return null;
}

/** Recovery and direct imports must not pass malformed or orphaned controls to renderers. */
export function normalizeEdgeCurveControls(
  value: unknown,
  edgeCount: number,
): Record<number, EdgeCurveControl> | undefined {
  if (!isRecord(value)) return undefined;
  const controls: Record<number, EdgeCurveControl> = {};
  for (const [key, control] of Object.entries(value)) {
    if (isEdgeIndex(key) && Number(key) < edgeCount && isEdgeCurveControl(control)) {
      controls[Number(key)] = { c1x: control.c1x, c2x: control.c2x };
    }
  }
  return Object.keys(controls).length ? controls : undefined;
}
