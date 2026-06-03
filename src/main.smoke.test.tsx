/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach } from 'vitest';

describe('main bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
  });

  it('mounts App into #root', async () => {
    await import('./main');
    await new Promise((r) => setTimeout(r, 500));
    const root = document.getElementById('root');
    expect(root?.innerHTML.length ?? 0).toBeGreaterThan(0);
  });
});
