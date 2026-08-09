import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Framework-independent envelope-identity build: ZERO React, TipTap UI,
// ProseMirror view, Yjs, network, credential, persistence, or model imports.
export default defineConfig({
  plugins: [
    dts({
      include: [
        'src/envelope-identity',
        'src/documentEnvelopeIdentity.ts',
        'src/documentEnvelope.ts',
        'src/jsonObjectNameScanner.ts',
      ],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/envelope-identity/index.ts'),
      name: 'InkspanEnvelopeIdentity',
      fileName: (format) =>
        format === 'es'
          ? 'cwl-envelope-identity.js'
          : 'cwl-envelope-identity.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
