import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Optional collaboration build. It is emitted as a separate entrypoint so
 * standalone editor consumers never bundle Yjs or collaboration bindings.
 */
export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/collaboration/index.ts'),
      name: 'CwlCollaboration',
      fileName: (format) =>
        format === 'es' ? 'cwl-collaboration.js' : 'cwl-collaboration.cjs',
      formats: ['es', 'cjs'],
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'yjs',
        'y-prosemirror',
        /^@tiptap\//,
        /^prosemirror-/,
      ],
      output: {
        // Match the editor entrypoint's CommonJS default-export handling for
        // TipTap while retaining native interop for Yjs and host dependencies.
        interop: 'auto',
      },
    },
  },
});
