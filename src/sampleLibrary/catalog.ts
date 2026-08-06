import {
  SAMPLE_LIBRARY,
  sampleAssetUrl,
  sampleThumbnailUrl,
  type SampleLeaf,
  type SampleTreeNode,
} from '../shell/samples';

export type SampleCategoryId = 'general' | 'amba' | 'undulate';
export type SampleDifficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface SampleLibraryEntry extends SampleLeaf {
  assetUrl: string;
  thumbnailUrl: string;
  thumbnailLightUrl: string;
  previewVersion: 'v1';
  category: SampleCategoryId;
  categoryLabel: string;
  path: string[];
  tags: string[];
  difficulty: SampleDifficulty;
  featured: boolean;
}

export interface SampleLibraryCategory {
  id: 'all' | 'featured' | SampleCategoryId;
  label: string;
  description: string;
}

export const SAMPLE_LIBRARY_CATEGORIES: readonly SampleLibraryCategory[] = [
  {
    id: 'featured',
    label: 'Featured',
    description: 'A quick starting point for common waveform patterns',
  },
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
    label: 'Undulate tasks',
    description: 'Examples for the extended Undulate editing workflows',
  },
];

const CATEGORY_LABELS: Record<SampleCategoryId, string> = {
  general: 'Fundamentals',
  amba: 'AMBA protocols',
  undulate: 'Undulate tasks',
};

const FEATURED_IDS = new Set([
  'general/clock-reset',
  'general/handshake',
  'amba/apb/write',
  'undulate/fine-timing',
]);

function categoryForSample(sample: SampleLeaf): SampleCategoryId {
  const category = sample.id.split('/')[0];
  if (category === 'amba' || category === 'undulate') return category;
  return 'general';
}

function difficultyForCategory(category: SampleCategoryId): SampleDifficulty {
  if (category === 'general') return 'Beginner';
  if (category === 'amba') return 'Intermediate';
  return 'Advanced';
}

function makeEntry(sample: SampleLeaf, path: string[]): SampleLibraryEntry {
  const category = categoryForSample(sample);
  const tags = [CATEGORY_LABELS[category], ...path, sample.title]
    .filter((tag, index, list) => list.indexOf(tag) === index);
  return {
    ...sample,
    assetUrl: sampleAssetUrl(sample.file),
    thumbnailUrl: sampleThumbnailUrl(sample.file, 'dark'),
    thumbnailLightUrl: sampleThumbnailUrl(sample.file, 'light'),
    previewVersion: 'v1',
    category,
    categoryLabel: CATEGORY_LABELS[category],
    path,
    tags,
    difficulty: difficultyForCategory(category),
    featured: FEATURED_IDS.has(sample.id),
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
  category: SampleLibraryCategory['id'],
  query: string,
): SampleLibraryEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return entries.filter((entry) => {
    const matchesCategory = category === 'all'
      || (category === 'featured' ? entry.featured : entry.category === category);
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      entry.title,
      entry.description,
      entry.categoryLabel,
      entry.difficulty,
      ...entry.path,
      ...entry.tags,
    ].join(' ').toLocaleLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
