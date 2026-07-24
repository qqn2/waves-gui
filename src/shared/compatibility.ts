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
  const findings: CompatibilityFinding[] = [];
  if (summary.annotationCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'annotations',
      message: `${summary.annotationCount} annotation${summary.annotationCount === 1 ? '' : 's'} cannot be represented in WaveDrom JSON.`,
      consequence: 'Annotations will be omitted from the compatible subset.',
    });
  }
  if (summary.analogueSignalCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'analogue-signals',
      message: `${summary.analogueSignalCount} analogue signal${summary.analogueSignalCount === 1 ? '' : 's'} cannot be represented in WaveDrom JSON.`,
      consequence: 'Analogue lanes will be omitted from the compatible subset.',
    });
  }
  return findings;
}

export function undulateCompatibilityFindings(
  diagram: DiagramState,
): CompatibilityFinding[] {
  const findings: CompatibilityFinding[] = (diagram.annotations ?? []).map((annotation) => ({
    level: 'converted',
    feature: annotation.type,
    objectId: annotation.id,
    message:
      annotation.type === 'text'
        ? 'Text annotation anchor will be converted to Undulate x/y coordinates.'
        : annotation.type === 'vertical-line'
          ? 'Vertical line will be converted to Undulate shape "|" with an x coordinate.'
          : 'Horizontal line will be converted to Undulate shape "-" with a y coordinate.',
  }));
  const appendAnalogue = (signals: DiagramState['signals']) => {
    for (const signal of signals) {
      if (signal.type === 'group') appendAnalogue(signal.children);
      else if (signal.type === 'analogue') {
        findings.push({
          level: 'converted',
          feature: 'analogue-signal',
          objectId: signal.id,
          message: 'Analogue cells will be converted to Undulate s/c/a wave data.',
        });
      }
    }
  };
  appendAnalogue(diagram.signals);
  return findings;
}

export function hasBlockingFindings(
  findings: CompatibilityFinding[],
): boolean {
  return findings.some((finding) => finding.level === 'unsupported');
}
