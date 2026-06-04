import type { DiagramState, ViewState, BitState } from '../shared/types';
import { toggleBinaryBitState, isClockBitState, resolvePaintValue, isHoldPaintValue } from '../shared/bitToggle';
import {
  applyClockBrushToRange,
  applyClockToggleToRange,
} from '../wavedromBridge/clockWave';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout, totalContentHeight } from './rowLayout';
import { renderGrid } from './renderGrid';
import { renderTimeAxis } from './renderTimeAxis';
import { renderBitSignal } from './renderBitSignal';
import { renderVectorSignal } from './renderVectorSignal';
import { fillHexForColorIndex } from '../wavedromBridge/wavedromColors';
import { applyVectorSpan } from '../shared/vectorSegments';
import { renderSignalNodes } from './renderNodes';
import { measureHeadFoot, renderHeadFoot } from './renderHeadFoot';
import type { ViewTransform } from './coordinates';

export class CanvasRenderer {
  constructor(private readonly ctx: CanvasRenderingContext2D) {}

  draw(
    diagram: DiagramState,
    view: ViewState,
    canvasWidth: number,
    canvasHeight: number,
  ): void {
    const transform: ViewTransform = {
      zoom: view.zoom,
      hscale: diagram.config.hscale,
      scrollX: view.scrollX,
      scrollY: view.scrollY,
    };

    const rows = buildRowLayout(diagram.signals);
    const contentH = totalContentHeight(rows);
    const axisOffset = view.showTimeAxis ? TIME_AXIS_HEIGHT : 0;
    const { headHeight, footHeight } = measureHeadFoot(diagram.config);
    const waveformTop = axisOffset + headHeight;
    const showAnchorLetters =
      view.showAnchorLetters ||
      view.selectedTool === 'arrow' ||
      view.selectedTool === 'timespan';

    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    this.ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() ||
      '#111';
    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (view.showTimeAxis) {
      renderTimeAxis(this.ctx, diagram.config.totalSteps, transform, canvasWidth);
    }

    this.ctx.save();
    this.ctx.translate(0, waveformTop);
    renderGrid(
      this.ctx,
      diagram.config.totalSteps,
      contentH,
      transform,
      canvasWidth,
    );

    let rowIndex = 0;
    const walkDraw = (list: typeof diagram.signals) => {
      for (const item of list) {
        const row = rows[rowIndex];
        if (!row) return;
        if (item.type === 'group') {
          rowIndex++;
          if (!item.collapsed) walkDraw(item.children);
        } else if (item.type === 'bit') {
          let drawSignal = item;
          let draft: BitState[] | null = null;
          if (view.paintDraft && view.paintDraft.signalId === item.id) {
            const lo = Math.min(view.paintDraft.startStep, view.paintDraft.endStep);
            const hi = Math.max(view.paintDraft.startStep, view.paintDraft.endStep);
            if (
              view.paintDraft.mode === 'paint' &&
              view.paintDraft.apply === 'glitch'
            ) {
              const glitches = [...(item.stepGlitches ?? [])];
              const maxBoundaries = Math.max(0, item.states.length - 1);
              while (glitches.length < maxBoundaries) glitches.push(false);
              for (let i = lo; i < hi && i < maxBoundaries; i++) {
                glitches[i] = !glitches[i];
              }
              drawSignal = { ...item, stepGlitches: glitches };
            } else {
              draft = [...item.states];
              if (
                view.paintDraft.mode === 'paint' &&
                view.paintDraft.apply === 'set' &&
                isClockBitState(view.paintDraft.bitState) &&
                lo < hi
              ) {
                applyClockBrushToRange(
                  draft,
                  lo,
                  hi,
                  view.paintDraft.bitState,
                );
              } else if (
                view.paintDraft.mode === 'paint' &&
                view.paintDraft.apply === 'set' &&
                isHoldPaintValue(view.paintDraft.bitState)
              ) {
                for (let s = lo; s <= hi; s++) {
                  draft[s] = resolvePaintValue(draft, s, view.paintDraft.bitState);
                }
              } else if (
                view.paintDraft.mode === 'paint' &&
                view.paintDraft.apply === 'toggle' &&
                item.states.every(isClockBitState)
              ) {
                applyClockToggleToRange(draft, lo, hi);
              } else {
                for (let s = lo; s <= hi; s++) {
                  if (view.paintDraft.mode === 'paint') {
                    draft[s] =
                      view.paintDraft.apply === 'toggle'
                        ? toggleBinaryBitState(item.states[s])
                        : view.paintDraft.bitState;
                  } else {
                    draft[s] = s > 0 ? draft[s - 1] : '0';
                  }
                }
              }
            }
          }
          renderBitSignal(
            this.ctx,
            drawSignal,
            row.y,
            row.height,
            transform,
            diagram.config.totalSteps,
            draft,
            {
              highlightGlitchBoundaries:
                view.selectedTool === 'paint' && view.paintMode === 'glitch',
            },
          );
          if (item.node) {
            renderSignalNodes(
              this.ctx,
              diagram,
              item.id,
              row.y,
              row.height,
              transform,
              diagram.config.totalSteps,
              item.node,
              showAnchorLetters,
            );
          }
          rowIndex++;
        } else if (item.type === 'vector') {
          let drawSignal = item;
          const draft = view.paintDraft;
          if (draft && draft.signalId === item.id && draft.lane === 'vector') {
            const lo = Math.min(draft.startStep, draft.endStep);
            const hi = Math.max(draft.startStep, draft.endStep);
            const value =
              draft.mode === 'paint' ? (draft.busLabel ?? 'data') : null;
            const busFill =
              draft.mode === 'paint'
                ? (draft.busColorFill ??
                  fillHexForColorIndex(view.activeBusColorIndex))
                : undefined;
            drawSignal = {
              ...item,
              segments: applyVectorSpan(
                item.segments,
                lo,
                hi,
                value,
                diagram.config.totalSteps,
                busFill,
              ),
            };
          }
          renderVectorSignal(this.ctx, drawSignal, row.y, row.height, transform);
          if (drawSignal.node) {
            renderSignalNodes(
              this.ctx,
              diagram,
              drawSignal.id,
              row.y,
              row.height,
              transform,
              diagram.config.totalSteps,
              drawSignal.node,
              showAnchorLetters,
            );
          }
          rowIndex++;
        } else {
          rowIndex++;
        }
      }
    };

    walkDraw(diagram.signals);
    this.ctx.restore();

    if (headHeight > 0 || footHeight > 0) {
      renderHeadFoot(
        this.ctx,
        diagram.config,
        transform,
        diagram.config.totalSteps,
        canvasWidth,
        axisOffset,
        waveformTop + contentH * transform.zoom,
      );
    }

    this.ctx.restore();
  }
}
