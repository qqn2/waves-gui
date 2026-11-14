// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('storage fallback persistence reporting', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('does not label the in-memory quota fallback persistent', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Full', 'QuotaExceededError');
    });
    const { getSafeStorage, isBrowserStoragePersistent } = await import('./safeStorage');
    const storage = getSafeStorage();
    storage.setItem('draft', 'recovery');
    expect(storage.getItem('draft')).toBe('recovery');
    expect(isBrowserStoragePersistent()).toBe(false);
  });

  it('handles unavailable browser storage without throwing', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('localStorage', undefined);
    const { getSafeStorage, isBrowserStoragePersistent } = await import('./safeStorage');
    expect(() => getSafeStorage().setItem('draft', 'recovery')).not.toThrow();
    expect(isBrowserStoragePersistent()).toBe(false);
  });
});
