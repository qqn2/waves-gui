import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Lane { name: string; wave: string; data?: string[] }
type SignalTree = Lane | Record<string, never> | [string, ...SignalTree[]];
type Trace = Record<string, string[]>;

/** Each cell is the value held before the rising edge at its right boundary. */
function readTrace(file: string): Trace {
  const root = JSON.parse(readFileSync(join(process.cwd(), 'public/samples', file), 'utf8')) as { signal: SignalTree[] };
  const lanes: Lane[] = [];
  function visit(items: SignalTree[]) {
    for (const item of items) {
      if (Array.isArray(item)) visit(item.slice(1) as SignalTree[]);
      else if ('wave' in item) lanes.push(item as Lane);
    }
  }
  visit(root.signal);
  const duration = lanes.find((lane) => /CLK$/.test(lane.name))!.wave.length;
  return Object.fromEntries(lanes.map((lane) => {
    expect(lane.wave.length, `${file}: ${lane.name} duration`).toBe(duration);
    let label = 0;
    let previous = '';
    const values = [...lane.wave].map((character) => {
      if (character === '.') {
        expect(previous).not.toBe('');
      } else if (/[=2-9]/.test(character)) {
        previous = lane.data?.[label++] ?? '';
        expect(previous, `${file}: ${lane.name} missing bus label`).not.toBe('');
      } else {
        expect('01xP').toContain(character);
        previous = character;
      }
      return previous;
    });
    expect(label, `${file}: ${lane.name} unused bus labels`).toBe(lane.data?.length ?? 0);
    return [lane.name.replace(/\[.*\]/, ''), values];
  }));
}

function acceptedCycles(trace: Trace, valid: string, ready: string): number[] {
  return trace[valid].flatMap((value, cycle) => value === '1' && trace[ready][cycle] === '1' ? [cycle] : []);
}

function checkAXIChannel(trace: Trace, channel: string, payloads: string[]): number[] {
  const valid = trace[`${channel}VALID`];
  const ready = trace[`${channel}READY`];
  for (let cycle = 0; cycle < valid.length; cycle++) {
    if (valid[cycle] !== '1') continue;
    for (const payload of payloads) expect(trace[payload][cycle], `${payload} valid at ${cycle}`).not.toBe('x');
    if (ready[cycle] === '0') {
      expect(valid[cycle + 1], `${channel} dropped VALID during stall`).toBe('1');
      for (const payload of payloads) {
        expect(trace[payload][cycle + 1], `${payload} changed during stall`).toBe(trace[payload][cycle]);
      }
    }
  }
  const accepted = acceptedCycles(trace, `${channel}VALID`, `${channel}READY`);
  expect(accepted, `${channel} must transfer exactly once`).toHaveLength(1);
  return accepted;
}

describe('AMBA teaching trace semantics', () => {
  it.each(['write', 'read'])('APB %s keeps setup information valid through one access', (direction) => {
    const trace = readTrace(`amba-apb-${direction}.json`);
    const setup: number[] = [];
    const completion: number[] = [];
    for (let cycle = 0; cycle < trace.PCLK.length; cycle++) {
      if (trace.PSEL[cycle] !== '1') continue;
      expect(trace.PWRITE[cycle]).toBe(direction === 'write' ? '1' : '0');
      expect(trace.PADDR[cycle]).not.toBe('x');
      if (trace.PENABLE[cycle] === '0') {
        setup.push(cycle);
        expect(trace.PENABLE[cycle + 1]).toBe('1');
      } else {
        expect(trace.PSEL[cycle - 1]).toBe('1');
        expect(trace.PENABLE[cycle - 1]).toBe('0');
        expect(trace.PADDR[cycle]).toBe(trace.PADDR[cycle - 1]);
        expect(trace.PREADY[cycle]).toBe('1');
        expect(trace.PSLVERR[cycle]).toBe('0');
        expect(trace.PENABLE[cycle + 1]).toBe('0');
        completion.push(cycle);
        if (direction === 'write') {
          expect(trace.PWDATA[cycle]).toBe('0xDEADBEEF');
          expect(trace.PWDATA[cycle - 1]).toBe(trace.PWDATA[cycle]);
        } else expect(trace.PRDATA[cycle]).toBe('0x5A5A');
      }
    }
    expect(setup).toHaveLength(1);
    expect(completion).toHaveLength(1);
  });

  it('AHB single write places data in the cycle after its accepted address', () => {
    const trace = readTrace('amba-ahb-write.json');
    const addresses = trace.HTRANS.flatMap((kind, cycle) => (
      kind === 'NONSEQ' && trace.HSEL[cycle] === '1' && trace.HREADY[cycle] === '1' ? [cycle] : []
    ));
    expect(addresses).toHaveLength(1);
    const cycle = addresses[0];
    expect(trace.HADDR[cycle]).toBe('0xA000');
    expect(trace.HWRITE[cycle]).toBe('1');
    expect(trace.HSIZE[cycle]).toBe('32-bit');
    expect(trace.HBURST[cycle]).toBe('SINGLE');
    expect(trace.HWDATA[cycle + 1]).toBe('0x1234');
    expect(trace.HREADY[cycle + 1]).toBe('1');
    expect(trace.HRESP[cycle + 1]).toBe('0');
    expect(trace.HTRANS[cycle + 1]).toBe('IDLE');
  });

  it('AHB burst ignores BUSY and completes four ordered reads across a wait state', () => {
    const trace = readTrace('amba-ahb-transfer-types.json');
    const accepted: string[] = [];
    const completed: string[] = [];
    let pending: string | null = null;
    let busyCount = 0;
    let waits = 0;
    for (let cycle = 0; cycle < trace.HCLK.length; cycle++) {
      if (trace.HREADY[cycle] === '0') {
        waits++;
        expect(pending).not.toBeNull();
        for (const name of ['HADDR', 'HTRANS', 'HWRITE', 'HSIZE', 'HBURST']) {
          expect(trace[name][cycle + 1], `${name} stable during wait`).toBe(trace[name][cycle]);
        }
        continue;
      }
      if (pending) {
        expect(trace.HRDATA[cycle]).toBe(`Data (${pending})`);
        expect(trace.HRESP[cycle]).toBe('0');
        completed.push(pending);
        pending = null;
      }
      if (trace.HTRANS[cycle] === 'BUSY') {
        busyCount++;
        expect(trace.HADDR[cycle]).toBe(trace.HADDR[cycle + 1]);
        expect(trace.HREADY[cycle + 1]).toBe('1');
        expect(trace.HRESP[cycle + 1]).toBe('0');
        expect(trace.HRDATA[cycle + 1]).toBe('x');
      }
      if (trace.HSEL[cycle] === '1' && ['NONSEQ', 'SEQ'].includes(trace.HTRANS[cycle])) {
        expect(trace.HTRANS[cycle]).toBe(accepted.length ? 'SEQ' : 'NONSEQ');
        expect(trace.HWRITE[cycle]).toBe('0');
        expect(trace.HSIZE[cycle]).toBe('word (32-bit)');
        expect(trace.HBURST[cycle]).toBe('INCR');
        pending = trace.HADDR[cycle];
        accepted.push(pending);
      }
    }
    expect(accepted).toEqual(['0x20', '0x24', '0x28', '0x2C']);
    expect(completed).toEqual(accepted);
    expect(pending).toBeNull();
    expect(busyCount).toBe(1);
    expect(waits).toBe(1);
  });

  it('AXI write holds each channel until acceptance and responds after address and final data', () => {
    const trace = readTrace('amba-axi-write.json');
    const [address] = checkAXIChannel(trace, 'AW', ['AWADDR', 'AWLEN', 'AWSIZE', 'AWBURST']);
    const [data] = checkAXIChannel(trace, 'W', ['WDATA', 'WSTRB', 'WLAST']);
    const [response] = checkAXIChannel(trace, 'B', ['BRESP']);
    expect(trace.AWADDR[address]).toBe('0x40001000');
    expect(trace.AWLEN[address]).toBe('0');
    expect(trace.WDATA[data]).toBe('0xCAFEBABE');
    expect(trace.WSTRB[data]).toBe('0xF');
    expect(trace.WLAST[data]).toBe('1');
    expect(trace.BRESP[response]).toBe('OKAY');
    const responseStart = trace.BVALID.indexOf('1');
    expect(responseStart).toBeGreaterThan(address);
    expect(responseStart).toBeGreaterThan(data);
  });

  it('AXI read keeps data, response, and LAST stable under backpressure', () => {
    const trace = readTrace('amba-axi-read.json');
    const [address] = checkAXIChannel(trace, 'AR', ['ARADDR', 'ARLEN', 'ARSIZE', 'ARBURST']);
    const [data] = checkAXIChannel(trace, 'R', ['RDATA', 'RRESP', 'RLAST']);
    expect(trace.ARADDR[address]).toBe('0x07000100');
    expect(trace.ARLEN[address]).toBe('0');
    expect(trace.RDATA[data]).toBe('0x5A5A5A5A');
    expect(trace.RRESP[data]).toBe('OKAY');
    expect(trace.RLAST[data]).toBe('1');
    expect(trace.RVALID.indexOf('1')).toBeGreaterThan(address);
    expect(trace.RVALID.indexOf('1')).toBeLessThan(data);
  });
});
