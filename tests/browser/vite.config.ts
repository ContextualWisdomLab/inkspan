import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vite';

const browserDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(browserDirectory, '../..');
const configuredPackageEntry = process.env.INKSPAN_BROWSER_PACKAGE_ENTRY?.trim();
const packageEntry = configuredPackageEntry
  ? resolve(configuredPackageEntry)
  : resolve(repositoryRoot, 'src/index.ts');

export default defineConfig({
  resolve: {
    alias: {
      '/dist/cwl-editor.css': configuredPackageEntry
        ? resolve(dirname(packageEntry), 'cwl-editor.css')
        : resolve(repositoryRoot, 'dist/cwl-editor.css'),
      'inkspan-browser-under-test': packageEntry,
      'inkspan-collaboration-under-test': configuredPackageEntry
        ? resolve(dirname(packageEntry), 'cwl-collaboration.js')
        : resolve(repositoryRoot, 'src/collaboration/index.ts'),
      'inkspan-autosave-under-test': configuredPackageEntry
        ? resolve(dirname(packageEntry), 'cwl-autosave.js')
        : resolve(repositoryRoot, 'src/autosave/package.ts'),
    },
  },
});
