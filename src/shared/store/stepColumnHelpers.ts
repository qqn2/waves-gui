import { deleteBitStepAt, insertBitStepAt } from '../bitStepResize';
import type { Signal, SignalOrGroup } from '../types';
import { ensureStepGaps, pruneStepGaps } from '../stepGapHelpers';



/** Clear node anchors and dependency edges after column insert/delete (node shift is error-prone). */

export function clearNodesAndEdges(signals: SignalOrGroup[], edges: string[]): void {

  const walk = (list: SignalOrGroup[]) => {

    for (const item of list) {

      if (item.type === 'group') walk(item.children);

      else delete item.node;

    }

  };

  walk(signals);

  edges.length = 0;

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



export function insertStepInSignal(sig: Signal, index: number, totalSteps: number): void {

  const clamped = Math.max(0, Math.min(index, totalSteps));



  if (sig.type === 'bit') {

    insertBitStepAt(sig, clamped);

    return;

  }



  if (sig.type === 'vector') {

    for (const seg of sig.segments) {

      if (seg.startStep >= clamped) seg.startStep++;

      if (seg.endStep > clamped) seg.endStep++;

      else if (seg.startStep < clamped && seg.endStep === clamped) seg.endStep++;

    }

    sig.stepGaps = spliceColumnFlags(sig.stepGaps, clamped, totalSteps + 1);

    return;

  }

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
