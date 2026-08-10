import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const nodeRequire = createRequire(import.meta.url);
const turndownStandaloneEntry = nodeRequire.resolve('turndown/lib/turndown.es.js');
const dominoStandaloneEntry = createRequire(turndownStandaloneEntry).resolve(
  '@mixmark-io/domino',
);

// Headless deterministic serializer build: bundle the conversion dependencies so
// consumers can use the public subpath without importing the React/TipTap graph.
// Turndown publishes separate standalone and browser builds and its package
// `browser` map replaces both the entry and Domino parser for browser-oriented
// bundlers. This public subpath must work in browserless Node as well as browsers,
// so pin the upstream standalone entry and its non-fetching Domino parser by
// absolute path. Vite documents absolute paths as the required form for
// file-system aliases.
export default defineConfig({
  resolve: {
    alias: [
      { find: /^turndown$/u, replacement: turndownStandaloneEntry },
      { find: /^@mixmark-io\/domino$/u, replacement: dominoStandaloneEntry },
    ],
    mainFields: ['module', 'jsnext:main', 'jsnext', 'main'],
  },
  plugins: [
    dts({
      include: [
        'src/markdown',
        'src/policy/safeLinkPolicy.ts',
        'src/policy/inlineImagePolicy.ts',
        'src/converter/base64.ts',
        'src/types/turndown-plugin-gfm.d.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    commonjsOptions: {
      // Turndown's standalone ESM surface crosses into CommonJS-only Domino
      // parser code. Transform require() in mixed modules so both emitted ESM
      // and CommonJS packages keep that parser inside the bounded bundle.
      transformMixedEsModules: true,
    },
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
