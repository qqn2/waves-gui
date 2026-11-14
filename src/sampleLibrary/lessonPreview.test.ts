import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCodeToDiagram } from '../codePanel/codeSync';
import { defaultView } from '../shared/store/helpers';
import type { DiagramState, Signal, SignalOrGroup } from '../shared/types';
import { collectSampleLeaves } from '../shell/samples';
import { fromWavedromJSON } from '../wavedromBridge';
import { SAMPLE_LEARNING_NOTES } from './learningNotes';
import { lessonHighlight, lessonPreviewDiagram, stageCycleLabel } from './lessonPreview';
import type { LessonStage } from './learningTypes';

function readLesson(id: string): DiagramState {
  const sample = collectSampleLeaves().find((entry) => entry.id === id);
  if (!sample) throw new Error(`Missing lesson asset: ${id}`);
  const source = readFileSync(join(process.cwd(), 'public/samples', sample.file), 'utf8');
  const parsed = parseCodeToDiagram(source);
  if (parsed.ok === false) throw new Error(parsed.error);
  return parsed.diagram;
}

function lanes(signals: SignalOrGroup[]): Signal[] {
  return signals.flatMap((signal): Signal[] => signal.type === 'group'
    ? lanes(signal.children) : signal.type === 'spacer' ? [] : [signal]);
}

function freezeTree(value: unknown): void {
  if (!value || typeof value !== 'object') return;
  for (const child of Object.values(value)) freezeTree(child);
  Object.freeze(value);
}

describe('lesson preview projection', () => {
  it.each([true, false])('preserves source timing and hscale without mutation (focus=%s)', (focus) => {
    const source = readLesson('amba/axi/write');
    const before = structuredClone(source);
    const stage = SAMPLE_LEARNING_NOTES['amba/axi/write'].stages[4];
    freezeTree(source);

    const preview = lessonPreviewDiagram(source, stage, focus);

    expect(preview).not.toBe(source);
    expect(preview.config).not.toBe(source.config);
    expect(preview.config.hscale).toBe(before.config.hscale);
    expect(preview.config.hscale).toBeGreaterThan(1);
    expect(preview.config.totalSteps).toBe(before.config.totalSteps);
    expect(preview.config.head).toBeUndefined();
    expect(preview.config.foot).toBeUndefined();
    expect(source).toEqual(before);
    expect(source.config.head?.text).toBeTruthy();
    expect(source.config.foot?.text).toBeTruthy();
    for (const lane of lanes(preview.signals)) {
      expect(lane).toEqual(lanes(before.signals).find((original) => original.id === lane.id));
    }
  });

  it('keeps the clock and selected signals inside their nested channel groups', () => {
    const source = readLesson('amba/axi/write');
    source.signals = [{ id: 'channels', type: 'group', name: 'AXI channels', children: source.signals }];
    const stage = SAMPLE_LEARNING_NOTES['amba/axi/write'].stages[4];
    expect(stage.signals).not.toContain('ACLK');

    const preview = lessonPreviewDiagram(source, stage, true);

    expect(lanes(preview.signals).map((lane) => lane.name)).toEqual(['ACLK', 'BRESP', 'BVALID', 'BREADY']);
    expect(preview.signals).toHaveLength(1);
    const outer = preview.signals[0];
    expect(outer).toMatchObject({ type: 'group', name: 'AXI channels' });
    if (outer.type !== 'group') throw new Error('Missing outer group');
    expect(outer.children.map((child) => child.name)).toEqual(['Write address (AW)', 'Write response (B)']);
    const [address, response] = outer.children;
    if (address.type !== 'group' || response.type !== 'group') throw new Error('Missing channel groups');
    expect(address.children.map((child) => child.name)).toEqual(['ACLK']);
    expect(response.children.map((child) => child.name)).toEqual(['BRESP', 'BVALID', 'BREADY']);
  });

  it('restores the complete original signal tree in All signals mode', () => {
    const source = readLesson('amba/axi/write');
    const stage = SAMPLE_LEARNING_NOTES['amba/axi/write'].stages[4];

    const focused = lessonPreviewDiagram(source, stage, true);
    const full = lessonPreviewDiagram(source, stage, false);

    expect(lanes(focused.signals)).toHaveLength(4);
    expect(lanes(full.signals)).toHaveLength(15);
    expect(full.signals).toEqual(source.signals);
    expect(full.signals.some((signal) => signal.type === 'spacer')).toBe(true);
    expect(full.signals.some((signal) => signal.type === 'group' && signal.name === 'Write data (W)')).toBe(true);
  });

  it('places the highlight on cycle boundaries in the rendered image coordinate system', () => {
    const source = fromWavedromJSON({
      config: { hscale: 2.5 },
      head: { text: 'Source title', tick: 0 },
      foot: { text: 'Source footnote' },
      signal: [['Channel', { name: 'ACLK', wave: 'P.....' }, { name: 'data', wave: 'x.=..x', data: ['word'] }]],
    });
    const data = lanes(source.signals).find((lane) => lane.name === 'data')!;
    data.rowHeight = 52;
    const stage: LessonStage = { title: 'Wait', start: 2, end: 5, description: 'Three cells', signals: ['data'] };
    const preview = lessonPreviewDiagram(source, stage, true);
    const view = { ...defaultView(), labelWidth: 173, zoom: 2, scrollX: 60, scrollY: 20 };

    expect(lessonHighlight(preview, view, stage)).toEqual({
      x: 373, // 173px labels + two 100px cycles.
      y: 24, // Time axis only; lesson headings are outside the image.
      width: 300, // Three cycles at 40px × hscale 2.5.
      height: 120, // 28px group + 40px clock + 52px data.
      totalWidth: 773, // Six cycles plus labels; editor zoom/scroll do not alter SVG coordinates.
      totalHeight: 144,
    });
  });

  it('labels the included cycles rather than treating the exclusive boundary as another cycle', () => {
    const stage: LessonStage = { title: 'Access', start: 3, end: 4, description: '', signals: [] };
    expect(stageCycleLabel(stage)).toBe('Cycle 3');
    expect(stageCycleLabel({ ...stage, end: 6 })).toBe('Cycles 3–5');
  });
});

describe('guided lesson source consistency', () => {
  it('covers the ten curated AMBA samples', () => {
    const ambaIds = collectSampleLeaves().filter((entry) => entry.id.startsWith('amba/')).map((entry) => entry.id);
    expect(Object.keys(SAMPLE_LEARNING_NOTES)).toHaveLength(10);
    expect(Object.keys(SAMPLE_LEARNING_NOTES).sort()).toEqual(ambaIds.sort());
  });

  it.each(Object.entries(SAMPLE_LEARNING_NOTES))('%s uses valid ordered stages and source signal names', (id, lesson) => {
    const source = readLesson(id);
    const sourceLanes = lanes(source.signals);
    const sourceNames = sourceLanes.map((lane) => lane.name);
    const glossaryNames = lesson.signals.map((signal) => signal.name);
    expect(new Set(glossaryNames).size).toBe(glossaryNames.length);
    expect(glossaryNames.toSorted()).toEqual(sourceNames.toSorted());
    expect(lesson.stages.length).toBeGreaterThan(0);
    let end = 0;
    for (const stage of lesson.stages) {
      expect(Number.isInteger(stage.start)).toBe(true);
      expect(Number.isInteger(stage.end)).toBe(true);
      expect(stage.start).toBeGreaterThanOrEqual(end);
      expect(stage.end).toBeGreaterThan(stage.start);
      expect(stage.end).toBeLessThanOrEqual(source.config.totalSteps);
      expect(stage.signals.length).toBeGreaterThan(0);
      expect(new Set(stage.signals).size).toBe(stage.signals.length);
      for (const name of stage.signals) expect(sourceNames, `${stage.title}: ${name}`).toContain(name);
      end = stage.end;
    }
    // Cell-index highlights assume these teaching traces share an unshifted, one-cycle grid.
    for (const lane of sourceLanes) {
      expect(lane.period ?? 1).toBe(1);
      expect(lane.phase ?? 0).toBe(0);
    }
  });
});
