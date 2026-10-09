import { defineConfig } from 'vitest/config'

// Config dédiée à l'intégration anvil : `npm run test:e2e`.
// Le run vitest par défaut (`npm test`) ne ramasse pas les fichiers .e2e.ts.
export default defineConfig({
  test: {
    include: ['test/**/*.e2e.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
})
