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
      '@learnverse/service-core': path.resolve(__dirname, 'core/src'),
      '@learnverse/service-auth': path.resolve(__dirname, 'auth/src'),
      '@learnverse/service-content-store': path.resolve(__dirname, 'content-store/src'),
      '@learnverse/service-content-ingestion': path.resolve(__dirname, 'content-ingestion/src'),
      '@learnverse/service-pronunciation': path.resolve(__dirname, 'pronunciation/src'),
      '@learnverse/service-grammar': path.resolve(__dirname, 'grammar/src'),
      '@learnverse/service-comprehension': path.resolve(__dirname, 'comprehension/src'),
      '@learnverse/service-sync': path.resolve(__dirname, 'sync/src'),
      '@learnverse/service-api': path.resolve(__dirname, 'api/src'),
      '@learnverse/service-ai-gateway': path.resolve(__dirname, 'ai-gateway/src'),
      '@learnverse/platform-contracts': path.resolve(__dirname, '../../packages/platform-contracts/src'),
    },
  },
});
