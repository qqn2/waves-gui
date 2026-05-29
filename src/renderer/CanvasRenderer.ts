import type { DiagramState, ViewState, BitState } from '../shared/types';
import { toggleBinaryBitState } from '../shared/bitToggle';
import { TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout, totalContentHeight } from './rowLayout';
import { renderGrid } from './renderGrid';
import { renderTimeAxis } from './renderTimeAxis';
import { renderBitSignal } from './renderBitSignal';
import { renderVectorSignal } from './renderVectorSignal';
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
    this.ctx.translate(0, axisOffset);
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
          let draft: BitState[] | null = null;
          if (view.paintDraft && view.paintDraft.signalId === item.id) {
            draft = [...item.states];
            const lo = Math.min(view.paintDraft.startStep, view.paintDraft.endStep);
            const hi = Math.max(view.paintDraft.startStep, view.paintDraft.endStep);
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
          renderBitSignal(
            this.ctx,
            item,
            row.y,
            row.height,
            transform,
            diagram.config.totalSteps,
            draft,
          );
          rowIndex++;
        } else if (item.type === 'vector') {
          renderVectorSignal(this.ctx, item, row.y, row.height, transform);
          rowIndex++;
        } else {
          rowIndex++;
        }
      }
    };

    walkDraw(diagram.signals);
    this.ctx.restore();
    this.ctx.restore();
  }
}
