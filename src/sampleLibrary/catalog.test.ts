import { describe, expect, it } from 'vitest';
import { collectSampleLeaves } from '../shell/samples';
import { filterSampleLibrary, SAMPLE_LIBRARY_CATALOG } from './catalog';

describe('sample browser catalog', () => {
  it('preserves exactly the bundled stable sample IDs', () => {
    expect(SAMPLE_LIBRARY_CATALOG.map(({ id }) => id)).toEqual(collectSampleLeaves().map(({ id }) => id));
    expect(new Set(SAMPLE_LIBRARY_CATALOG.map(({ id }) => id)).size).toBe(19);
  });

  it('disambiguates AMBA titles and searches words across protocol and description', () => {
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'all', '  WRITE   apb '))
      .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'amba/apb/write', title: expect.stringMatching(/^APB write/) })]));
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'all', 'axi RLAST read'))
      .toMatchObject([{ id: 'amba/axi/read', title: expect.stringMatching(/^AXI /) }]);
    expect(new Set(SAMPLE_LIBRARY_CATALOG.map(({ title }) => title)).size).toBe(19);
  });

  it('combines category and search without leaking results from other categories', () => {
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'general', 'APB')).toEqual([]);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'amba', '')).toHaveLength(10);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'undulate', 'analogue'))
      .toMatchObject([{ id: 'undulate/analogue', source: 'Undulate' }]);
  });
});
