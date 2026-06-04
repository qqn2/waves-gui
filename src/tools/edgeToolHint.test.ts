import { describe, expect, it } from 'vitest';
import { edgeToolHint } from './edgeToolHint';

describe('edgeToolHint', () => {
  it('describes arrow tool states', () => {
    expect(edgeToolHint('arrow', null)).toContain('click start anchor');
    expect(
      edgeToolHint('arrow', {
        kind: 'arrow',
        char: 'A',
        signalId: 's',
        step: 0,
      }),
    ).toContain('A');
  });
});
