import { deleteBitStepAt, fitTimingFlags, insertBitStepAt } from '../bitStepResize';
import type {
  DiagramAnnotation,
  DiagramState,
  Signal,
  SignalOrGroup,
} from '../types';
import { parseUndulateEdge } from '../edgeSyntax';
import { ensureStepGaps, pruneStepGaps } from '../stepGapHelpers';
import { normalizeTimedVectorSegments } from '../vectorSegments';
import {
  deleteTimingFlags,
  insertTimingFlags,
} from '../bitStepResize';
import {
  canDeleteMajorStepInTiming,
  canInsertMajorStepInTiming,
  deleteMajorStepInTiming,
  insertMajorStepInTiming,
  timingBoundaryAtMajorStep,
} from '../timedStepResize';



/** Clear node anchors and dependency edges after column insert/delete (node shift is error-prone). */

export function clearNodesAndEdges(
  signals: SignalOrGroup[],
  edges: string[],
  annotations?: DiagramAnnotation[],
): void {

  const walk = (list: SignalOrGroup[]) => {

    for (const item of list) {

      if (item.type === 'group') walk(item.children);

      else {
        delete item.node;
        delete item.nodeNames;
      }

    }

  };

  walk(signals);

  edges.length = 0;

  if (annotations) {
    for (let index = annotations.length - 1; index >= 0; index--) {
      const annotation = annotations[index];
      if (
        annotation?.type === 'arrow'
        && (annotation.from.kind === 'node' || annotation.to.kind === 'node')
      ) {
        annotations.splice(index, 1);
      }
    }
  }

}

export interface StructuralReferenceImpact {
  nodeAnchors: number;
  dependencyEdges: number;
  nodeAnchoredAnnotations: number;
  timelineAnnotations: number;
}

/** References that current column edits cannot safely remap yet. */
export function structuralReferenceImpact(diagram: DiagramState): StructuralReferenceImpact {
  let nodeAnchors = 0;
  const walk = (items: SignalOrGroup[]) => {
    for (const item of items) {
      if (item.type === 'group') {
        walk(item.children);
        continue;
      }
      const positions = new Set<number>();
      for (let index = 0; index < (item.node?.length ?? 0); index++) {
        const char = item.node?.[index];
        if (char && char !== '.' && char !== ' ') positions.add(index);
      }
      Object.keys(item.nodeNames ?? {}).forEach((index) => positions.add(Number(index)));
      nodeAnchors += positions.size;
    }
  };
  walk(diagram.signals);
  const nodeAnchoredAnnotations = (diagram.annotations ?? []).filter(
    (annotation) => annotation.type === 'arrow'
      && (annotation.from.kind === 'node' || annotation.to.kind === 'node'),
  ).length;
  return {
    nodeAnchors,
    dependencyEdges: diagram.edges?.length ?? 0,
    nodeAnchoredAnnotations,
    timelineAnnotations: 0,
  };
}

function collectRemovedNodeNames(
  diagram: DiagramState,
  nextTotalSteps: number,
): { names: Set<string>; nodeAnchors: number } {
  const names = new Set<string>();
  let nodeAnchors = 0;
  // Native timing cells use source-cell coordinates, which are not the same
  // as document major steps. Until resize returns a source-cell mapping,
  // treat every native-timing node anchor as potentially affected by a shrink.
  const conservativeNativeTiming = hasNativeTiming(diagram.signals);
  const walk = (items: SignalOrGroup[]) => {
    for (const item of items) {
      if (item.type === 'group') {
        walk(item.children);
        continue;
      }
      const positions = new Set<number>();
      const firstRemovedIndex = conservativeNativeTiming ? 0 : Math.max(0, nextTotalSteps);
      for (let index = firstRemovedIndex; index < (item.node?.length ?? 0); index++) {
        const char = item.node?.[index];
        if (char && char !== '.' && char !== ' ') {
          names.add(char);
          positions.add(index);
        }
      }
      for (const [rawIndex, name] of Object.entries(item.nodeNames ?? {})) {
        if (!conservativeNativeTiming && Number(rawIndex) < nextTotalSteps) continue;
        names.add(name);
        positions.add(Number(rawIndex));
      }
      nodeAnchors += positions.size;
    }
  };
  walk(diagram.signals);
  return { names, nodeAnchors };
}

function isOutOfRangeAnnotation(
  annotation: DiagramAnnotation,
  nextTotalSteps: number,
  removedNodeNames: Set<string>,
): boolean {
  if (annotation.type === 'arrow') {
    return (annotation.from.kind === 'node' && removedNodeNames.has(annotation.from.node))
      || (annotation.to.kind === 'node' && removedNodeNames.has(annotation.to.node))
      || (annotation.from.kind === 'point' && annotation.from.x >= nextTotalSteps)
      || (annotation.to.kind === 'point' && annotation.to.x >= nextTotalSteps);
  }
  return 'tick' in annotation && annotation.tick >= nextTotalSteps;
}

/** References that a Steps shrink will remove from the truncated tail. */
export function structuralReferenceImpactForStepShrink(
  diagram: DiagramState,
  nextTotalSteps: number,
): StructuralReferenceImpact {
  const { names, nodeAnchors } = collectRemovedNodeNames(diagram, nextTotalSteps);
  const dependencyEdges = (diagram.edges ?? []).filter((edge) => {
    const parsed = parseUndulateEdge(edge);
    return parsed !== null && (names.has(parsed.from) || names.has(parsed.to));
  }).length;
  const annotations = diagram.annotations ?? [];
  const nodeAnchoredAnnotations = annotations.filter(
    (annotation) => annotation.type === 'arrow'
      && ((annotation.from.kind === 'node' && names.has(annotation.from.node))
        || (annotation.to.kind === 'node' && names.has(annotation.to.node))),
  ).length;
  const timelineAnnotations = annotations.filter(
    (annotation) => isOutOfRangeAnnotation(annotation, nextTotalSteps, names)
      && !(annotation.type === 'arrow'
        && ((annotation.from.kind === 'node' && names.has(annotation.from.node))
          || (annotation.to.kind === 'node' && names.has(annotation.to.node)))),
  ).length;
  return {
    nodeAnchors,
    dependencyEdges,
    nodeAnchoredAnnotations,
    timelineAnnotations,
  };
}

/** Remove references anchored in the tail truncated by a Steps shrink. */
export function pruneReferencesBeyondSteps(
  diagram: DiagramState,
  nextTotalSteps: number,
): StructuralReferenceImpact {
  const impact = structuralReferenceImpactForStepShrink(diagram, nextTotalSteps);
  const { names } = collectRemovedNodeNames(diagram, nextTotalSteps);
  const conservativeNativeTiming = hasNativeTiming(diagram.signals);

  const trimSignals = (items: SignalOrGroup[]) => {
    for (const item of items) {
      if (item.type === 'group') {
        trimSignals(item.children);
        continue;
      }
      if (conservativeNativeTiming) {
        delete item.node;
        delete item.nodeNames;
      } else if (item.node && item.node.length > nextTotalSteps) {
        item.node = item.node.slice(0, Math.max(0, nextTotalSteps));
        if (/^[. ]*$/u.test(item.node)) delete item.node;
      }
      if (item.nodeNames) {
        for (const rawIndex of Object.keys(item.nodeNames)) {
          if (Number(rawIndex) >= nextTotalSteps) delete item.nodeNames[Number(rawIndex)];
        }
        if (Object.keys(item.nodeNames).length === 0) delete item.nodeNames;
      }
    }
  };
  trimSignals(diagram.signals);

  const nextEdges: string[] = [];
  const nextControls: Record<number, { c1x: number; c2x: number }> = {};
  for (const [index, edge] of (diagram.edges ?? []).entries()) {
    const parsed = parseUndulateEdge(edge);
    if (parsed && (names.has(parsed.from) || names.has(parsed.to))) continue;
    const nextIndex = nextEdges.length;
    nextEdges.push(edge);
    const control = diagram.edgeCurveControls?.[index];
    if (control) nextControls[nextIndex] = control;
  }
  diagram.edges = nextEdges;
  diagram.edgeCurveControls = Object.keys(nextControls).length > 0 ? nextControls : undefined;
  if (diagram.annotations) {
    diagram.annotations = diagram.annotations.filter(
      (annotation) => !isOutOfRangeAnnotation(annotation, nextTotalSteps, names),
    );
    if (diagram.annotations.length === 0) delete diagram.annotations;
  }
  return impact;
}



function spliceColumnFlags(

  flags: boolean[] | undefined,

  index: number,

  newColumnCount: number,

): boolean[] | undefined {

  const out = ensureStepGaps(flags, index);

  out.splice(index, 0, false);

  while (out.length < newColumnCount) out.push(false);

  if (out.length > newColumnCount) out.length = newColumnCount;

  return pruneStepGaps(out);

}



function removeColumnFlags(

  flags: boolean[] | undefined,

  index: number,

  newColumnCount: number,

): boolean[] | undefined {

  if (!flags?.length) return undefined;

  const out = [...flags];

  if (index < out.length) out.splice(index, 1);

  while (out.length < newColumnCount) out.push(false);

  if (out.length > newColumnCount) out.length = newColumnCount;

  return pruneStepGaps(out);

}



export function canInsertStepInSignal(sig: Signal, index: number, totalSteps: number): boolean {
  const clamped = Math.max(0, Math.min(index, totalSteps));
  return sig.type !== 'bit' || !sig.digitalTiming || canInsertMajorStepInTiming(sig.digitalTiming, clamped);
}

export function canDeleteStepInSignal(
  sig: Signal,
  index: number,
  minSteps: number,
): boolean {
  if (sig.type === 'bit' && sig.digitalTiming) {
    return canDeleteMajorStepInTiming(sig.digitalTiming, index, minSteps);
  }
  if (sig.type === 'vector' && sig.vectorTiming) {
    return canDeleteMajorStepInTiming(sig.vectorTiming, index, minSteps);
  }
  return true;
}

export function insertStepInSignal(sig: Signal, index: number, totalSteps: number): boolean {

  const clamped = Math.max(0, Math.min(index, totalSteps));



  if (sig.type === 'bit') {

    return insertBitStepAt(sig, clamped);


  }



  if (sig.type === 'vector') {

    if (sig.vectorTiming) {
      const boundary = timingBoundaryAtMajorStep(sig.vectorTiming, clamped);
      const beforeCount = sig.vectorTiming.cells.length;
      if (!insertMajorStepInTiming(sig.vectorTiming, clamped)) return false;
      delete sig.sourceWaveData;
      const inserted = sig.vectorTiming.cells.length - beforeCount;
      sig.stepGaps = fitTimingFlags(
        insertTimingFlags(sig.stepGaps, boundary, inserted),
        sig.vectorTiming.cells.length,
      );
      for (const seg of sig.segments) {
        if (boundary.kind === 'inside') {
          if (seg.startStep > boundary.index) {
            seg.startStep += inserted;
            seg.endStep += inserted;
          } else if (seg.endStep > boundary.index) {
            seg.endStep += inserted;
          }
        } else if (boundary.index === 0 && seg.startStep === 0) {
          seg.endStep += inserted;
        } else if (seg.startStep >= boundary.index) {
          seg.startStep += inserted;
          seg.endStep += inserted;
        } else if (seg.endStep >= boundary.index) {
          seg.endStep += inserted;
        }
      }
      sig.segments = normalizeTimedVectorSegments(
        sig.segments,
        sig.vectorTiming.cells.length,
      );
      return true;
    }

    for (const seg of sig.segments) {

      if (seg.startStep >= clamped) seg.startStep++;

      if (seg.endStep > clamped) seg.endStep++;

      else if (seg.startStep < clamped && seg.endStep === clamped) seg.endStep++;

    }

    sig.stepGaps = spliceColumnFlags(sig.stepGaps, clamped, totalSteps + 1);
    delete sig.sourceWaveData;

    return true;

  }

  return true;
}



export function deleteStepInSignal(

  sig: Signal,

  index: number,

  totalSteps: number,

  minSteps: number,

): boolean {

  if (sig.type === 'bit') {

    return deleteBitStepAt(sig, index, minSteps);

  }



  if (sig.type === 'vector') {

    if (sig.vectorTiming) {
      const sourceCells = sig.vectorTiming.cells.map((cell) => ({ ...cell }));
      const total = sourceCells.reduce(
        (sum, cell) => sum + Math.max(1, Math.round(cell.durationTicks)),
        0,
      );
      const stepTicks = Math.max(1, sig.vectorTiming.ticksPerStep);
      const rawStart = index * stepTicks + sig.vectorTiming.phaseTicks;
      const rawEnd = rawStart + stepTicks;
      const start = Math.max(0, rawStart);
      const end = Math.min(total, rawEnd);
      const remappedBoundaries = [0];
      let cursor = 0;
      for (const cell of sourceCells) {
        const duration = Math.max(1, Math.round(cell.durationTicks));
        const cellEnd = cursor + duration;
        const before = Math.max(0, Math.min(cellEnd, start) - cursor);
        const after = Math.max(0, cellEnd - Math.max(cursor, end));
        remappedBoundaries.push(
          remappedBoundaries.at(-1)! + (before > 0 ? 1 : 0) + (after > 0 ? 1 : 0),
        );
        cursor = cellEnd;
      }
      const deleted = deleteMajorStepInTiming(sig.vectorTiming, index, minSteps);
      if (!deleted) return false;
      delete sig.sourceWaveData;
      if (rawEnd <= 0 || rawStart >= total) return true;
      sig.stepGaps = fitTimingFlags(
        deleteTimingFlags(sig.stepGaps, sourceCells, start, end),
        sig.vectorTiming.cells.length,
      );
      for (const seg of sig.segments) {
        seg.startStep = remappedBoundaries[Math.max(0, Math.min(seg.startStep, sourceCells.length))]!;
        seg.endStep = remappedBoundaries[Math.max(0, Math.min(seg.endStep, sourceCells.length))]!;
      }
      sig.segments = sig.segments.filter((seg) => seg.endStep > seg.startStep);
      sig.segments = normalizeTimedVectorSegments(
        sig.segments,
        sig.vectorTiming.cells.length,
      );
      return true;
    }

    for (const seg of sig.segments) {

      if (seg.startStep >= index + 1) {

        seg.startStep--;

      } else if (seg.endStep > index + 1) {

        seg.endStep--;

      } else if (seg.startStep <= index && seg.endStep > index) {

        if (seg.endStep - seg.startStep <= 1) return false;

        seg.endStep--;

      }

    }

    sig.stepGaps = removeColumnFlags(

      sig.stepGaps,

      index,

      Math.max(0, totalSteps - 1),

    );
    delete sig.sourceWaveData;

    return true;

  }



  return true;

}



export function walkSignals(signals: SignalOrGroup[], fn: (sig: Signal) => void): void {

  for (const item of signals) {

    if (item.type === 'group') walkSignals(item.children, fn);

    else fn(item);

  }

}

export function hasNativeTiming(signals: SignalOrGroup[]): boolean {
  let timed = false;
  walkSignals(signals, (signal) => {
    if (signal.digitalTiming || signal.vectorTiming) timed = true;
  });
  return timed;
}

/**
 * Legacy WaveDrom period/phase lanes use source-cell coordinates while the
 * document timeline uses rendered major columns. Structural timeline edits
 * cannot safely resize or remap those lanes without first converting them to
 * native timing.
 */
export function hasLegacyTimelineTiming(signals: SignalOrGroup[]): boolean {
  let legacy = false;
  walkSignals(signals, (signal) => {
    if (
      (signal.period !== undefined && signal.period !== 1)
      || (signal.phase !== undefined && signal.phase !== 0)
    ) {
      legacy = true;
    }
  });
  return legacy;
}
