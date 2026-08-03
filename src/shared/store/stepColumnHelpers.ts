import { deleteBitStepAt, insertBitStepAt } from '../bitStepResize';
import type {
  DiagramAnnotation,
  DiagramState,
  Signal,
  SignalOrGroup,
} from '../types';
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
  };
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
      const inserted = sig.vectorTiming.cells.length - beforeCount;
      sig.stepGaps = insertTimingFlags(sig.stepGaps, boundary, inserted);
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
      const boundary = timingBoundaryAtMajorStep(sig.vectorTiming, index);
      const total = sourceCells.reduce(
        (sum, cell) => sum + Math.max(1, Math.round(cell.durationTicks)),
        0,
      );
      const stepTicks = Math.max(1, sig.vectorTiming.ticksPerStep);
      const start = Math.max(0, Math.min(Math.max(0, total - stepTicks), boundary.tick));
      const end = Math.min(total, start + stepTicks);
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
      sig.stepGaps = deleteTimingFlags(sig.stepGaps, sourceCells, start, end);
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
