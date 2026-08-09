import { describe, expect, it } from 'vitest';
import {
  filterSampleLibrary,
  SAMPLE_LIBRARY_CATALOG,
} from './catalog';

describe('template library catalog', () => {
  it('flattens the bundled templates into unique, searchable entries', () => {
    const ids = SAMPLE_LIBRARY_CATALOG.map((entry) => entry.id);
    expect(ids).toHaveLength(37);
    expect(new Set(ids).size).toBe(ids.length);
    expect(SAMPLE_LIBRARY_CATALOG.every((entry) => entry.categoryLabel.length > 0)).toBe(true);
    expect(SAMPLE_LIBRARY_CATALOG.every((entry) => entry.assetUrl.match(/\.(json|jsonml|yaml|toml)$/))).toBe(true);
    expect(SAMPLE_LIBRARY_CATALOG.every((entry) => entry.thumbnailUrl.endsWith('.dark.svg'))).toBe(true);
    expect(SAMPLE_LIBRARY_CATALOG.every((entry) => entry.thumbnailLightUrl.endsWith('.light.svg'))).toBe(true);
  });

  it('supports category and text filtering for the library UI', () => {
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'amba', '')).toHaveLength(6);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'amba/axi', '')).toHaveLength(2);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'amba/ahb', '')).toHaveLength(2);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'amba/apb', '')).toHaveLength(2);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'general/structure-states', '')).toHaveLength(2);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'undulate', '')).toHaveLength(4);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'compatibility', '')).toHaveLength(22);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'compatibility/upstream', '')).toHaveLength(22);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'all', 'WLAST').map((entry) => entry.id))
      .toEqual(['amba/axi/write']);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'general', 'clock')).toEqual([
      expect.objectContaining({ id: 'general/clock-reset' }),
    ]);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'compatibility', 'legacy'))
      .toHaveLength(4);
    expect(filterSampleLibrary(SAMPLE_LIBRARY_CATALOG, 'undulate', 'register'))
      .toHaveLength(0);
  });
});
