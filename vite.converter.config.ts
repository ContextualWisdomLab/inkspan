import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Standalone converter build: framework-agnostic, ZERO React/TipTap. This is
// the artifact the naruon / DOM-understanding pipeline can consume on its own.
export default defineConfig({
  plugins: [
    dts({
      include: ['src/converter'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/converter/index.ts'),
      name: 'CwlConverter',
      fileName: (format) =>
        format === 'es' ? 'cwl-converter.js' : 'cwl-converter.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
