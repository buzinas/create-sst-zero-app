import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    projects: [
      {
        test: {
          name: 'core',
          root: 'packages/core',
          environment: 'node',
        },
      },
      {
        test: {
          name: 'api',
          root: 'packages/api',
          environment: 'node',
        },
      },
      {
        test: {
          name: 'web',
          root: 'packages/web',
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts'],
        },
      },
    ],
  },
})
