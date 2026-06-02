import { describe, it, expect, beforeEach } from 'vitest';
import type { BitState, DiagramState } from '../../shared/types';
import { DEFAULT_STEPS } from '../../shared/constants';
import {
  clearDraft,
  DRAFT_ENVELOPE_VERSION,
  DRAFT_STORAGE_KEY,
  isDiagramEmpty,
  loadDraft,
  saveDraft,
  serializeDraftEnvelope,
  type StorageLike,
} from './localDraft';
import {
  clearRecentFiles,
  loadRecentFiles,
  RECENT_FILES_MAX,
  RECENT_FILES_STORAGE_KEY,
  recordRecentFile,
} from './recentFiles';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
  };
}

function sampleDiagram(): DiagramState {
  const states = new Array<BitState>(DEFAULT_STEPS).fill('0');
  states[2] = '1';
  return {
    version: 1,
    signals: [
      {
        id: 'sig-1',
        name: 'clk',
        type: 'bit',
        states,
        segments: [],
        color: '#4A9EFF',
        rowHeight: 40,
      },
    ],
    config: { totalSteps: DEFAULT_STEPS, hscale: 1 },
    edges: [],
    annotations: [],
  };
}

describe('localDraft', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('isDiagramEmpty detects blank diagrams', () => {
    expect(
      isDiagramEmpty({
        version: 1,
        signals: [],
        config: { totalSteps: DEFAULT_STEPS, hscale: 1 },
        edges: [],
        annotations: [],
      }),
    ).toBe(true);
    expect(isDiagramEmpty(sampleDiagram())).toBe(false);
  });

  it('round-trips diagram through save/load', () => {
    const diagram = sampleDiagram();
    saveDraft(diagram, storage);
    expect(loadDraft(storage)).toEqual(diagram);
  });

  it('serializeDraftEnvelope includes envelope and diagram version fields', () => {
    const diagram = sampleDiagram();
    saveDraft(diagram, storage);
    const raw = storage.getItem(DRAFT_STORAGE_KEY);
    expect(raw).toBeTruthy();

    const parsed = JSON.parse(raw!) as {
      version: number;
      savedAt: number;
      diagram: DiagramState;
    };
    expect(parsed.version).toBe(DRAFT_ENVELOPE_VERSION);
    expect(parsed.diagram.version).toBe(1);
    expect(typeof parsed.savedAt).toBe('number');

    expect(JSON.parse(serializeDraftEnvelope(diagram, 123))).toEqual({
      version: DRAFT_ENVELOPE_VERSION,
      savedAt: 123,
      diagram,
    });
  });

  it('returns null for invalid stored JSON', () => {
    storage.setItem(DRAFT_STORAGE_KEY, '{not json');
    expect(loadDraft(storage)).toBeNull();

    storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ version: 99, diagram: {} }));
    expect(loadDraft(storage)).toBeNull();
  });

  it('clearDraft removes stored draft', () => {
    saveDraft(sampleDiagram(), storage);
    clearDraft(storage);
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('does not throw when storage getItem/setItem fails', () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new DOMException('NS_ERROR_STORAGE_BUSY', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('NS_ERROR_STORAGE_BUSY', 'SecurityError');
      },
      removeItem: () => {
        throw new DOMException('NS_ERROR_STORAGE_BUSY', 'SecurityError');
      },
    };
    expect(() => saveDraft(sampleDiagram(), broken)).not.toThrow();
    expect(loadDraft(broken)).toBeNull();
    expect(() => clearDraft(broken)).not.toThrow();
  });
});

describe('recentFiles', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('stores file names with timestamps', () => {
    recordRecentFile('wave.json', storage, 1000);
    expect(loadRecentFiles(storage)).toEqual([{ name: 'wave.json', openedAt: 1000 }]);
  });

  it('keeps at most five entries with newest first', () => {
    for (let i = 0; i < RECENT_FILES_MAX + 2; i++) {
      recordRecentFile(`file-${i}.json`, storage, i * 1000);
    }

    const recent = loadRecentFiles(storage);
    expect(recent).toHaveLength(RECENT_FILES_MAX);
    expect(recent[0]).toEqual({
      name: `file-${RECENT_FILES_MAX + 1}.json`,
      openedAt: (RECENT_FILES_MAX + 1) * 1000,
    });
    expect(recent[RECENT_FILES_MAX - 1]).toEqual({
      name: 'file-2.json',
      openedAt: 2000,
    });
  });

  it('moves duplicate names to the front', () => {
    recordRecentFile('a.json', storage, 100);
    recordRecentFile('b.json', storage, 200);
    recordRecentFile('a.json', storage, 300);

    expect(loadRecentFiles(storage)).toEqual([
      { name: 'a.json', openedAt: 300 },
      { name: 'b.json', openedAt: 200 },
    ]);
  });

  it('ignores blank names', () => {
    recordRecentFile('   ', storage, 100);
    expect(loadRecentFiles(storage)).toEqual([]);
    expect(storage.getItem(RECENT_FILES_STORAGE_KEY)).toBeNull();
  });

  it('clearRecentFiles removes stored list', () => {
    recordRecentFile('wave.json', storage, 1000);
    clearRecentFiles(storage);
    expect(storage.getItem(RECENT_FILES_STORAGE_KEY)).toBeNull();
  });
});
