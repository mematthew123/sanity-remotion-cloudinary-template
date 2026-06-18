import {defineConfig} from 'vitest/config'

// Minimal Vitest setup for the web workspace. Node environment — the code under
// test is pure server logic (no DOM). Workspace packages like
// `@template/video-core/registry` resolve through their package.json `exports`
// field, so the real chunking logic is exercised, not a mock.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
})
