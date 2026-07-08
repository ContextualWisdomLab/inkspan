/// <reference types="vitest/config" />
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';

// Library build: the full React editor. React/TipTap are externalized so the
// package stays embeddable without bundling a second React copy.
export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ['src'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/*.spec.ts'],
      rollupTypes: false,
      entryRoot: 'src',
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'CwlEditor',
      fileName: (format) =>
        format === 'es' ? 'cwl-editor.js' : 'cwl-editor.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        /^@tiptap\//,
        /^prosemirror-/,
      ],
    },
  },
});
