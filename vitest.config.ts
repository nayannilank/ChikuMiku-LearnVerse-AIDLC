import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/services/*/src/**/*.{test,spec}.ts',
      'packages/services/*/src/**/*.property.ts',
      'packages/platform-web/*/src/**/*.{test,spec}.ts',
      'packages/platform-mobile/*/src/**/*.{test,spec}.ts',
      'packages/platform-contracts/src/**/*.{test,spec}.ts',
      'packages/core/src/**/*.{test,spec}.ts',
      'scripts/__tests__/**/*.{test,spec}.ts',
      'scripts/__tests__/**/*.property.test.ts',
    ],
    coverage: {
      provider: 'v8',
      include: ['packages/services/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/*.property.ts'],
    },
  },
  resolve: {
    alias: {
      '@chikumiku/service-core': '/packages/services/core/src',
      '@chikumiku/service-auth': '/packages/services/auth/src',
      '@chikumiku/service-content-store': '/packages/services/content-store/src',
      '@chikumiku/service-content-ingestion': '/packages/services/content-ingestion/src',
      '@chikumiku/service-pronunciation': '/packages/services/pronunciation/src',
      '@chikumiku/service-grammar': '/packages/services/grammar/src',
      '@chikumiku/service-comprehension': '/packages/services/comprehension/src',
      '@chikumiku/service-sync': '/packages/services/sync/src',
      '@chikumiku/service-api': '/packages/services/api/src',
      '@chikumiku/platform-contracts': '/packages/platform-contracts/src',
      '@chikumiku/web-app': '/packages/platform-web/app/src',
      '@chikumiku/mobile-app': '/packages/platform-mobile/app/src',
    },
  },
});
