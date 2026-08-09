import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Framework-independent persistence build: ZERO React, TipTap, ProseMirror, or
// Yjs runtime imports. This entrypoint is intended for servers, workers, queues,
// migration jobs, storage adapters, and other non-editor processes.
export default defineConfig({
  plugins: [
    dts({
      include: [
        'src/revision-evidence',
        'src/documentEnvelope.ts',
        'src/documentEnvelopeCanonical.ts',
        'src/documentEnvelopeRevision.ts',
        'src/documentRevisionEvidence.ts',
        'src/documentTransitionEvidence.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/revision-evidence/index.ts'),
      name: 'InkspanRevisionEvidence',
      fileName: (format) =>
        format === 'es'
          ? 'cwl-revision-evidence.js'
          : 'cwl-revision-evidence.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
