import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    proxy: {
      '/api/v1': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
        headers: {
          Connection: 'keep-alive',
        },
      },
    },
    cors: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
