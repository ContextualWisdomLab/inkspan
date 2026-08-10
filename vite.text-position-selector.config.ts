import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// React-free selector projection build: ZERO React, React DOM, TipTap UI/view,
// Yjs, network, credential, persistence, naruon, orchestrator, or model imports.
// ProseMirror model/state appear only in erased TypeScript input types.
export default defineConfig({
  plugins: [
    dts({
      include: [
        'src/text-position-selector',
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
      entry: resolve(__dirname, 'src/text-position-selector/index.ts'),
      name: 'InkspanTextPositionSelector',
      fileName: (format) =>
        format === 'es'
          ? 'cwl-text-position-selector.js'
          : 'cwl-text-position-selector.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
