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
      '@learnverse/service-core': '/packages/services/core/src',
      '@learnverse/service-auth': '/packages/services/auth/src',
      '@learnverse/service-content-store': '/packages/services/content-store/src',
      '@learnverse/service-content-ingestion': '/packages/services/content-ingestion/src',
      '@learnverse/service-pronunciation': '/packages/services/pronunciation/src',
      '@learnverse/service-grammar': '/packages/services/grammar/src',
      '@learnverse/service-comprehension': '/packages/services/comprehension/src',
      '@learnverse/service-sync': '/packages/services/sync/src',
      '@learnverse/service-api': '/packages/services/api/src',
      '@learnverse/platform-contracts': '/packages/platform-contracts/src',
      '@learnverse/web-app': '/packages/platform-web/app/src',
      '@learnverse/mobile-app': '/packages/platform-mobile/app/src',
    },
  },
});
