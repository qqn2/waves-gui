import { describe, expect, it, beforeEach } from 'vitest';
import { saveDraft, loadDraft, clearDraft, type StorageLike } from './localDraft';
import { recordRecentFile, loadRecentFiles } from './recentFiles';
import type { DiagramState } from '../../shared/types';

const minimalDiagram = (): DiagramState => ({
  version: 1,
  signals: [],
  config: { totalSteps: 20, hscale: 1 },
  annotations: [],
});

function memoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('soloDesk localDraft', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('round-trips diagram JSON', () => {
    const d = minimalDiagram();
    saveDraft(d, storage);
    expect(loadDraft(storage)?.config.totalSteps).toBe(20);
    clearDraft(storage);
    expect(loadDraft(storage)).toBeNull();
  });
});

describe('soloDesk recentFiles', () => {
  let storage: StorageLike;

  beforeEach(() => {
    storage = memoryStorage();
  });

  it('stores unique names newest first', () => {
    recordRecentFile('a.json', storage);
    recordRecentFile('b.json', storage);
    recordRecentFile('a.json', storage);
    const names = loadRecentFiles(storage).map((e) => e.name);
    expect(names[0]).toBe('a.json');
    expect(names[1]).toBe('b.json');
    expect(names.length).toBeLessThanOrEqual(5);
  });
});
