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
  const extendedDigitalCount = summary.extendedDigitalSignalCount;
  if (extendedDigitalCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'extended-digital-signals',
      message: `${extendedDigitalCount} extended digital signal${extendedDigitalCount === 1 ? '' : 's'} use Undulate-only mixed, impulse, metastability, or held clock-edge states.`,
      consequence: 'The WaveDrom Editor may reject these wave strings.',
    });
  }
  const expandedNodeCount = summary.expandedNodeCount;
  if (expandedNodeCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'expanded-node-identifiers',
      message: `${expandedNodeCount} expanded Undulate node identifier${expandedNodeCount === 1 ? '' : 's'} cannot be represented in WaveDrom JSON.`,
      consequence: 'Long node names will be omitted from the compatible subset.',
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
          : annotation.type === 'horizontal-line'
            ? 'Horizontal line will be converted to Undulate shape "-" with a y coordinate.'
            : annotation.type === 'global-compression'
              ? 'Global compression will be converted to Undulate shape "||" with an x coordinate.'
              : 'Structured arrow anchors, shape, label, and offsets will be exported as Undulate annotation data.',
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
