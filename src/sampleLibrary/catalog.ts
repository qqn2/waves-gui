import {
  SAMPLE_LIBRARY,
  sampleAssetUrl,
  sampleThumbnailUrl,
  type SampleLeaf,
  type SampleTreeNode,
} from '../shell/samples';

export type SampleCategoryId = 'general' | 'amba' | 'undulate' | 'compatibility';
export type AmbaProtocolId = 'axi' | 'ahb' | 'apb';
export type SampleSource = 'Undulate' | 'WaveDrom JSON';

export interface SampleLibraryEntry extends SampleLeaf {
  assetUrl: string;
  thumbnailUrl: string;
  thumbnailLightUrl: string;
  previewVersion: 'v1';
  category: SampleCategoryId;
  categoryLabel: string;
  source: SampleSource;
  path: string[];
}

export interface SampleLibraryCategory {
  id: 'all' | SampleCategoryId;
  label: string;
  description: string;
}

export interface SampleLibrarySubcategory {
  id: string;
  parentId: SampleCategoryId;
  label: string;
  description: string;
  matches: (entry: SampleLibraryEntry) => boolean;
}

export const SAMPLE_LIBRARY_CATEGORIES: readonly SampleLibraryCategory[] = [
  {
    id: 'all',
    label: 'All templates',
    description: 'Every bundled template in the library',
  },
  {
    id: 'general',
    label: 'Fundamentals',
    description: 'Core timing, state, and signal-organization patterns',
  },
  {
    id: 'amba',
    label: 'AMBA protocols',
    description: 'APB, AHB, and AXI transaction examples',
  },
  {
    id: 'undulate',
    label: 'Undulate workflows',
    description: 'Examples for the extended Undulate editing workflows',
  },
  {
    id: 'compatibility',
    label: 'Compatibility & regression',
    description: 'Upstream compatibility cases and renderer regression fixtures',
  },
];

const CATEGORY_LABELS: Record<SampleCategoryId, string> = {
  general: 'Fundamentals',
  amba: 'AMBA protocols',
  undulate: 'Undulate workflows',
  compatibility: 'Compatibility & regression',
};

export const SAMPLE_LIBRARY_SUBCATEGORIES: readonly SampleLibrarySubcategory[] = [
  {
    id: 'general/clocking-reset',
    parentId: 'general',
    label: 'Clocking and reset',
    description: 'Clock, reset, and enable patterns',
    matches: (entry) => entry.id === 'general/clock-reset',
  },
  {
    id: 'general/handshake-control',
    parentId: 'general',
    label: 'Handshake and control',
    description: 'Request, grant, valid, and ready coordination',
    matches: (entry) => entry.id === 'general/handshake',
  },
  {
    id: 'general/buses-data',
    parentId: 'general',
    label: 'Buses and data',
    description: 'Vector buses and write-enable timing',
    matches: (entry) => entry.id === 'general/data-bus',
  },
  {
    id: 'general/structure-states',
    parentId: 'general',
    label: 'Structure and states',
    description: 'Groups, spacers, and undefined signal states',
    matches: (entry) => entry.id === 'general/groups' || entry.id === 'general/undefined-states',
  },
  {
    id: 'amba/axi',
    parentId: 'amba',
    label: 'AXI',
    description: 'AXI transaction examples',
    matches: (entry) => entry.path[1] === 'AXI',
  },
  {
    id: 'amba/ahb',
    parentId: 'amba',
    label: 'AHB',
    description: 'AHB transaction examples',
    matches: (entry) => entry.path[1] === 'AHB',
  },
  {
    id: 'amba/apb',
    parentId: 'amba',
    label: 'APB',
    description: 'APB transaction examples',
    matches: (entry) => entry.path[1] === 'APB',
  },
  {
    id: 'undulate/fine-timing',
    parentId: 'undulate',
    label: 'Fine timing',
    description: 'Sub-steps, periods, duty cycles, phase, and slew',
    matches: (entry) => entry.id === 'undulate/fine-timing',
  },
  {
    id: 'undulate/analogue',
    parentId: 'undulate',
    label: 'Analogue',
    description: 'Analogue curves, expressions, and overlays',
    matches: (entry) => entry.id === 'undulate/analogue',
  },
  {
    id: 'undulate/annotations',
    parentId: 'undulate',
    label: 'Annotations',
    description: 'Labels, lines, arrows, and anchors',
    matches: (entry) => entry.id === 'undulate/annotations',
  },
  {
    id: 'undulate/states-style',
    parentId: 'undulate',
    label: 'States and styling',
    description: 'Extended states, nodes, edges, and styles',
    matches: (entry) => entry.id === 'undulate/states-and-style',
  },
  {
    id: 'compatibility/upstream',
    parentId: 'compatibility',
    label: 'Upstream compatibility',
    description: 'Supported upstream parser and renderer fixtures',
    matches: (entry) => entry.category === 'compatibility' && entry.support !== 'future',
  },
];

function categoryForSample(sample: SampleLeaf, path: string[]): SampleCategoryId {
  const category = sample.id.split('/')[0];
  if (category === 'undulate' && path[1] === 'Upstream compatibility') return 'compatibility';
  if (category === 'amba' || category === 'undulate') return category;
  return 'general';
}

function makeEntry(sample: SampleLeaf, path: string[]): SampleLibraryEntry {
  const category = categoryForSample(sample, path);
  return {
    ...sample,
    assetUrl: sampleAssetUrl(sample.file),
    thumbnailUrl: sampleThumbnailUrl(sample.file, 'dark'),
    thumbnailLightUrl: sampleThumbnailUrl(sample.file, 'light'),
    previewVersion: 'v1',
    category,
    categoryLabel: CATEGORY_LABELS[category],
    source: category === 'undulate' || category === 'compatibility' ? 'Undulate' : 'WaveDrom JSON',
    path,
  };
}

function collectCatalogEntries(nodes: SampleTreeNode[]): SampleLibraryEntry[] {
  const entries: SampleLibraryEntry[] = [];
  const walk = (items: SampleTreeNode[], path: string[]) => {
    for (const item of items) {
      if (item.kind === 'sample') {
        entries.push(makeEntry(item, path));
      } else {
        walk(item.children, [...path, item.label]);
      }
    }
  };
  walk(nodes, []);
  return entries;
}

export const SAMPLE_LIBRARY_CATALOG: readonly SampleLibraryEntry[] =
  collectCatalogEntries(SAMPLE_LIBRARY);

export function filterSampleLibrary(
  entries: readonly SampleLibraryEntry[],
  category: SampleLibraryCategory['id'] | SampleLibrarySubcategory['id'],
  query: string,
): SampleLibraryEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const subcategory = SAMPLE_LIBRARY_SUBCATEGORIES.find((item) => item.id === category);
  return entries.filter((entry) => {
    const matchesCategory = subcategory
      ? subcategory.matches(entry)
      : category === 'all' || entry.category === category;
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      entry.title,
      entry.description,
      entry.categoryLabel,
      entry.source,
      entry.supportNote ?? '',
      ...entry.path,
    ].join(' ').toLocaleLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
