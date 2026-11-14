import { CELL_WIDTH } from '../shared/constants';
import type { DiagramState, SignalOrGroup, ViewState } from '../shared/types';
import { computeExportDimensions } from '../exportEngine/exportDimensions';
import { buildRowLayout, totalContentHeight } from '../renderer/rowLayout';
import type { LessonStage } from './learningTypes';

/** A read-only teaching projection; opening a copy always uses the original asset. */
export function lessonPreviewDiagram(
  diagram: DiagramState,
  stage: LessonStage,
  focusSignals: boolean,
): DiagramState {
  const names = new Set(stage.signals);
  const filter = (signals: SignalOrGroup[]): SignalOrGroup[] => signals.flatMap((signal): SignalOrGroup[] => {
    if (signal.type === 'group') {
      const children = filter(signal.children);
      return children.length ? [{ ...signal, children }] : [];
    }
    return names.has(signal.name) || /^(?:PCLK|HCLK|ACLK)$/.test(signal.name) ? [signal] : [];
  });
  return {
    ...diagram,
    signals: focusSignals ? filter(diagram.signals) : diagram.signals,
    // The lesson heading and explanation supply this information without a
    // second, ambiguously numbered axis or clipped footnote inside the image.
    config: { ...diagram.config, head: undefined, foot: undefined },
  };
}

export function lessonHighlight(diagram: DiagramState, view: ViewState, stage: LessonStage) {
  const dims = computeExportDimensions(diagram, view);
  return {
    x: dims.labelWidth + stage.start * CELL_WIDTH * diagram.config.hscale,
    y: dims.axisOffset,
    width: (stage.end - stage.start) * CELL_WIDTH * diagram.config.hscale,
    height: totalContentHeight(buildRowLayout(diagram.signals)),
    totalWidth: dims.totalWidth,
    totalHeight: dims.totalHeight,
  };
}

export function stageCycleLabel(stage: LessonStage): string {
  return stage.end - stage.start === 1 ? `Cycle ${stage.start}` : `Cycles ${stage.start}–${stage.end - 1}`;
}
