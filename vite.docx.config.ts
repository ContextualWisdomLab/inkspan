import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Standalone DOCX importer build: deterministic local parsing with no React,
// TipTap, network, credential, persistence, host, or model runtime authority.
export default defineConfig({
  plugins: [
    dts({
      include: ['src/docx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/docx/index.ts'),
      name: 'InkspanDocx',
      fileName: (format) =>
        format === 'es' ? 'cwl-docx.js' : 'cwl-docx.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
