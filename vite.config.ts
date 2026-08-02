import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(
  readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8'),
) as { version: string }

function buildRevision(): string {
  const fromEnvironment = process.env.CF_PAGES_COMMIT_SHA
    ?? process.env.GITHUB_SHA
    ?? process.env.VITE_BUILD_SHA
    ?? process.env.COMMIT_SHA
  if (fromEnvironment) return fromEnvironment.slice(0, 7)
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return 'unknown'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version),
    __BUILD_SHA__: JSON.stringify(buildRevision()),
  },
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
