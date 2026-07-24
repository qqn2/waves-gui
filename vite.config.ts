import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // A second React runtime leaves hooks without the renderer's dispatcher.
    // This also protects linked worktrees and stale dependency prebundles.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['wavedrom'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    testTimeout: 10_000,
  },
})
