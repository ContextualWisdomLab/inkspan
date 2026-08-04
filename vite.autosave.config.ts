import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

// Framework-independent autosave coordination build: ZERO React, TipTap,
// ProseMirror, or Yjs runtime imports. Hosts retain transport, authorization,
// tenant isolation, persistence, credentials, migration, retention, audit, and
// durable compare-and-swap policy.
export default defineConfig({
  plugins: [
    dts({
      include: ['src/autosave/package.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/autosave/package.ts'),
      name: 'InkspanAutosave',
      fileName: (format) =>
        format === 'es' ? 'cwl-autosave.js' : 'cwl-autosave.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
  },
});
