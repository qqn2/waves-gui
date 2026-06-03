/** @vitest-environment happy-dom */
import { describe, it, expect } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import App from './App';

describe('App smoke', () => {
  it('renders without throwing', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<App />);
    });

    expect(host.innerHTML.length).toBeGreaterThan(0);
    root.unmount();
    host.remove();
  });
});
