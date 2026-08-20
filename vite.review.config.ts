import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Framework-independent review contract build: ZERO React, TipTap, ProseMirror
// view, Yjs, network, credential, persistence, or model imports.
export default defineConfig({
  plugins: [
    dts({
      include: [
        'src/review',
        'src/documentEnvelope.ts',
        'src/documentEnvelopeLimits.ts',
        'src/documentEnvelopeCanonical.ts',
        'src/documentEnvelopeRevision.ts',
        'src/documentRevisionEvidence.ts',
        'src/documentTransitionEvidence.ts',
        'src/textPositionSelectorEvidence.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/review/index.ts'),
      name: 'InkspanReview',
      fileName: (format) =>
        format === 'es' ? 'cwl-review.js' : 'cwl-review.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
