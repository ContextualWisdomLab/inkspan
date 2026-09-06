import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

const nodeRequire = createRequire(import.meta.url);
const turndownStandaloneEntry = nodeRequire.resolve('turndown/lib/turndown.es.js');
const dominoStandaloneEntry = createRequire(turndownStandaloneEntry).resolve(
  '@mixmark-io/domino',
);
const turndownAmbientWindowProbe =
  /\bvar root = typeof window !== ['"]undefined['"] \? window : \{\};/u;

// Turndown's standalone build still probes the ambient `window` binding during
// module evaluation before it decides whether to use its bundled Domino parser.
// A hostile accessor-backed global therefore executes caller code merely by
// importing Inkspan's framework-free `/markdown` subpath. Replace only that
// exact upstream probe with the empty root that selects the already-pinned,
// non-fetching Domino path. Fail the build if the pinned upstream source shape
// changes so a dependency update cannot silently restore ambient authority.
const boundTurndownStandaloneParser = {
  name: 'inkspan-bound-turndown-standalone-parser',
  enforce: 'pre' as const,
  transform(source: string, id: string) {
    if (id.split('?', 1)[0] !== turndownStandaloneEntry) return null;
    const matches = source.match(new RegExp(turndownAmbientWindowProbe.source, 'gu'));
    if (matches?.length !== 1) {
      throw new Error(
        `Expected exactly one Turndown ambient window probe, found ${matches?.length ?? 0}.`,
      );
    }
    return {
      code: source.replace(turndownAmbientWindowProbe, 'var root = {};'),
      map: null,
    };
  },
};

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
    boundTurndownStandaloneParser,
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
