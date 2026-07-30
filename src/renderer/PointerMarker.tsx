import type {
  AnalogueTransition,
  BitState,
  DiagramState,
  EdgeAnchorPending,
  Signal,
  Tool,
  ViewState,
} from '../shared/types';
import { CELL_WIDTH, ROW_HEIGHT, TIME_AXIS_HEIGHT } from '../shared/constants';
import { buildRowLayout } from './rowLayout';
import { measureHeadFoot } from './renderHeadFoot';
import type { HitTestResult } from './hitTest';
import { findSignal } from '../shared/store';
import { toggleBinaryBitState } from '../shared/bitToggle';
import { stepLogicalX, stepLogicalXEnd } from './laneTiming';

function analogueHoverShape(
  signal: Signal,
  step: number,
  kind: AnalogueTransition,
  requestedValue: number,
): { path: string; points: Array<{ x: number; y: number }> } {
  const min = signal.analogueMin ?? 0;
  const max = signal.analogueMax ?? 1.8;
  const span = Math.max(Number.EPSILON, max - min);
  const previous =
    step > 0
      ? signal.analogueCells?.[step - 1]?.value ?? min
      : min;
  const target = kind === 'hold' ? previous : requestedValue;
  const y = (value: number) =>
    8 + (1 - Math.max(0, Math.min(1, (value - min) / span))) * 84;
  const previousY = y(previous);
  const targetY = y(target);

  if (kind === 'hold') {
    return { path: `M0 ${previousY}H100`, points: [] };
  }
  if (kind === 'step') {
    return {
      path: `M0 ${previousY}H10V${targetY}H100`,
      points: [],
    };
  }
  if (kind === 'capacitive') {
    return {
      path: `M0 ${previousY}C18 ${previousY} 12 ${targetY} 48 ${targetY}S82 ${targetY} 100 ${targetY}`,
      points: [],
    };
  }
  if (kind === 'metastable-low') {
    return {
      path: 'M0 50C8 8 16 92 24 50S40 14 48 55S64 72 74 69S88 84 100 84',
      points: [],
    };
  }
  if (kind === 'metastable-high') {
    return {
      path: 'M0 50C8 92 16 8 24 50S40 86 48 45S64 28 74 31S88 16 100 16',
      points: [],
    };
  }
  if (kind === 'impulse-low') {
    return { path: 'M0 8H50V92V8H100', points: [] };
  }
  if (kind === 'impulse-high') {
    return { path: 'M0 92H50V8V92H100', points: [] };
  }
  return {
    path: `M0 ${previousY}L100 ${targetY}`,
    points: [{ x: 0, y: previousY }, { x: 100, y: targetY }],
  };
}

export interface PointerMarkerProps {
  hit: HitTestResult | null;
  diagram: DiagramState;
  view: ViewState;
  tool?: Tool;
  edgePending?: EdgeAnchorPending | null;
}

export function PointerMarker({
  hit,
  diagram,
  view,
  tool = 'cursor',
  edgePending = null,
}: PointerMarkerProps) {
  if (!hit?.signalId || hit.step === null) return null;

  const rows = buildRowLayout(diagram.signals);
  const row = rows.find((r) => r.id === hit.signalId);
  if (!row || row.type === 'group') return null;

  let targetSignal: import('../shared/types').Signal | null = null;
  findSignal(diagram.signals, hit.signalId, (signal) => {
    targetSignal = signal;
  });
  if (!targetSignal) return null;
  const scale = diagram.config.hscale * view.zoom;
  const left = stepLogicalX(targetSignal, hit.step) * scale - view.scrollX;
  const cellW =
    (stepLogicalXEnd(targetSignal, hit.step) - stepLogicalX(targetSignal, hit.step)) * scale;
  const axis = TIME_AXIS_HEIGHT;
  const { headHeight } = measureHeadFoot(diagram.config);
  const waveformTop = axis + headHeight;
  const top = row.y * view.zoom - view.scrollY + waveformTop;
  const height = row.height * view.zoom;
  const timingDivisions =
    diagram.compatibility?.extensionsEnabled === true
      ? diagram.config.ticksPerStep ?? 1
      : 1;
  const rawPointerX = hit.canvasX ?? left + cellW / 2;
  const pointerLogicalX =
    (rawPointerX + view.scrollX) / Math.max(Number.EPSILON, scale);
  const snappedTick = Math.max(
    0,
    Math.min(
      diagram.config.totalSteps * timingDivisions,
      Math.round(pointerLogicalX / CELL_WIDTH * timingDivisions),
    ),
  );
  const precisionX =
    snappedTick / timingDivisions * CELL_WIDTH * scale - view.scrollX;
  const majorTick = Math.floor(snappedTick / timingDivisions);
  const minorTick = snappedTick % timingDivisions;
  const tickLabel =
    timingDivisions > 1 && minorTick > 0
      ? `${majorTick}+${minorTick}/${timingDivisions}`
      : `${majorTick}`;

  if (tool === 'structured-arrow') {
    const currentX =
      timingDivisions > 1 ? precisionX : left + cellW / 2;
    const currentY = top + height / 2;
    const pending = view.structuredArrowPending;
    const startX = pending
      ? pending.x * CELL_WIDTH * scale - view.scrollX
      : null;
    const startY = pending
      ? waveformTop + pending.y * ROW_HEIGHT * view.zoom - view.scrollY
      : null;
    return (
      <>
        {startX !== null && startY !== null && (
          <>
            <svg className="structuredArrowPreview" aria-hidden>
              <line x1={startX} y1={startY} x2={currentX} y2={currentY} />
            </svg>
            <div
              className="structuredArrowStart"
              style={{ left: startX, top: startY }}
              aria-hidden
            />
          </>
        )}
        <div
          className="structuredArrowCursor"
          style={{ left: currentX, top: currentY }}
          aria-hidden
        />
        {timingDivisions > 1 ? (
          <div
            className="pointerTickBadge"
            style={{ left: currentX, top: waveformTop }}
            aria-hidden
          >
            {tickLabel}
          </div>
        ) : null}
        <div
          className="pointerMarkerLabel"
          style={{ left: currentX + 10, top: currentY + 8 }}
        >
          {pending ? 'Click arrow end · Esc cancels' : 'Click arrow start'}
        </div>
      </>
    );
  }

  let signalName = hit.signalId;
  let current: BitState | null = null;
  signalName = targetSignal.name;
  if (targetSignal.type === 'bit') current = targetSignal.states[hit.step];

  const paintHint =
    tool === 'paint' && hit.signalType === 'bit' && current !== null
      ? view.paintMode === 'glitch'
        ? ' · glitch'
        : view.paintMode === 'gap'
          ? ' · |'
          : view.paintMode === 'set'
          ? ` → ${view.activeBitState}`
          : ` ${current}→${toggleBinaryBitState(current)}`
      : '';
  const analogueKindHint =
    view.activeAnalogueKind === 'hold'
      ? '. hold previous'
      : view.activeAnalogueKind === 'step'
        ? `s step → ${view.activeAnalogueValue}`
        : view.activeAnalogueKind === 'capacitive'
          ? `c curve → ${view.activeAnalogueValue}`
          : view.activeAnalogueKind === 'samples'
            ? `a samples → ${view.activeAnalogueValue}`
            : view.activeAnalogueKind === 'metastable-low'
              ? 'm metastable to low'
              : view.activeAnalogueKind === 'metastable-high'
                ? 'M metastable to high'
                : view.activeAnalogueKind === 'impulse-low'
                  ? 'i downward impulse'
                  : 'I upward impulse';
  const analoguePaintHint =
    tool === 'analogue-paint' && hit.signalType === 'analogue'
      ? ` · ${analogueKindHint}`
      : '';
  const analoguePreview =
    tool === 'analogue-paint' && targetSignal.type === 'analogue'
      ? analogueHoverShape(
          targetSignal,
          hit.step,
          view.activeAnalogueKind,
          view.activeAnalogueValue,
        )
      : null;

  let edgeHint = '';
  if (tool === 'arrow') {
    if (edgePending?.kind === 'arrow') {
      const same =
        hit.signalId === edgePending.signalId && hit.step === edgePending.step;
      edgeHint = same
        ? ` · anchor ${edgePending.char}`
        : hit.step !== null
          ? ` · → T${hit.step}`
          : '';
    } else {
      edgeHint = ' · press and drag';
    }
  } else if (tool === 'timespan') {
    if (edgePending?.kind === 'timespan') {
      const sameRow = hit.signalId === edgePending.signalId;
      edgeHint = sameRow
        ? ` · T${edgePending.startStep}→T${hit.step}`
        : ' · wrong row';
    } else {
      edgeHint = ' · press start';
    }
  }

  return (
    <>
      <div
        className="pointerPrecisionLine"
        style={{ left: precisionX, top: waveformTop }}
        aria-hidden
      />
      <div
        className="pointerPrecisionTarget"
        style={{ left: precisionX, top: top + height / 2 }}
        aria-hidden
      />
      <div
        className="pointerTickBadge"
        style={{ left: precisionX, top: waveformTop }}
        aria-hidden
      >
        {tickLabel}
      </div>
      {analoguePreview ? (
        <svg
          className="analogueBrushGhost"
          style={{
            left: left + 3,
            width: Math.max(0, cellW - 6),
            top: top + 3,
            height: Math.max(0, height - 6),
          }}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path d={analoguePreview.path} />
          {analoguePreview.points.map((point) => (
            <circle key={`${point.x}-${point.y}`} cx={point.x} cy={point.y} r="3.5" />
          ))}
        </svg>
      ) : null}
      {tool !== 'cursor' && tool !== 'select' ? (
        <div
          className="pointerMarkerLabel pointerMarkerLabelCompact"
          style={{ left: precisionX + 7, top: top + 3 }}
        >
          {signalName}
          {paintHint}
          {analoguePaintHint}
          {edgeHint}
        </div>
      ) : null}
    </>
  );
}
