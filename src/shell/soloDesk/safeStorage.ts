/** Minimal storage API used for drafts and recent files. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

const memory = new Map<string, string>();

const memoryStorage: StorageLike = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => {
    memory.set(key, value);
  },
  removeItem: (key) => {
    memory.delete(key);
  },
};

let localStorageBroken = false;
let warned = false;

function warnOnce(): void {
  if (warned) return;
  warned = true;
  console.warn(
    '[WaveDrom GUI] Browser storage is unavailable (localStorage/IndexedDB busy). ' +
      'Drafts and recent files work in-memory only until you reload in a healthy profile.',
  );
}

function wrapLocalStorage(): StorageLike {
  if (typeof localStorage === 'undefined') {
    localStorageBroken = true;
    return memoryStorage;
  }

  return {
    getItem(key: string): string | null {
      if (localStorageBroken) {
        return memoryStorage.getItem(key);
      }
      try {
        return localStorage.getItem(key);
      } catch {
        localStorageBroken = true;
        warnOnce();
        return memoryStorage.getItem(key);
      }
    },
    setItem(key: string, value: string): void {
      if (localStorageBroken) {
        memoryStorage.setItem(key, value);
        return;
      }
      try {
        localStorage.setItem(key, value);
      } catch {
        localStorageBroken = true;
        warnOnce();
        memoryStorage.setItem(key, value);
      }
    },
    removeItem(key: string): void {
      if (localStorageBroken) {
        memoryStorage.removeItem(key);
        return;
      }
      try {
        localStorage.removeItem(key);
      } catch {
        localStorageBroken = true;
        warnOnce();
        memoryStorage.removeItem(key);
      }
    },
  };
}

let cached: StorageLike | null = null;

/** Never throws; falls back to in-memory storage when localStorage is broken. */
export function getSafeStorage(): StorageLike {
  if (!cached) {
    cached = wrapLocalStorage();
  }
  return cached;
}

export function isBrowserStoragePersistent(): boolean {
  return !localStorageBroken && typeof localStorage !== 'undefined';
}
