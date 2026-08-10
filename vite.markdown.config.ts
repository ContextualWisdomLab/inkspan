import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Headless deterministic serializer build: bundle the conversion dependencies so
// consumers can use the public subpath without importing the React/TipTap graph.
export default defineConfig({
  plugins: [
    dts({
      include: [
        'src/markdown',
        'src/policy/safeLinkPolicy.ts',
        'src/policy/inlineImagePolicy.ts',
        'src/converter/base64.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/markdown/index.ts'),
      name: 'InkspanMarkdown',
      fileName: (format) =>
        format === 'es' ? 'cwl-markdown.js' : 'cwl-markdown.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
