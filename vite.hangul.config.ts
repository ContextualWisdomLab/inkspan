import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/** Build the framework-neutral HWP/HWPX bridge as an isolated package subpath. */
export default defineConfig({
  plugins: [
    dts({
      include: ['src/hangul'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/hangul/index.ts'),
      name: 'InkspanHangul',
      fileName: (format) =>
        format === 'es' ? 'cwl-hangul.js' : 'cwl-hangul.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
