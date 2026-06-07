import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.property.ts', 'src/**/*.property.test.ts'],
  },
  resolve: {
    alias: {
      '@chikumiku/service-core': path.resolve(__dirname, 'core/src'),
      '@chikumiku/service-auth': path.resolve(__dirname, 'auth/src'),
      '@chikumiku/service-content-store': path.resolve(__dirname, 'content-store/src'),
      '@chikumiku/service-content-ingestion': path.resolve(__dirname, 'content-ingestion/src'),
      '@chikumiku/service-pronunciation': path.resolve(__dirname, 'pronunciation/src'),
      '@chikumiku/service-grammar': path.resolve(__dirname, 'grammar/src'),
      '@chikumiku/service-comprehension': path.resolve(__dirname, 'comprehension/src'),
      '@chikumiku/service-sync': path.resolve(__dirname, 'sync/src'),
      '@chikumiku/service-api': path.resolve(__dirname, 'api/src'),
      '@chikumiku/platform-contracts': path.resolve(__dirname, '../../packages/platform-contracts/src'),
    },
  },
});
