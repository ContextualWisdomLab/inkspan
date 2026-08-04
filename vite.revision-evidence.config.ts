import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Standalone revision-evidence build.
 *
 * The entry bundles Inkspan's strict envelope, canonicalization, and SHA-256
 * orchestration modules so server, worker, migration, queue, and storage hosts
 * do not evaluate React, TipTap, collaboration, transport, or provider code.
 */
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/revision-evidence/index.ts'),
      name: 'CwlRevisionEvidence',
      fileName: (format) =>
        format === 'es'
          ? 'cwl-revision-evidence.js'
          : 'cwl-revision-evidence.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
