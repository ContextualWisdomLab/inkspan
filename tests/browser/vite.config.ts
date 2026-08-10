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
      'inkspan-browser-under-test': packageEntry,
    },
  },
});
