import type { DiagramState } from './types';

export function annotationTimingDivisions(diagram: DiagramState): number {
  if (diagram.compatibility?.extensionsEnabled !== true) return 1;
  return Math.max(1, Math.floor(diagram.config.ticksPerStep ?? 1));
}

/**
 * Snap an annotation X coordinate expressed in waveform-cell units.
 * A fine timing grid snaps to its visible tick lines. The ordinary grid keeps
 * the established WaveDrom behavior of targeting the center of a step.
 */
export function snapAnnotationX(rawX: number, diagram: DiagramState): number {
  const divisions = annotationTimingDivisions(diagram);
  const snapped = divisions > 1
    ? Math.round(rawX * divisions) / divisions
    : Math.floor(rawX) + 0.5;
  return Math.max(0, Math.min(diagram.config.totalSteps, snapped));
}

export function snapAnnotationY(rawY: number): number {
  return Math.max(0.5, Math.floor(rawY) + 0.5);
}
