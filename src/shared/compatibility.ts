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
  if (summary.extendedEdgeCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'extended-edge-markers',
      message: `${summary.extendedEdgeCount} dependency edge${summary.extendedEdgeCount === 1 ? '' : 's'} use Undulate-only square or circle endpoint markers.`,
      consequence: 'WaveDrom does not support # or * edge endpoint markers.',
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
  const opaque = diagram.compatibility?.opaqueUndulate;
  const opaqueSignalIds = Object.keys(opaque?.signals ?? {});
  const liveSignalIds = new Set<string>();
  const collectIds = (signals: DiagramState['signals']) => {
    for (const signal of signals) {
      if (signal.type === 'group') collectIds(signal.children);
      else liveSignalIds.add(signal.id);
    }
  };
  collectIds(diagram.signals);
  const preservedSignalCount = opaqueSignalIds.filter((id) => liveSignalIds.has(id)).length;
  const preservedRootCount = Object.keys(opaque?.root ?? {}).length;
  if (preservedRootCount + preservedSignalCount > 0) {
    findings.push({
      level: 'opaque',
      feature: 'unknown-undulate-properties',
      message: `${preservedRootCount + preservedSignalCount} safe unknown Undulate propert${preservedRootCount + preservedSignalCount === 1 ? 'y is' : 'ies are'} preserved without interpretation.`,
      consequence: 'They are re-exported verbatim; GUI edits do not modify their values.',
    });
  }
  const orphanedCount = opaqueSignalIds.length - preservedSignalCount;
  if (orphanedCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'orphaned-unknown-undulate-properties',
      message: `${orphanedCount} preserved unknown signal propert${orphanedCount === 1 ? 'y no longer has' : 'ies no longer have'} a live signal to attach to.`,
      consequence: 'Delete or restore the affected signal before exporting to avoid omission.',
    });
  }
  return findings;
}

export function hasBlockingFindings(
  findings: CompatibilityFinding[],
): boolean {
  return findings.some((finding) => finding.level === 'unsupported');
}
