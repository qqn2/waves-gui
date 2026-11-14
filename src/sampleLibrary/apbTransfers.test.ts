import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fromWavedromJSON } from '../wavedromBridge';
import type { WdRoot, WdSignal } from '../wavedromBridge/wdTypes';
import { busLabelFontPx, measureBusLabelWidth, segmentSpanPx, segmentUsableLabelPx } from '../shared/vectorLabelFit';
import { APB_LESSONS } from './apbLessons';

interface Lane extends WdSignal { name: string; wave: string; data?: string[] }
interface Source extends WdRoot { signal: Lane[]; config: { hscale: number } }
type Trace = Record<string, string[]>;
interface Transfer { setup: number; completion: number; waits: number; address: string; data: string; error: boolean }

function readSample(name: string): { source: Source; trace: Trace } {
  const source = JSON.parse(readFileSync(join(process.cwd(), 'public/samples', `amba-apb-${name}.json`), 'utf8')) as Source;
  const duration = source.signal.find((lane) => lane.name === 'PCLK')!.wave.length;
  const trace = Object.fromEntries(source.signal.map((lane) => {
    expect(lane.wave.length, `${name}: ${lane.name} duration`).toBe(duration);
    let previous = '';
    let label = 0;
    const values = [...lane.wave].map((character) => {
      if (character === '.') {
        expect(previous, `${name}: ${lane.name} uninitialized continuation`).not.toBe('');
      } else if (/[=2-9]/.test(character)) {
        previous = lane.data?.[label++] ?? '';
        expect(previous, `${name}: ${lane.name} missing bus label`).not.toBe('');
      } else {
        expect('01xP').toContain(character);
        previous = character;
      }
      return previous;
    });
    expect(label, `${name}: ${lane.name} unused data`).toBe(lane.data?.length ?? 0);
    return [lane.name, values];
  }));
  return { source, trace };
}

/** Evaluate the signals held in a cell at its right-hand rising edge. */
function checkTransfers(trace: Trace): Transfer[] {
  const transfers: Transfer[] = [];
  let setup: number | undefined;
  let waits = 0;
  for (let cycle = 0; cycle < trace.PCLK.length; cycle++) {
    if (trace.PSEL[cycle] === '0') {
      expect(trace.PENABLE[cycle], `idle PENABLE at ${cycle}`).toBe('0');
      expect(setup, 'an unfinished request cannot return to idle').toBeUndefined();
      continue;
    }
    expect(trace.PADDR[cycle], `address valid at ${cycle}`).not.toBe('x');
    expect(['0', '1']).toContain(trace.PWRITE[cycle]);
    if (trace.PWRITE[cycle] === '1') expect(trace.PWDATA[cycle]).not.toBe('x');
    if (trace.PENABLE[cycle] === '0') {
      expect(setup, 'SETUP cannot restart an unfinished ACCESS').toBeUndefined();
      setup = cycle;
      waits = 0;
      expect(trace.PSEL[cycle + 1], 'SETUP must lead to ACCESS').toBe('1');
      expect(trace.PENABLE[cycle + 1], 'SETUP lasts exactly one cycle').toBe('1');
      continue;
    }

    expect(setup, 'ACCESS needs a preceding SETUP').toBeDefined();
    expect(trace.PSEL[cycle - 1]).toBe('1');
    const stableRequest = ['PADDR', 'PWRITE', ...(trace.PWRITE[cycle] === '1' ? ['PWDATA'] : [])];
    for (const signal of stableRequest) {
      expect(trace[signal][cycle], `${signal} stable through ACCESS at ${cycle}`).toBe(trace[signal][cycle - 1]);
    }
    if (trace.PREADY[cycle] === '0') {
      waits++;
      expect(trace.PSEL[cycle + 1], 'PSEL held while waiting').toBe('1');
      expect(trace.PENABLE[cycle + 1], 'wait extends ACCESS').toBe('1');
      continue;
    }

    const data = trace.PWRITE[cycle] === '1' ? trace.PWDATA[cycle] : trace.PRDATA[cycle];
    expect(data, 'data must be valid at successful completion').not.toBe('x');
    transfers.push({ setup: setup!, completion: cycle, waits, address: trace.PADDR[cycle], data, error: trace.PSLVERR[cycle] === '1' });
    expect(trace.PENABLE[cycle + 1], 'every completion leaves ACCESS').toBe('0');
    setup = undefined;
  }
  expect(setup, 'trace must finish every request').toBeUndefined();
  return transfers;
}

const cases: Array<{ name: string; expected: Transfer[] }> = [
  { name: 'write', expected: [{ setup: 2, completion: 3, waits: 0, address: '0x1000', data: '0xDEADBEEF', error: false }] },
  { name: 'read', expected: [{ setup: 2, completion: 3, waits: 0, address: '0x2000', data: '0x5A5A', error: false }] },
  { name: 'write-wait', expected: [{ setup: 2, completion: 5, waits: 2, address: '0x1000', data: '0x0000002A', error: false }] },
  { name: 'read-wait', expected: [{ setup: 2, completion: 5, waits: 2, address: '0x2000', data: '0xA5A5', error: false }] },
  { name: 'back-to-back', expected: [
    { setup: 2, completion: 3, waits: 0, address: '0x1000', data: '0x00000011', error: false },
    { setup: 4, completion: 5, waits: 0, address: '0x1004', data: '0x00000022', error: false },
  ] },
  { name: 'error', expected: [{ setup: 2, completion: 4, waits: 1, address: '0x3000', data: '0x00000055', error: true }] },
];

describe('APB learning path', () => {
  it.each(cases)('$name has legal phases, stable requests, and the intended accepted transfers', ({ name, expected }) => {
    const { source, trace } = readSample(name);
    expect(checkTransfers(trace)).toEqual(expected);
    const diagram = fromWavedromJSON(source);
    expect(diagram.signals).toHaveLength(source.signal.length);
    expect(diagram.config.totalSteps).toBe(trace.PCLK.length);
  });

  it('delays read data until completion without requiring stable PRDATA during waits', () => {
    const { trace } = readSample('read-wait');
    expect(trace.PRDATA.slice(2, 5)).toEqual(['x', 'x', 'x']);
    expect(trace.PRDATA[5]).toBe('0xA5A5');
    // These unaccepted values are legal too; only the completion value is captured.
    trace.PRDATA[3] = '0x11111111';
    trace.PRDATA[4] = '0x22222222';
    expect(checkTransfers(trace)).toEqual(cases.find(({ name }) => name === 'read-wait')!.expected);
  });

  it('keeps PSEL high but inserts a fresh SETUP between transfers to the same peripheral', () => {
    const { trace } = readSample('back-to-back');
    expect(trace.PSEL.slice(2, 6)).toEqual(['1', '1', '1', '1']);
    expect(trace.PENABLE.slice(2, 6)).toEqual(['0', '1', '0', '1']);
    expect(trace.PADDR[3]).not.toBe(trace.PADDR[4]);
  });

  it('samples PSLVERR only when ACCESS completes, not during the wait', () => {
    const { trace } = readSample('error');
    expect(trace.PSLVERR.flatMap((value, cycle) => value === '1' ? [cycle] : [])).toEqual([4]);
    const expected = checkTransfers(trace);
    trace.PSLVERR[3] = '1'; // Legal but not recommended: no valid response while PREADY=0.
    expect(checkTransfers(trace)).toEqual(expected);
    trace.PSLVERR[4] = '0';
    expect(checkTransfers(trace)[0].error).toBe(false);
  });

  it.each(cases)('$name lesson highlights real lanes and completes at the correct stage boundary', ({ name, expected }) => {
    const { trace } = readSample(name);
    const lesson = APB_LESSONS[`amba/apb/${name}`];
    expect(lesson.protocol).toBe('APB');
    expect(lesson.signals.map(({ name: signal }) => signal).sort()).toEqual(Object.keys(trace).sort());
    for (const stage of lesson.stages) {
      expect(stage.start).toBeGreaterThanOrEqual(0);
      expect(stage.end).toBeGreaterThan(stage.start);
      expect(stage.end).toBeLessThanOrEqual(trace.PCLK.length);
      for (const signal of stage.signals) expect(trace).toHaveProperty(signal);
    }
    for (const transfer of expected) {
      expect(lesson.stages.some(({ start, end }) => start === transfer.setup && end === transfer.setup + 1)).toBe(true);
      expect(lesson.stages.some(({ start, end }) => start === transfer.completion && end === transfer.completion + 1)).toBe(true);
    }
    // Keep bus values in the explanations consistent with the actual trace.
    const explanation = [lesson.summary, ...lesson.stages.map(({ description }) => description)].join(' ');
    for (const transfer of expected) {
      expect(explanation).toContain(transfer.address);
      expect(explanation).toContain(transfer.data);
    }
  });

  it('orders six focused lessons from the basic phases to an error response', () => {
    expect(Object.entries(APB_LESSONS).sort(([, a], [, b]) => a.order - b.order).map(([id]) => id))
      .toEqual(cases.map(({ name }) => `amba/apb/${name}`));
    expect(new Set(Object.values(APB_LESSONS).map(({ order }) => order)).size).toBe(cases.length);
  });

  it.each(cases.slice(2))('$name leaves enough width for every bus label at the default scale', ({ name }) => {
    const { source } = readSample(name);
    const diagram = fromWavedromJSON(source);
    for (const signal of diagram.signals) {
      if (signal.type !== 'vector') continue;
      for (const segment of signal.segments) {
        if (!segment.value || segment.value === 'x') continue;
        const available = segmentUsableLabelPx(segmentSpanPx(segment, signal, source.config.hscale), source.config.hscale);
        // No overflow slack: teaching values must fit at full size, without compression.
        expect(measureBusLabelWidth(segment.value, busLabelFontPx()), `${name}: ${segment.value}`).toBeLessThanOrEqual(available);
      }
    }
  });
});
