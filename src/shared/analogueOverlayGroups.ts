import type {
  AnalogueOverlayGroup,
  DiagramState,
  Signal,
  SignalOrGroup,
} from './types';

export const MAX_ANALOGUE_OVERLAY_MEMBERS = 4;

interface SiblingLevel {
  signals: SignalOrGroup[];
  analogueIds: Set<string>;
}

function siblingLevels(signals: SignalOrGroup[]): SiblingLevel[] {
  const levels: SiblingLevel[] = [];
  const walk = (items: SignalOrGroup[]) => {
    levels.push({
      signals: items,
      analogueIds: new Set(
        items.filter((item) => item.type === 'analogue').map((item) => item.id),
      ),
    });
    for (const item of items) {
      if (item.type === 'group') walk(item.children);
    }
  };
  walk(signals);
  return levels;
}

function allAnalogueSignals(signals: SignalOrGroup[]): Signal[] {
  const result: Signal[] = [];
  const walk = (items: SignalOrGroup[]) => {
    for (const item of items) {
      if (item.type === 'group') walk(item.children);
      else if (item.type === 'analogue') result.push(item);
    }
  };
  walk(signals);
  return result;
}

function inferredGroups(levels: SiblingLevel[]): AnalogueOverlayGroup[] {
  const groups: AnalogueOverlayGroup[] = [];
  for (const level of levels) {
    for (let index = 0; index < level.signals.length; index++) {
      const first = level.signals[index]!;
      if (first.type !== 'analogue' || first.overlay !== true) continue;
      const signalIds = [first.id];
      while (index < level.signals.length - 1) {
        const current = level.signals[index];
        const next = level.signals[index + 1];
        if (
          current?.type !== 'analogue'
          || current.overlay !== true
          || next?.type !== 'analogue'
        ) break;
        index++;
        signalIds.push(next.id);
      }
      if (signalIds.length >= 2) {
        groups.push({
          id: `overlay-${signalIds[0]}`,
          name: `Overlay ${groups.length + 1}`,
          signalIds,
        });
      }
    }
  }
  return groups;
}

function normalizedGroups(
  groups: AnalogueOverlayGroup[],
  levels: SiblingLevel[],
): AnalogueOverlayGroup[] {
  const used = new Set<string>();
  const result: AnalogueOverlayGroup[] = [];
  for (const group of groups) {
    const uniqueIds = [...new Set(group.signalIds)];
    const level = levels.find((candidate) => (
      uniqueIds.every((id) => candidate.analogueIds.has(id))
    ));
    if (!level || uniqueIds.length < 2 || uniqueIds.length > MAX_ANALOGUE_OVERLAY_MEMBERS) {
      continue;
    }
    const ordered = level.signals
      .filter((item) => uniqueIds.includes(item.id))
      .map((item) => item.id);
    const indexes = ordered.map((id) => level.signals.findIndex((item) => item.id === id));
    const consecutive = indexes.every(
      (value, index) => index === 0 || value === indexes[index - 1]! + 1,
    );
    if (!consecutive || ordered.some((id) => used.has(id))) continue;
    ordered.forEach((id) => used.add(id));
    result.push({
      id: group.id,
      name: group.name?.trim() || `Overlay ${result.length + 1}`,
      signalIds: ordered,
    });
  }
  return result;
}

/** Normalize explicit groups and derive the legacy Undulate overlay flags. */
export function reconcileAnalogueOverlayGroups(diagram: DiagramState): void {
  const levels = siblingLevels(diagram.signals);
  const source = diagram.analogueOverlayGroups
    ?? inferredGroups(levels);
  const groups = normalizedGroups(source, levels);
  if (diagram.analogueOverlayGroups !== undefined || groups.length > 0) {
    diagram.analogueOverlayGroups = groups;
  }

  const analogues = allAnalogueSignals(diagram.signals);
  const analogueById = new Map(analogues.map((signal) => [signal.id, signal]));
  for (const signal of analogues) delete signal.overlay;
  for (const group of groups) {
    for (const id of group.signalIds.slice(0, -1)) {
      const signal = analogueById.get(id);
      if (signal) signal.overlay = true;
    }
  }
}

export function overlayGroupForSignal(
  diagram: DiagramState,
  signalId: string,
): AnalogueOverlayGroup | undefined {
  return diagram.analogueOverlayGroups?.find((group) => (
    group.signalIds.includes(signalId)
  ));
}

export function nextAnalogueOverlayCandidate(
  diagram: DiagramState,
  signalId: string,
): Signal | undefined {
  const group = overlayGroupForSignal(diagram, signalId);
  const anchorId = group?.signalIds.at(-1) ?? signalId;
  const occupied = new Set(
    diagram.analogueOverlayGroups?.flatMap((item) => item.signalIds) ?? [],
  );
  for (const level of siblingLevels(diagram.signals)) {
    const index = level.signals.findIndex((item) => item.id === anchorId);
    if (index < 0) continue;
    const next = level.signals[index + 1];
    return next?.type === 'analogue' && !occupied.has(next.id) ? next : undefined;
  }
  return undefined;
}
