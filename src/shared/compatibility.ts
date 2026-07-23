import type { DiagramState } from './types';
import { scanExtensionContent } from './annotations';

export type CompatibilityLevel =
  | 'exact'
  | 'converted'
  | 'approximated'
  | 'opaque'
  | 'unsupported';

export interface CompatibilityFinding {
  level: CompatibilityLevel;
  feature: string;
  objectId?: string;
  message: string;
  consequence?: string;
}

export function waveDromCompatibilityFindings(
  diagram: DiagramState,
): CompatibilityFinding[] {
  const summary = scanExtensionContent(diagram);
  if (summary.annotationCount === 0) return [];
  return [{
    level: 'unsupported',
    feature: 'text-annotations',
    message: `${summary.annotationCount} text annotation${summary.annotationCount === 1 ? '' : 's'} cannot be represented in WaveDrom JSON.`,
    consequence: 'Annotations will be omitted from the compatible subset.',
  }];
}

export function undulateCompatibilityFindings(
  diagram: DiagramState,
): CompatibilityFinding[] {
  return (diagram.annotations ?? []).map((annotation) => ({
    level: 'converted',
    feature: 'text-annotation',
    objectId: annotation.id,
    message: 'Text annotation anchor will be converted to Undulate x/y coordinates.',
  }));
}

export function hasBlockingFindings(
  findings: CompatibilityFinding[],
): boolean {
  return findings.some((finding) => finding.level === 'unsupported');
}
