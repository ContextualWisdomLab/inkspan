import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// React-free review contract build: deterministic revision/selector evidence only.
// No React UI, network, credential, persistence, tenancy, model, or provider authority.
export default defineConfig({
  plugins: [
    dts({
      include: [
        'src/review',
        'src/documentEnvelopeRevision.ts',
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
