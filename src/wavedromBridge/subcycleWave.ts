/**
 * WaveDrom sub-cycle wave expansion for native canvas rendering.
 * Ports wavedrom/lib/parse-wave-lane.js + gen-*-brick.js (simplified to lane levels).
 */
import type { BitState } from '../shared/types';

export function hasSubcycleSyntax(wave: string): boolean {
  return wave.includes('<') || wave.includes('>');
}

const WAVE_BODY_CHARS = /^[0-9.xXzZuUdDpPnN.=|2-9<>]*$/;

export function isValidWaveString(wave: string): boolean {
  return WAVE_BODY_CHARS.test(wave);
}

export type LaneLevel = BitState;

export interface WaveColumnDraw {
  levels: LaneLevel[];
  gapAfter?: boolean;
}

function genBrick(texts: string | string[], extra: number, times: number): string[] {
  const R: string[] = [];
  let list = Array.isArray(texts) ? texts : [texts];
  if (list.length === 4) {
    for (let j = 0; j < times; j++) {
      R.push(list[0]!);
      for (let i = 0; i < extra; i++) R.push(list[1]!);
      R.push(list[2]!);
      for (let i = 0; i < extra; i++) R.push(list[3]!);
    }
    return R;
  }
  if (list.length === 1) list = [list[0]!, list[0]!];
  R.push(list[0]!);
  for (let i = 0; i < times * (2 * (extra + 1)) - 1; i++) {
    R.push(list[1]!);
  }
  return R;
}

const FIRST_LUT: Record<string, string | string[]> = {
  p: ['pclk', '111', 'nclk', '000'],
  n: ['nclk', '000', 'pclk', '111'],
  P: ['Pclk', '111', 'nclk', '000'],
  N: ['Nclk', '000', 'pclk', '111'],
  l: '000',
  L: '000',
  '0': '000',
  h: '111',
  H: '111',
  '1': '111',
  '=': 'vvv-2',
  '2': 'vvv-2',
  '3': 'vvv-3',
  '4': 'vvv-4',
  '5': 'vvv-5',
  '6': 'vvv-6',
  '7': 'vvv-7',
  '8': 'vvv-8',
  '9': 'vvv-9',
  d: 'ddd',
  u: 'uuu',
  z: 'zzz',
};

function genFirstWaveBrick(text: string, extra: number, times: number): string[] {
  const entry = FIRST_LUT[text] ?? 'xxx';
  return genBrick(entry, extra, times);
}

function genWaveBrick(text: string, extra: number, times: number): string[] {
  const atext = text.split('');
  const a = atext[0]!;
  const b = atext[1] ?? 'x';

  const x1: Record<string, string> = {
    p: 'pclk', n: 'nclk', P: 'Pclk', N: 'Nclk',
    h: 'pclk', l: 'nclk', H: 'Pclk', L: 'Nclk',
  };
  const x2: Record<string, string> = {
    '0': '0', '1': '1', x: 'x', d: 'd', u: 'u', z: 'z',
    '=': 'v', '2': 'v', '3': 'v', '4': 'v', '5': 'v', '6': 'v', '7': 'v', '8': 'v', '9': 'v',
  };
  const x3: Record<string, string> = {
    '0': '', '1': '', x: '', d: '', u: '', z: '',
    '=': '-2', '2': '-2', '3': '-3', '4': '-4', '5': '-5', '6': '-6', '7': '-7', '8': '-8', '9': '-9',
  };
  const y1: Record<string, string> = {
    p: '0', n: '1', P: '0', N: '1', h: '1', l: '0', H: '1', L: '0',
    '0': '0', '1': '1', x: 'x', d: 'd', u: 'u', z: 'z',
    '=': 'v', '2': 'v', '3': 'v', '4': 'v', '5': 'v', '6': 'v', '7': 'v', '8': 'v', '9': 'v',
  };
  const y2: Record<string, string> = {
    p: '', n: '', P: '', N: '', h: '', l: '', H: '', L: '',
    '0': '', '1': '', x: '', d: '', u: '', z: '',
    '=': '-2', '2': '-2', '3': '-3', '4': '-4', '5': '-5', '6': '-6', '7': '-7', '8': '-8', '9': '-9',
  };
  const x4: Record<string, string> = {
    p: '111', n: '000', P: '111', N: '000', h: '111', l: '000', H: '111', L: '000',
    '0': '000', '1': '111', x: 'xxx', d: 'ddd', u: 'uuu', z: 'zzz',
    '=': 'vvv-2', '2': 'vvv-2', '3': 'vvv-3', '4': 'vvv-4', '5': 'vvv-5',
    '6': 'vvv-6', '7': 'vvv-7', '8': 'vvv-8', '9': 'vvv-9',
  };
  const x5: Record<string, string> = { p: 'nclk', n: 'pclk', P: 'nclk', N: 'pclk' };
  const x6: Record<string, string> = { p: '000', n: '111', P: '000', N: '111' };
  const xclude: Record<string, string> = {
    hp: '111', Hp: '111', ln: '000', Ln: '000', nh: '111', Nh: '111', pl: '000', Pl: '000',
  };

  const tmp0 = x4[b];
  let tmp1 = x1[b];
  if (tmp1 === undefined) {
    const tmp2 = x2[b];
    if (tmp2 === undefined) return genBrick('xxx', extra, times);
    const tmp3 = y1[a];
    if (tmp3 === undefined) return genBrick('xxx', extra, times);
    return genBrick([tmp3 + 'm' + tmp2 + y2[a] + x3[b], tmp0], extra, times);
  }
  const tmp4 = xclude[text];
  if (tmp4 !== undefined) tmp1 = tmp4;
  const tmp5 = x5[b];
  if (tmp5 === undefined) return genBrick([tmp1, tmp0], extra, times);
  return genBrick([tmp1, tmp0, tmp5, x6[b]], extra, times);
}

function brickToLevel(brick: string): LaneLevel {
  if (brick === '000' || brick === '0') return '0';
  if (brick === '111' || brick === '1') return '1';
  if (brick.includes('xxx')) return 'x';
  if (brick.includes('zzz')) return 'z';
  if (brick.includes('ddd')) return 'd';
  if (brick.includes('uuu')) return 'u';
  if (brick.includes('Pclk')) return 'P';
  if (brick.includes('Nclk')) return 'N';
  if (brick.includes('pclk')) return 'p';
  if (brick.includes('nclk')) return 'n';
  const mIdx = brick.indexOf('m');
  if (mIdx >= 0) {
    const tail = brick.slice(mIdx + 1);
    if (tail.includes('1') || tail.includes('pclk') || tail.includes('Pclk')) return '1';
    if (tail.includes('0') || tail.includes('nclk') || tail.includes('Nclk')) return '0';
    if (tail.includes('x')) return 'x';
    if (tail.includes('z')) return 'z';
    if (tail.includes('d')) return 'd';
    if (tail.includes('u')) return 'u';
  }
  return '0';
}

function bricksToColumns(
  bricks: string[],
  extra: number,
  subcycle: boolean,
  gapAfter: boolean,
): WaveColumnDraw[] {
  if (subcycle) {
    return [{ levels: bricks.map(brickToLevel), gapAfter }];
  }
  const cols: WaveColumnDraw[] = [];
  const bricksPerCol = 2 * (extra + 1);
  for (let i = 0; i < bricks.length; i += bricksPerCol) {
    const slice = bricks.slice(i, i + bricksPerCol);
    if (slice.length === 0) continue;
    cols.push({
      levels: slice.map(brickToLevel),
      gapAfter: gapAfter && i + bricksPerCol >= bricks.length,
    });
  }
  return cols;
}

/** Expand a WaveDrom wave string into per-column draw data (matches upstream parse-wave-lane). */
export function expandWaveToColumns(
  wave: string,
  hscale: number,
  period = 1,
): WaveColumnDraw[] {
  const extra = Math.max(0, Math.floor(hscale) - 1);
  const stack = wave.split('');
  const columns: WaveColumnDraw[] = [];

  let next = stack.shift();
  if (next === undefined) return columns;

  let repeats = 1;
  let gapAfter = false;
  while (stack[0] === '.' || stack[0] === '|') {
    const ch = stack.shift()!;
    if (ch === '|') gapAfter = true;
    repeats += 1;
  }

  const firstBricks = genFirstWaveBrick(next, extra, repeats);
  const firstCols = bricksToColumns(firstBricks, extra, false, gapAfter);
  if (firstCols.length > 0) {
    firstCols[firstCols.length - 1]!.gapAfter = gapAfter || firstCols[firstCols.length - 1]!.gapAfter;
  }
  columns.push(...firstCols);

  let top = next;
  let subCycle = false;
  while (stack.length) {
    top = next;
    next = stack.shift()!;
    if (next === '<') {
      subCycle = true;
      next = stack.shift()!;
    }
    if (next === '>') {
      subCycle = false;
      next = stack.shift()!;
    }
    repeats = 1;
    gapAfter = false;
    while (stack[0] === '.' || stack[0] === '|') {
      const ch = stack.shift()!;
      if (ch === '|') gapAfter = true;
      repeats += 1;
    }
    const times = subCycle ? Math.max(1, repeats - period) : repeats;
    const bricks = genWaveBrick(top + next, subCycle ? 0 : extra, times);
    const chunk = bricksToColumns(bricks, extra, subCycle, gapAfter);
    if (chunk.length > 0) {
      chunk[chunk.length - 1]!.gapAfter = gapAfter || chunk[chunk.length - 1]!.gapAfter;
    }
    columns.push(...chunk);
  }

  return columns;
}

export function waveColumnCount(wave: string, period = 1, hscale = 1): number {
  return expandWaveToColumns(wave, hscale, period).length;
}

export function padWaveColumns(
  columns: WaveColumnDraw[],
  totalSteps: number,
): WaveColumnDraw[] {
  const n = Math.max(0, totalSteps);
  if (n === 0) return [];
  if (columns.length === n) return columns;
  if (columns.length < n) {
    const last = columns[columns.length - 1];
    const hold: LaneLevel = last?.levels[last.levels.length - 1] ?? '0';
    const out = [...columns];
    while (out.length < n) out.push({ levels: [hold] });
    return out;
  }
  return columns.slice(0, n);
}

/** Pad or trim a preserved wave string to the diagram step count using WaveDrom `.` continuation. */
export function padWaveOverride(wave: string, totalSteps: number, period = 1, hscale = 1): string {
  const cols = expandWaveToColumns(wave, hscale, period);
  const n = Math.max(0, totalSteps);
  if (cols.length === n) return wave;
  if (cols.length < n) return wave + '.'.repeat(n - cols.length);
  return truncateWaveToColumns(wave, n);
}

function truncateWaveToColumns(wave: string, columns: number): string {
  if (columns <= 0) return '';
  let out = '';
  let count = 0;
  const stack = wave.split('');
  let next = stack.shift();
  if (next === undefined) return '0'.slice(0, columns);

  let repeats = 1;
  while (stack[0] === '.' || stack[0] === '|') {
    out += stack.shift();
    repeats += 1;
  }
  out += next;
  count += repeats;
  if (count >= columns) return out.slice(0, out.length - Math.max(0, count - columns));

  while (stack.length && count < columns) {
    next = stack.shift()!;
    if (next === '<') {
      out += '<';
      next = stack.shift()!;
    }
    if (next === '>') {
      out += '>';
      next = stack.shift()!;
    }
    repeats = 1;
    while (stack[0] === '.' || stack[0] === '|') {
      out += stack.shift();
      repeats += 1;
    }
    out += next;
    count += repeats;
  }

  if (count > columns) {
    while (count > columns && (out.endsWith('.') || out.endsWith('|'))) {
      out = out.slice(0, -1);
      count -= 1;
    }
  }
  return out;
}
