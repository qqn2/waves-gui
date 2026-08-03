import type { DiagramState } from './types';
import { scanExtensionContent } from './annotations';
import { countOpaqueMixedWaves } from './mixedWave';

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

export function opaqueMixedWaveFindings(
  diagram: DiagramState,
): CompatibilityFinding[] {
  const count = countOpaqueMixedWaves(diagram.signals);
  if (count === 0) return [];
  return [{
    level: 'unsupported',
    feature: 'mixed-bus-scalar-wave',
    message: `${count} mixed bus/scalar lane${count === 1 ? '' : 's'} are preserved as opaque source data.`,
    consequence: 'Canvas and visual exports omit the unsupported scalar/clock cells; keep the lane read-only or edit the source explicitly.',
  }];
}

export function waveDromCompatibilityFindings(
  diagram: DiagramState,
): CompatibilityFinding[] {
  const summary = scanExtensionContent(diagram);
  const findings: CompatibilityFinding[] = [];
  let styledSignalCount = 0;
  const countStyled = (signals: DiagramState['signals']) => {
    for (const signal of signals) {
      if (signal.type === 'group') countStyled(signal.children);
      else if (signal.style) styledSignalCount++;
    }
  };
  countStyled(diagram.signals);
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
  if (styledSignalCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'signal-styles',
      message: `${styledSignalCount} signal style${styledSignalCount === 1 ? '' : 's'} use Undulate-only declarative styling.`,
      consequence: 'Stroke, fill, dash, width, and font-size overrides will be omitted.',
    });
  }
  const opaque = diagram.compatibility?.opaqueUndulate;
  const opaqueCount = [
    opaque?.root,
    opaque?.config,
    opaque?.head,
    opaque?.foot,
    ...Object.values(opaque?.signals ?? {}),
    ...Object.values(opaque?.annotations ?? {}),
  ].reduce((count, record) => count + Object.keys(record ?? {}).length, 0);
  if (opaqueCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'opaque-undulate-properties',
      message: `${opaqueCount} safe unknown Undulate propert${opaqueCount === 1 ? 'y is' : 'ies are'} attached to this document.`,
      consequence: 'WaveDrom export cannot carry these preserved fields.',
    });
  }
  return findings.concat(opaqueMixedWaveFindings(diagram));
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
  const appendTypedExtensions = (signals: DiagramState['signals']) => {
    for (const signal of signals) {
      if (signal.type === 'group') {
        appendTypedExtensions(signal.children);
        continue;
      }
      if (signal.digitalTiming || signal.vectorTiming) {
        findings.push({
          level: 'exact',
          feature: signal.type === 'vector'
            ? 'integer-vector-timing'
            : 'integer-digital-timing',
          objectId: signal.id,
          message: 'Per-cell periods, duty boundaries, phase, and slew export exactly.',
        });
      }
      if (signal.style) {
        findings.push({
          level: 'exact',
          feature: 'signal-style',
          objectId: signal.id,
          message: 'Safe declarative signal styling exports exactly.',
        });
      }
      if (Object.keys(signal.nodeNames ?? {}).length > 0) {
        findings.push({
          level: 'exact',
          feature: 'expanded-node-identifiers',
          objectId: signal.id,
          message: 'Expanded Undulate node identifiers export exactly.',
        });
      }
    }
  };
  appendTypedExtensions(diagram.signals);
  if ((diagram.analogueOverlayGroups?.length ?? 0) > 0) {
    findings.push({
      level: 'exact',
      feature: 'analogue-overlay-groups',
      message: `${diagram.analogueOverlayGroups!.length} explicit analogue overlay group${diagram.analogueOverlayGroups!.length === 1 ? '' : 's'} export as consecutive Undulate overlay flags.`,
    });
  }
  const extendedEdgeCount = scanExtensionContent(diagram).extendedEdgeCount;
  if (extendedEdgeCount > 0) {
    findings.push({
      level: 'exact',
      feature: 'extended-edge-markers',
      message: `${extendedEdgeCount} edge${extendedEdgeCount === 1 ? '' : 's'} with square or circle endpoint markers export exactly.`,
    });
  }
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
  const liveAnnotationIds = new Set((diagram.annotations ?? []).map(({ id }) => id));
  const opaqueAnnotationIds = Object.keys(opaque?.annotations ?? {});
  const preservedAnnotationCount =
    opaqueAnnotationIds.filter((id) => liveAnnotationIds.has(id)).length;
  const preservedDocumentCount = [
    opaque?.root,
    opaque?.config,
    opaque?.head,
    opaque?.foot,
  ].reduce((count, record) => count + Object.keys(record ?? {}).length, 0);
  const preservedCount =
    preservedDocumentCount + preservedSignalCount + preservedAnnotationCount;
  if (preservedCount > 0) {
    findings.push({
      level: 'opaque',
      feature: 'unknown-undulate-properties',
      message: `${preservedCount} safe unknown Undulate propert${preservedCount === 1 ? 'y is' : 'ies are'} preserved without interpretation.`,
      consequence: 'They are re-exported verbatim; GUI edits do not modify their values.',
    });
  }
  const orphanedCount =
    opaqueSignalIds.length - preservedSignalCount
    + opaqueAnnotationIds.length - preservedAnnotationCount;
  if (orphanedCount > 0) {
    findings.push({
      level: 'unsupported',
      feature: 'orphaned-unknown-undulate-properties',
      message: `${orphanedCount} preserved unknown object propert${orphanedCount === 1 ? 'y no longer has' : 'ies no longer have'} a live object to attach to.`,
      consequence: 'Restore the affected signal or annotation before exporting to avoid omission.',
    });
  }
  return findings.concat(opaqueMixedWaveFindings(diagram));
}

export function hasBlockingFindings(
  findings: CompatibilityFinding[],
): boolean {
  return findings.some((finding) => finding.level === 'unsupported');
}
