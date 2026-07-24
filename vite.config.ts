import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // A second React runtime leaves hooks without the renderer's dispatcher.
    // This also protects linked worktrees and stale dependency prebundles.
    dedupe: ['react', 'react-dom'],
    // jju's concrete-syntax updater uses only assert() and assert.equal().
    // Keep that browser path small instead of shipping the Node assert polyfill.
    alias: {
      assert: fileURLToPath(new URL('./src/vendor/assert.cjs', import.meta.url)),
    },
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
