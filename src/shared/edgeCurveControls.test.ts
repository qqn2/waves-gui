import { describe, expect, it } from 'vitest';
import { fromWavedromJSON, type WdRoot } from '../wavedromBridge';
import { defaultView } from './store/helpers';
import { buildSVGString } from '../exportEngine/exportSVG';
import { normalizeDiagram } from './normalizeDiagram';
import { normalizeEdgeCurveControls, validateEdgeCurveControls } from './edgeCurveControls';

const root = {
  signal: [
    { name: 'request', wave: '01..', node: '.a..' },
    { name: 'response', wave: '0..1', node: '...b' },
  ],
  edge: ['a~>b'],
};

describe('edge curve boundary validation', () => {
  it.each([NaN, Infinity, -Infinity])('rejects non-finite control values (%s)', (value) => {
    expect(validateEdgeCurveControls({ 0: { c1x: value, c2x: 0.2 } })).not.toBeNull();
    expect(normalizeEdgeCurveControls({ 0: { c1x: value, c2x: 0.2 } }, 1)).toBeUndefined();
  });

  it('copies valid controls and removes orphaned or invalid recovered entries', () => {
    const good = { c1x: 0.85, c2x: 0.15000000000000002 };
    const diagram = fromWavedromJSON(root);
    diagram.edgeCurveControls = { 0: good, 1: { c1x: 0.3, c2x: 0.4 }, 2: null } as never;
    const recovered = normalizeDiagram(diagram);
    expect(recovered.edgeCurveControls).toEqual({ 0: good });
    expect(recovered.edgeCurveControls![0]).not.toBe(good);
    expect(buildSVGString(recovered, defaultView())).not.toMatch(/NaN|Infinity|undefined/);
  });

  it.each([null, [], 'bad', { 0: null }, { 0: { c1x: null, c2x: 0.3 } }])(
    'safely normalizes invalid direct imports and recovered drafts (%j)', (controls) => {
      const imported = fromWavedromJSON({ ...root, 'x-waves-gui': { edgeCurveControls: controls } } as WdRoot);
      expect(imported.edgeCurveControls).toBeUndefined();
      const recovered = normalizeDiagram({ ...fromWavedromJSON(root), edgeCurveControls: controls } as never);
      expect(recovered.edgeCurveControls).toBeUndefined();
      expect(buildSVGString(recovered, defaultView())).not.toMatch(/NaN|Infinity|undefined/);
    },
  );
});
