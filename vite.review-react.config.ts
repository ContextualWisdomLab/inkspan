import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Build the controlled React presentation adapter separately from the
 * framework-free review contract. React remains host-supplied peer authority.
 */
export default defineConfig({
  plugins: [
    react(),
    dts({
      include: [
        'src/review-react',
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
      entry: resolve(__dirname, 'src/review-react/index.tsx'),
      name: 'InkspanReviewReact',
      fileName: (format) =>
        format === 'es' ? 'cwl-review-react.js' : 'cwl-review-react.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: { interop: 'auto' },
    },
  },
});
