import type { WdRoot, WdSignal } from '../wavedromBridge/wdTypes';

type VcdVar = {
  id: string;
  name: string;
  width: number;
};

type Change = {
  time: number;
  value: string;
};

function cleanName(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function scalarToWaveChar(value: string): string {
  const ch = value.trim().toLowerCase()[0];
  if (ch === '0' || ch === '1' || ch === 'z') return ch;
  return 'x';
}

function vectorLabel(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^01xz]/g, '');
  return normalized.length > 0 ? normalized : 'x';
}

function tokenizeDefinitions(vcd: string): string[] {
  const definitionText = vcd.split('$enddefinitions')[0] ?? vcd;
  return definitionText.match(/\$var\s+[^$]*?\$end/g) ?? [];
}

function parseVars(vcd: string): VcdVar[] {
  const vars: VcdVar[] = [];
  for (const stmt of tokenizeDefinitions(vcd)) {
    const body = stmt.replace(/^\$var\s+/, '').replace(/\s+\$end$/, '').trim();
    const parts = body.split(/\s+/);
    if (parts.length < 4) continue;
    const width = Number.parseInt(parts[1] ?? '1', 10);
    const id = parts[2];
    const name = cleanName(parts.slice(3).join(' '));
    if (!id || !name || !Number.isFinite(width)) continue;
    vars.push({ id, name, width: Math.max(1, width) });
  }
  return vars;
}

function bodyAfterDefinitions(vcd: string): string {
  const marker = '$enddefinitions';
  const idx = vcd.indexOf(marker);
  if (idx === -1) return vcd;
  const endIdx = vcd.indexOf('$end', idx + marker.length);
  return endIdx === -1 ? vcd.slice(idx + marker.length) : vcd.slice(endIdx + '$end'.length);
}

function parseChanges(vcd: string, vars: VcdVar[]): Map<string, Change[]> {
  const knownIds = new Set(vars.map((v) => v.id));
  const changes = new Map<string, Change[]>();
  for (const v of vars) changes.set(v.id, []);

  let time = 0;
  for (const rawLine of bodyAfterDefinitions(vcd).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('$')) continue;
    if (line.startsWith('#')) {
      const parsed = Number.parseInt(line.slice(1), 10);
      if (Number.isFinite(parsed)) time = parsed;
      continue;
    }

    const vector = /^(?:[br])([01xXzZ]+)\s+(\S+)$/.exec(line);
    if (vector) {
      const [, value, id] = vector;
      if (knownIds.has(id)) changes.get(id)?.push({ time, value: vectorLabel(value) });
      continue;
    }

    const scalar = /^([01xXzZ])(.+)$/.exec(line);
    if (scalar) {
      const [, value, id] = scalar;
      if (knownIds.has(id)) changes.get(id)?.push({ time, value: scalarToWaveChar(value) });
    }
  }
  return changes;
}

function timelineFromChanges(changes: Map<string, Change[]>): number[] {
  const times = new Set<number>([0]);
  for (const list of changes.values()) {
    for (const change of list) times.add(change.time);
  }
  return [...times].sort((a, b) => a - b);
}

function scalarSignal(v: VcdVar, list: Change[], timeline: number[]): WdSignal {
  let current = 'x';
  let changeIndex = 0;
  let wave = '';
  for (const t of timeline) {
    let changed = false;
    while (changeIndex < list.length && list[changeIndex]!.time <= t) {
      current = scalarToWaveChar(list[changeIndex]!.value);
      changeIndex += 1;
      changed = true;
    }
    wave += wave.length > 0 && !changed ? '.' : current;
  }
  return { name: v.name, wave };
}

function vectorSignal(v: VcdVar, list: Change[], timeline: number[]): WdSignal {
  let current = 'x';
  let changeIndex = 0;
  let wave = '';
  const data: string[] = [];
  for (const t of timeline) {
    let changed = false;
    while (changeIndex < list.length && list[changeIndex]!.time <= t) {
      current = vectorLabel(list[changeIndex]!.value);
      changeIndex += 1;
      changed = true;
    }
    if (wave.length === 0 || changed) {
      wave += current.includes('x') || current.includes('z') ? 'x' : '=';
      if (!current.includes('x') && !current.includes('z')) data.push(current);
    } else {
      wave += '.';
    }
  }
  return { name: v.name, wave, ...(data.length > 0 ? { data } : {}) };
}

export function vcdToWavedromJSON(vcd: string): WdRoot {
  const vars = parseVars(vcd);
  if (vars.length === 0) throw new Error('No VCD variables found.');
  const changes = parseChanges(vcd, vars);
  const timeline = timelineFromChanges(changes);
  const signal = vars.map((v) => {
    const list = changes.get(v.id) ?? [];
    return v.width === 1 ? scalarSignal(v, list, timeline) : vectorSignal(v, list, timeline);
  });
  return {
    signal,
    config: {
      hscale: 1,
      head: { tick: timeline[0] ?? 0 },
    },
  };
}
