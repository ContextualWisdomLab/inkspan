import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Framework-neutral spreadsheet conversion build. The implementation imports
// TipTap only as a TypeScript type, so the emitted runtime bundle carries no
// React, TipTap, network, credential, persistence, or model authority.
export default defineConfig({
  plugins: [
    dts({
      include: ['src/spreadsheet'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/spreadsheet/index.ts'),
      name: 'InkspanSpreadsheet',
      fileName: (format) =>
        format === 'es' ? 'cwl-spreadsheet.js' : 'cwl-spreadsheet.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
