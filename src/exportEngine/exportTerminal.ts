import { saveAs } from 'file-saver';
import type { DiagramState, Signal, SignalOrGroup, ViewState } from '../shared/types';
import { exportBaseName } from './fileName';

const BLOCKS = '▁▂▃▄▅▆▇█';

function analogueGlyph(signal: Signal, value: number): string {
  const min = signal.analogueMin ?? 0;
  const max = signal.analogueMax ?? 1.8;
  const ratio = max > min ? (value - min) / (max - min) : 0;
  const index = Math.max(0, Math.min(BLOCKS.length - 1, Math.round(
    ratio * (BLOCKS.length - 1),
  )));
  return BLOCKS[index]!;
}

function signalCells(signal: Signal, totalSteps: number): string {
  if (signal.type === 'analogue') {
    return (signal.analogueCells ?? [])
      .slice(0, totalSteps)
      .map((cell) => analogueGlyph(signal, cell.value))
      .join(' ');
  }
  if (signal.type === 'vector') {
    return Array.from({ length: totalSteps }, (_, step) => {
      const segment = signal.segments.find(
        (item) => step >= item.startStep && step < item.endStep,
      );
      return segment?.value ? `[${segment.value}]` : '·';
    }).join(' ');
  }
  return signal.states.slice(0, totalSteps).map((state) => state || '·').join(' ');
}

/** Deterministic UTF-8 terminal rendering with groups and annotation notes. */
export function buildTerminalDiagram(diagram: DiagramState): string {
  const rows: Array<{ label: string; signal: Signal; depth: number }> = [];
  const groupLines: Array<{ label: string; depth: number }> = [];
  const walk = (items: SignalOrGroup[], depth: number) => {
    for (const item of items) {
      if (item.type === 'group') {
        groupLines.push({ label: item.name, depth });
        walk(item.children, depth + 1);
      } else if (item.type !== 'spacer') {
        rows.push({ label: item.name, signal: item, depth });
      }
    }
  };
  walk(diagram.signals, 0);
  const labelWidth = Math.max(
    8,
    ...rows.map(({ label, depth }) => label.length + depth * 2),
    ...groupLines.map(({ label, depth }) => label.length + depth * 2 + 2),
  );
  const lines = [
    `${'Signal'.padEnd(labelWidth)} | ${Array.from(
      { length: diagram.config.totalSteps },
      (_, index) => String(index).padStart(2, ' '),
    ).join(' ')}`,
    `${'-'.repeat(labelWidth)}-+-${'-'.repeat(diagram.config.totalSteps * 3 - 1)}`,
  ];
  const render = (items: SignalOrGroup[], depth: number) => {
    for (const item of items) {
      if (item.type === 'group') {
        lines.push(`${`${'  '.repeat(depth)}[${item.name}]`.padEnd(labelWidth)} |`);
        render(item.children, depth + 1);
      } else if (item.type !== 'spacer') {
        const label = `${'  '.repeat(depth)}${item.name}`;
        lines.push(
          `${label.padEnd(labelWidth)} | ${signalCells(item, diagram.config.totalSteps)}`,
        );
      }
    }
  };
  render(diagram.signals, 0);
  if ((diagram.annotations?.length ?? 0) > 0) {
    lines.push('', 'Annotations:');
    for (const annotation of diagram.annotations ?? []) {
      const text = 'text' in annotation ? annotation.text : annotation.type;
      lines.push(`- ${annotation.type}: ${text}`);
    }
  }
  return `${lines.join('\n')}\n`;
}

export function exportTerminal(diagram: DiagramState, view: ViewState): void {
  const blob = new Blob(
    [buildTerminalDiagram(diagram)],
    { type: 'text/plain;charset=utf-8' },
  );
  saveAs(blob, `${exportBaseName(view)}.terminal.txt`);
}
