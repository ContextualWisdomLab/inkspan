import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Framework-neutral writing-diagnostic contract build: ZERO React, React DOM,
// TipTap editor UI/view, Yjs, provider, awareness, network, credential,
// persistence, naruon, contextual-orchestrator, email, or model imports.
// ProseMirror model appears only in erased TypeScript input types.
export default defineConfig({
  plugins: [
    dts({
      include: [
        'src/writing-diagnostics',
        'src/writingDiagnostics.ts',
        'src/writingDiagnosticProjection.ts',
        'src/textPositionSelectorEvidence.ts',
        'src/graphemeBoundary.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/writing-diagnostics/index.ts'),
      name: 'InkspanWritingDiagnostics',
      fileName: (format) =>
        format === 'es'
          ? 'cwl-writing-diagnostics.js'
          : 'cwl-writing-diagnostics.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
