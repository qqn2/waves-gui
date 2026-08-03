import {
  structuralReferenceImpact,
  type StructuralReferenceImpact,
} from '../shared/store/stepColumnHelpers';
import { useStore } from '../shared/store';

/** Ask before a structural edit that currently drops unremappable references. */
export function confirmStructuralReferenceLoss(
  operation: string,
  requestedImpact?: StructuralReferenceImpact,
): boolean {
  const impact = requestedImpact ?? structuralReferenceImpact(useStore.getState().diagram);
  if (
    impact.nodeAnchors === 0
    && impact.dependencyEdges === 0
    && impact.nodeAnchoredAnnotations === 0
    && impact.timelineAnnotations === 0
  ) return true;
  const references = [
    impact.nodeAnchors > 0 ? `${impact.nodeAnchors} node anchor${impact.nodeAnchors === 1 ? '' : 's'}` : '',
    impact.dependencyEdges > 0 ? `${impact.dependencyEdges} dependency edge${impact.dependencyEdges === 1 ? '' : 's'}` : '',
    impact.nodeAnchoredAnnotations > 0
      ? `${impact.nodeAnchoredAnnotations} node-anchored annotation${impact.nodeAnchoredAnnotations === 1 ? '' : 's'}`
      : '',
    impact.timelineAnnotations > 0
      ? `${impact.timelineAnnotations} out-of-range annotation${impact.timelineAnnotations === 1 ? '' : 's'}`
      : '',
  ].filter(Boolean).join(' and ');
  return window.confirm(`${operation} will remove ${references}. Continue?`);
}
