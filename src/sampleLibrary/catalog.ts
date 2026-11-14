import { SAMPLE_LIBRARY, sampleAssetUrl, type SampleLeaf, type SampleTreeNode } from '../shell/samples';
import { SAMPLE_LEARNING_NOTES } from './learningNotes';

export type SampleCategoryId = 'general' | 'amba' | 'undulate';
export type SampleSource = 'Undulate' | 'WaveDrom JSON';

export interface SampleLibraryEntry extends SampleLeaf {
  assetUrl: string;
  category: SampleCategoryId;
  categoryLabel: string;
  source: SampleSource;
  path: string[];
  tags: string[];
  signalNames: string[];
}

export interface SampleLibraryCategory {
  id: 'all' | SampleCategoryId;
  label: string;
  description: string;
}

export const SAMPLE_LIBRARY_CATEGORIES: readonly SampleLibraryCategory[] = [
  { id: 'all', label: 'All samples', description: 'Every bundled waveform example' },
  { id: 'general', label: 'Fundamentals', description: 'Clocks, handshakes, buses, and signal groups' },
  { id: 'amba', label: 'AMBA protocols', description: 'APB, AHB, and AXI transaction examples' },
  { id: 'undulate', label: 'Undulate tasks', description: 'Fine timing, analogue signals, annotations, and styles' },
];

function collectCatalogEntries(nodes: readonly SampleTreeNode[], path: string[] = []): SampleLibraryEntry[] {
  return nodes.flatMap((node): SampleLibraryEntry[] => {
    if (node.kind === 'folder') return collectCatalogEntries(node.children, [...path, node.label]);
    const prefix = node.id.split('/')[0];
    const category = prefix === 'amba' || prefix === 'undulate' ? prefix : 'general';
    const categoryLabel = SAMPLE_LIBRARY_CATEGORIES.find(({ id }) => id === category)!.label;
    // A flat result list needs the protocol name that the old folder menu supplied.
    const title = category === 'amba'
      ? `${path.at(-1)} ${node.title.charAt(0).toLowerCase()}${node.title.slice(1)}`
      : node.title;
    return [{
      ...node,
      title,
      assetUrl: sampleAssetUrl(node.file),
      category,
      categoryLabel,
      source: category === 'undulate' ? 'Undulate' : 'WaveDrom JSON',
      path,
      tags: [categoryLabel, ...path],
      signalNames: SAMPLE_LEARNING_NOTES[node.id]?.signals.map(({ name }) => name.toLocaleLowerCase()) ?? [],
    }];
  });
}

export const SAMPLE_LIBRARY_CATALOG: readonly SampleLibraryEntry[] = collectCatalogEntries(SAMPLE_LIBRARY);

export function filterSampleLibrary(
  entries: readonly SampleLibraryEntry[],
  category: SampleLibraryCategory['id'],
  query: string,
): SampleLibraryEntry[] {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((entry) => {
    if (category !== 'all' && entry.category !== category) return false;
    const searchable = [entry.id, entry.title, entry.description, entry.source, ...entry.tags]
      .join(' ').toLocaleLowerCase();
    return words.every((word) => searchable.includes(word)
      || entry.signalNames.some((name) => name === word || name.startsWith(`${word}[`)));
  });
}
