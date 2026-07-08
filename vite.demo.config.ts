import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Standalone demo build (Vite). `pnpm build:demo` emits a static site to
// dist-demo/ that can be served by any static host or the provided Dockerfile.
export default defineConfig({
  root: resolve(__dirname, 'demo'),
  base: './',
  plugins: [react()],
  build: {
    outDir: resolve(__dirname, 'dist-demo'),
    emptyOutDir: true,
  },
});
