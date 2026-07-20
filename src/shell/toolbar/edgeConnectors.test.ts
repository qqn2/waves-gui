import { describe, expect, it } from 'vitest';
import { EDGE_CONNECTOR_GROUPS } from './bitStateConstants';

const connectors = EDGE_CONNECTOR_GROUPS.flatMap((group) =>
  group.options.map((option) => option.value),
);

describe('WaveDrom edge connector menu', () => {
  it('offers every spline connector from the WaveDrom tutorial', () => {
    expect(connectors).toEqual(
      expect.arrayContaining(['~', '-~', '<~>', '<-~>', '~>', '-~>', '~->']),
    );
  });

  it('offers every sharp connector from the WaveDrom tutorial', () => {
    expect(connectors).toEqual(
      expect.arrayContaining([
        '-',
        '-|',
        '-|-',
        '<->',
        '<-|>',
        '<-|->',
        '->',
        '-|>',
        '-|->',
        '|->',
      ]),
    );
  });
});
